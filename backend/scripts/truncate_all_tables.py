"""[유지보수] 모든 테이블 데이터 TRUNCATE 스크립트.

스키마(테이블 구조)와 alembic 마이그레이션 이력은 유지하고,
모든 데이터 테이블의 행을 삭제 + AUTO_INCREMENT 1로 리셋한다.

⚠️  운영 DB 에서 실행하면 모든 운영 데이터가 영구 삭제된다. 복구 불가.
⚠️  실행 전 .env 의 DB_HOST 가 의도한 환경인지 반드시 재확인.

안전장치 3중:
  1. 현재 가리키는 DB host / name 출력
  2. host 를 직접 타이핑하여 확인 (오타 방지 + 의도 재확인)
  3. CI/스크립트 환경에서 강제 실행 시 `--yes <host>` 인자로 모두 우회 가능

사용법:
    cd backend && python scripts/truncate_all_tables.py
    cd backend && python scripts/truncate_all_tables.py --yes your-app.mycafe24.com
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

# backend/ 를 sys.path 에 추가 (app.* import 위해)
BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

from sqlalchemy import text  # noqa: E402

from app.core.config import settings  # noqa: E402
from app.db.base import Base  # noqa: E402
from app.db.session import engine  # noqa: E402
import app.models  # noqa: F401, E402 — 모델 import 로 Base.metadata 채움


# 비우지 않을 테이블 (alembic 이력은 스키마 일부)
PROTECTED_TABLES = {"alembic_version"}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="모든 테이블 데이터 TRUNCATE")
    parser.add_argument(
        "--yes",
        metavar="HOST",
        help="인터랙티브 확인 우회. 인자값은 settings.DB_HOST 와 일치해야 함.",
    )
    return parser.parse_args()


def confirm_or_exit(args: argparse.Namespace) -> None:
    print("=" * 60)
    print("⚠️  모든 테이블 데이터 TRUNCATE")
    print("=" * 60)
    print(f"  DB_HOST : {settings.DB_HOST}")
    print(f"  DB_PORT : {settings.DB_PORT}")
    print(f"  DB_NAME : {settings.DB_NAME}")
    print(f"  DB_USER : {settings.DB_USER}")
    print("=" * 60)

    if args.yes:
        if args.yes != settings.DB_HOST:
            print(f"❌ --yes 인자({args.yes!r}) 가 DB_HOST({settings.DB_HOST!r}) 와 다릅니다.")
            sys.exit(2)
        print(f"✅ --yes {args.yes} 확인. 진행합니다.\n")
        return

    print("이 작업은 영구적이며 복구 불가능합니다.")
    print(f"계속하려면 DB_HOST 를 정확히 입력하세요: {settings.DB_HOST}")
    typed = input("> ").strip()
    if typed != settings.DB_HOST:
        print("❌ 입력이 일치하지 않습니다. 작업을 취소합니다.")
        sys.exit(1)
    print()


def get_target_tables() -> list[str]:
    """Base.metadata.sorted_tables 기준 보호 테이블 제외한 이름 목록."""
    return [t.name for t in Base.metadata.sorted_tables if t.name not in PROTECTED_TABLES]


def truncate_all(table_names: list[str]) -> None:
    if not table_names:
        print("비울 테이블이 없습니다.")
        return

    with engine.begin() as conn:
        # FK 제약 해제 (의존성 무시하고 일괄 TRUNCATE)
        conn.execute(text("SET FOREIGN_KEY_CHECKS = 0"))
        try:
            for name in table_names:
                row_count = conn.execute(text(f"SELECT COUNT(*) FROM `{name}`")).scalar()
                conn.execute(text(f"TRUNCATE TABLE `{name}`"))
                print(f"  ✓ {name:<24} ({row_count:>6} rows → 0)")
        finally:
            conn.execute(text("SET FOREIGN_KEY_CHECKS = 1"))

    print(f"\n✅ {len(table_names)} 개 테이블 TRUNCATE 완료.")
    if PROTECTED_TABLES:
        print(f"   (보존: {', '.join(sorted(PROTECTED_TABLES))})")


def main() -> None:
    args = parse_args()
    confirm_or_exit(args)
    targets = get_target_tables()
    print(f"대상 테이블 {len(targets)} 개:\n")
    truncate_all(targets)


if __name__ == "__main__":
    main()
