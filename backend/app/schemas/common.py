from pydantic import BaseModel
from typing import Generic, TypeVar, Optional, List
from datetime import datetime

T = TypeVar("T")


class ResponseBase(BaseModel):
    success: bool = True
    message: str = "Success"


class ResponseModel(ResponseBase, Generic[T]):
    data: Optional[T] = None


class PaginationMeta(BaseModel):
    total: int
    page: int
    limit: int
    total_pages: int


class PaginatedResponse(ResponseBase, Generic[T]):
    data: List[T]
    pagination: PaginationMeta


class ErrorResponse(BaseModel):
    success: bool = False
    message: str
    errors: Optional[dict] = None


# Query parameters
class PaginationParams(BaseModel):
    page: int = 1
    limit: int = 20
    
    def get_offset(self) -> int:
        return (self.page - 1) * self.limit


class DateRangeParams(BaseModel):
    start_date: Optional[str] = None
    end_date: Optional[str] = None
