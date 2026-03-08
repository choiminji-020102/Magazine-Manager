from pydantic import BaseModel
from typing import Generic, TypeVar, Optional, List

T = TypeVar("T")


class ResponseModel(BaseModel, Generic[T]):
    message: str = "success"
    data: Optional[T] = None


class PaginatedResponse(BaseModel, Generic[T]):
    total: int
    page: int
    limit: int
    total_pages: int
    items: List[T]


class ErrorResponse(BaseModel):
    message: str
    detail: Optional[str] = None


# Query parameters
class PaginationParams(BaseModel):
    page: int = 1
    limit: int = 20

    def get_offset(self) -> int:
        return (self.page - 1) * self.limit


class DateRangeParams(BaseModel):
    start_date: Optional[str] = None
    end_date: Optional[str] = None
