# 표준 라이브러리
from datetime import datetime
from typing import Optional

# 서드파티 라이브러리
from fastapi import Query
from pydantic import BaseModel, ConfigDict, Field


# ── 생성/수정 스키마 ──────────────────────────────────────────────────────────

class AddressCreate(BaseModel):
    customer_id: int                            # 필수
    recipient_name: str                         # 수령인 이름 (불변)
    recipient_phone: str                        # 수령인 연락처 (불변)
    country_code: str = "KR"                    # 국가 코드 (불변)
    postal_code: str                            # 우편번호 (불변)
    recipient_address: str                      # 주소 (불변)
    customer_memo: Optional[str] = None         # 고객 배송 요청 사항 (불변)
    admin_memo: Optional[str] = None


class AddressUpdate(BaseModel):
    # ⚠️ recipient_name, recipient_phone, recipient_address, postal_code,
    #    country_code, customer_memo 수정 불가 (불변 필드)
    # 주소 내용이 잘못된 경우: 신규 배송지 등록 후 OrderItem.address_id 교체
    admin_memo: Optional[str] = None
    vip1: Optional[bool] = None
    vip2: Optional[bool] = None
    vip3: Optional[bool] = None
    vip4: Optional[bool] = None
    vip5: Optional[bool] = None
    vip6: Optional[bool] = None


# ── 응답 스키마 ───────────────────────────────────────────────────────────────

class AddressResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    address_id: int
    customer_id: int
    recipient_name: str
    recipient_phone: str
    country_code: str
    postal_code: str
    recipient_address: str
    customer_memo: Optional[str] = None
    admin_memo: Optional[str] = None
    vip1: bool
    vip2: bool
    vip3: bool
    vip4: bool
    vip5: bool
    vip6: bool
    created_at: datetime
    updated_at: datetime


# ── 목록 쿼리 스키마 ──────────────────────────────────────────────────────────

class AddressListQuery(BaseModel):
    page: int = Field(1, ge=1)
    limit: int = Field(20, ge=1, le=100)
    customer_id: Optional[int] = None
    postal_code: Optional[str] = None
    country_code: Optional[str] = None
    vip_slot_number: Optional[int] = Field(None, ge=1, le=6)  # Address.vipN=true 필터
    sort_by: str = "created_at"
    sort_order: str = "desc"

    @classmethod
    def as_query_params(
        cls,
        page: int = Query(1, ge=1),
        limit: int = Query(20, ge=1, le=100),
        customer_id: Optional[int] = Query(None),
        postal_code: Optional[str] = Query(None),
        country_code: Optional[str] = Query(None),
        vip_slot_number: Optional[int] = Query(None, ge=1, le=6),
        sort_by: str = Query("created_at"),
        sort_order: str = Query("desc"),
    ):
        return cls(
            page=page,
            limit=limit,
            customer_id=customer_id,
            postal_code=postal_code,
            country_code=country_code,
            vip_slot_number=vip_slot_number,
            sort_by=sort_by,
            sort_order=sort_order,
        )
