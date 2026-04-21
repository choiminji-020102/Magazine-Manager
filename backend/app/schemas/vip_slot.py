# 표준 라이브러리
from typing import Optional

# 서드파티 라이브러리
from pydantic import BaseModel, ConfigDict, Field


class VipSlotResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    slot_number: int
    label: Optional[str] = None
    is_enabled: bool


class VipSlotUpdate(BaseModel):
    # label=null 은 "라벨 제거" 의미, label 생략은 "변경 없음"
    label: Optional[str] = Field(None, max_length=50)
    is_enabled: Optional[bool] = None
