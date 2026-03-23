# 표준 라이브러리
from typing import List

# 서드파티 라이브러리
from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.orm import Session

# 로컬 애플리케이션
from app.db.session import get_db
from app.core.deps import require_roles
from app.models.admin import Admin
from app.models.pause import Pause
from app.schemas.activity_log import ActivityAction, ActivityTargetType
from app.schemas.common import PaginatedResponse, ResponseModel
from app.schemas.order_item import (
    OrderItemAddressUpdate,
    OrderItemAddressUpdateResponse,
    OrderItemCancelRequest,
    OrderItemCreate,
    OrderItemDetailResponse,
    OrderItemLastSendIssueUpdate,
    OrderItemPostalCode13113Query,
    OrderItemResponse,
    OrderItemUpdate,
    PauseInfo,
    SubscriptionBatchExtendRequest,
    SubscriptionBatchExtendResponse,
    SubscriptionChangePeriodRequest,
    SubscriptionExtendRequest,
    SubscriptionShortenCalculateRequest,
    SubscriptionShortenCalculateResponse,
    SubscriptionShortenConfirmRequest,
)
from app.services import activity_log_service, order_item_service, order_service

router = APIRouter(tags=["주문 품목"])

require_admin = require_roles(["SUPER_ADMIN", "ADMIN"])
require_manager = require_roles(["SUPER_ADMIN", "ADMIN", "MANAGER"])


def _build_detail_response(db: Session, order_item) -> OrderItemDetailResponse:
    """OrderItem ORM → OrderItemDetailResponse (비삭제 휴지 포함)"""
    response = OrderItemDetailResponse.model_validate(order_item)
    pauses = order_item_service.get_non_deleted_pauses(db, order_item.order_item_id)
    response.pauses = [PauseInfo.model_validate(p) for p in pauses]
    return response


# ── 조회 ──────────────────────────────────────────────────────────────────────

@router.get(
    "/order-items/postal-code/13113",
    response_model=PaginatedResponse[OrderItemResponse],
)
def list_by_postal_code_13113(
    query: OrderItemPostalCode13113Query = Depends(OrderItemPostalCode13113Query.as_query_params),
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_manager),
):
    """우편번호 13113 품목 목록"""
    items, total = order_item_service.list_postal_code_13113(db, query)
    total_pages = (total + query.limit - 1) // query.limit

    return PaginatedResponse(
        total=total,
        page=query.page,
        limit=query.limit,
        total_pages=total_pages,
        items=[OrderItemResponse.model_validate(i) for i in items],
    )


@router.get(
    "/orders/{order_id}/items",
    response_model=ResponseModel[List[OrderItemDetailResponse]],
)
def get_items_by_order(
    order_id: int,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_manager),
):
    """주문별 품목 목록 (휴지 정보 포함)"""
    order_service.get_order_by_id(db, order_id)  # 주문 존재 확인
    items = order_item_service.get_order_items_by_order(db, order_id)

    return ResponseModel(
        message="주문별 품목 목록을 조회했습니다.",
        data=[_build_detail_response(db, item) for item in items],
    )


@router.get(
    "/order-items/{order_item_id}",
    response_model=ResponseModel[OrderItemDetailResponse],
)
def get_order_item(
    order_item_id: int,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_manager),
):
    """품목 상세 조회 (휴지 정보 포함)"""
    order_item = order_item_service.get_order_item_by_id(db, order_item_id)

    return ResponseModel(
        message="주문 품목 정보를 조회했습니다.",
        data=_build_detail_response(db, order_item),
    )


# ── 독립 품목 추가 ────────────────────────────────────────────────────────────

@router.post(
    "/order-items",
    response_model=ResponseModel[OrderItemDetailResponse],
    status_code=status.HTTP_201_CREATED,
)
def create_order_item(
    item_in: OrderItemCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_admin),
):
    """독립 품목 추가 (이미 존재하는 주문에 품목 직접 추가)"""
    item = order_item_service.create_order_item(db, item_in)

    # 주문 총액 재계산
    order = order_service.get_order_by_id(db, item.order_id)
    order_service.recalculate_totals(db, order)

    activity_log_service.create_log(
        db=db,
        action=ActivityAction.CREATE,
        target_type=ActivityTargetType.ORDER_ITEM,
        admin_id=current_admin.admin_id,
        admin_name=current_admin.admin_name,
        target_id=item.order_item_id,
        target_name=item.product_name,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        details={"order_id": item.order_id, "product_code": item.product_code},
    )

    return ResponseModel(
        message="주문 품목이 추가되었습니다.",
        data=_build_detail_response(db, item),
    )


# ── 품목 수정 ─────────────────────────────────────────────────────────────────

@router.put(
    "/order-items/{order_item_id}",
    response_model=ResponseModel[OrderItemDetailResponse],
)
def update_order_item(
    order_item_id: int,
    item_in: OrderItemUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_admin),
):
    """품목 수정"""
    order_item = order_item_service.get_active_order_item_by_id(db, order_item_id)
    before = item_in.model_dump(exclude_unset=True)

    updated = order_item_service.update_order_item(db, order_item, item_in)

    # 금액/수량 관련 필드 변경 시 주문 총액 재계산
    if any(f in before for f in ("sale_price", "order_num", "refund_amount")):
        order = order_service.get_order_by_id(db, updated.order_id)
        order_service.recalculate_totals(db, order)

    activity_log_service.create_log(
        db=db,
        action=ActivityAction.UPDATE,
        target_type=ActivityTargetType.ORDER_ITEM,
        admin_id=current_admin.admin_id,
        admin_name=current_admin.admin_name,
        target_id=order_item_id,
        target_name=updated.product_name,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        details={"updated_fields": before},
    )

    return ResponseModel(
        message="주문 품목이 수정되었습니다.",
        data=_build_detail_response(db, updated),
    )


# ── 배송지 변경 ───────────────────────────────────────────────────────────────

@router.patch(
    "/order-items/{order_item_id}/address",
    response_model=ResponseModel[OrderItemAddressUpdateResponse],
)
def update_order_item_address(
    order_item_id: int,
    address_in: OrderItemAddressUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_admin),
):
    """품목 배송지 변경"""
    order_item = order_item_service.get_active_order_item_by_id(db, order_item_id)
    result = order_item_service.update_address(db, order_item, address_in)

    if result.can_change:
        activity_log_service.create_log(
            db=db,
            action=ActivityAction.UPDATE,
            target_type=ActivityTargetType.ORDER_ITEM,
            admin_id=current_admin.admin_id,
            admin_name=current_admin.admin_name,
            target_id=order_item_id,
            target_name=order_item.product_name,
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent"),
            details={"action": "배송지 변경", "new_address_id": result.changed_address_id},
        )

    return ResponseModel(
        message=result.message,
        data=result,
    )


# ── 구독 연장 ─────────────────────────────────────────────────────────────────

@router.post(
    "/order-items/{order_item_id}/extend",
    response_model=ResponseModel[OrderItemDetailResponse],
)
def extend_subscription(
    order_item_id: int,
    extend_in: SubscriptionExtendRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_admin),
):
    """구독 기간 연장 (단건, YEARLY만)"""
    order_item = order_item_service.get_active_order_item_by_id(db, order_item_id)
    prev_end = order_item.final_subscribe_end_issue

    updated = order_item_service.extend_subscription(db, order_item, extend_in)

    activity_log_service.create_log(
        db=db,
        action=ActivityAction.UPDATE,
        target_type=ActivityTargetType.ORDER_ITEM,
        admin_id=current_admin.admin_id,
        admin_name=current_admin.admin_name,
        target_id=order_item_id,
        target_name=updated.product_name,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        details={
            "action": "구독 연장",
            "prev_end_issue": prev_end,
            "new_end_issue": updated.final_subscribe_end_issue,
            "reason": extend_in.reason,
        },
    )

    return ResponseModel(
        message="구독 기간이 연장되었습니다.",
        data=_build_detail_response(db, updated),
    )


@router.post(
    "/order-items/batch/extend",
    response_model=ResponseModel[SubscriptionBatchExtendResponse],
)
def batch_extend_subscription(
    batch_in: SubscriptionBatchExtendRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_admin),
):
    """구독 기간 연장 (다건 일괄, YEARLY만)"""
    result = order_item_service.batch_extend_subscription(db, batch_in)

    activity_log_service.create_log(
        db=db,
        action=ActivityAction.UPDATE,
        target_type=ActivityTargetType.ORDER_ITEM,
        admin_id=current_admin.admin_id,
        admin_name=current_admin.admin_name,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        details={
            "action": "구독 일괄 연장",
            "extend_months": batch_in.extend_months,
            "reason": batch_in.reason,
            "total": result.total_requested,
            "success": result.success_count,
            "fail": result.fail_count,
        },
    )

    return ResponseModel(
        message=f"일괄 연장 완료: 성공 {result.success_count}건, 실패 {result.fail_count}건",
        data=result,
    )


# ── 구독 기간 이동 ────────────────────────────────────────────────────────────

@router.post(
    "/order-items/{order_item_id}/change-period",
    response_model=ResponseModel[OrderItemDetailResponse],
)
def change_period(
    order_item_id: int,
    change_in: SubscriptionChangePeriodRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_admin),
):
    """구독 기간 이동 (앞당기기/밀기, YEARLY만)"""
    order_item = order_item_service.get_active_order_item_by_id(db, order_item_id)
    prev_start = order_item.final_subscribe_start_issue
    prev_end = order_item.final_subscribe_end_issue

    updated = order_item_service.change_period(db, order_item, change_in)

    activity_log_service.create_log(
        db=db,
        action=ActivityAction.UPDATE,
        target_type=ActivityTargetType.ORDER_ITEM,
        admin_id=current_admin.admin_id,
        admin_name=current_admin.admin_name,
        target_id=order_item_id,
        target_name=updated.product_name,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        details={
            "action": "구독 기간 이동",
            "before": {"start": prev_start, "end": prev_end},
            "after": {
                "start": updated.final_subscribe_start_issue,
                "end": updated.final_subscribe_end_issue,
            },
        },
    )

    return ResponseModel(
        message="구독 기간이 이동되었습니다.",
        data=_build_detail_response(db, updated),
    )


# ── 구독 단축 ─────────────────────────────────────────────────────────────────

@router.post(
    "/order-items/{order_item_id}/shorten/calculate",
    response_model=ResponseModel[SubscriptionShortenCalculateResponse],
)
def shorten_calculate(
    order_item_id: int,
    shorten_in: SubscriptionShortenCalculateRequest,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_manager),
):
    """구독 기간 단축 — 환불액 미리 계산 (DB 변경 없음)"""
    order_item = order_item_service.get_active_order_item_by_id(db, order_item_id)
    result = order_item_service.shorten_calculate(order_item, shorten_in)

    return ResponseModel(
        message="환불액이 계산되었습니다.",
        data=result,
    )


@router.post(
    "/order-items/{order_item_id}/shorten/confirm",
    response_model=ResponseModel[OrderItemDetailResponse],
)
def shorten_confirm(
    order_item_id: int,
    confirm_in: SubscriptionShortenConfirmRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_admin),
):
    """구독 기간 단축 — 최종 확정 및 저장"""
    order_item = order_item_service.get_active_order_item_by_id(db, order_item_id)
    prev_end = order_item.final_subscribe_end_issue

    updated = order_item_service.shorten_confirm(db, order_item, confirm_in)

    activity_log_service.create_log(
        db=db,
        action=ActivityAction.UPDATE,
        target_type=ActivityTargetType.ORDER_ITEM,
        admin_id=current_admin.admin_id,
        admin_name=current_admin.admin_name,
        target_id=order_item_id,
        target_name=updated.product_name,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        details={
            "action": "구독 단축",
            "prev_end_issue": prev_end,
            "new_end_issue": updated.final_subscribe_end_issue,
            "refund_amount": updated.refund_amount,
        },
    )

    return ResponseModel(
        message="구독 기간이 단축되었습니다.",
        data=_build_detail_response(db, updated),
    )


# ── 품목 취소 ─────────────────────────────────────────────────────────────────

@router.post(
    "/order-items/{order_item_id}/cancel",
    response_model=ResponseModel[OrderItemResponse],
)
def cancel_order_item(
    order_item_id: int,
    cancel_in: OrderItemCancelRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_admin),
):
    """품목 취소 (MONTHLY 배송 후 불가, YEARLY 잔여 환불 자동 계산)"""
    order_item = order_item_service.get_active_order_item_by_id(db, order_item_id)
    order_id = order_item.order_id

    cancelled = order_item_service.cancel_order_item(db, order_item, cancel_in)

    # 주문 총액 재계산
    order = order_service.get_order_by_id(db, order_id)
    order_service.recalculate_totals(db, order)

    activity_log_service.create_log(
        db=db,
        action=ActivityAction.CANCEL,
        target_type=ActivityTargetType.ORDER_ITEM,
        admin_id=current_admin.admin_id,
        admin_name=current_admin.admin_name,
        target_id=order_item_id,
        target_name=cancelled.product_name,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        details={
            "reason": cancel_in.admin_memo,
            "refund_amount": cancelled.refund_amount,
        },
    )

    return ResponseModel(
        message="주문 품목이 취소되었습니다.",
        data=OrderItemResponse.model_validate(cancelled),
    )


# ── 마지막 발송 호 업데이트 ───────────────────────────────────────────────────

@router.patch(
    "/order-items/{order_item_id}/last-send-issue",
    response_model=ResponseModel[OrderItemResponse],
)
def update_last_send_issue(
    order_item_id: int,
    body: OrderItemLastSendIssueUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_admin),
):
    """마지막 발송 호 업데이트"""
    order_item = order_item_service.get_active_order_item_by_id(db, order_item_id)
    prev_issue = order_item.last_send_issue

    updated = order_item_service.update_last_send_issue(db, order_item, body.last_send_issue)

    activity_log_service.create_log(
        db=db,
        action=ActivityAction.UPDATE,
        target_type=ActivityTargetType.ORDER_ITEM,
        admin_id=current_admin.admin_id,
        admin_name=current_admin.admin_name,
        target_id=order_item_id,
        target_name=updated.product_name,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        details={
            "action": "마지막 발송 호 업데이트",
            "prev_issue": prev_issue,
            "new_issue": body.last_send_issue,
        },
    )

    return ResponseModel(
        message="마지막 발송 호가 업데이트되었습니다.",
        data=OrderItemResponse.model_validate(updated),
    )
