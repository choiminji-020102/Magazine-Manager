from pydantic import BaseModel
from typing import Generic, TypeVar, Optional, List

T = TypeVar("T")


class ResponseBase(BaseModel):
    success: bool = True
    message: str = "Success"


class ResponseModel(ResponseBase, Generic[T]):
    data: Optional[T] = None
    # → 실제로는 success, message, data 3개 필드를 가짐


class PaginationMeta(BaseModel):
    total: int
    page: int
    limit: int
    total_pages: int


class PaginatedResponse(ResponseBase, Generic[T]):
    data: List[T]
    pagination: PaginationMeta
    # → 실제로는 success, message, data, pagination 4개 필드를 가짐


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
