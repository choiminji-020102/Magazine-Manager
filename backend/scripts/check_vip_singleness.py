"""VIP 단일성 점검 스크립트.

운영 DB의 모든 Address 를 훑어 vip1~vip6 중 2개 이상 활성화된 위반 건을 출력한다.
V-7 단일성 검증을 안전하게 활성화하기 전에 1회 실행해 잔존 위반을 정리하기 위함.

사용법:
    python -m backend.scripts.check_vip_singleness
또는
    cd backend && python scripts/check_vip_singleness.py
"""
# 표준 라이브러리
import sys
from pathlib import Path

# 패키지 루트(=backend) 를 sys.path 에 강제 등록 (스크립트 직접 실행 케이스)
BACKEND_ROOT = Path(__file__).resolve().parent.parent
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

# 로컬 애플리케이션
from app.db.session import SessionLocal
from app.models.address import Address


def main() -> int:
    db = SessionLocal()
    try:
        addresses = db.query(Address).all()
        violations = []
        for addr in addresses:
            active = [n for n in range(1, 7) if getattr(addr, f"vip{n}")]
            if len(active) > 1:
                violations.append({
                    "address_id": addr.address_id,
                    "customer_id": addr.customer_id,
                    "recipient_name": addr.recipient_name,
                    "active_slots": active,
                })

        if violations:
            print(f"[FAIL] VIP 단일성 위반 {len(violations)}건 발견:")
            for v in violations:
                print(
                    f"  - address_id={v['address_id']} customer_id={v['customer_id']} "
                    f"recipient={v['recipient_name']!r} active=vip{v['active_slots']}"
                )
            print()
            print("운영자가 수동으로 vip 슬롯을 1개 이하로 정리한 뒤 재실행하세요.")
            return 1

        print(f"[OK] 점검 대상 {len(addresses)}건 모두 단일성 만족 (vip 활성 0~1개).")
        return 0
    finally:
        db.close()


if __name__ == "__main__":
    sys.exit(main())
