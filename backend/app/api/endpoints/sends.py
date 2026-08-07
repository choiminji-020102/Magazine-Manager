# 표준 라이브러리
from typing import List

# 서드파티 라이브러리
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

# 로컬 애플리케이션
from app.db.session import get_db
from app.core.deps import require_roles
from app.models.admin import Admin
from app.schemas.activity_log import ActivityAction, ActivityTargetType
from app.schemas.common import PaginatedResponse, ResponseModel
from app.schemas.send import (
    OrderItemSendResponse,
    SendAdminMemoUpdate,
    SendDetailResponse,
    SendListQuery,
    SendResendRequest,
    SendResponse,
    SendTrackingUpdate,
)
from app.schemas.send_item import SendItemResponse
from app.services import (
    activity_log_service,
    order_item_service,
    order_service,
    send_service,
)

router = APIRouter(tags=["발송"])

require_admin = require_roles(["SUPER_ADMIN", "ADMIN"])
require_manager = require_roles(["SUPER_ADMIN", "ADMIN", "MANAGER"])


# ── 조회 ──────────────────────────────────────────────────────────────────────

@router.get(
    "/sends",
    response_model=PaginatedResponse[SendDetailResponse],
)
def list_sends(
    query: SendListQuery = Depends(SendListQuery.as_query_params),
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_manager),
):
    """발송 목록 조회 (각 박스의 SendItem 목록 인라인 포함).

    카드 그리드 표시 시 박스별 detail 추가 호출(N+1) 을 없애기 위해 items 임베드.
    SendItem 은 crud.list_sends 의 selectinload(Send.items) 로 한 방에 로드되고,
    Pydantic from_attributes 가 ORM relationship 을 SendItemResponse 로 자동 매핑.
    """
    sends, total = send_service.list_sends(db, query)
    total_pages = (total + query.limit - 1) // query.limit

    return PaginatedResponse(
        total=total,
        page=query.page,
        limit=query.limit,
        total_pages=total_pages,
        items=[SendDetailResponse.model_validate(s) for s in sends],
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
    "/order-items/{order_item_id}/sends",
    response_model=ResponseModel[List[OrderItemSendResponse]],
)
def get_sends_by_order_item(
    order_item_id: int,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_manager),
):
    """주문 품목별 발송 내역 (호·상품명 포함, 최신 호 순).

    /orders/{order_id}/sends 와 달리 그 품목의 발송만 반환한다.
    """
    order_item_service.get_order_item_by_id(db, order_item_id)  # 품목 존재 확인

    # 여러 품목이 아니라 한 품목의 호(issue)별 발송 기록 N건 — (품목, 호) 유니크
    history = send_service.get_send_history_by_order_item(db, order_item_id)

    return ResponseModel(
        message="주문 품목별 발송 내역을 조회했습니다.",
        data=history,
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


@router.patch(
    "/sends/{send_id}/admin-memo",
    response_model=ResponseModel[SendResponse],
)
def update_admin_memo(
    send_id: int,
    memo_in: SendAdminMemoUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_manager),
):
    """Send 관리자 메모 수정. 상태 무관 (PREPARING/DELIVERED/CANCELLED 모두 허용).

    권한: SUPER_ADMIN/ADMIN/MANAGER 모두 허용 (운영 메모는 자주 수정되는 보조 정보).
    """
    send = send_service.get_send_by_id(db, send_id)
    before = send.admin_memo

    updated = send_service.update_admin_memo(db, send, memo_in.admin_memo)
    after = updated.admin_memo

    if before != after:
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
            details={"before": {"admin_memo": before}, "after": {"admin_memo": after}},
        )
        message = "관리자 메모가 수정되었습니다."
    else:
        message = "변경된 항목이 없습니다."

    return ResponseModel(
        message=message,
        data=SendResponse.model_validate(updated),
    )


@router.delete(
    "/sends/{send_id}/preparing",
    response_model=ResponseModel[None],
)
def delete_preparing_send(
    send_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_manager),
):
    """PREPARING Send 강제 삭제 (운영자 직접 박스 단위 정리).

    DELIVERED/CANCELLED 차단. 잔여 SendItem 까지 cascade DELETE.
    OrderItem 취소 시 자동 삭제(delete_preparing_send_items_for_order_items)와 별도 흐름.
    권한: SUPER_ADMIN/ADMIN/MANAGER 모두 허용.
    """
    send = send_service.get_send_by_id(db, send_id)

    # 활동 로그용 스냅샷 — db.delete(send) 직후엔 relationship 접근 불가하므로 미리 추출.
    # send_id / recipient_name 은 ActivityLog 본체(target_id / target_name) 에 기록되므로
    # details 에는 중복 저장하지 않고, 사후 추적에 필요한 박스 본문(SendItem 요약) 과
    # 묶인 주문 ID 만 남긴다. send_status 는 항상 PREPARING (서비스 레이어 검증 통과한 결과) 이라 잉여.
    recipient_name_snapshot = send.recipient_name
    send_items_snapshot = [
        {
            "send_item_id": si.send_item_id,
            "order_item_id": si.order_item_id,
            "product_code": si.product_code,
            "product_name": si.product_name,
            "issue": si.issue,
            "send_num": si.send_num,
        }
        for si in send.items
    ]
    order_ids_snapshot = list(send.order_ids)

    deleted_items = send_service.delete_single_preparing_send(db, send)

    activity_log_service.create_log(
        db=db,
        action=ActivityAction.DELETE,
        target_type=ActivityTargetType.SEND,
        admin_id=current_admin.admin_id,
        admin_name=current_admin.admin_name,
        target_id=send_id,
        target_name=recipient_name_snapshot,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        details={
            "deleted_send_items_count": deleted_items,
            "order_ids": order_ids_snapshot,
            "send_items": send_items_snapshot,
        },
    )

    return ResponseModel(
        message=f"PREPARING 박스 #{send_id} 가 삭제되었습니다 (잔여 품목 {deleted_items}건 함께 정리).",
        data=None,
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
    """DELIVERED Send 재배송 내역 기록 (Send 본체 변경 없음, 활동 로그만 추가).

    send_item_ids로 재발송 대상 품목을 명시 (박스 통째 시 UI가 모든 SendItem ID 채워서 보냄).
    해당 send_id에 속하지 않은 SendItem ID가 섞여있으면 422 거부.
    """
    send = send_service.get_send_by_id(db, send_id)
    send_service.assert_resend_eligible(db, send)

    items = send_service.get_send_items(db, send_id)
    valid_ids = {si.send_item_id for si in items}
    invalid = [sid for sid in resend_in.send_item_ids if sid not in valid_ids]
    if invalid:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"이 박스(send_id={send_id})에 속하지 않은 SendItem ID: {invalid}",
        )

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
            "send_item_ids": resend_in.send_item_ids,
        },
    )

    return ResponseModel(
        message="재배송 내역이 기록되었습니다.",
        data=SendResponse.model_validate(send),
    )


