# 표준 라이브러리
import re
from typing import Dict, List, Optional, Tuple

# 서드파티 라이브러리
import httpx
from fastapi import HTTPException, status
from sqlalchemy.orm import Session, joinedload

# 로컬 애플리케이션
from app.core import vip_slots
from app.core.utils import now_kst, parse_subscribe_start_issue
from app.models.order_item import OrderItem
from app.models.product import Product
from app.models.send import Send
from app.models.send_item import SendItem
from app.schemas.send import SendListQuery
from app.crud import send as send_crud
from app.services import cafe24_admin_service, send_item_service
from app.services.dispatch_grouping_service import (
    SendGroup,
    get_paid_order_items_for_dispatch,
    group_monthly_for_send,
    group_vip_for_send,
    group_yearly_for_send,
)
from app.services.order_item_service import convert_to_send_product_code


# ── 헬퍼 ──────────────────────────────────────────────────────────────────────

def derive_courier_company(send_method: Optional[str]) -> Optional[str]:
    """발송 방법(send_method)으로부터 운송사(courier_company)를 자동 도출.

    - 기출유택배 → CJ대한통운 (외부 위탁 택배)
    - 그 외(기출유우편/일반우편/찾아가기) → 자체배송
    - send_method 없음 → None

    운영자가 Send 본체에서 수동으로 다른 값으로 수정할 수 있다.
    """
    if send_method is None:
        return None
    if send_method == "기출유택배":
        return "CJ대한통운"
    return "자체배송"


# ── PREPARING Send 생성 ────────────────────────────────────────────────────────

def create_preparing_sends_from_groups(
    db: Session,
    groups: List[SendGroup],
    issue: Optional[str] = None,
) -> List[Send]:
    """그룹 리스트를 받아 Send + SendItem을 PREPARING 상태로 일괄 생성.

    - send_method, courier_company, tracking_no 모두 NULL (실제 배송중 전환 시점에 결정)
    - YEARLY 그룹: 입력 issue 필수. SendItem.product_code는 convert_to_send_product_code로 변환,
      SendItem.issue는 입력 issue 사용
    - MONTHLY 그룹: issue 없이도 동작. SendItem.product_code는 OrderItem.product_code 그대로,
      SendItem.issue는 parse_subscribe_start_issue(product_code)로 도출
    - OrderItem.last_send_issue는 갱신하지 않음 (PREPARING은 아직 발송 전)

    호출자(엔드포인트)가 db.commit() 책임.
    """
    if not groups:
        return []

    # 그룹들에 포함된 모든 OrderItem ID·Product code 일괄 조회 + upfront 검증
    all_order_item_ids: List[int] = []
    for group in groups:
        all_order_item_ids.extend(group.order_item_ids)

    order_items = (
        db.query(OrderItem)
        .filter(OrderItem.order_item_id.in_(all_order_item_ids))
        .all()
    )
    order_items_by_id = {oi.order_item_id: oi for oi in order_items}

    missing_oi_ids = set(all_order_item_ids) - set(order_items_by_id.keys())
    if missing_oi_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"OrderItem을 찾을 수 없습니다: {sorted(missing_oi_ids)}",
        )

    product_codes = {oi.product_code for oi in order_items}
    products = db.query(Product).filter(Product.product_code.in_(product_codes)).all()
    products_by_code = {p.product_code: p for p in products}

    missing_product_codes = product_codes - set(products_by_code.keys())
    if missing_product_codes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"상품을 찾을 수 없습니다: {sorted(missing_product_codes)}",
        )

    has_yearly = any(oi.product_kind == "YEARLY" for oi in order_items)
    if has_yearly and not issue:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="YEARLY OrderItem 발송 생성 시 issue가 필요합니다.",
        )

    created_sends: List[Send] = []

    for group in groups:
        send = Send(
            address_id=group.address_id,
            send_status="PREPARING",
            send_method=None,
            courier_company=None,
            tracking_no=None,
            recipient_name=group.recipient_name,
            recipient_phone=group.recipient_phone,
            country_code=group.country_code,
            postal_code=group.postal_code,
            recipient_address=group.recipient_address,
            customer_memo=group.customer_memo,
        )
        db.add(send)
        db.flush()  # send_id 확보

        for order_item_id in group.order_item_ids:
            order_item = order_items_by_id[order_item_id]
            product = products_by_code[order_item.product_code]

            # 종류별 product_code·issue 결정
            if order_item.product_kind == "YEARLY":
                # invariant assert — group_yearly_for_send 가 거름망이지만 우회 호출 방어.
                # 박기 직전 last_send_issue / 구독 범위 한 번 더 확인.
                if order_item.last_send_issue and order_item.last_send_issue >= issue:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"OrderItem #{order_item_id} 는 이미 {order_item.last_send_issue} 호로 발송됨. issue={issue} 박기 불가",
                    )
                if order_item.final_subscribe_start_issue and order_item.final_subscribe_start_issue > issue:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"OrderItem #{order_item_id} 의 구독 시작({order_item.final_subscribe_start_issue}) 이 issue({issue}) 보다 큼",
                    )
                if order_item.final_subscribe_end_issue and order_item.final_subscribe_end_issue < issue:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"OrderItem #{order_item_id} 의 구독 종료({order_item.final_subscribe_end_issue}) 가 issue({issue}) 보다 작음",
                    )
                send_item_product_code = convert_to_send_product_code(
                    product.product_code, "YEARLY", issue
                )
                send_item_issue = issue
            else:  # MONTHLY
                send_item_product_code = order_item.product_code
                send_item_issue = parse_subscribe_start_issue(order_item.product_code)
                # YYYYMM 형식 + month 01~12 강제 — product_code 가 오염돼 있어도 비정상 SendItem 생성 차단
                if not send_item_issue or not re.match(r"^\d{4}(0[1-9]|1[0-2])$", send_item_issue):
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"MONTHLY product_code 에서 호 파싱 실패 또는 형식 오류: {order_item.product_code}",
                    )

            send_item = SendItem(
                send_id=send.send_id,
                order_item_id=order_item.order_item_id,
                product_code=send_item_product_code,
                product_name=product.product_name,
                issue=send_item_issue,
                send_num=order_item.order_num,
                cost_price=product.cost_price or 0,
                unit_weight=float(product.unit_weight) if product.unit_weight is not None else None,
                unit_width=float(product.unit_width) if product.unit_width is not None else None,
                unit_length=float(product.unit_length) if product.unit_length is not None else None,
                unit_height=float(product.unit_height) if product.unit_height is not None else None,
            )
            db.add(send_item)

        created_sends.append(send)

    db.flush()
    return created_sends


# ── 배송완료 처리 ─────────────────────────────────────────────────────────────

def transition_send_to_delivered(
    db: Session,
    send: Send,
    send_method: str,
    courier_company: str,
    tracking_no: Optional[str],
    send_items: Optional[List[SendItem]] = None,
) -> Send:
    """단일 PREPARING Send를 DELIVERED로 전환 ("보냈다 = 끝", SHIPPING 단계 없음).

    - send_method, courier_company 필수. tracking_no 선택 (None 허용 — 우편·자체배송 등 운송장 없는 케이스)
    - delivered_at = now_kst()
    - 각 SendItem 마다 OrderItem.product_kind 로 판정:
      - YEARLY OrderItem: last_send_issue 를 SendItem.issue 기준 max 로 갱신
      - MONTHLY OrderItem: last_send_issue 갱신 안 함
    - VIP Send 는 정기+단품 혼합 가능 — SendItem 단위 분기 필수 ("한 Send = 한 종류" 가정 금지)
    - send_items: 이미 조회된 SendItem 목록(가급적 order_item 까지 joinedload된 것)을 넘기면
      내부에서 재쿼리하지 않고 그대로 재사용. 대량 배치 호출 시(transition_sends_to_delivered_batch)
      호출자가 이미 0단계에서 joinedload 해둔 목록을 반드시 전달해 N+1 쿼리를 피할 것.
      생략 시(단독 호출 등) 함수 내부에서 직접 쿼리.

    호출자(엔드포인트)가 db.commit() 책임.
    """
    if send.send_status != "PREPARING":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"PREPARING 상태에서만 배송완료로 전환 가능합니다. 현재: {send.send_status}",
        )
    if not send_method or not courier_company:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="send_method, courier_company는 필수입니다.",
        )

    send.send_status = "DELIVERED"
    send.send_method = send_method
    send.courier_company = courier_company
    send.tracking_no = tracking_no
    send.delivered_at = now_kst()

    # 각 SendItem 마다 OrderItem.product_kind 로 분기 (VIP 정기+단품 혼합 Send 대응)
    if send_items is None:
        send_items = (
            db.query(SendItem)
            .filter(SendItem.send_id == send.send_id, SendItem.cancelled_at.is_(None))
            .all()
        )
    if send_items:
        for si in send_items:
            oi = si.order_item  # 호출자가 joinedload 해뒀으면 추가 쿼리 없음
            if oi is None:
                continue
            oi.delivered_at = now_kst()
            if oi.product_kind != "YEARLY":
                continue  # MONTHLY 는 last_send_issue 미사용 (정책 그대로)
            if not oi.last_send_issue or si.issue > oi.last_send_issue:
                oi.last_send_issue = si.issue

    db.flush()
    return send


async def transition_sends_to_delivered_batch(
    db: Session,
    sends_input: List[Tuple[int, str]],
    send_method: str,
    courier_company: str,
    client: httpx.AsyncClient,
) -> Tuple[int, int, List[Dict]]:
    """선택된 PREPARING Send들을 DELIVERED 전환 시도. (전환 성공 수, 카페24 연동 성공 수, 실패 목록) 반환.

    sends_input: (send_id, tracking_no) 페어 리스트. 박스마다 운송장 다를 수 있음. tracking_no 필수 (스키마 보장).
    send_method, courier_company는 모든 Send에 공통 적용.

    all-or-nothing 아님 — 존재하지 않거나 이미 처리된 Send, 카페24 연동에 실패한 Send는
    예외를 던지는 대신 failed 목록에 담기고, 나머지는 계속 진행되어 정상 반영됨.
    failed 항목 형식: {"send_id": int, "recipient_name": str, "recipient_phone": str,
                       "reason": str, "category": "validation" | "cafe24"}
    - "validation": 카페24를 아예 시도하기도 전에 걸림 (존재 안 함 / 이미 처리됨)
    - "cafe24": 우리 시스템 검증은 통과했지만 카페24 API 호출이 실패함
                (이 경우도 해당 Send의 우리 시스템 반영은 함께 취소됨 — 부분 성공 없음)

    한 Send에 카페24 대상 주문이 여러 건 섞여 있을 수 있음(같은 주소면 다른 고객 주문도
    한 Send로 묶임 — group_monthly_for_send 참고). 이 경우 Send는 그 안의 카페24 대상
    주문이 "전부" 성공해야만 DELIVERED로 전환됨 (하나라도 실패하면 Send 전체 보류).
    단, 이미 성공한 개별 주문 건은 재시도 시 다시 카페24로 보내지 않음(MONTHLY는
    oi.cafe24_shipping_code 존재 여부로 판별) — Send 전체의 성패 판정과는 별개로,
    카페24 쪽에서 이미 확정된 사실을 다시 흔들지 않기 위함.

    호출자가 db.commit() + 활동 로그 책임.
    """
    send_ids = [sid for sid, _ in sends_input]
    tracking_by_id = dict(sends_input)
    failed: List[Dict] = []

    sends = db.query(Send).filter(Send.send_id.in_(send_ids)).all()
    sends_by_id = {s.send_id: s for s in sends}

    missing = sorted(set(send_ids) - set(sends_by_id.keys()))
    for send_id in missing:
        failed.append({
            "send_id": send_id,
            "recipient_name": "-",
            "recipient_phone": "-",
            "reason": "존재하지 않는 발송입니다. 새로고침 후 다시 확인해주세요.",
            "category": "validation",
        })

    valid_sends: List[Send] = []
    for s in sends:
        if s.send_status != "PREPARING":
            failed.append({
                "send_id": s.send_id,
                "recipient_name": s.recipient_name,
                "recipient_phone": s.recipient_phone,
                "reason": "이미 처리(발송완료 또는 취소)되어 있어 다시 처리할 수 없습니다. 새로고침 후 다시 확인해주세요.",
                "category": "validation",
            })
        else:
            valid_sends.append(s)

    if not valid_sends:
        return 0, 0, failed

    valid_send_ids = [s.send_id for s in valid_sends]

    # 0단계: 루프 전에 모든 send의 SendItem 한번에 미리 쿼리
    # joinedload(order_item → order) 포함 → MONTHLY POST의 external_order_id 접근 시 추가 쿼리 없음
    # items_by_send_id는 3단계에서 transition_send_to_delivered(send_items=...)로 그대로 전달되어
    # 재쿼리 없이 재사용됨(과거엔 그 함수 내부에서 SendItem/OrderItem을 매 Send마다 다시 쿼리했음)
    all_send_items = (
        db.query(SendItem)
        .filter(SendItem.send_id.in_(valid_send_ids), SendItem.cancelled_at.is_(None))
        .options(joinedload(SendItem.order_item).joinedload(OrderItem.order))
        .all()
    )
    items_by_send_id: dict = {}
    for si in all_send_items:
        items_by_send_id.setdefault(si.send_id, []).append(si)

    # 1단계: Cafe24 정보 수집 (DB flush 전 — last_send_issue가 아직 null인 시점)
    monthly_groups: dict = {}                    # ext_oid → [order_item_code]
    monthly_order_items_map: dict = {}           # ext_oid → [OrderItem] (shipping_code 저장용)
    monthly_send_ids_by_order: dict = {}         # ext_oid → {send_id, ...} (실패 시 역추적용, set — 순서 보장 안 함)
    monthly_tracking_send_id_by_order: dict = {} # ext_oid → send_id (운송장번호 조회 전용 — 항상 덮어써서 "마지막 Send" 기준 결정적으로 유지)
    yearly_requests: List[dict] = []
    yearly_send_ids_by_shipping_code: dict = {}  # shipping_code → {send_id, ...}
    cafe24_synced_send_ids: set = set()          # 카페24 연동 "대상"이었던 Send (성공분은 3단계에서 걸러냄)

    for send in valid_sends:
        for si in items_by_send_id.get(send.send_id, []):
            oi = si.order_item
            if oi.external_order_item_id is None:
                continue  # OFFLINE/GPMALL 품목 — Cafe24 연동 대상 아님
            if oi.cancelled_at is not None:
                continue
            if oi.product_kind == "MONTHLY":
                if oi.cafe24_shipping_code:
                    continue  # 이전 시도(재시도)에서 이미 카페24 연동 성공 — 재전송 방지(idempotency).
                    # 같은 Send에 섞인 다른 주문이 실패해 이 Send가 재시도 대상이 되더라도,
                    # 이미 성공한 이 주문은 다시 카페24로 보내지 않음. Send 자체는 이 주문이
                    # 속한 것과 무관하게, 여전히 남은 미동기화 주문까지 전부 성공해야 DELIVERED 전환됨.
                ext_oid = oi.order.external_order_id  # Cafe24 주문번호
                if ext_oid is None:
                    continue
                monthly_groups.setdefault(ext_oid, []).append(oi.external_order_item_id)
                monthly_order_items_map.setdefault(ext_oid, []).append(oi)
                monthly_send_ids_by_order.setdefault(ext_oid, set()).add(send.send_id)
                monthly_tracking_send_id_by_order[ext_oid] = send.send_id  # 항상 덮어씀 — 같은 주문이 여러 Send에 걸쳐도 매번 동일하게 "마지막 Send" 채택
                cafe24_synced_send_ids.add(send.send_id)
            elif (
                oi.product_kind == "YEARLY"
                and oi.last_send_issue is None      # 첫 발송만 — 의도적 설계 (§3-2). flush 전이므로 올바른 체크
                and oi.cafe24_shipping_code
            ):
                yearly_requests.append({"order_id": oi.order.external_order_id, "shipping_code": oi.cafe24_shipping_code, "status": "shipping"})
                yearly_send_ids_by_shipping_code.setdefault(oi.cafe24_shipping_code, set()).add(send.send_id)
                cafe24_synced_send_ids.add(send.send_id)

    # shipping_code 중복 제거 (같은 주문 YEARLY 2종 → 동일 shipping_code)
    seen: set = set()
    yearly_requests = [
        r for r in yearly_requests
        if not (r["shipping_code"] in seen or seen.add(r["shipping_code"]))
    ]

    # 2단계: Cafe24 API 호출 (부분 성공 허용 — _tolerant 버전은 실패한 100건 묶음만 배제하고 계속 진행)
    cafe24_failed_send_ids: set = set()
    # send_id → [reason, ...] — VIP처럼 한 Send에 MONTHLY+YEARLY가 섞여 있으면 두 실패
    # 루프(아래) 모두에서 같은 send_id가 걸릴 수 있음. failed에 send_id당 한 번만
    # 등록하기 위해 사유를 여기 모아뒀다가 두 루프가 끝난 뒤 한꺼번에 만든다.
    cafe24_failure_reasons: dict = {}

    def _record_cafe24_failure(send_id: int, reason: str) -> None:
        cafe24_failed_send_ids.add(send_id)
        cafe24_failure_reasons.setdefault(send_id, []).append(reason)

    # MONTHLY POST: N20 → N30 (shipping). order_id 필수.
    if monthly_groups:
        monthly_payload: List[dict] = []
        for ext_oid, item_codes in monthly_groups.items():
            tracking_no_val = tracking_by_id[monthly_tracking_send_id_by_order[ext_oid]]
            shipping_co_code = "0006" if courier_company == "CJ대한통운" else "0001"
            monthly_payload.append({
                "order_id": ext_oid,
                "tracking_no": tracking_no_val,
                "shipping_company_code": shipping_co_code,
                "status": "shipping",
                "order_item_code": item_codes,
            })
        shipments, monthly_failed_batches = await cafe24_admin_service.post_shipments_tolerant(
            db=db, client=client, requests_payload=monthly_payload
        )
        for shipment in shipments:
            resp_order_id = shipment.get("order_id")
            shipping_code = shipment.get("shipping_code")
            if resp_order_id and shipping_code:
                for oi in monthly_order_items_map.get(resp_order_id, []):
                    oi.cafe24_shipping_code = shipping_code
        db.flush()
        for fb in monthly_failed_batches:
            for item in fb["items"]:
                affected = monthly_send_ids_by_order.get(item["order_id"], set())
                for send_id in affected:
                    _record_cafe24_failure(send_id, fb["reason"])

    # YEARLY PUT: N21 → N30 (shipping). shipping_code 필수, order_id 불필요.
    if yearly_requests:
        _yearly_shipments, yearly_failed_batches = await cafe24_admin_service.put_shipments_tolerant(
            db=db, client=client, requests_payload=yearly_requests
        )
        for fb in yearly_failed_batches:
            for item in fb["items"]:
                affected = yearly_send_ids_by_shipping_code.get(item["shipping_code"], set())
                for send_id in affected:
                    _record_cafe24_failure(send_id, fb["reason"])

    # MONTHLY/YEARLY 양쪽에서 모인 실패 사유를 send_id당 하나의 failed 항목으로 병합
    # (VIP처럼 한 Send에 MONTHLY 실패 + YEARLY 실패가 동시에 있으면 사유를 이어붙임)
    for send_id, reasons in cafe24_failure_reasons.items():
        unique_reasons = list(dict.fromkeys(reasons))  # 순서 유지하며 중복 사유 제거
        failed.append({
            "send_id": send_id,
            "recipient_name": sends_by_id[send_id].recipient_name,
            "recipient_phone": sends_by_id[send_id].recipient_phone,
            "reason": " / ".join(unique_reasons),
            "category": "cafe24",
        })

    # 3단계: 카페24까지 성공한(또는 애초에 대상이 아니었던) Send만 실제로 DB 반영
    succeeded_sends = [s for s in valid_sends if s.send_id not in cafe24_failed_send_ids]
    for send in succeeded_sends:
        transition_send_to_delivered(
            db=db,
            send=send,
            send_method=send_method,
            courier_company=courier_company,
            tracking_no=tracking_by_id[send.send_id],
            send_items=items_by_send_id.get(send.send_id, []),  # 0단계에서 joinedload 해둔 목록 재사용 — 재쿼리 방지
        )

    cafe24_synced_count = len(cafe24_synced_send_ids - cafe24_failed_send_ids)
    return len(succeeded_sends), cafe24_synced_count, failed


# ── [발송 생성] 오케스트레이션 ─────────────────────────────────────────────────

def regenerate_preparing_sends(
    db: Session,
    scope: str,
    issue: Optional[str],
) -> Tuple[int, int]:
    """[발송 생성] 오케스트레이션. (deleted_count, created_count) 반환.

    1. scope에 따라 기존 PREPARING Send 일괄 삭제 (각 탭은 자기 영역만)
    2. scope에 따라 그룹핑
    3. PREPARING Send + SendItem 생성

    scope:
      - monthly : 단품 (활성 vipN 모두 false). issue 무관
      - yearly  : 정기구독 (활성 vipN 모두 false). issue 필수
      - vip1..vip6 : 해당 슬롯의 정기+단품 통합. issue 필수. 슬롯 비활성이면 400

    호출자(엔드포인트)가 db.commit() + 활동 로그 기록 책임.
    """
    is_vip = scope.startswith("vip") and scope[3:].isdigit() and 1 <= int(scope[3:]) <= 6
    if scope not in ("monthly", "yearly") and not is_vip:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"잘못된 scope: {scope}. 'monthly' / 'yearly' / 'vip1'..'vip6' 중 하나여야 합니다.",
        )

    if scope == "yearly" and not issue:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="정기구독(YEARLY) 발송 생성 시 issue를 입력해야 합니다.",
        )

    if is_vip:
        slot_number = int(scope[3:])
        slot = next((s for s in vip_slots.list_slots() if s.slot_number == slot_number), None)
        if slot is None or not slot.is_enabled:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"비활성 슬롯입니다: {scope}",
            )
        if not issue:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="VIP 발송 생성 시 issue 를 입력해야 합니다 (정기 SendItem 처리용).",
            )

        deleted_count = send_crud.delete_preparing_sends(db=db, scope=scope, issue=issue)
        groups: List[SendGroup] = group_vip_for_send(db, slot_number, issue)
        created_sends = create_preparing_sends_from_groups(db, groups, issue=issue)
        return deleted_count, len(created_sends)

    # 1. 삭제 (monthly / yearly) — yearly는 이미 위에서 issue 필수 검증됨
    deleted_count = send_crud.delete_preparing_sends(db=db, scope=scope, issue=issue)

    # 2. PAID OrderItem 조회
    yearly_items, monthly_items = get_paid_order_items_for_dispatch(db)

    # 3. 그룹핑
    groups: List[SendGroup] = []
    if scope == "monthly":
        monthly_ids = [oi.order_item_id for oi in monthly_items]
        groups.extend(group_monthly_for_send(db, monthly_ids))
    else:  # yearly
        yearly_ids = [oi.order_item_id for oi in yearly_items]
        groups.extend(group_yearly_for_send(db, yearly_ids, issue))

    # 4. PREPARING Send 생성
    created_sends = create_preparing_sends_from_groups(db, groups, issue=issue)

    return deleted_count, len(created_sends)


def add_paid_to_preparing_yearly(
    db: Session,
    issue: str,
) -> int:
    """[정기 신규 결제 추가] — incremental. 기존 PREPARING Send 박스는 건드리지 않음.

    정기(YEARLY)는 1 OrderItem = 1 박스(Send) 매핑이므로 같은 배송지 묶음 재계산 불필요.
    신규 PAID OrderItem 만 추가로 박스 생성.

    group_yearly_for_send 가 이미 다음을 자동 제외:
    - 활성 SendItem 있는 OrderItem (= 이미 PREPARING 박스에 든 것)
    - DELIVERED/CANCELLED Send 안의 SendItem
    - 휴지(Pause)된 OrderItem
    - 활성 VIP 슬롯 매칭 OrderItem
    - last_send_issue 가드 (이전 호 이미 발송)
    - 구독 범위 밖 OrderItem
    - 해외(KR 외) OrderItem

    호출자(엔드포인트)가 db.commit() + 활동 로그 기록 책임.
    """
    if not issue:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="정기구독(YEARLY) 신규 결제 추가 시 issue를 입력해야 합니다.",
        )

    yearly_items, _ = get_paid_order_items_for_dispatch(db)
    yearly_ids = [oi.order_item_id for oi in yearly_items]
    groups: List[SendGroup] = group_yearly_for_send(db, yearly_ids, issue)
    created_sends = create_preparing_sends_from_groups(db, groups, issue=issue)
    return len(created_sends)


# ── 조회 ──────────────────────────────────────────────────────────────────────

def get_send_by_id(db: Session, send_id: int) -> Send:
    return send_crud.read_send_by_id(db=db, send_id=send_id)


def list_sends(db: Session, query: SendListQuery) -> Tuple[List[Send], int]:
    return send_crud.list_sends(db=db, query=query)


def get_sends_by_order(db: Session, order_id: int) -> List[Send]:
    return send_crud.read_sends_by_order_id(db=db, order_id=order_id)


def get_send_items(db: Session, send_id: int) -> List[SendItem]:
    return send_item_service.get_send_items_by_send(db=db, send_id=send_id)


# ── 수정 ──────────────────────────────────────────────────────────────────────

def update_tracking(
    db: Session,
    send: Send,
    tracking_no: Optional[str] = None,
    send_method: Optional[str] = None,
    courier_company: Optional[str] = None,
) -> Send:
    """DELIVERED Send의 운송장/배송업체/배송방법 수정.

    상태 검증: DELIVERED만 허용 (PREPARING/CANCELLED 거부).
    상태 전환은 동반하지 않음 (필드 수정만).
    """
    if send.send_status != "DELIVERED":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"운송장 수정은 DELIVERED 상태에서만 가능합니다. 현재 상태: {send.send_status}",
        )
    return send_crud.update_tracking(
        db=db,
        send=send,
        tracking_no=tracking_no,
        send_method=send_method,
        courier_company=courier_company,
    )


def update_admin_memo(db: Session, send: Send, admin_memo: Optional[str]) -> Send:
    """Send.admin_memo 수정. 상태 무관 (PREPARING/DELIVERED/CANCELLED 모두 허용)."""
    return send_crud.update_admin_memo(db=db, send=send, admin_memo=admin_memo)


def delete_single_preparing_send(db: Session, send: Send) -> int:
    """운영자 직접 박스 강제 삭제 — PREPARING 만 허용.

    DELIVERED/CANCELLED 차단. 잔여 SendItem 까지 cascade 삭제.
    Returns: 삭제된 SendItem 수 (활동 로그용).
    """
    if send.send_status != "PREPARING":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"박스 삭제는 PREPARING 상태에서만 가능합니다. 현재 상태: {send.send_status}",
        )
    return send_crud.delete_single_preparing_send(db=db, send=send)


def assert_resend_eligible(db: Session, send: Send) -> None:
    """재배송 가능 여부 검증 — Send 본체는 변경하지 않음 (활동 로그 기록은 호출자 책임).

    DELIVERED Send에서만 가능. PREPARING/CANCELLED 거부.
    """
    if send.send_status != "DELIVERED":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"재배송은 DELIVERED 상태에서만 가능합니다. 현재 상태: {send.send_status}",
        )


def delete_preparing_send_items_for_order_items(
    db: Session, order_item_ids: List[int]
) -> Tuple[int, int]:
    """주문/품목 취소 시 PREPARING Send에 묶인 SendItem 수술적 제거.

    - PREPARING Send에 속한 SendItem만 DELETE (cancelled_at 무관 — 미아 SendItem 방지)
    - 잔여 SendItem 0개 PREPARING Send도 함께 DELETE
    - 다른 PREPARING Send는 안 건드림 (send_id 유지)
    - DELIVERED/CANCELLED Send는 호출 전 _validate_cancellable 등에서 차단됨
    - commit/refresh는 호출자가 담당 (db.flush만 수행)

    Returns: (deleted_send_items_count, deleted_sends_count)
    """
    if not order_item_ids:
        return (0, 0)

    send_items = (
        db.query(SendItem)
        .join(Send, SendItem.send_id == Send.send_id)
        .filter(
            SendItem.order_item_id.in_(order_item_ids),
            Send.send_status == "PREPARING",
        )
        .all()
    )
    if not send_items:
        return (0, 0)

    affected_send_ids = {si.send_id for si in send_items}
    deleted_send_items_count = len(send_items)

    for si in send_items:
        db.delete(si)
    db.flush()

    deleted_sends_count = 0
    for sid in affected_send_ids:
        remaining = db.query(SendItem).filter(SendItem.send_id == sid).count()
        if remaining == 0:
            send = db.query(Send).get(sid)
            if send is not None:
                db.delete(send)
                deleted_sends_count += 1
    db.flush()

    return (deleted_send_items_count, deleted_sends_count)
