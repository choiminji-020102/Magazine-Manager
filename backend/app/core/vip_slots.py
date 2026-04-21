"""VIP 슬롯 라벨/활성화 설정 저장소.

DB 테이블 대신 단일 JSON 파일(`backend/data/vip_slots.json`)에 저장한다.
- 파일이 없으면 첫 접근 시 기본값(6슬롯, label=null, is_enabled=false)으로 자동 생성
- 모든 접근은 스레드 락으로 보호 (단일 프로세스 내 동시성 대응)
- 관리자 편집 UX는 DB 기반과 동일 (PATCH API가 뒤에서 파일 쓰기)
"""
# 표준 라이브러리
import json
from pathlib import Path
from threading import Lock
from typing import List, Optional

# 서드파티 라이브러리
from pydantic import BaseModel


SLOT_COUNT = 6
LABEL_MAX_LENGTH = 50

# backend/app/core/vip_slots.py → backend/data/vip_slots.json
DATA_DIR = Path(__file__).resolve().parents[2] / "data"
VIP_SLOTS_FILE = DATA_DIR / "vip_slots.json"

_file_lock = Lock()


class VipSlot(BaseModel):
    slot_number: int
    label: Optional[str] = None
    is_enabled: bool = False


def _default_slots() -> List[dict]:
    return [
        {"slot_number": i, "label": None, "is_enabled": False}
        for i in range(1, SLOT_COUNT + 1)
    ]


def _write_slots(slots: List[dict]) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    tmp_file = VIP_SLOTS_FILE.with_suffix(".json.tmp")
    with tmp_file.open("w", encoding="utf-8") as f:
        json.dump(slots, f, ensure_ascii=False, indent=2)
    tmp_file.replace(VIP_SLOTS_FILE)


def _read_or_initialize() -> List[dict]:
    if not VIP_SLOTS_FILE.exists():
        slots = _default_slots()
        _write_slots(slots)
        return slots

    with VIP_SLOTS_FILE.open("r", encoding="utf-8") as f:
        slots = json.load(f)

    # 파일이 손상되었거나 슬롯 수가 바뀐 경우 누락분 보강
    existing = {s["slot_number"]: s for s in slots if isinstance(s, dict)}
    merged = []
    for i in range(1, SLOT_COUNT + 1):
        if i in existing:
            entry = existing[i]
            merged.append({
                "slot_number": i,
                "label": entry.get("label"),
                "is_enabled": bool(entry.get("is_enabled", False)),
            })
        else:
            merged.append({"slot_number": i, "label": None, "is_enabled": False})
    if merged != slots:
        _write_slots(merged)
    return merged


def list_slots() -> List[VipSlot]:
    with _file_lock:
        slots = _read_or_initialize()
    return [VipSlot(**s) for s in slots]


def update_slot(
    slot_number: int,
    *,
    label: Optional[str] = None,
    is_enabled: Optional[bool] = None,
    label_set: bool = False,
    is_enabled_set: bool = False,
) -> VipSlot:
    """단일 슬롯을 부분 업데이트한다.

    `*_set` 플래그가 True인 필드만 실제로 반영된다. PATCH 의미(명시된 필드만 변경)
    를 구현하기 위함. label은 None/빈 문자열이면 null 저장.
    """
    if slot_number < 1 or slot_number > SLOT_COUNT:
        raise ValueError(f"slot_number는 1..{SLOT_COUNT} 범위여야 합니다.")

    if label_set and label is not None:
        stripped = label.strip()
        if len(stripped) > LABEL_MAX_LENGTH:
            raise ValueError(f"label은 {LABEL_MAX_LENGTH}자 이내여야 합니다.")
        label = stripped or None

    with _file_lock:
        slots = _read_or_initialize()
        target = next(s for s in slots if s["slot_number"] == slot_number)
        if label_set:
            target["label"] = label
        if is_enabled_set:
            target["is_enabled"] = bool(is_enabled)
        _write_slots(slots)
        return VipSlot(**target)
