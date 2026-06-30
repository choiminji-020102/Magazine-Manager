# 표준 라이브러리
from typing import List, Tuple

# 서드파티 라이브러리
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

# 로컬 애플리케이션
from app.core.utils import calculate_subscribe_end_issue
from app.services.order_item_service import recalculate_final_end_issue
from app.crud import pause as pause_crud
from app.models.customer import Customer
from app.models.order import Order
from app.models.order_item import OrderItem
from app.models.pause import Pause
from app.schemas.pause import (
    PauseBatchCreate,
    PauseBatchCreateResponse,
    PauseCreate,
    PauseListQuery,
    PauseUpdate,
)


# ── 헬퍼 ──────────────────────────────────────────────────────────────────────

def _add_month(issue: str) -> str:
    """호(YYYYMM)에 1개월 추가"""
    return calculate_subscribe_end_issue(issue, 2)



def _validate_pause_issue(order_item: OrderItem, pause_issue: str) -> None:
    """휴지 호 유효성 검증"""
    start = order_item.final_subscribe_start_issue
    end = order_item.final_subscribe_end_issue

    if pause_issue < start or pause_issue > end:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"휴지 호({pause_issue})는 구독 기간({start}~{end}) 내에 있어야 합니다.",
        )

    if order_item.last_send_issue and pause_issue <= order_item.last_send_issue:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"이미 발송된 호({pause_issue})는 휴지할 수 없습니다.",
        )


# ── 조회 ──────────────────────────────────────────────────────────────────────

def get_pause_by_id(db: Session, pause_id: int) -> Pause:
    return pause_crud.read_pause_by_id(db=db, pause_id=pause_id)


def get_pauses_by_order_item(db: Session, order_item_id: int) -> List[Pause]:
    return pause_crud.read_pauses_by_order_item_id(db=db, order_item_id=order_item_id)


def list_pauses(db: Session, query: PauseListQuery) -> Tuple[List[dict], int]:
    return pause_crud.list_pauses(
        db=db,
        page=query.page,
        limit=query.limit,
        order_item_id=query.order_item_id,
        pause_issue=query.pause_issue,
        admin_id=query.admin_id,
        sort_by=query.sort_by,
        sort_order=query.sort_order,
    )


def get_pauses_by_issue(db: Session, issue: str) -> List[dict]:
    """특정 호의 휴지 목록 (고객/상품 정보 포함)"""
    results = (
        db.query(
            Pause,
            OrderItem.product_name,
            Order.customer_id,
            Order.order_channel,
            Customer.customer_name,
            Customer.customer_phone,
        )
        .join(OrderItem, Pause.order_item_id == OrderItem.order_item_id)
        .join(Order, OrderItem.order_id == Order.order_id)
        .join(Customer, Order.customer_id == Customer.customer_id)
        .filter(Pause.pause_issue == issue, Pause.deleted_at.is_(None))
        .all()
    )

    return [
        {
            "pause_id": p.pause_id,
            "order_item_id": p.order_item_id,
            "pause_issue": p.pause_issue,
            "reason": p.reason,
            "admin_id": p.admin_id,
            "is_deleted": p.is_deleted,
            "created_at": p.created_at,
            "updated_at": p.updated_at,
            "deleted_at": p.deleted_at,
            "product_name": product_name,
            "customer_id": customer_id,
            "order_channel": order_channel,
            "customer_name": customer_name,
            "customer_phone": customer_phone,
        }
        for p, product_name, customer_id, order_channel, customer_name, customer_phone in results
    ]


# ── 생성 ──────────────────────────────────────────────────────────────────────

def create_pause(
    db: Session,
    order_item: OrderItem,
    pause_in: PauseCreate,
    admin_id: int,
) -> Pause:
    """단건 휴지 생성 + final_subscribe_end_issue +1개월"""
    if order_item.product_kind != "YEARLY":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="YEARLY 상품만 휴지를 등록할 수 있습니다.",
        )

    _validate_pause_issue(order_item, pause_in.pause_issue)

    if pause_crud.check_duplicate_pause(db, order_item.order_item_id, pause_in.pause_issue):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="해당 호에 이미 휴지가 등록되어 있습니다.",
        )

    pause = pause_crud.create_pause(
        db=db,
        order_item_id=order_item.order_item_id,
        pause_issue=pause_in.pause_issue,
        admin_id=admin_id,
        reason=pause_in.reason,
    )

    # 공식으로 final_end 재계산
    order_item.final_subscribe_end_issue = recalculate_final_end_issue(db, order_item)
    db.commit()
    db.refresh(pause)
    return pause


def batch_create_pause(
    db: Session,
    order_item: OrderItem,
    batch_in: PauseBatchCreate,
    admin_id: int,
) -> PauseBatchCreateResponse:
    """다건 휴지 일괄 생성 + final_subscribe_end_issue +N개월"""
    if order_item.product_kind != "YEARLY":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="YEARLY 상품만 휴지를 등록할 수 있습니다.",
        )

    if not batch_in.pause_issues:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="휴지 호 목록이 비어있습니다.",
        )

    prev_final_end = order_item.final_subscribe_end_issue

    for pause_issue in batch_in.pause_issues:
        _validate_pause_issue(order_item, pause_issue)

        if pause_crud.check_duplicate_pause(db, order_item.order_item_id, pause_issue):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"해당 호({pause_issue})에 이미 휴지가 등록되어 있습니다.",
            )

        pause_crud.create_pause(
            db=db,
            order_item_id=order_item.order_item_id,
            pause_issue=pause_issue,
            admin_id=admin_id,
            reason=batch_in.reason,
        )

    # 공식으로 final_end 재계산
    n = len(batch_in.pause_issues)
    order_item.final_subscribe_end_issue = recalculate_final_end_issue(db, order_item)
    db.commit()

    # 다음 발송 예정 호 계산 (last_send_issue 다음 호)
    next_send_issue = None
    if order_item.last_send_issue:
        next_send_issue = _add_month(order_item.last_send_issue)

    return PauseBatchCreateResponse(
        created_count=n,
        prev_final_end_issue=prev_final_end,
        new_final_end_issue=order_item.final_subscribe_end_issue,
        next_send_issue=next_send_issue,
    )


# ── 수정 ──────────────────────────────────────────────────────────────────────

def update_pause(db: Session, pause: Pause, pause_in: PauseUpdate) -> Pause:
    return pause_crud.update_pause(db=db, pause=pause, pause_in=pause_in)


# ── 삭제 / 복구 ───────────────────────────────────────────────────────────────

def delete_pause(db: Session, pause: Pause) -> Pause:
    """휴지 소프트 삭제 + final_subscribe_end_issue -1개월"""
    if pause.is_deleted:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="이미 삭제된 휴지입니다.",
        )

    order_item = db.query(OrderItem).filter(
        OrderItem.order_item_id == pause.order_item_id
    ).first()

    result = pause_crud.soft_delete_pause(db=db, pause=pause)

    if order_item:
        order_item.final_subscribe_end_issue = recalculate_final_end_issue(db, order_item)
        db.commit()

    return result
