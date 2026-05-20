"""Cafe24 주문 일괄 import.

매핑 규칙은 CAFE24_ORDER_IMPORT_MAPPING.md 참조.
구현 설계는 CAFE24_ORDER_IMPORT_PLAN.md 참조.

핵심:
- 각 주문은 독립 트랜잭션 (실패 시 그 주문만 rollback, 다른 주문 영향 X)
- 기존 order_service.create_order는 사용하지 않고 직접 db.add (commit 통제 위해)
- import 종료 후 활동 로그 1건 기록
"""
import re
from datetime import datetime
from typing import List, Optional, Tuple

import httpx
from fastapi import HTTPException, Request, status as http_status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.utils import calculate_subscribe_end_issue, format_phone_number
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
# option_price는 옵션 추가금 (1년=0, 2년=+1년치 product_price, 3년=+2년치)이며 할인 필드가 아니므로 제외
ITEM_DISCOUNT_FIELDS = [
    "coupon_discount_price", "additional_discount_price",
    "app_item_discount_amount",
]

# 1/2/3년 옵션을 가진 YEARLY 상품 prefix. 그 외 YEARLY 는 1년 고정 — Cafe24 옵션이
# 단일 선택지("1년 구독" 같은 라벨) 로만 등록돼 있어 option_value 가 W0/WB 의
# "구독 기간=N년 연장" 형식과 다름. 어떤 라벨이 와도 무시하고 12개월 처리.
# 꿀땅(HN) / 어린이 저학년(CL) / 어린이 고학년(CH) / 청소년(JN) 은 1년 정기구독만 판매.
#
# 주의 — dispatch_excel_service.GICHULYU_YEARLY_PREFIXES 와 현재 우연히 같은 집합이지만
# 의미가 다른 차원이므로 별도 유지: 본 상수는 "Cafe24 옵션 존재 여부", 저쪽은 "발송 채널 분류".
# 미래에 HN 에 2년 옵션이 붙거나 발송 채널이 재편되면 두 집합이 어긋날 수 있음.
YEARLY_OPTIONABLE_PREFIXES = {"W0", "WB"}

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
    """option_value에서 '구독 기간=N년 연장' 또는 '구독 연장=N년 연장' 파싱 → N×12. 실패 시 None.

    MONTHLY 상품은 option_value가 빈 문자열로 와서 None을 반환 — 호출자가 product_kind 분기로 처리.
    """
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


# ── Cafe24 주문 목록 조회 ─────────────────────────────────────────────────────

async def _fetch_base_orders(
    db: Session,
    start_date: str,
    end_date: str,
    client: httpx.AsyncClient,
) -> dict:
    """기간 내 Cafe24 주문 목록 → {order_id: order_data}.

    embed 파라미터로 단일 호출에 buyer/receivers/items까지 동봉되어 옴
    (개별 detail API 호출 불필요).
    order_status=N20 필터로 '배송준비중' 주문만 받음
    (결제완료 + 우리 시스템에서 아직 발송 처리 안 한 주문 = 새 import 후보).
    """
    r = await cafe24_admin_service.call_cafe24(
        method="GET",
        url=f"{BASE_URL}/orders",
        db=db,
        client=client,
        params={
            "start_date": start_date,
            "end_date": end_date,
            "limit": 1000,
            "embed": "items,receivers,buyer",
            "order_status": "N20",
        },
    )
    if r.is_error:
        raise HTTPException(
            status_code=r.status_code,
            detail=f"Cafe24 주문 목록 조회 실패: {r.text}",
        )
    return {o["order_id"]: o for o in r.json().get("orders", [])}


# ── 목록 조회용 매핑 (UI 표시 전용, 검증 없음) ────────────────────────────────

async def list_mapped_orders(
    db: Session,
    start_date: str,
    end_date: str,
    client: httpx.AsyncClient,
) -> dict:
    """기간 내 Cafe24 주문 목록을 매핑 문서대로 변환해 반환.

    - _fetch_base_orders 단일 호출로 buyer/receivers/items까지 동봉되어 옴 (embed)
    - UI 표시 목적이므로 검증(total_amount, sale_price, 할인 0 등)은 생략
    - 상품 매칭 실패(미등록) 시 내부 필드는 null + Cafe24 원본 코드 표시
    - 응답에 already_imported 플래그 포함
    """
    # 1) Cafe24 주문 목록 조회 (embed로 buyer/receivers/items 동봉)
    base_by_id = await _fetch_base_orders(db, start_date, end_date, client)
    order_ids = list(base_by_id.keys())

    # 2) 내부 DB 중복 체크 - import 시 중복 방지용
    existing_ids: set[str] = set()
    if order_ids:
        existing_ids = {
            row[0] for row in db.query(Order.external_order_id).filter(
                Order.external_order_id.in_(order_ids)
            ).all()
        }

    # 3) 모든 Cafe24 상품 코드 모아 내부 Product 일괄 조회
    all_cafe24_codes = set()
    for base in base_by_id.values():
        for it in (base.get("items") or []):
            code = it.get("product_code")
            if code:
                all_cafe24_codes.add(code)
    products = db.query(Product).filter(
        Product.external_product_code_cafe24.in_(all_cafe24_codes)
    ).all() if all_cafe24_codes else []
    product_map = {p.external_product_code_cafe24: p for p in products}

    # 4) 각 주문 매핑 (base에서 buyer/receivers/items 직접 추출)
    mapped_orders: List[dict] = []
    for order_id, base in base_by_id.items():
        buyer = base.get("buyer")
        receivers = base.get("receivers") or []
        items = base.get("items") or []
        mapped = _build_mapped_order(
            base=base,
            buyer=buyer,
            receivers=receivers,
            items=items,
            product_map=product_map,
            already_imported=(order_id in existing_ids),
        )
        mapped_orders.append(mapped)

    return {"orders": mapped_orders}


def _build_mapped_order(
    *,
    base: dict,
    buyer: Optional[dict],
    receivers: List[dict],
    items: List[dict],
    product_map: dict,
    already_imported: bool,
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
    payment_method = PAYMENT_METHOD_MAP.get(pm_code, pm_code)  # 미매핑은 원본(pm_code) 노출

    # 금액
    initial = base.get("initial_order_amount") or {}
    send_fee = to_int(initial.get("shipping_fee"))
    total_amount = to_int(initial.get("order_price_amount"))
    payment_amount = to_int(base.get("payment_amount"))

    # Customer
    if buyer:
        raw_customer_phone = buyer.get("cellphone") or ""
        customer_phone, _ = format_phone_number(raw_customer_phone)
        customer_name = buyer.get("name") or ""
        customer_email = buyer.get("email") or None
        admin_memo = (buyer.get("customer_notification") or "").strip() or None
    else:
        customer_phone = ""
        customer_name = ""
        customer_email = None
        admin_memo = None

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

    # Items
    # unit_price = Cafe24 1년 단가 (product_price 원본)
    # sale_price = 1세트 실제 지불액 = product_price + option_price (옵션 추가금 포함, MONTHLY는 option_price=0)
    # line_total = 라인 총액 = sale_price × order_num
    mapped_items: List[dict] = []
    for it in items:
        cafe24_code = it.get("product_code")
        product = product_map.get(cafe24_code)
        unit_price = to_int(it.get("product_price"))
        quantity = it.get("quantity") or 0
        option_value = it.get("option_value") or ""

        if product:
            sale_price = unit_price + to_int(it.get("option_price"))
            if product.product_kind == "YEARLY":
                if product.product_code[:2] in YEARLY_OPTIONABLE_PREFIXES:
                    subscribe_period = parse_subscribe_period(option_value)
                else:
                    subscribe_period = 12  # 1년 고정 상품군 — option_value 무시
            else:
                subscribe_period = 1
            line_total = sale_price * quantity
            mapped_items.append({
                "cafe24_product_code": cafe24_code,
                "external_order_item_id": it.get("order_item_code"),
                "product_code": product.product_code,
                "product_kind": product.product_kind,
                "product_name": product.product_name,
                "unit_price": unit_price,
                "sale_price": sale_price,
                "order_num": quantity,
                "line_total": line_total,        # UI 전용 (= OrderItem.sale_price × OrderItem.order_num, DB 저장 안 됨. 합산은 Order.total_amount)
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
                "unit_price": unit_price,
                "sale_price": None,
                "order_num": quantity,
                "line_total": None,              # UI 전용 (DB 저장 안 됨)
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
        "customer_name": customer_name,
        "customer_phone": customer_phone,
        "customer_email": customer_email,
        "admin_memo": admin_memo,                # 관리자 메모 (Customer.admin_memo, Cafe24 buyer.customer_notification)
        "recipient_name": receiver.get("name") or "",
        "recipient_phone": recipient_phone,
        "country_code": "KR",
        "postal_code": receiver.get("zipcode") or "",
        "recipient_address": recipient_address,
        "customer_memo": customer_memo,          # 배송 메모 (Address.customer_memo, Cafe24 receivers[0].shipping_message)
        "items": mapped_items,
        "total_amount": total_amount,
        "payment_amount": payment_amount,
        "already_imported": already_imported,
    }


# ── Customer / Address 매칭 (commit 없음 — 호출자 책임) ──────────────────────

def _find_or_create_customer(db: Session, buyer: dict) -> Customer:
    """customer_phone(정규화) + customer_name으로 매칭 후 없으면 신규. db.flush()로 customer_id 확보.

    buyer.customer_notification(Cafe24 관리자 메모)는 Customer.admin_memo에 매핑:
    - 신규 생성: cafe24 메모를 그대로 채움
    - 기존 매칭: cafe24 메모가 있으면 기존 admin_memo에 줄바꿈으로 append (정보 손실 방지)
    """
    raw_customer_phone = buyer.get("cellphone") or ""
    if not raw_customer_phone:
        raise ImportSkip("buyer.cellphone이 비어있음")
    formatted_phone, phone_num4 = format_phone_number(raw_customer_phone)

    customer_name = (buyer.get("name") or "").strip()
    if not customer_name:
        raise ImportSkip("buyer.name이 비어있음")

    cafe24_memo = (buyer.get("customer_notification") or "").strip() or None

    existing = db.query(Customer).filter(
        Customer.customer_phone == formatted_phone,
        Customer.customer_name == customer_name,
        Customer.is_deleted == False,
    ).first()
    if existing:
        if cafe24_memo:
            if existing.admin_memo:
                existing.admin_memo = f"{existing.admin_memo}\n{cafe24_memo}"
            else:
                existing.admin_memo = cafe24_memo
        return existing

    customer = Customer(
        customer_phone=formatted_phone,
        customer_phone_num4=phone_num4,
        customer_name=customer_name,
        customer_email=buyer.get("email") or None,
        admin_memo=cafe24_memo,
        create_channel="CAFE24",
        is_active=True,
    )
    db.add(customer)
    db.flush()  # customer_id 확보
    return customer


def _find_or_create_address(db: Session, customer_id: int, receiver: dict) -> Address:
    """4개 필드(name+phone+postal_code+address) 일치 시 재사용, 없으면 신규.

    4개 필드는 Address 모델에서 nullable=False —
    의미 있는 값이 하나라도 없으면 ImportSkip.
    """
    recipient_name = (receiver.get("name") or "").strip()
    if not recipient_name:
        raise ImportSkip("receiver.name이 비어있음")

    raw_recipient_phone = (receiver.get("cellphone") or "").strip()
    if not raw_recipient_phone:
        raise ImportSkip("receiver.cellphone이 비어있음")
    # recipient_phone: Customer.customer_phone과 동일한 정규화 포맷으로 저장 → 매칭 누락 방지
    recipient_phone, _ = format_phone_number(raw_recipient_phone)

    postal_code = (receiver.get("zipcode") or "").strip()
    if not postal_code:
        raise ImportSkip("receiver.zipcode가 비어있음")

    # address_full이 있으면 우선, 없으면 address1+address2 결합 (방어)
    recipient_address = (
        receiver.get("address_full")
        or " ".join(filter(None, [receiver.get("address1"), receiver.get("address2")])).strip()
        or ""
    ).strip()
    if not recipient_address:
        raise ImportSkip("receiver.address가 비어있음 (address_full / address1+address2 모두 빈)")

    customer_memo = receiver.get("shipping_message") or None

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
    external_order_id: str,
    base_order: dict,
) -> List[dict]:
    """Cafe24 주문 1건 → 내부 DB(Customer/Address/Order/OrderItem) 변환·저장.

    검증 실패 시 ImportSkip 예외, 비치명적 이상은 warnings 리스트로 반환.
    트랜잭션 commit/rollback은 호출자 책임 (db.add/flush만 수행).
    """
    warnings: List[dict] = []

    def warn(msg: str):
        warnings.append({"external_order_id": external_order_id, "message": msg})

    # 1) base_order에서 buyer / receivers / items 추출 (embed로 이미 동봉됨)
    buyer = base_order.get("buyer")
    receivers = base_order.get("receivers") or []
    items = base_order.get("items") or []
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

    # 3) order_status 검증 — N20 필터로 paid="T" + canceled="F" 보장
    # 그 외 조합은 N20 정의 변경/Cafe24 데이터 drift 의미이므로 즉시 skip
    paid = base_order.get("paid")
    canceled = base_order.get("canceled")
    if paid != "T" or canceled != "F":
        raise ImportSkip(
            f"N20 필터 통과했는데 paid/canceled가 예상과 다름: paid={paid!r}, canceled={canceled!r}"
        )
    order_status = "PAID"

    # 4) 시각 필드 (KST naive)
    # canceled="F" 보장 → cancel_date는 항상 None이므로 변수 생략
    order_at = parse_cafe24_datetime(base_order.get("order_date"))
    payment_at = parse_cafe24_datetime(base_order.get("payment_date"))

    # paid="T" 보장 → payment_date 반드시 있어야 함. 없으면 데이터 이상으로 간주하고 skip
    if not payment_at:
        raise ImportSkip("paid=T인데 payment_date 없음")

    # 5) 상품 매칭 + product_price(1년 단가) 검증 + YEARLY 옵션 구독 개월 수 계산
    # Cafe24 product_price는 옵션(1/2/3년 연장)과 무관하게 항상 1년 단가로 내려오므로
    # 내부 Product.sale_price(1년 단가)와 직접 비교 가능.
    # 옵션 추가금은 items[].option_price에 들어있어 OrderItem.sale_price 계산 시 합산.
    cafe24_codes = list({it.get("product_code") for it in items if it.get("product_code")})
    products = db.query(Product).filter(
        Product.external_product_code_cafe24.in_(cafe24_codes)
    ).all()
    product_map = {p.external_product_code_cafe24: p for p in products}

    item_subscribe_periods: dict[str, int] = {}  # external_order_item_id → 구독 개월 수 (MONTHLY=1)
    for it in items:
        cafe24_code = it.get("product_code")
        product = product_map.get(cafe24_code)
        if not product:
            raise ImportSkip(f"상품 매칭 실패: {cafe24_code}")
        cafe24_price = to_int(it.get("product_price"))
        if cafe24_price != product.sale_price:
            raise ImportSkip(
                f"product_price 불일치 (상품 {cafe24_code}): Cafe24={cafe24_price}, Product.sale_price={product.sale_price}"
            )
        if product.product_kind == "YEARLY":
            if product.product_code[:2] in YEARLY_OPTIONABLE_PREFIXES:
                period_months = parse_subscribe_period(it.get("option_value") or "")
                if period_months is None:
                    raise ImportSkip(
                        f"YEARLY 옵션 상품 {cafe24_code}의 option_value에서 구독 기간 파싱 실패: "
                        f"{(it.get('option_value') or '')!r}"
                    )
            else:
                period_months = 12  # 1년 고정 상품군 — option_value 무시
            item_subscribe_periods[it.get("order_item_code")] = period_months
        else:
            item_subscribe_periods[it.get("order_item_code")] = 1

    # 6) 금액 계산 + total_amount 검증
    # sale_price = product_price + option_price (옵션 추가금 포함, MONTHLY는 option_price=0)
    initial = base_order.get("initial_order_amount") or {}
    items_sum = sum(
        (to_int(it.get("product_price")) + to_int(it.get("option_price"))) * (it.get("quantity") or 0)
        for it in items
    )
    cafe24_total = to_int(initial.get("order_price_amount"))
    if cafe24_total != items_sum:
        raise ImportSkip(
            f"total_amount 불일치: order_price_amount={cafe24_total}, Σ((product_price+option_price)×quantity)={items_sum}"
        )

    # 7) send_fee (Cafe24 값 그대로)
    send_fee = to_int(initial.get("shipping_fee"))
    expected_payment = items_sum + send_fee

    # 8) payment_amount / total_amount_due 검증
    # paid="T" 보장 → 결제금액 일치 + 잔액 0 두 가지 검증
    cafe24_payment = to_int(base_order.get("payment_amount"))
    cafe24_due = to_int(initial.get("total_amount_due"))
    if cafe24_payment != expected_payment:
        raise ImportSkip(
            f"payment_amount 불일치: Cafe24={cafe24_payment}, 계산={expected_payment}"
        )
    if cafe24_due != 0:
        raise ImportSkip(f"paid=T인데 total_amount_due={cafe24_due} (미납 잔액 존재)")

    # 9) 주문 레벨 할인 0 검증 (경고)
    for f in ORDER_DISCOUNT_FIELDS:
        v = to_int(initial.get(f))
        if v != 0:
            warn(f"할인 필드 {f}={v} (정책 위반)")

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
    )
    if order_at:
        order.order_at = order_at
    db.add(order)
    db.flush()  # order.order_id 확보

    # 13) OrderItem 생성 (sale_price = product_price + option_price, 옵션 추가금 포함)
    for it in items:
        cafe24_code = it.get("product_code")
        product = product_map[cafe24_code]
        if not product.subscribe_start_issue:
            raise ImportSkip(
                f"상품 {cafe24_code}의 subscribe_start_issue가 비어있음 (product_code: {product.product_code})"
            )
        quantity = it.get("quantity") or 0
        external_item_id = it.get("order_item_code")
        option_value = it.get("option_value") or ""
        sale_price = to_int(it.get("product_price")) + to_int(it.get("option_price"))
        subscribe_period = item_subscribe_periods[external_item_id]

        # 구독 종료 호 (MONTHLY는 시작 호 = 종료 호)
        if product.product_kind == "YEARLY":
            subscribe_end_issue = calculate_subscribe_end_issue(
                product.subscribe_start_issue, subscribe_period
            )
        else:  # MONTHLY
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
    # Cafe24는 과거 주문을 나중에 import하는 패턴이므로 실제 주문 시각(order_at) 사용.
    # 더 최근 주문이 이미 있다면 덮어쓰지 않음 (backwards 이동 방지).
    if order_at and (customer.last_order_at is None or order_at > customer.last_order_at):
        customer.last_order_at = order_at

    db.flush()
    return warnings


# ── 메인 오케스트레이션 (실제 DB import) ─────────────────────────────────────

async def import_orders(
    db: Session,
    external_order_ids: List[str],
    client: httpx.AsyncClient,
    current_admin: Admin,
    request: Request,
    dry_run: bool = False,
) -> dict:
    """Cafe24 주문번호 배열을 일괄 import — 각 주문마다 _import_single_order 호출.

    각 주문은 독립 트랜잭션 (실패 시 그 주문만 rollback). 종료 후 활동 로그 1건 기록.
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
    base_by_id = await _fetch_base_orders(db, period_start, period_end, client)

    # 0-2) 이미 import된 외부 주문번호 일괄 확인 (N+1 방지)
    # 루프 진입 후 외부에서 동시 import된 케이스는 IntegrityError 핸들러가 잡아줌.
    existing_external_ids = set(
        row[0] for row in db.query(Order.external_order_id)
        .filter(Order.external_order_id.in_(external_order_ids))
        .all()
    )

    imported_order_ids: List[str] = []
    skipped_orders: List[dict] = []
    warnings: List[dict] = []

    for external_order_id in external_order_ids:
        if external_order_id in existing_external_ids:
            skipped_orders.append({"external_order_id": external_order_id, "reason": "이미 import됨"})
            continue

        base = base_by_id.get(external_order_id)
        if not base:
            skipped_orders.append({"external_order_id": external_order_id, "reason": "Cafe24 응답에서 찾을 수 없음 (기간 외/삭제)"})
            continue

        try:
            order_warnings = await _import_single_order(db, external_order_id, base)
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
