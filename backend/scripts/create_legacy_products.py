"""레거시 이관 전 products 사전 생성 스크립트.

엑셀에 등장하는 모든 호(start_issue ~ end_issue)에 대해
6개 prefix × 각 호 수만큼 YEARLY 상품을 생성한다.
이미 존재하는 product_code는 건너뜀(멱등성).

⚠️  실행 전 스크립트 상단 PRODUCT_SPECS의 가격/무게를 실제 값으로 채울 것.

사용법:
    cd backend
    python scripts/create_legacy_products.py --start 202501 --end 202607
    python scripts/create_legacy_products.py --start 202501 --end 202607 --dry-run
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

from sqlalchemy.orm import Session  # noqa: E402

from app.db.session import engine   # noqa: E402
from app.models.product import Product  # noqa: E402


# ── 상품 스펙 (실행 전 실제 값으로 채울 것) ──────────────────────────────────
# list_price, sale_price, cost_price: 원 단위 정수
# unit_weight: kg (소수점 2자리), unit_width/length/height: mm (소수점 1자리)
# 모르는 값은 None 유지 (DB NULL로 저장)
PRODUCT_SPECS: dict[str, dict] = {
    "W0": dict(
        list_price=42000,
        sale_price=38500,
        cost_price=0,
        unit_weight=1,
        unit_width=None,
        unit_length=None,
        unit_height=None,
    ),
    "WB": dict(
        list_price=54000,
        sale_price=49500,
        cost_price=0,
        unit_weight=1,
        unit_width=None,
        unit_length=None,
        unit_height=None,
    ),
    "HN": dict(
        list_price=72000,
        sale_price=66000,
        cost_price=0,
        unit_weight=1,
        unit_width=None,
        unit_length=None,
        unit_height=None,
    ),
    "CL": dict(
        list_price=60000,
        sale_price=55000,
        cost_price=0,
        unit_weight=1,
        unit_width=None,
        unit_length=None,
        unit_height=None,
    ),
    "CH": dict(
        list_price=42000,
        sale_price=38500,
        cost_price=0,
        unit_weight=1,
        unit_width=None,
        unit_length=None,
        unit_height=None,
    ),
    "JN": dict(
        list_price=42000,
        sale_price=38500,
        cost_price=0,
        unit_weight=1,
        unit_width=None,
        unit_length=None,
        unit_height=None,
    ),
}


# ── product_name 패턴 (§5 기준) ───────────────────────────────────────────────
def make_product_name(prefix: str, yy: int, m: int) -> str:
    patterns = {
        "W0": f"정기구독 - {yy}년 {m}월호 시작 말씀함께 [기본판]",
        "WB": f"정기구독 - {yy}년 {m}월호 시작 말씀함께 [큰글자판]",
        "HN": f"1년 정기구독 - {yy}년 {m}월호 시작 꿀땅 [미취학부]",
        "CL": f"1년 정기구독 - {yy}년 {m}월호 시작 어린이 말씀함께 [저학년 1~3학년]",
        "CH": f"1년 정기구독 - {yy}년 {m}월호 시작 어린이 말씀함께 [고학년 4~6학년]",
        "JN": f"1년 정기구독 - {yy}년 {m}월호 시작 청소년 말씀함께",
    }
    return patterns[prefix]


def issue_range(start: str, end: str) -> list[str]:
    """start~end 사이의 모든 YYYYMM 목록 반환."""
    result = []
    y, m = int(start[:4]), int(start[4:])
    ey, em = int(end[:4]), int(end[4:])
    while (y, m) <= (ey, em):
        result.append(f"{y:04d}{m:02d}")
        m += 1
        if m > 12:
            m = 1
            y += 1
    return result


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="레거시 이관용 YEARLY 상품 사전 생성")
    parser.add_argument("--start", required=True, metavar="YYYYMM", help="시작 호 (예: 202501)")
    parser.add_argument("--end",   required=True, metavar="YYYYMM", help="종료 호 (예: 202607)")
    parser.add_argument("--dry-run", action="store_true", help="DB에 쓰지 않고 생성 목록만 출력")
    return parser.parse_args()


def main() -> None:
    args = parse_args()

    if len(args.start) != 6 or len(args.end) != 6:
        print("❌ --start / --end 는 YYYYMM 6자리 형식이어야 합니다.")
        sys.exit(1)
    if args.start > args.end:
        print("❌ --start 가 --end 보다 늦을 수 없습니다.")
        sys.exit(1)

    issues = issue_range(args.start, args.end)
    prefixes = list(PRODUCT_SPECS.keys())

    print(f"생성 범위: {args.start} ~ {args.end}  ({len(issues)}개 호 × {len(prefixes)}종 = 최대 {len(issues) * len(prefixes)}개)")
    if args.dry_run:
        print("(dry-run 모드 — DB에 쓰지 않음)")
    print()

    created = skipped = 0

    with Session(engine) as session:
        for issue in issues:
            yy = int(issue[:4]) % 100  # 2025 → 25
            m  = int(issue[4:])        # 01 → 1

            for prefix in prefixes:
                product_code = f"{prefix}+{issue}"

                if session.query(Product).filter_by(product_code=product_code).first():
                    print(f"  SKIP  {product_code}")
                    skipped += 1
                    continue

                product_name = make_product_name(prefix, yy, m)
                spec = PRODUCT_SPECS[prefix]

                product = Product(
                    product_code=product_code,
                    product_kind="YEARLY",
                    product_name=product_name,
                    list_price=spec["list_price"],
                    sale_price=spec["sale_price"],
                    cost_price=spec["cost_price"],
                    unit_weight=spec["unit_weight"],
                    unit_width=spec["unit_width"],
                    unit_length=spec["unit_length"],
                    unit_height=spec["unit_height"],
                    subscribe_start_issue=issue,
                    is_active=True,
                    stock_quantity=0,
                )

                if not args.dry_run:
                    session.add(product)

                tag = "DRY" if args.dry_run else "ADD"
                print(f"  {tag}   {product_code:<14}  {product_name}")
                created += 1

        if not args.dry_run:
            session.commit()

    icon = "📋" if args.dry_run else "✅"
    print(f"\n{icon} 완료: 생성 {created}개, 건너뜀 {skipped}개")


if __name__ == "__main__":
    main()
