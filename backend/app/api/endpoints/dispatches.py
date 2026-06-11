# 서드파티 라이브러리
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.exc import IntegrityError
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
    AddToPreparingYearlyRequest,
    AddToPreparingYearlyResponse,
    DispatchSummaryResponse,
    PaidNotPreparedCountResponse,
    PreviewSkippedIssuesRequest,
    PreviewSkippedIssuesResponse,
    RegeneratePreparingSendsRequest,
    RegeneratePreparingSendsResponse,
    SequenceViolationItem,
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
    try:
        deleted_count, created_count = send_service.regenerate_preparing_sends(
            db=db,
            scope=req.scope,
            issue=req.issue,
        )
        db.commit()
    except IntegrityError:
        # SendItem UNIQUE(order_item_id, issue) 위반 — 동시 클릭/race condition 의심.
        # 활동 로그는 일부러 기록하지 않음 (성공한 작업만 로그 남기는 기존 패턴 일관).
        # 운영상 race 가 자주 보이면 audit log 별도 도입 검토.
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="이미 같은 호로 발송 박스가 생성되어 있습니다. 페이지를 새로고침한 후 다시 시도해주세요.",
        )

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
    "/dispatches/add-to-preparing-yearly",
    response_model=ResponseModel[AddToPreparingYearlyResponse],
    status_code=status.HTTP_200_OK,
)
def add_to_preparing_yearly_endpoint(
    req: AddToPreparingYearlyRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_admin),
):
    """[정기 신규 결제 추가] — incremental. 기존 PREPARING 박스 건드리지 않음.

    정기(YEARLY)는 1 OrderItem = 1 박스 매핑이므로 묶음 재계산 불필요.
    신규 PAID OrderItem 만 추가 박스 생성 → 기존 박스/메모/ID 완전 보존.

    제외 조건 (group_yearly_for_send 가 자동 적용):
    - 활성 SendItem 있는 OrderItem (이미 PREPARING 박스에 든 것)
    - DELIVERED/CANCELLED Send 안의 SendItem
    - 휴지된 OrderItem
    - 활성 VIP 슬롯 매칭 (VIP 탭에서 별도 처리)
    - 구독 범위 밖 / 해외 / 이전 호 발송된 OrderItem
    """
    try:
        created_count = send_service.add_paid_to_preparing_yearly(
            db=db,
            issue=req.issue,
        )
        db.commit()
    except IntegrityError:
        # SendItem UNIQUE(order_item_id, issue) 위반 — 동시 클릭/race condition 의심.
        # 활동 로그는 일부러 기록하지 않음 (성공한 작업만 로그 남기는 기존 패턴 일관).
        # 운영상 race 가 자주 보이면 audit log 별도 도입 검토.
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="이미 같은 호로 발송 박스가 생성되어 있습니다. 페이지를 새로고침한 후 다시 시도해주세요.",
        )

    activity_log_service.create_log(
        db=db,
        action=ActivityAction.DISPATCH,
        target_type=ActivityTargetType.SEND,
        admin_id=current_admin.admin_id,
        admin_name=current_admin.admin_name,
        target_id=None,
        target_name=f"[정기 신규 결제 추가] {req.issue}호",
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        details={
            "issue": req.issue,
            "created_count": created_count,
        },
    )

    return ResponseModel(
        message="정기 신규 결제 추가 완료",
        data=AddToPreparingYearlyResponse(
            issue=req.issue,
            created_count=created_count,
        ),
    )


@router.post(
    "/dispatches/transition-to-delivered",
    response_model=ResponseModel[TransitionToDeliveredResponse],
    status_code=status.HTTP_200_OK,
)
async def transition_to_delivered_endpoint(
    req: TransitionToDeliveredRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_admin),
):
    """선택된 PREPARING Send들을 DELIVERED로 일괄 전환 ("보냈다 = 끝", SHIPPING 단계 없음).

    send_method, courier_company는 항상 필수.
    tracking_no는 박스(Send)마다 개별 입력 (선택 — 비워두면 NULL 저장. 우편·자체배송 등 운송장 없는 케이스 허용).
    한 건이라도 PREPARING이 아니면 전체 거부 (all-or-nothing).
    Cafe24 주문 상태 동기화 포함 (MONTHLY POST / YEARLY PUT) — 실패 시 DB rollback.
    """
    sends_input = [(s.send_id, s.tracking_no) for s in req.sends]

    transitioned_count = await send_service.transition_sends_to_delivered_batch(
        db=db,
        sends_input=sends_input,
        send_method=req.send_method,
        courier_company=req.courier_company,
        client=request.app.state.http_client,
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


@router.post(
    "/dispatches/preview-skipped-issues",
    response_model=ResponseModel[PreviewSkippedIssuesResponse],
)
def preview_skipped_issues_endpoint(
    req: PreviewSkippedIssuesRequest,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_manager),
):
    """[발송 생성] 사전 미리보기 — 순차 발송 위반(중간 호 누락) 후보 조회.

    target_issue 로 발송 시 시작호부터 순차 발송이 아닌 OrderItem 들을 검사한다.
    - scope=monthly 는 호 무관이라 항상 빈 응답
    - scope=yearly / vipN: 그룹핑 통과한 YEARLY OrderItem 만 검사
      누락된 호가 있는 OrderItem 들의 카운트 + 상위 3건 샘플 반환
    DB 변경 없음 (조회 전용).
    """
    if req.scope == "monthly":
        return ResponseModel(
            data=PreviewSkippedIssuesResponse(violation_count=0, samples=[]),
        )

    violations = dispatch_grouping_service.find_violations_for_scope(
        db=db,
        scope=req.scope,
        target_issue=req.issue,
    )
    samples = [
        SequenceViolationItem(
            order_item_id=v.order_item_id,
            product_code=v.product_code,
            recipient_name=v.recipient_name,
            missing_issues=v.missing_issues,
        )
        for v in violations[:3]
    ]
    return ResponseModel(
        data=PreviewSkippedIssuesResponse(
            violation_count=len(violations),
            samples=samples,
        ),
    )


@router.get(
    "/dispatches/paid-not-prepared-count",
    response_model=ResponseModel[PaidNotPreparedCountResponse],
)
def paid_not_prepared_count_endpoint(
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_manager),
):
    """PreparingSendListPage 카운트 배너용 — 두 묶음 한 응답.

    - *_count (PR5): "신규 결제" — PAID 지만 PREPARING 안 들어간 OrderItem (다음 [발송 생성] 시 추가될 후보)
    - *_preparing (PR5.1): "박스 처리됨" — 현재 PREPARING 박스에 들어가 있는 활성 OrderItem
    8키 합계 = 각 묶음의 total (단일성 제약 V-7 덕).
    """
    counts = dispatch_grouping_service.count_paid_not_prepared(db)
    in_preparing = dispatch_grouping_service.count_orderitems_in_preparing(db)
    return ResponseModel(
        data=PaidNotPreparedCountResponse(
            monthly_count=counts["monthly"],
            yearly_count=counts["yearly"],
            vip1_count=counts["vip1"],
            vip2_count=counts["vip2"],
            vip3_count=counts["vip3"],
            vip4_count=counts["vip4"],
            vip5_count=counts["vip5"],
            vip6_count=counts["vip6"],
            total_count=sum(counts.values()),
            monthly_preparing=in_preparing["monthly"],
            yearly_preparing=in_preparing["yearly"],
            vip1_preparing=in_preparing["vip1"],
            vip2_preparing=in_preparing["vip2"],
            vip3_preparing=in_preparing["vip3"],
            vip4_preparing=in_preparing["vip4"],
            vip5_preparing=in_preparing["vip5"],
            vip6_preparing=in_preparing["vip6"],
            total_preparing=sum(in_preparing.values()),
        ),
    )
