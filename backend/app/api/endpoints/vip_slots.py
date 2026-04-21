# 서드파티 라이브러리
from fastapi import APIRouter, Depends, HTTPException, status
from typing import List

# 로컬 애플리케이션
from app.core import vip_slots as vip_slots_store
from app.core.deps import require_manager
from app.models import admin as admin_model
from app.schemas.common import ResponseModel
from app.schemas.vip_slot import VipSlotResponse, VipSlotUpdate


router = APIRouter(prefix="/vip-slots", tags=["VIP 슬롯"])


@router.get("", response_model=ResponseModel[List[VipSlotResponse]])
def list_vip_slots(
    _: admin_model.Admin = Depends(require_manager),
):
    """VIP 슬롯 6개 전체 조회 (모든 관리자 권한 가능)."""
    slots = vip_slots_store.list_slots()
    return ResponseModel(data=[VipSlotResponse.model_validate(s.model_dump()) for s in slots])


@router.patch("/{slot_number}", response_model=ResponseModel[VipSlotResponse])
def update_vip_slot(
    slot_number: int,
    payload: VipSlotUpdate,
    _: admin_model.Admin = Depends(require_manager),
):
    """VIP 슬롯 라벨/활성화 수정 (모든 관리자 권한 가능).

    생략된 필드는 변경하지 않음. `label=null`은 라벨 제거 의미.
    """
    sent = payload.model_dump(exclude_unset=True)
    try:
        updated = vip_slots_store.update_slot(
            slot_number,
            label=sent.get("label"),
            is_enabled=sent.get("is_enabled"),
            label_set="label" in sent,
            is_enabled_set="is_enabled" in sent,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    return ResponseModel(data=VipSlotResponse.model_validate(updated.model_dump()))
