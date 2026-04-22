"""Cafe24 주문 일괄 import.

매핑 규칙은 CAFE24_ORDER_IMPORT_MAPPING.md 참조.
구현 설계는 CAFE24_ORDER_IMPORT_PLAN.md 참조.

핵심:
- 각 주문은 독립 트랜잭션 (실패 시 그 주문만 rollback, 다른 주문 영향 X)
- 기존 order_service.create_order는 사용하지 않고 직접 db.add (commit 통제 위해)
- import 종료 후 활동 로그 1건 기록
"""
import asyncio
import re
from datetime import datetime
from typing import List, Optional, Tuple

import httpx
from fastapi import HTTPException, Request, status as http_status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.utils import calculate_subscribe_end_issue, format_phone_number, now_kst
from app.models.activity_log import ActivityAction, ActivityTargetType
from app.models.address import Address
from app.models.admin import Admin
from app.models.customer import Customer
from app.models.order import Order
from app.models.order_item import OrderItem
from app.models.product import Product
from app.services import activity_log_service, cafe24_admin_service


MALL_ID = settings.CAFE24_MALL_ID
BASE_URL = f"https://{MALL_ID}.cafe24api.com/api/v2/admin"

# Cafe24 payment_method 코드 → 내부 PaymentMethod (1:1 매칭, 동일 값)
PAYMENT_METHOD_MAP = {"cash": "cash", "card": "card", "icash": "icash", "tcash": "tcash"}

# 할인 0 검증 대상 필드 (initial_order_amount.*)
ORDER_DISCOUNT_FIELDS = [
    "coupon_discount_price", "app_discount_amount",
    "membership_discount_amount", "set_product_discount_amount",
    "shipping_fee_discount_amount", "coupon_shipping_fee_amount",
    "market_other_discount_amount", "points_spent_amount",
    "credits_spent_amount", "point_incentive_amount",
]

# 할인 0 검증 대상 필드 (items[].*)
# option_price는 제외: Cafe24가 옵션 없는 단품에도 product_price와 동일한 값을 내려줌 → "옵션 추가금" 의미 아님
ITEM_DISCOUNT_FIELDS = [
    "coupon_discount_price", "additional_discount_price",
    "app_item_discount_amount",
]

_PERIOD_YEAR_RE = re.compile(r"구독 (?:기간|연장)=(\d+)년 연장")
_OPTION_PERIOD_RE = re.compile(r"기간:\s*(\d+)/(\d+)\s*~")


# ── 변환 헬퍼 (매핑 문서의 to_int / parse_cafe24_datetime 구현) ────────────────

def to_int(value) -> int:
    """Cafe24 금액 문자열(예: '38500.00') → int. None/빈값은 0."""
    if value in (None, "", 0):
        return 0
    return int(float(value))


def parse_cafe24_datetime(value: Optional[str]) -> Optional[datetime]:
    """Cafe24 ISO 8601 문자열 → KST naive datetime. None/빈값은 None."""
    if not value:
        return None
    return datetime.fromisoformat(value).replace(tzinfo=None)


def extract_period_from_ids(external_order_ids: List[str]) -> Tuple[str, str]:
    """주문번호 앞 8자리(YYYYMMDD)에서 min/max 날짜 추출 → ('YYYY-MM-DD', 'YYYY-MM-DD')."""
    dates = sorted({oid[:8] for oid in external_order_ids if len(oid) >= 8 and oid[:8].isdigit()})
    if not dates:
        raise HTTPException(
            status_code=http_status.HTTP_400_BAD_REQUEST,
            detail="주문번호에서 날짜를 추출할 수 없습니다.",
        )
    return f"{dates[0][:4]}-{dates[0][4:6]}-{dates[0][6:8]}", \
           f"{dates[-1][:4]}-{dates[-1][4:6]}-{dates[-1][6:8]}"


def parse_subscribe_period(option_value: str) -> Optional[int]:
    """option_value에서 '구독 기간=N년 연장' 파싱 → N×12. 실패 시 None."""
    if not option_value:
        return None
    m = _PERIOD_YEAR_RE.search(option_value)
    return int(m.group(1)) * 12 if m else None


def parse_period_start_issue(option_value: str) -> Optional[str]:
    """option_value의 '기간: 26/6~...'에서 시작 호(YYYYMM) 추출. 실패 시 None."""
    if not option_value:
        return None
    m = _OPTION_PERIOD_RE.search(option_value)
    if not m:
        return None
    yy, mm = m.groups()
    return f"20{int(yy):02d}{int(mm):02d}"


# ── 단일 주문 import 실패 예외 ────────────────────────────────────────────────

class ImportSkip(Exception):
    """주문을 skip해야 하는 검증 실패. message는 사용자에게 노출됨."""
    def __init__(self, message: str):
        super().__init__(message)
        self.message = message


# ── Cafe24 API 호출 헬퍼 ──────────────────────────────────────────────────────

async def _fetch_base_orders(
    start_date: str, end_date: str, db: Session, client: httpx.AsyncClient,
) -> dict:
    """기간 내 Cafe24 주문 목록 → {order_id: order_data}."""
    r = await cafe24_admin_service.call_cafe24(
        method="GET",
        url=f"{BASE_URL}/orders",
        db=db,
        client=client,
        params={"start_date": start_date, "end_date": end_date, "limit": 1000},
    )
    if r.is_error:
        raise HTTPException(
            status_code=r.status_code,
            detail=f"Cafe24 주문 목록 조회 실패: {r.text}",
        )
    return {o["order_id"]: o for o in r.json().get("orders", [])}


async def _fetch_order_detail(
    order_id: str, db: Session, client: httpx.AsyncClient,
) -> Tuple[Optional[dict], List[dict], List[dict]]:
    """단일 주문의 buyer + receivers + items 병렬 조회.

    HTTP 에러 발생 시 즉시 ImportSkip (상태 코드 명시). 본문이 비어있는 경우는 호출자에서 구분 처리.
    """
    base = f"{BASE_URL}/orders/{order_id}"

    buyer_r, receivers_r, items_r = await asyncio.gather(
        cafe24_admin_service.call_cafe24(method="GET", url=f"{base}/buyer", db=db, client=client),
        cafe24_admin_service.call_cafe24(method="GET", url=f"{base}/receivers", db=db, client=client),
        cafe24_admin_service.call_cafe24(method="GET", url=f"{base}/items", db=db, client=client),
    )

    if buyer_r.is_error:
        raise ImportSkip(f"buyer 조회 HTTP 에러 (status={buyer_r.status_code})")
    if receivers_r.is_error:
        raise ImportSkip(f"receivers 조회 HTTP 에러 (status={receivers_r.status_code})")
    if items_r.is_error:
        raise ImportSkip(f"items 조회 HTTP 에러 (status={items_r.status_code})")

    buyer = buyer_r.json().get("buyer")
    receivers = receivers_r.json().get("receivers", [])
    items = items_r.json().get("items", [])
    return buyer, receivers, items


# ── Customer / Address 매칭 (commit 없음 — 호출자 책임) ──────────────────────

def _find_or_create_customer(db: Session, buyer: dict) -> Customer:
    """customer_phone(정규화)으로 매칭 후 없으면 신규. db.flush()로 customer_id 확보."""
    raw_phone = buyer.get("cellphone") or ""
    if not raw_phone:
        raise ImportSkip("buyer.cellphone이 비어있음")
    formatted_phone, phone_num4 = format_phone_number(raw_phone)

    existing = db.query(Customer).filter(
        Customer.customer_phone == formatted_phone,
        Customer.is_deleted == False,
    ).first()
    if existing:
        return existing

    customer = Customer(
        customer_phone=formatted_phone,
        customer_phone_num4=phone_num4,
        customer_name=buyer.get("name") or "",
        customer_email=buyer.get("email") or None,
        create_channel="CAFE24",
        is_active=True,
    )
    db.add(customer)
    db.flush()  # customer_id 확보
    return customer


def _find_or_create_address(db: Session, customer_id: int, receiver: dict) -> Address:
    """4개 필드(name+phone+postal_code+address) 일치 시 재사용, 없으면 신규."""
    recipient_name = receiver.get("name") or ""
    # recipient_phone: Customer.customer_phone과 동일한 정규화 포맷으로 저장 → 매칭 누락 방지
    recipient_phone, _ = format_phone_number(receiver.get("cellphone") or "")
    postal_code = receiver.get("zipcode") or ""
    # address_full이 있으면 우선, 없으면 address1+address2 결합 (방어)
    recipient_address = (
        receiver.get("address_full")
        or " ".join(filter(None, [receiver.get("address1"), receiver.get("address2")])).strip()
        or ""
    )
    customer_memo = receiver.get("shipping_message") or None
    if customer_memo == "":
        customer_memo = None

    existing = db.query(Address).filter(
        Address.customer_id == customer_id,
        Address.recipient_name == recipient_name,
        Address.recipient_phone == recipient_phone,
        Address.postal_code == postal_code,
        Address.recipient_address == recipient_address,
    ).first()
    if existing:
        return existing

    address = Address(
        customer_id=customer_id,
        recipient_name=recipient_name,
        recipient_phone=recipient_phone,
        country_code="KR",
        postal_code=postal_code,
        recipient_address=recipient_address,
        customer_memo=customer_memo,
    )
    db.add(address)
    db.flush()  # address_id 확보
    return address


# ── 단일 주문 처리 (트랜잭션 단위) ────────────────────────────────────────────

async def _import_single_order(
    db: Session,
    client: httpx.AsyncClient,
    external_order_id: str,
    base_order: dict,
) -> List[dict]:
    """주문 1건 처리. 성공 시 warnings 리스트 반환. 실패 시 ImportSkip 예외.
    트랜잭션 commit/rollback은 호출자 책임.
    """
    warnings: List[dict] = []

    def warn(msg: str):
        warnings.append({"external_order_id": external_order_id, "message": msg})

    # 1) Cafe24 상세 조회 (buyer / receivers / items 병렬) — HTTP 에러 시 내부에서 ImportSkip
    buyer, receivers, items = await _fetch_order_detail(external_order_id, db, client)
    if not buyer:
        raise ImportSkip("buyer 데이터 비어있음")
    if not receivers:
        raise ImportSkip("receivers 데이터 비어있음")
    if not items:
        raise ImportSkip("items 데이터 비어있음")

    # 2) payment_method 매핑
    pm_codes = base_order.get("payment_method") or []
    pm_code = pm_codes[0] if pm_codes else None
    payment_method = PAYMENT_METHOD_MAP.get(pm_code)
    if not payment_method:
        raise ImportSkip(f"미매핑 payment_method 코드: {pm_code!r}")

    # 3) order_status 결정 (paid / canceled 4가지 조합)
    paid = base_order.get("paid")
    canceled = base_order.get("canceled")
    # 부분 결제/부분 취소("M")는 매핑 정책상 지원 안 함 — 발생 시 명시적으로 skip
    if paid == "M" or canceled == "M":
        raise ImportSkip(
            f"부분 결제/취소 케이스 지원 안 함 (paid={paid!r}, canceled={canceled!r})"
        )
    if canceled == "T":
        order_status = "CANCELLED" if paid == "T" else "UNPAID_CANCELLED"
    elif paid == "T":
        order_status = "PAID"
    else:
        order_status = "ORDERED"

    # 4) 시각 필드 (KST naive)
    order_at = parse_cafe24_datetime(base_order.get("order_date"))
    payment_at = parse_cafe24_datetime(base_order.get("payment_date"))
    cancelled_at = parse_cafe24_datetime(base_order.get("cancel_date"))

    # 보조 일관성 검증 (경고)
    if paid == "T" and not payment_at:
        warn("paid=T인데 payment_date 없음")
    if canceled == "T" and not cancelled_at:
        warn("canceled=T인데 cancel_date 없음")

    # 5) 금액 계산 + total_amount 검증
    initial = base_order.get("initial_order_amount") or {}
    items_sum = sum(to_int(it.get("product_price")) * (it.get("quantity") or 0) for it in items)
    cafe24_total = to_int(initial.get("order_price_amount"))
    if cafe24_total != items_sum:
        raise ImportSkip(
            f"total_amount 불일치: order_price_amount={cafe24_total}, Σ(product_price×quantity)={items_sum}"
        )

    # 6) send_fee (Cafe24 값 그대로)
    send_fee = to_int(initial.get("shipping_fee"))
    expected_payment = items_sum + send_fee

    # 7) payment_amount / total_amount_due 검증 (경고)
    cafe24_payment = to_int(base_order.get("payment_amount"))
    cafe24_due = to_int(initial.get("total_amount_due"))
    if paid == "T":
        if cafe24_payment != expected_payment:
            warn(f"payment_amount 불일치: Cafe24={cafe24_payment}, 계산={expected_payment}")
        if cafe24_due != 0:
            warn(f"paid=T인데 total_amount_due={cafe24_due}")
    elif paid == "F":
        if cafe24_due != expected_payment:
            warn(f"paid=F인데 total_amount_due({cafe24_due}) ≠ 계산({expected_payment})")

    # 8) 주문 레벨 할인 0 검증 (경고)
    for f in ORDER_DISCOUNT_FIELDS:
        v = to_int(initial.get(f))
        if v != 0:
            warn(f"할인 필드 {f}={v} (정책 위반)")

    # 9) 상품 매칭 (한 번에 prefetch) + sale_price 일치 검증
    cafe24_codes = list({it.get("product_code") for it in items if it.get("product_code")})
    products = db.query(Product).filter(
        Product.external_product_code_cafe24.in_(cafe24_codes)
    ).all()
    product_map = {p.external_product_code_cafe24: p for p in products}

    for it in items:
        cafe24_code = it.get("product_code")
        product = product_map.get(cafe24_code)
        if not product:
            raise ImportSkip(f"상품 매칭 실패: {cafe24_code}")
        cafe24_price = to_int(it.get("product_price"))
        if cafe24_price != product.sale_price:
            raise ImportSkip(
                f"sale_price 불일치 (상품 {cafe24_code}): Cafe24={cafe24_price}, Product.sale_price={product.sale_price}"
            )

    # 10) 품목 레벨 할인 0 검증 (경고)
    for it in items:
        for f in ITEM_DISCOUNT_FIELDS:
            v = to_int(it.get(f))
            if v != 0:
                warn(f"품목 {it.get('product_code')} 할인 {f}={v}")

    # 11) Customer / Address 매칭/생성
    customer = _find_or_create_customer(db, buyer)
    address = _find_or_create_address(db, customer.customer_id, receivers[0])

    # 12) Order 생성 (db.add만 — commit은 호출자)
    order = Order(
        customer_id=customer.customer_id,
        address_id=address.address_id,
        external_order_id=external_order_id,
        order_channel="CAFE24",
        order_status=order_status,
        total_amount=items_sum,
        send_fee=send_fee,
        payment_amount=expected_payment,
        payment_method=payment_method,
        payment_at=payment_at,
        cancelled_at=cancelled_at,
    )
    if order_at:
        order.order_at = order_at
    db.add(order)
    db.flush()  # order.order_id 확보

    # 13) OrderItem 생성
    for it in items:
        cafe24_code = it.get("product_code")
        product = product_map[cafe24_code]
        if not product.subscribe_start_issue:
            raise ImportSkip(
                f"상품 {cafe24_code}의 subscribe_start_issue가 비어있음 (product_code: {product.product_code})"
            )
        quantity = it.get("quantity") or 0
        sale_price = to_int(it.get("product_price"))
        external_item_id = it.get("order_item_code")
        option_value = it.get("option_value") or ""

        # 구독 기간
        if product.product_kind == "YEARLY":
            period = parse_subscribe_period(option_value)
            if period is None:
                raise ImportSkip(
                    f"YEARLY 상품 {cafe24_code}의 option_value에서 구독 기간 파싱 실패: {option_value!r}"
                )
            subscribe_period = period
            subscribe_end_issue = calculate_subscribe_end_issue(
                product.subscribe_start_issue, subscribe_period
            )
        else:  # MONTHLY
            subscribe_period = 1
            subscribe_end_issue = product.subscribe_start_issue

        # option_value 시작 호 ↔ Product.subscribe_start_issue 교차 검증 (경고)
        parsed_start = parse_period_start_issue(option_value)
        if parsed_start and parsed_start != product.subscribe_start_issue:
            warn(
                f"option_value 시작 호({parsed_start}) ≠ Product.subscribe_start_issue({product.subscribe_start_issue}) [상품 {cafe24_code}]"
            )

        order_item = OrderItem(
            order_id=order.order_id,
            address_id=address.address_id,
            external_order_item_id=external_item_id,
            product_code=product.product_code,
            product_kind=product.product_kind,
            product_name=product.product_name,
            list_price=product.list_price,
            sale_price=sale_price,
            order_num=quantity,
            subscribe_start_issue=product.subscribe_start_issue,
            subscribe_end_issue=subscribe_end_issue,
            final_subscribe_start_issue=product.subscribe_start_issue,
            final_subscribe_end_issue=subscribe_end_issue,
            subscribe_period=subscribe_period,
        )
        db.add(order_item)

    # 14) 고객 last_order_at 업데이트
    customer.last_order_at = now_kst()

    db.flush()
    return warnings


# ── 메인 오케스트레이션 ───────────────────────────────────────────────────────

# ── 목록 조회용 매핑 (UI 표시 전용, 검증 없음) ────────────────────────────────

async def list_mapped_orders(
    db: Session,
    start_date: str,
    end_date: str,
    client: httpx.AsyncClient,
) -> dict:
    """기간 내 Cafe24 주문 목록을 매핑 문서대로 변환해 반환.

    - 각 주문마다 buyer/receivers/items 병렬 조회 후 매핑 적용
    - UI 표시 목적이므로 검증(total_amount, sale_price, 할인 0 등)은 생략
    - 상품 매칭 실패(미등록) 시 내부 필드는 null + Cafe24 원본 코드 표시
    - 응답에 already_imported 플래그 포함
    """
    # 1) Cafe24 주문 목록 조회
    base_by_id = await _fetch_base_orders(start_date, end_date, db, client)
    order_ids = list(base_by_id.keys())

    # 2) 내부 DB 중복 체크
    existing_ids: set[str] = set()
    if order_ids:
        existing_ids = {
            row[0] for row in db.query(Order.external_order_id).filter(
                Order.external_order_id.in_(order_ids)
            ).all()
        }

    # 3) 모든 주문의 buyer/receivers/items 병렬 조회
    details = await asyncio.gather(
        *[_fetch_order_detail(oid, db, client) for oid in order_ids],
        return_exceptions=True,
    )

    # 4) 모든 Cafe24 상품 코드 모아 내부 Product 일괄 조회
    all_cafe24_codes = set()
    for detail in details:
        if isinstance(detail, Exception):
            continue
        _, _, items_list = detail
        for it in items_list:
            code = it.get("product_code")
            if code:
                all_cafe24_codes.add(code)
    products = db.query(Product).filter(
        Product.external_product_code_cafe24.in_(all_cafe24_codes)
    ).all() if all_cafe24_codes else []
    product_map = {p.external_product_code_cafe24: p for p in products}

    # 5) 각 주문 매핑
    mapped_orders: List[dict] = []
    for oid, detail in zip(order_ids, details):
        base = base_by_id[oid]
        if isinstance(detail, Exception):
            mapped_orders.append(_build_mapped_error(oid, base, oid in existing_ids, str(detail)))
            continue
        buyer, receivers, items_list = detail
        mapped = _build_mapped_order(
            base=base,
            buyer=buyer,
            receivers=receivers,
            items=items_list,
            product_map=product_map,
            already_imported=(oid in existing_ids),
        )
        mapped_orders.append(mapped)

    return {"orders": mapped_orders}


def _build_mapped_order(
    *, base: dict, buyer: Optional[dict], receivers: List[dict], items: List[dict],
    product_map: dict, already_imported: bool,
) -> dict:
    """단일 주문 매핑 — UI 표시용. 검증 수행 안 함."""
    paid = base.get("paid")
    canceled = base.get("canceled")

    # order_status
    if paid == "M" or canceled == "M":
        order_status = "UNKNOWN"  # 부분결제/취소 — UI에 '지원안함'으로 표시
    elif canceled == "T":
        order_status = "CANCELLED" if paid == "T" else "UNPAID_CANCELLED"
    elif paid == "T":
        order_status = "PAID"
    else:
        order_status = "ORDERED"

    # payment_method
    pm_codes = base.get("payment_method") or []
    pm_code = pm_codes[0] if pm_codes else None
    payment_method = PAYMENT_METHOD_MAP.get(pm_code, pm_code)  # 미매핑은 원본 노출

    # 금액
    initial = base.get("initial_order_amount") or {}
    send_fee = to_int(initial.get("shipping_fee"))
    total_amount = to_int(initial.get("order_price_amount"))
    payment_amount_val = to_int(base.get("payment_amount"))

    # Customer
    if buyer:
        raw_phone = buyer.get("cellphone") or ""
        customer_phone, _ = format_phone_number(raw_phone)
        customer_name = buyer.get("name") or ""
        customer_email = buyer.get("email") or None
    else:
        customer_phone = ""
        customer_name = ""
        customer_email = None

    # Address (receivers[0])
    receiver = receivers[0] if receivers else {}
    raw_recipient_phone = receiver.get("cellphone") or ""
    recipient_phone, _ = format_phone_number(raw_recipient_phone)
    recipient_address = (
        receiver.get("address_full")
        or " ".join(filter(None, [receiver.get("address1"), receiver.get("address2")])).strip()
        or ""
    )
    customer_memo = receiver.get("shipping_message") or None
    if customer_memo == "":
        customer_memo = None

    # Items
    mapped_items: List[dict] = []
    for it in items:
        cafe24_code = it.get("product_code")
        product = product_map.get(cafe24_code)
        sale_price = to_int(it.get("product_price"))
        quantity = it.get("quantity") or 0
        option_value = it.get("option_value") or ""

        if product:
            if product.product_kind == "YEARLY":
                period = parse_subscribe_period(option_value)
                subscribe_period = period if period is not None else None
            else:
                subscribe_period = 1
            mapped_items.append({
                "cafe24_product_code": cafe24_code,
                "external_order_item_id": it.get("order_item_code"),
                "product_code": product.product_code,
                "product_kind": product.product_kind,
                "product_name": product.product_name,
                "sale_price": sale_price,
                "order_num": quantity,
                "subscribe_period": subscribe_period,
                "option_value": option_value,
            })
        else:
            mapped_items.append({
                "cafe24_product_code": cafe24_code,
                "external_order_item_id": it.get("order_item_code"),
                "product_code": None,
                "product_kind": None,
                "product_name": None,
                "sale_price": sale_price,
                "order_num": quantity,
                "subscribe_period": None,
                "option_value": option_value,
            })

    return {
        "external_order_id": base.get("order_id"),
        "order_channel": "CAFE24",
        "order_status": order_status,
        "send_fee": send_fee,
        "payment_method": payment_method,
        "order_at": base.get("order_date"),
        "payment_at": base.get("payment_date"),
        "cancelled_at": base.get("cancel_date"),
        "customer_name": customer_name,
        "customer_phone": customer_phone,
        "customer_email": customer_email,
        "recipient_name": receiver.get("name") or "",
        "recipient_phone": recipient_phone,
        "country_code": "KR",
        "postal_code": receiver.get("zipcode") or "",
        "recipient_address": recipient_address,
        "customer_memo": customer_memo,
        "items": mapped_items,
        "total_amount": total_amount,
        "payment_amount": payment_amount_val,
        "already_imported": already_imported,
    }


def _build_mapped_error(order_id: str, base: dict, already_imported: bool, error: str) -> dict:
    """detail 조회 실패 시 최소 정보만 담은 매핑 실패 응답."""
    return {
        "external_order_id": order_id,
        "order_channel": "CAFE24",
        "order_status": None,
        "send_fee": None,
        "payment_method": None,
        "order_at": base.get("order_date"),
        "payment_at": base.get("payment_date"),
        "cancelled_at": base.get("cancel_date"),
        "customer_name": None,
        "customer_phone": None,
        "customer_email": None,
        "recipient_name": None,
        "recipient_phone": None,
        "country_code": None,
        "postal_code": None,
        "recipient_address": None,
        "customer_memo": None,
        "items": [],
        "total_amount": None,
        "payment_amount": None,
        "already_imported": already_imported,
        "detail_fetch_error": error,
    }


async def import_orders(
    db: Session,
    external_order_ids: List[str],
    client: httpx.AsyncClient,
    current_admin: Admin,
    request: Request,
    dry_run: bool = False,
) -> dict:
    """선택된 Cafe24 주문번호 배열을 일괄 import.

    각 주문은 독립 트랜잭션 (실패 시 그 주문만 rollback). 마지막에 활동 로그 1건 기록.
    dry_run=True면 저장하지 않고 매핑·검증 결과만 반환 (미리보기 용도).
    응답: {imported_count, skipped_count, imported_order_ids, skipped_orders, warnings, dry_run}
    """
    if not external_order_ids:
        raise HTTPException(
            status_code=http_status.HTTP_400_BAD_REQUEST,
            detail="external_order_ids가 비어있습니다.",
        )

    # 0) 기간 추출 + Cafe24 base 일괄 조회 (1회)
    period_start, period_end = extract_period_from_ids(external_order_ids)
    base_by_id = await _fetch_base_orders(period_start, period_end, db, client)

    imported_order_ids: List[str] = []
    skipped_orders: List[dict] = []
    warnings: List[dict] = []

    for external_order_id in external_order_ids:
        # DB 중복 검사
        already = db.query(Order).filter(Order.external_order_id == external_order_id).first()
        if already:
            skipped_orders.append({"external_order_id": external_order_id, "reason": "이미 import됨"})
            continue

        base = base_by_id.get(external_order_id)
        if not base:
            skipped_orders.append({"external_order_id": external_order_id, "reason": "Cafe24 응답에서 찾을 수 없음 (기간 외/삭제)"})
            continue

        try:
            order_warnings = await _import_single_order(db, client, external_order_id, base)
            if dry_run:
                db.rollback()   # 미리보기: 저장 취소
            else:
                db.commit()
            imported_order_ids.append(external_order_id)
            warnings.extend(order_warnings)
        except ImportSkip as e:
            db.rollback()
            skipped_orders.append({"external_order_id": external_order_id, "reason": e.message})
        except IntegrityError:
            # 동시 INSERT 경쟁 상황에서 UNIQUE 제약 위반 → 다른 요청이 이미 import함
            db.rollback()
            skipped_orders.append({
                "external_order_id": external_order_id,
                "reason": "이미 import됨 (동시 요청 감지)",
            })
        except Exception as e:
            db.rollback()
            skipped_orders.append({"external_order_id": external_order_id, "reason": f"내부 오류: {e}"})

    # 활동 로그 1건 (실제 실행 시에만, 트랜잭션 외부, 자체 commit)
    if not dry_run:
        activity_log_service.create_log(
            db=db,
            action=ActivityAction.CREATE,
            target_type=ActivityTargetType.CAFE24,
            admin_id=current_admin.admin_id,
            admin_name=current_admin.admin_name,
            target_name="Cafe24 주문 Import",
            details={
                "period": {"start": period_start, "end": period_end},
                "imported_count": len(imported_order_ids),
                "skipped_count": len(skipped_orders),
                "imported_order_ids": imported_order_ids,
                "skipped_orders": skipped_orders,
                "warnings": warnings,
            },
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent"),
        )

    return {
        "imported_count": len(imported_order_ids),
        "skipped_count": len(skipped_orders),
        "imported_order_ids": imported_order_ids,
        "skipped_orders": skipped_orders,
        "warnings": warnings,
        "dry_run": dry_run,
    }
