from pydantic import BaseModel, EmailStr, Field
from typing import Optional, Literal
from datetime import datetime
from fastapi import Query


class CustomerListQuery(BaseModel):
    """고객 목록 조회 쿼리 파라미터"""
    page: int = Field(1, ge=1, description="페이지 번호")
    limit: int = Field(20, ge=1, le=100, description="페이지당 항목 수")
    search: Optional[str] = Field(None, description="검색어 (이름, 연락처, 이메일, 연락처 뒷자리 4자리)")
    channel: Optional[str] = Field(None, description="유입 경로 필터 (CAFE24, GPMALL, OFFLINE)")
    sort: str = Field("created_at", description="정렬 기준")
    order: str = Field("DESC", description="정렬 순서 (ASC, DESC)")

    @classmethod
    def as_query_params(
        cls,
        page: int = Query(1, ge=1, description="페이지 번호"),
        limit: int = Query(20, ge=1, le=100, description="페이지당 항목 수"),
        search: Optional[str] = Query(None, description="검색어 (이름, 연락처, 이메일)"),
        channel: Optional[str] = Query(None, description="유입 경로 필터 (CAFE24, GPMALL, OFFLINE)"),
        sort: str = Query("created_at", description="정렬 기준"),
        order: str = Query("DESC", description="정렬 순서 (ASC, DESC)"),
    ):
        """쿼리 파라미터로 사용하기 위한 팩토리 메서드"""
        return cls(
            page=page,
            limit=limit,
            search=search,
            channel=channel,
            sort=sort,
            order=order
        )

class CustomerCreate(BaseModel):
    """고객 생성 요청"""
    customer_name: str = Field("", max_length=50, description="고객 이름")
    customer_phone: str = Field(..., max_length=20, description="연락처 (고유값)")
    customer_email: Optional[EmailStr] = Field(None, description="이메일")
    create_channel: Literal["CAFE24", "GPMALL", "OFFLINE"] = Field(
        "OFFLINE", 
        description="유입 경로"
    )
    admin_memo: Optional[str] = Field(None, description="관리자 메모(특이사항)")

class CustomerUpdate(BaseModel):
    """고객 수정 요청 (create_channel은 수정 불가)"""
    customer_name: Optional[str] = Field(None, max_length=50, description="고객 이름")
    customer_phone: Optional[str] = Field(None, max_length=20, description="연락처")
    customer_email: Optional[EmailStr] = Field(None, description="이메일")
    admin_memo: Optional[str] = Field(None, description="관리자 메모(특이사항)")


class CustomerResponse(BaseModel):
    """고객 응답"""
    customer_id: int = Field(..., description="내부 고객 고유 ID")
    customer_name: str
    customer_phone: str
    customer_phone_num4: str = Field(..., description="연락처 뒷자리(고정길이)")
    customer_email: Optional[EmailStr] = None
    create_channel: str
    admin_memo: Optional[str] = Field(None, description="관리자 메모(특이사항)")
    last_order_at: Optional[datetime] = Field(None, description="최근 주문 일시")
    created_at: datetime = Field(..., description="생성 일시")
    updated_at: datetime = Field(..., description="수정 일시")
    
    class Config:
        from_attributes = True 
