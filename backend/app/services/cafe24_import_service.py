# 표준 라이브러리
import logging
from datetime import datetime
from typing import Any, Dict, List, Optional

# 서드파티 라이브러리
import httpx
from sqlalchemy.orm import Session

# 로컬 애플리케이션
from app.core.config import settings
from app.models.order import Order
from app.schemas.order import (
    OrderChannel,
    OrderCreate,
    OrderCustomerInput,
    OrderAddressInput,
    OrderItemCreateInOrder,
    OrderStatus,
    PaymentMethod,
)
from app.services import order_service

logger = logging.getLogger(__name__)

# Cafe24 결제수단 → 우리 PaymentMethod 매핑
_PAYMENT_METHOD_MAP: Dict[str, PaymentMethod] = {
    "card": PaymentMethod.CARD,
    "cash": PaymentMethod.DEPOSIT,
    "tcash": PaymentMethod.TRANSFER,
    "icash": PaymentMethod.VIRTUAL,
    "cell": PaymentMethod.CELL,
    "credit": PaymentMethod.POINT,
    "point": PaymentMethod.POINT,
    "pointfy": PaymentMethod.POINT,
    "prepaid": PaymentMethod.OTHER,
    "cvs": PaymentMethod.OTHER,
    "cod": PaymentMethod.OTHER,
    "coupon": PaymentMethod.OTHER,
    "market_discount": PaymentMethod.OTHER,
    "giftcard": PaymentMethod.OTHER,
    "pointcard": PaymentMethod.OTHER,
    "etc": PaymentMethod.OTHER,
}


def _map_payment_method(methods: List[str]) -> PaymentMethod:
    """Cafe24 결제수단 배열 → PaymentMethod (첫번째 유효한 수단 기준)"""
    for m in methods:
        if m in _PAYMENT_METHOD_MAP:
            return _PAYMENT_METHOD_MAP[m]
    return PaymentMethod.OTHER


def _parse_cafe24_datetime(dt_str: Optional[str]) -> Optional[datetime]:
    """Cafe24 날짜 문자열 → datetime (ISO 8601, +09:00 포함)"""
    if not dt_str:
        return None
    try:
        return datetime.fromisoformat(dt_str)
    except ValueError:
        return None


def _to_int(value: Any) -> int:
    """문자열 금액 → 정수 (소수점 절삭)"""
    if value is None:
        return 0
    return int(float(str(value)))


async def _cafe24_get(
    access_token: str,
    mall_id: str,
    path: str,
) -> dict:
    """Cafe24 Admin API GET 요청"""
    url = f"https://{mall_id}.cafe24api.com/api/v2/admin{path}"
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json",
        "X-Cafe24-Api-Version": settings.CAFE24_API_VERSION,
    }
    async with httpx.AsyncClient() as client:
        resp = await client.get(url, headers=headers)
        resp.raise_for_status()
        return resp.json()


async def import_orders(
    db: Session,
    access_token: str,
    mall_id: str,
) -> Dict[str, Any]:
    """
    Cafe24 주문 임포트 — 배송 전 결제완료 주문을 가져와서 우리 DB에 저장.
    반환: { imported_count, skipped_count, errors }
    """
    # 1. Cafe24에서 배송 전 + 결제완료 주문 목록 조회
    orders_data = await _cafe24_get(
        access_token, mall_id,
        "/orders?paid=T&shipping_status=F&limit=100",
    )
    cafe24_orders = orders_data.get("orders", [])

    imported_count = 0
    skipped_count = 0
    errors: List[Dict[str, str]] = []

    for c24_order in cafe24_orders:
        order_id = c24_order.get("order_id")
        try:
            # 2. 중복 체크 (external_order_id)
            existing = (
                db.query(Order)
                .filter(Order.external_order_id == order_id)
                .first()
            )
            if existing:
                skipped_count += 1
                continue

            # 3. 주문 상세 조회: buyer, receivers, items
            buyer_data = await _cafe24_get(access_token, mall_id, f"/orders/{order_id}/buyer")
            receiver_data = await _cafe24_get(access_token, mall_id, f"/orders/{order_id}/receivers")
            items_data = await _cafe24_get(access_token, mall_id, f"/orders/{order_id}/items")

            buyer = buyer_data.get("buyer", {})
            receivers = receiver_data.get("receivers", [])
            items = items_data.get("items", [])

            if not items:
                skipped_count += 1
                errors.append({"order_id": order_id, "message": "품목이 없습니다."})
                continue

            receiver = receivers[0] if receivers else {}

            # 4. 품목 매핑 — custom_product_code 사용
            order_items: List[OrderItemCreateInOrder] = []
            has_unmapped = False
            for item in items:
                product_code = item.get("custom_product_code") or ""
                if not product_code:
                    has_unmapped = True
                    errors.append({
                        "order_id": order_id,
                        "message": f"상품 '{item.get('product_name')}'의 custom_product_code가 비어있습니다.",
                    })
                    continue
                order_items.append(OrderItemCreateInOrder(
                    product_code=product_code,
                    order_num=item.get("quantity", 1),
                    sale_price=_to_int(item.get("product_price")),
                ))

            if not order_items:
                skipped_count += 1
                continue

            # 5. 필드 매핑 → OrderCreate
            payment_methods = c24_order.get("payment_method", [])
            actual_amount = c24_order.get("actual_order_amount", {})

            order_create = OrderCreate(
                external_order_id=order_id,
                order_channel=OrderChannel.CAFE24,
                order_status=OrderStatus.PAID,
                customer=OrderCustomerInput(
                    customer_name=buyer.get("name") or c24_order.get("billing_name", ""),
                    customer_phone=buyer.get("cellphone") or buyer.get("phone") or "",
                    customer_email=buyer.get("email"),
                ),
                address=OrderAddressInput(
                    recipient_name=receiver.get("name") or buyer.get("name", ""),
                    recipient_phone=receiver.get("cellphone") or receiver.get("phone") or "",
                    postal_code=receiver.get("zipcode") or "",
                    recipient_address=(
                        f"{receiver.get('address1', '')} {receiver.get('address2', '')}".strip()
                    ),
                    country_code=receiver.get("country_code") or "KR",
                    customer_memo=receiver.get("shipping_message"),
                ),
                items=order_items,
                payment_method=_map_payment_method(payment_methods),
                send_fee=_to_int(actual_amount.get("shipping_fee")),
                discount_amount=0,
                order_at=_parse_cafe24_datetime(c24_order.get("order_date")),
                payment_at=_parse_cafe24_datetime(c24_order.get("payment_date")),
            )

            # 6. 주문 생성 (기존 create_order 로직 재사용)
            order_service.create_order(db=db, order_in=order_create)
            imported_count += 1

        except Exception as e:
            skipped_count += 1
            errors.append({"order_id": order_id, "message": str(e)})
            logger.warning(f"Cafe24 주문 임포트 실패: {order_id} — {e}")

    return {
        "imported_count": imported_count,
        "skipped_count": skipped_count,
        "errors": errors,
    }
