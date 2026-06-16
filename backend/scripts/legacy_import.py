"""레거시 엑셀 → DB 이관 스크립트.

엑셀 1행 = 1 order + 1 order_item으로 적재.
고객: 전화번호 기준 중복 조회/생성 (customer_service 헬퍼 재사용)
배송지: find_or_create_address 헬퍼 재사용
send/send_items: 생성 안 함 → order_items.last_send_issue 세팅으로 대체

사전 조건:
  - truncate_all_tables.py 실행 완료
  - create_legacy_products.py 실행 완료
  - 관리자 재가입 완료

사용법:
    cd backend
    python scripts/legacy_import.py --file /path/to/excel.xlsx --dry-run
    python scripts/legacy_import.py --file /path/to/excel.xlsx
"""
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path
from typing import Optional

BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

import openpyxl  # noqa: E402
from sqlalchemy.orm import Session  # noqa: E402

from app.core.utils import now_kst, format_phone_number, count_issue_diff  # noqa: E402
from app.db.session import engine  # noqa: E402
from app.models.order import Order  # noqa: E402
from app.models.order_item import OrderItem  # noqa: E402
from app.models.product import Product  # noqa: E402
from app.schemas.address import AddressCreate  # noqa: E402
from app.schemas.customer import CustomerCreate  # noqa: E402
from app.services import address_service, customer_service  # noqa: E402


# ── prefix 매핑 (§5) ─────────────────────────────────────────────────────────
PRODUCT_NAME_TO_PREFIX: dict[str, str] = {
    "기본판":   "W0",
    "큰글":     "WB",
    "꿀땅":     "HN",
    "어린이저": "CL",
    "어린이고": "CH",
    "청소년":   "JN",
}

REQUIRED_HEADERS = [
    "상품명", "구독", "수량",
    "수령인", "수령인 휴대전화", "수령인 우편번호", "수령인 주소(전체)",
    "비고", "마지막발송호",
]


# ── 파싱 헬퍼 ────────────────────────────────────────────────────────────────


def parse_subscribe_range(value) -> tuple[str, str]:
    """'구독 : 25년 07월호~26년 07월호' → ('202507', '202607'). 연도는 반드시 2자리."""
    m = re.search(
        r"(\d{2})년\s*(\d{1,2})월호\s*[~～]\s*(\d{2})년\s*(\d{1,2})월호",
        str(value).strip(),
    )
    if not m:
        raise ValueError(f"'구독' 파싱 실패: {value!r}  (형식: 'YY년 M월호~YY년 M월호', 연도 2자리)")
    sy, sm, ey, em = m.group(1), m.group(2), m.group(3), m.group(4)
    return f"20{sy}{int(sm):02d}", f"20{ey}{int(em):02d}"


def cell_str(value) -> Optional[str]:
    if value is None:
        return None
    s = str(value).strip()
    return s if s else None


def parse_last_send_issue(value) -> Optional[str]:
    """마지막발송호 파싱. 비면 None. float(202605.0) 대응 + 6자리 검증."""
    if value is None:
        return None
    s = str(value).strip()
    if not s:
        return None
    # 엑셀 숫자 형식 대응: 202605.0 → "202605"
    try:
        s = str(int(float(s)))
    except ValueError:
        pass
    if not re.fullmatch(r"\d{6}", s):
        raise ValueError(f"'마지막발송호' 형식 오류: {value!r}  (형식: YYYYMM 6자리)")
    return s


def parse_postal_code(value) -> str:
    """숫자만 추출 후 5자리로 zero-fill. 엑셀 숫자 형식(5792.0) 대응."""
    digits = re.sub(r"\D", "", str(value))
    if not digits:
        raise ValueError(f"'수령인 우편번호' 숫자 없음: {value!r}")
    return digits.zfill(5)


# ── 행 처리 ──────────────────────────────────────────────────────────────────

def process_row(db: Session, row_num: int, row: dict, dry_run: bool) -> None:
    # 값 추출 및 파싱
    subscribe_start, subscribe_end = parse_subscribe_range(row["구독"])

    product_key = cell_str(row["상품명"])
    if product_key not in PRODUCT_NAME_TO_PREFIX:
        raise ValueError(f"'상품명' 허용값 아님: {row['상품명']!r}  허용: {list(PRODUCT_NAME_TO_PREFIX)}")
    prefix = PRODUCT_NAME_TO_PREFIX[product_key]
    product_code = f"{prefix}+{subscribe_start}"

    try:
        order_num = int(row["수량"])
    except (TypeError, ValueError):
        raise ValueError(f"'수량' 정수 변환 실패: {row['수량']!r}")

    customer_name = cell_str(row["수령인"])
    phone_raw     = cell_str(row["수령인 휴대전화"])
    if not customer_name or not phone_raw:
        raise ValueError("'수령인' 또는 '수령인 휴대전화' 값 없음")
    formatted_phone, _ = format_phone_number(phone_raw)

    postal_code       = parse_postal_code(row["수령인 우편번호"])
    recipient_address = cell_str(row["수령인 주소(전체)"])
    if not recipient_address:
        raise ValueError("'수령인 주소(전체)' 값 없음")

    last_send_issue = parse_last_send_issue(row["마지막발송호"])
    admin_memo      = cell_str(row["비고"])

    subscribe_period = count_issue_diff(subscribe_start, subscribe_end) + 1
    if subscribe_period <= 0:
        raise ValueError(
            f"'구독' 기간 오류: {subscribe_start}~{subscribe_end} → {subscribe_period}개월 "
            f"(시작호가 종료호보다 늦음)"
        )

    # 상품 조회
    product = db.query(Product).filter_by(product_code=product_code).first()
    if not product:
        raise ValueError(
            f"products에 없음: {product_code!r} → create_legacy_products.py 먼저 실행"
        )

    send_fee       = 0  # YEARLY 고정
    total_amount   = product.sale_price * order_num
    payment_amount = total_amount + send_fee

    # 진행 상황 출력
    print(
        f"  ROW {row_num:>3}  {customer_name}({formatted_phone})  "
        f"{product_code}  구독:{subscribe_start}~{subscribe_end}({subscribe_period}개월)  "
        f"수량:{order_num}  마지막:{last_send_issue or '-'}  금액:{total_amount:,}원"
    )

    if dry_run:
        return

    # 고객 조회/생성 (내부 commit)
    customer = customer_service.get_customer_by_phone(db=db, phone=formatted_phone)
    if not customer:
        customer = customer_service.create_customer(
            db=db,
            customer_in=CustomerCreate(
                customer_phone=formatted_phone,
                customer_name=customer_name,
                # create_channel 기본값 OFFLINE
            ),
        )

    # 배송지 조회/생성 (내부 commit)
    address, _ = address_service.find_or_create_address(
        db=db,
        address_in=AddressCreate(
            customer_id=customer.customer_id,
            recipient_name=customer_name,
            recipient_phone=phone_raw,
            postal_code=postal_code,
            recipient_address=recipient_address,
            country_code="KR",
        ),
    )

    # 주문 생성
    order = Order(
        customer_id=customer.customer_id,
        address_id=address.address_id,
        order_channel="OFFLINE",
        order_status="PAID",
        payment_method="tcash",
        total_amount=total_amount,
        send_fee=send_fee,
        discount_amount=0,
        refund_amount=0,
        payment_amount=payment_amount,
        payment_at=now_kst(),
    )
    db.add(order)
    db.flush()  # order_id 확보

    # 주문 품목 생성
    order_item = OrderItem(
        order_id=order.order_id,
        address_id=address.address_id,
        product_code=product_code,
        product_kind="YEARLY",
        product_name=product.product_name,
        list_price=product.list_price,
        sale_price=product.sale_price,
        order_num=order_num,
        subscribe_start_issue=subscribe_start,
        subscribe_end_issue=subscribe_end,
        final_subscribe_start_issue=subscribe_start,
        final_subscribe_end_issue=subscribe_end,
        subscribe_period=subscribe_period,
        last_send_issue=last_send_issue,
        admin_memo=admin_memo,
        refund_amount=0,
    )
    db.add(order_item)
    db.commit()


# ── 진입점 ───────────────────────────────────────────────────────────────────

def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="레거시 엑셀 → DB 이관")
    parser.add_argument("--file", required=True, metavar="PATH", help="엑셀 파일 경로 (.xlsx)")
    parser.add_argument("--dry-run", action="store_true", help="DB에 쓰지 않고 파싱/매핑 결과만 출력")
    return parser.parse_args()


def main() -> None:
    args = parse_args()

    excel_path = Path(args.file)
    if not excel_path.exists():
        print(f"❌ 파일 없음: {excel_path}")
        sys.exit(1)

    wb = openpyxl.load_workbook(excel_path, data_only=True)
    ws = wb.active

    # 헤더 검증
    headers = [cell.value for cell in next(ws.iter_rows(min_row=1, max_row=1))]
    missing = [h for h in REQUIRED_HEADERS if h not in headers]
    if missing:
        print(f"❌ 헤더 누락: {missing}")
        sys.exit(1)
    col_idx = {h: headers.index(h) for h in REQUIRED_HEADERS}

    total = ws.max_row - 1
    print(f"파일: {excel_path.name}  ({total}행)")
    if args.dry_run:
        print("(dry-run 모드 — DB에 쓰지 않음)")
    print()

    success = error = 0

    with Session(engine) as db:
        for row_num, cells in enumerate(ws.iter_rows(min_row=2, values_only=True), start=2):
            if all(v is None for v in cells):
                continue

            row = {h: cells[col_idx[h]] for h in REQUIRED_HEADERS}

            try:
                process_row(db=db, row_num=row_num, row=row, dry_run=args.dry_run)
                success += 1
            except Exception as e:
                db.rollback()  # 미커밋 order/order_item 롤백
                print(f"  ❌ ROW {row_num}  {e}")
                error += 1

    icon = "📋" if args.dry_run else "✅"
    print(f"\n{icon} 완료: 성공 {success}행, 오류 {error}행")
    if error:
        print("   오류 행은 수정 후 재실행하세요 (고객/배송지는 멱등: 이미 생성된 것은 재사용)")


if __name__ == "__main__":
    main()
