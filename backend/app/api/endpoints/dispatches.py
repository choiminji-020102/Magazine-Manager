# 서드파티 라이브러리
from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.orm import Session

# 로컬 애플리케이션
from app.db.session import get_db
from app.core.deps import require_roles
from app.models.admin import Admin
from app.models.send import Send
from app.models.send_item import SendItem
from app.schemas.activity_log import ActivityAction, ActivityTargetType
from app.schemas.common import ResponseModel
from app.schemas.dispatch import (
    DispatchSummaryResponse,
    PaidNotPreparedCountResponse,
    RegeneratePreparingSendsRequest,
    RegeneratePreparingSendsResponse,
    TransitionToDeliveredRequest,
    TransitionToDeliveredResponse,
)
from app.services import activity_log_service, dispatch_grouping_service, order_item_service, send_service

router = APIRouter(tags=["발송 처리"])

require_admin = require_roles(["SUPER_ADMIN", "ADMIN"])
require_manager = require_roles(["SUPER_ADMIN", "ADMIN", "MANAGER"])


# ── 조회 ──────────────────────────────────────────────────────────────────────

@router.get(
    "/dispatches/summary",
    response_model=ResponseModel[DispatchSummaryResponse],
)
def get_dispatch_summary(
    issue: str,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_manager),
):
    """특정 호(issue)의 발송 현황 요약 조회"""
    # 총 발송 대상: 해당 호 구독 중인 모든 OrderItem (YEARLY+MONTHLY, 취소 제외)
    all_targets = order_item_service.find_subscription_targets(db=db, issue=issue)
    total_target_count = len(all_targets)

    # 이미 발송된 OrderItem: last_send_issue == issue (발송 처리 완료된 것)
    from sqlalchemy import func
    dispatched_ids = set(
        row[0] for row in db.query(SendItem.order_item_id)
        .join(Send, SendItem.send_id == Send.send_id)
        .filter(
            SendItem.issue == issue,
            SendItem.cancelled_at.is_(None),
            Send.cancelled_at.is_(None),
        )
        .distinct()
        .all()
    )
    dispatched_count = len(dispatched_ids)
    pending_count = total_target_count - dispatched_count

    # 상품별 현황 집계
    product_map: dict = {}
    for t in all_targets:
        code = t.product_code
        name = t.product_name
        if code not in product_map:
            product_map[code] = {"product_code": code, "product_name": name, "total": 0, "dispatched": 0, "pending": 0}
        product_map[code]["total"] += 1
        if t.order_item_id in dispatched_ids:
            product_map[code]["dispatched"] += 1
        else:
            product_map[code]["pending"] += 1

    # Send 상태별 카운트 (해당 호의 SendItem을 가진 Send)
    status_rows = (
        db.query(Send.send_status, func.count(Send.send_id))
        .join(SendItem, Send.send_id == SendItem.send_id)
        .filter(
            SendItem.issue == issue,
            SendItem.cancelled_at.is_(None),
        )
        .group_by(Send.send_status)
        .all()
    )
    by_status = {row[0]: row[1] for row in status_rows}

    return ResponseModel(
        message="발송 현황 요약을 조회했습니다.",
        data=DispatchSummaryResponse(
            issue=issue,
            total_target_count=total_target_count,
            dispatched_count=dispatched_count,
            pending_count=pending_count,
            by_product=list(product_map.values()),
            by_status=by_status,
        ),
    )


# ── 발송 처리 ──────────────────────────────────────────────────────────────────

@router.post(
    "/dispatches/regenerate-preparing-sends",
    response_model=ResponseModel[RegeneratePreparingSendsResponse],
    status_code=status.HTTP_200_OK,
)
def regenerate_preparing_sends_endpoint(
    req: RegeneratePreparingSendsRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_admin),
):
    """[발송 생성] — PREPARING Send 를 scope 에 따라 일괄 재계산. 각 탭은 자기 영역만 처리 (격리).

    - scope=monthly  : 단품 (활성 vipN 모두 false). issue 무관
    - scope=yearly   : 정기구독 (활성 vipN 모두 false). issue 필수
    - scope=vip1..6  : 해당 VIP 슬롯 (Address.vipN=true). 정기+단품 통합 그룹핑.
                       issue 필수 (정기 SendItem 처리용). 슬롯 비활성이면 400.
                       country_code 필터 없음 — 해외 포함 모두 처리

    각 scope 의 delete 는 자기 영역의 PREPARING Send 만 삭제.
    DELIVERED/CANCELLED Send 는 모든 scope 에서 절대 건드리지 않음.
    """
    deleted_count, created_count = send_service.regenerate_preparing_sends(
        db=db,
        scope=req.scope,
        issue=req.issue,
    )

    db.commit()

    activity_log_service.create_log(
        db=db,
        action=ActivityAction.DISPATCH,
        target_type=ActivityTargetType.SEND,
        admin_id=current_admin.admin_id,
        admin_name=current_admin.admin_name,
        target_id=None,
        target_name=f"[발송 생성] scope={req.scope}" + (f" / {req.issue}호" if req.issue else ""),
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        details={
            "scope": req.scope,
            "issue": req.issue,
            "deleted_count": deleted_count,
            "created_count": created_count,
        },
    )

    return ResponseModel(
        message="PREPARING Send 재계산 완료",
        data=RegeneratePreparingSendsResponse(
            scope=req.scope,
            issue=req.issue,
            deleted_count=deleted_count,
            created_count=created_count,
        ),
    )


@router.post(
    "/dispatches/transition-to-delivered",
    response_model=ResponseModel[TransitionToDeliveredResponse],
    status_code=status.HTTP_200_OK,
)
def transition_to_delivered_endpoint(
    req: TransitionToDeliveredRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_admin),
):
    """선택된 PREPARING Send들을 DELIVERED로 일괄 전환 ("보냈다 = 끝", SHIPPING 단계 없음).

    send_method, courier_company는 항상 필수.
    tracking_no는 박스(Send)마다 개별 입력 (모두 필수).
    한 건이라도 PREPARING이 아니면 전체 거부 (all-or-nothing).
    """
    sends_input = [(s.send_id, s.tracking_no) for s in req.sends]

    transitioned_count = send_service.transition_sends_to_delivered_batch(
        db=db,
        sends_input=sends_input,
        send_method=req.send_method,
        courier_company=req.courier_company,
    )

    db.commit()

    activity_log_service.create_log(
        db=db,
        action=ActivityAction.DISPATCH,
        target_type=ActivityTargetType.SEND,
        admin_id=current_admin.admin_id,
        admin_name=current_admin.admin_name,
        target_id=None,
        target_name=f"[배송완료 처리] {transitioned_count}건",
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        details={
            "send_method": req.send_method,
            "courier_company": req.courier_company,
            "sends": [{"send_id": s.send_id, "tracking_no": s.tracking_no} for s in req.sends],
            "transitioned_count": transitioned_count,
        },
    )

    return ResponseModel(
        message=f"배송완료 처리 완료: {transitioned_count}건",
        data=TransitionToDeliveredResponse(transitioned_count=transitioned_count),
    )


@router.get(
    "/dispatches/paid-not-prepared-count",
    response_model=ResponseModel[PaidNotPreparedCountResponse],
)
def paid_not_prepared_count_endpoint(
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_manager),
):
    """PAID지만 PREPARING에 안 들어간 OrderItem 카운트 (PreparingSendListPage 알림 배너용).

    [발송 생성]을 다시 눌러야 PREPARING에 추가될 OrderItem이 몇 개인지 알려준다.
    """
    yearly, monthly = dispatch_grouping_service.count_paid_not_prepared(db)
    return ResponseModel(
        data=PaidNotPreparedCountResponse(
            monthly_count=monthly,
            yearly_count=yearly,
            total_count=monthly + yearly,
        ),
    )
