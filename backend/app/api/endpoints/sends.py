# 표준 라이브러리
from typing import List

# 서드파티 라이브러리
from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

# 로컬 애플리케이션
from app.db.session import get_db
from app.core.deps import require_roles
from app.models.admin import Admin
from app.schemas.activity_log import ActivityAction, ActivityTargetType
from app.schemas.common import PaginatedResponse, ResponseModel
from app.schemas.send import (
    SendDetailResponse,
    SendListQuery,
    SendResendRequest,
    SendResponse,
    SendTrackingUpdate,
)
from app.schemas.send_item import SendItemResponse
from app.services import activity_log_service, order_service, send_service

router = APIRouter(tags=["발송"])

require_admin = require_roles(["SUPER_ADMIN", "ADMIN"])
require_manager = require_roles(["SUPER_ADMIN", "ADMIN", "MANAGER"])


# ── 조회 ──────────────────────────────────────────────────────────────────────

@router.get(
    "/sends",
    response_model=PaginatedResponse[SendResponse],
)
def list_sends(
    query: SendListQuery = Depends(SendListQuery.as_query_params),
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_manager),
):
    """발송 목록 조회"""
    items, total = send_service.list_sends(db, query)
    total_pages = (total + query.limit - 1) // query.limit

    return PaginatedResponse(
        total=total,
        page=query.page,
        limit=query.limit,
        total_pages=total_pages,
        items=[SendResponse.model_validate(s) for s in items],
    )


@router.get(
    "/orders/{order_id}/sends",
    response_model=ResponseModel[List[SendResponse]],
)
def get_sends_by_order(
    order_id: int,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_manager),
):
    """주문별 발송 목록"""
    order_service.get_order_by_id(db, order_id)  # 주문 존재 확인
    sends = send_service.get_sends_by_order(db, order_id)

    return ResponseModel(
        message="주문별 발송 목록을 조회했습니다.",
        data=[SendResponse.model_validate(s) for s in sends],
    )


@router.get(
    "/sends/{send_id}",
    response_model=ResponseModel[SendDetailResponse],
)
def get_send(
    send_id: int,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_manager),
):
    """발송 상세 조회 (품목 포함)"""
    send = send_service.get_send_by_id(db, send_id)
    items = send_service.get_send_items(db, send_id)

    response = SendDetailResponse.model_validate(send)
    response.items = [SendItemResponse.model_validate(i) for i in items]

    return ResponseModel(
        message="발송 정보를 조회했습니다.",
        data=response,
    )


# ── 수정 ──────────────────────────────────────────────────────────────────────

@router.patch(
    "/sends/{send_id}/tracking",
    response_model=ResponseModel[SendResponse],
)
def update_tracking(
    send_id: int,
    tracking_in: SendTrackingUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_admin),
):
    """DELIVERED Send의 운송장/배송업체/배송방법 수정 (필드만 수정, 상태 전환 X).

    Cafe24 동기화는 본 시스템이 자동으로 하지 않음 — 운영자가 Cafe24 관리자에서 별도로 변경.
    """
    send = send_service.get_send_by_id(db, send_id)
    before = {
        "tracking_no": send.tracking_no,
        "send_method": send.send_method,
        "courier_company": send.courier_company,
    }

    updated = send_service.update_tracking(
        db,
        send,
        tracking_no=tracking_in.tracking_no,
        send_method=tracking_in.send_method,
        courier_company=tracking_in.courier_company,
    )
    after = {
        "tracking_no": updated.tracking_no,
        "send_method": updated.send_method,
        "courier_company": updated.courier_company,
    }

    activity_log_service.create_log(
        db=db,
        action=ActivityAction.UPDATE,
        target_type=ActivityTargetType.SEND,
        admin_id=current_admin.admin_id,
        admin_name=current_admin.admin_name,
        target_id=send_id,
        target_name=send.recipient_name,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        details={"before": before, "after": after},
    )

    # 실제로 바뀐 필드만 메시지에 명시 (no-op 호출 시엔 안내 줄 수 줄임)
    FIELD_LABEL = {"tracking_no": "운송장", "send_method": "배송방법", "courier_company": "배송업체"}
    changed = [FIELD_LABEL[k] for k in ("tracking_no", "send_method", "courier_company") if before[k] != after[k]]
    if changed:
        message = f"{'/'.join(changed)} 정보가 수정되었습니다. Cafe24 관리자에서도 동일하게 변경해 주세요."
    else:
        message = "변경된 항목이 없습니다."

    return ResponseModel(
        message=message,
        data=SendResponse.model_validate(updated),
    )


# ── 재배송 ──────────────────────────────────────────────────────────────────

@router.post(
    "/sends/{send_id}/resend",
    response_model=ResponseModel[SendResponse],
)
def resend_send(
    send_id: int,
    resend_in: SendResendRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_admin),
):
    """DELIVERED Send 재배송 이력 기록 (Send 본체 변경 없음, 활동 로그만 추가)."""
    send = send_service.get_send_by_id(db, send_id)
    send_service.assert_resend_eligible(db, send)

    activity_log_service.create_log(
        db=db,
        action=ActivityAction.RESEND,
        target_type=ActivityTargetType.SEND,
        admin_id=current_admin.admin_id,
        admin_name=current_admin.admin_name,
        target_id=send_id,
        target_name=send.recipient_name,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        details={
            "reason": resend_in.reason,
            "send_method": resend_in.send_method,
            "courier_company": resend_in.courier_company,
            "tracking_no": resend_in.tracking_no,
            "memo": resend_in.memo,
        },
    )

    return ResponseModel(
        message="재배송 이력이 기록되었습니다.",
        data=SendResponse.model_validate(send),
    )


