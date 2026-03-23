# 표준 라이브러리
from datetime import datetime
from typing import List, Optional

# 서드파티 라이브러리
from fastapi import Query
from pydantic import BaseModel, Field


# ── 생성/수정 스키마 ──────────────────────────────────────────────────────────

class PauseCreate(BaseModel):
    order_item_id: int
    pause_issue: str                            # YYYYMM (필수)
    reason: Optional[str] = None               # 고객 요청 사유


class PauseBatchCreate(BaseModel):
    order_item_id: int
    pause_issues: List[str]                    # YYYYMM 배열 (예: ["202406","202407"])
    reason: Optional[str] = None


class PauseUpdate(BaseModel):
    # ⚠️ pause_issue 수정 불가 (식별 키, 불변)
    # 잘못된 호의 휴지는 소프트 삭제 후 올바른 호로 재생성
    reason: Optional[str] = None               # 사유만 수정 가능


# ── 응답 스키마 ───────────────────────────────────────────────────────────────

class PauseResponse(BaseModel):
    pause_id: int
    order_item_id: int
    pause_issue: str
    reason: Optional[str] = None
    admin_id: int
    is_deleted: bool
    created_at: datetime
    updated_at: datetime
    deleted_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class PauseBatchCreateResponse(BaseModel):
    created_count: int                         # 생성된 pause 레코드 수
    prev_final_end_issue: str                  # 변경 전 final_subscribe_end_issue
    new_final_end_issue: str                   # 변경 후 final_subscribe_end_issue
    next_send_issue: Optional[str] = None      # 다음 발송 예정 호


class PauseByIssueResponse(PauseResponse):
    """호별 조회 시 고객/상품 정보 포함"""
    product_name: Optional[str] = None
    customer_id: Optional[int] = None
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None


# ── 목록 쿼리 스키마 ──────────────────────────────────────────────────────────

class PauseListQuery(BaseModel):
    page: int = Field(1, ge=1)
    limit: int = Field(20, ge=1, le=100)
    order_item_id: Optional[int] = None
    pause_issue: Optional[str] = None
    is_deleted: bool = False
    admin_id: Optional[int] = None
    sort_by: str = "created_at"
    sort_order: str = "desc"

    @classmethod
    def as_query_params(
        cls,
        page: int = Query(1, ge=1),
        limit: int = Query(20, ge=1, le=100),
        order_item_id: Optional[int] = Query(None),
        pause_issue: Optional[str] = Query(None),
        is_deleted: bool = Query(False),
        admin_id: Optional[int] = Query(None),
        sort_by: str = Query("created_at"),
        sort_order: str = Query("desc"),
    ):
        return cls(
            page=page,
            limit=limit,
            order_item_id=order_item_id,
            pause_issue=pause_issue,
            is_deleted=is_deleted,
            admin_id=admin_id,
            sort_by=sort_by,
            sort_order=sort_order,
        )
