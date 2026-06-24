# 표준 라이브러리
import io
from typing import List
from urllib.parse import quote

# 서드파티 라이브러리
import openpyxl
from fastapi import APIRouter, Depends, Query, Request, status
from fastapi.responses import StreamingResponse
from openpyxl.styles import Alignment, Font, PatternFill
from sqlalchemy.orm import Session

# 로컬 애플리케이션
from app.db.session import get_db
from app.core.deps import require_roles
from app.models.admin import Admin
from app.schemas.activity_log import ActivityAction, ActivityTargetType
from app.schemas.common import PaginatedResponse, ResponseModel
from app.schemas.order_item import (
    OrderItemAddressUpdate,
    OrderItemAddressUpdateResponse,
    OrderItemCancelCalculateResponse,
    OrderItemCancelRequest,
    OrderItemCreate,
    OrderItemDetailResponse,
    OrderItemLastSendIssueUpdate,
    OrderItemListQuery,
    OrderItemResponse,
    OrderItemUpdate,
    PauseInfo,
    SubscriptionBatchExtendRequest,
    SubscriptionBatchExtendResponse,
    SubscriptionChangePeriodRequest,
    SubscriptionExtendRequest,
    SubscriptionListItem,
    SubscriptionShortenCalculateRequest,
    SubscriptionShortenCalculateResponse,
    SubscriptionShortenConfirmRequest,
)
from app.models.order_item import OrderItem as OrderItemModel
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
    "/order-items",
    response_model=PaginatedResponse[SubscriptionListItem],
)
def list_order_items(
    query: OrderItemListQuery = Depends(OrderItemListQuery.as_query_params),
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_manager),
):
    """구독 목록 조회 (고객 정보 포함)"""
    items, total = order_item_service.list_order_items(db, query)
    total_pages = (total + query.limit - 1) // query.limit

    return PaginatedResponse(
        total=total,
        page=query.page,
        limit=query.limit,
        total_pages=total_pages,
        items=items,
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


_XLSX_MEDIA_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
_SHEET1_PREFIXES = frozenset(("W0", "WB"))
_SHEET2_PREFIXES = frozenset(("HN", "CL", "CH", "JN"))
_SHEET2_LABELS = {"HN": "꿀땅", "CL": "어저", "CH": "어고", "JN": "청소년"}
_SHEET2_SORT_ORDER = {"꿀땅": 0, "어저": 1, "어고": 2, "청소년": 3}


def _build_expiring_excel(rows: list) -> io.BytesIO:
    wb = openpyxl.Workbook()
    h_fill = PatternFill(start_color="F2F2F2", end_color="F2F2F2", fill_type="solid")
    h_font = Font(bold=True)
    center = Alignment(horizontal="center")

    def style_header(ws):
        for cell in ws[1]:
            cell.font = h_font
            cell.fill = h_fill
            cell.alignment = center

    ws1 = wb.active
    ws1.title = "말씀함께"
    ws1.append(["수령인 이름", "수령인 연락처"])
    ws1.column_dimensions["A"].width = 15
    ws1.column_dimensions["B"].width = 22

    seen_phones: set = set()
    sheet1_rows = []
    sheet2_rows = []

    for item in rows:
        prefix = (item.product_code or "")[:2]
        name = item.address.recipient_name or "" if item.address else ""
        phone = item.address.recipient_phone or "" if item.address else ""
        if prefix in _SHEET1_PREFIXES:
            if phone not in seen_phones:
                seen_phones.add(phone)
                sheet1_rows.append((name, phone))
        elif prefix in _SHEET2_PREFIXES:
            sheet2_rows.append((name, phone, _SHEET2_LABELS.get(prefix, prefix)))

    sheet1_rows.sort(key=lambda r: r[0])
    sheet2_rows.sort(key=lambda r: _SHEET2_SORT_ORDER.get(r[2], 99))

    for name, phone in sheet1_rows:
        ws1.append([name, phone])
        for cell in ws1[ws1.max_row]:
            cell.alignment = center

    style_header(ws1)

    ws2 = wb.create_sheet(title="교회학교")
    ws2.append(["수령인 이름", "수령인 연락처", "상품 종류"])
    ws2.column_dimensions["A"].width = 15
    ws2.column_dimensions["B"].width = 22
    ws2.column_dimensions["C"].width = 12
    for row in sheet2_rows:
        ws2.append(list(row))
        for cell in ws2[ws2.max_row]:
            cell.alignment = center
    style_header(ws2)

    output = io.BytesIO()
    wb.save(output)
    output.seek(0)
    return output


@router.get(
    "/order-items/expiring-subscribers/excel",
    response_class=StreamingResponse,
)
def download_expiring_subscribers_excel(
    request: Request,
    issue: str = Query(..., min_length=6, max_length=6, pattern=r"^\d{6}$", description="구독 종료 호 (YYYYMM)"),
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_manager),
):
    """재구독 안내 연락처 엑셀 다운로드 (2시트).
    Sheet1 말씀함께(W0/WB): recipient_phone 기준 중복 제거.
    Sheet2 교회학교(HN/CL/CH/JN): 중복 제거 없음, 상품 종류 열 포함.
    """
    rows = (
        db.query(OrderItemModel)
        .filter(
            OrderItemModel.cancelled_at.is_(None),
            OrderItemModel.product_kind == "YEARLY",
            OrderItemModel.final_subscribe_end_issue == issue,
        )
        .all()
    )

    output = _build_expiring_excel(rows)

    filename = f"재구독안내_{issue}.xlsx"
    encoded = quote(filename)
    content_disposition = f"attachment; filename=\"download.xlsx\"; filename*=UTF-8''{encoded}"

    activity_log_service.create_log(
        db=db,
        action=ActivityAction.DISPATCH,
        target_type=ActivityTargetType.ORDER_ITEM,
        admin_id=current_admin.admin_id,
        admin_name=current_admin.admin_name,
        target_id=None,
        target_name=f"재구독안내 엑셀 다운로드 / {issue} / {len(rows)}건",
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        details={"issue": issue, "total_count": len(rows)},
    )

    return StreamingResponse(
        output,
        media_type=_XLSX_MEDIA_TYPE,
        headers={"Content-Disposition": content_disposition},
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

    # 주문 총액 재계산 (품목 추가 → 결제금 갱신)
    order = order_service.get_order_by_id(db, item.order_id)
    order_service.recalculate_totals(db, order, update_payment=True)

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
    changed_fields = item_in.model_dump(exclude_unset=True)

    # 이전 값 캡처
    before_values = {}
    after_values = {}
    for field in ("order_num", "sale_price", "admin_memo"):
        if field in changed_fields:
            before_values[field] = getattr(order_item, field)
            after_values[field] = changed_fields[field]

    updated = order_item_service.update_order_item(db, order_item, item_in)

    # 금액/수량 관련 필드 변경 시 주문 총액 재계산
    if any(f in changed_fields for f in ("sale_price", "order_num")):
        order = order_service.get_order_by_id(db, updated.order_id)
        order_service.recalculate_totals(db, order, update_payment=True)

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
            "action": "품목 수정",
            "before": before_values if before_values else None,
            "after": after_values if after_values else None,
        },
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
    prev_start = order_item.final_subscribe_start_issue
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
            "before": {"start": prev_start, "end": prev_end},
            "after": {"start": updated.final_subscribe_start_issue, "end": updated.final_subscribe_end_issue},
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
    prev_start = order_item.final_subscribe_start_issue
    prev_end = order_item.final_subscribe_end_issue

    updated = order_item_service.shorten_confirm(db, order_item, confirm_in)

    # 주문 총액 재계산
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
        details={
            "action": "구독 단축",
            "before": {"start": prev_start, "end": prev_end},
            "after": {"start": updated.final_subscribe_start_issue, "end": updated.final_subscribe_end_issue},
            "reason": confirm_in.reason,
            "refund_amount": updated.refund_amount,
        },
    )

    return ResponseModel(
        message="구독 기간이 단축되었습니다.",
        data=_build_detail_response(db, updated),
    )


# ── 품목 취소 ─────────────────────────────────────────────────────────────────

@router.post(
    "/order-items/{order_item_id}/cancel/calculate",
    response_model=ResponseModel[OrderItemCancelCalculateResponse],
)
def cancel_item_calculate(
    order_item_id: int,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_admin),
):
    """품목 취소 환불 계산 미리보기 (DB 변경 없음)"""
    order_item = order_item_service.get_active_order_item_by_id(db, order_item_id)
    result = order_item_service.cancel_item_calculate(db=db, order_item=order_item)
    return ResponseModel(message="환불액이 계산되었습니다.", data=result)


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
