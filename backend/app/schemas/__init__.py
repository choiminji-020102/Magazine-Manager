from typing import List, Optional

from app.schemas.common import (
	ResponseModel, PaginatedResponse
)
from app.schemas.auth import (
    LoginRequest, TokenPairResponse, RefreshRequest, LogoutRequest,
    PasswordChangeRequest, TokenPayload
)
from app.schemas.admin import (
    AdminCreate, AdminUpdate, AdminResponse,
    AdminRoleUpdate, AdminListQuery,
)
from app.schemas.customer import (
    CustomerCreate, CustomerUpdate, CustomerResponse,
    CustomerDetailResponse, CustomerListItem, CustomerListQuery,
)
from app.schemas.product import (
	ProductCreate, ProductUpdate, ProductResponse
)
from app.schemas.address import (
	AddressCreate, AddressUpdate, AddressResponse
)
from app.schemas.order import (
    OrderCreate, OrderUpdate, OrderResponse, OrderListResponse,
    OrderPaymentUpdate, OrderItemCreateInOrder,
    OrderCancelRequest, OrderCancelCalculateResponse, OrderCancelItemDetail,
)
from app.schemas.order_item import (
    OrderItemCreate, OrderItemUpdate, OrderItemResponse,
    OrderItemDetailResponse, OrderItemAddressUpdate,
    SubscriptionExtendRequest, SubscriptionBatchExtendRequest,
)
from app.schemas.pause import (
	PauseCreate, PauseUpdate, PauseResponse, PauseByIssueResponse
)
from app.schemas.send import (
    SendUpdate, SendResponse, SendDetailResponse,
    SendStatusUpdate, SendTrackingUpdate,
)
from app.schemas.send_item import (
	SendItemCreate, SendItemUpdate, SendItemResponse
)
from app.schemas.dispatch import (
    DispatchTarget, DispatchTargetsResponse, DispatchSummaryResponse
)
from app.schemas.stats import (
    OrdersSummaryResponse, OrdersByChannelResponse, OrdersByPeriodResponse,
    SubscriptionsActiveResponse, SubscriptionsByIssueResponse, CustomersByChannelResponse
)
from app.schemas.activity_log import (
	ActivityLogCreate, ActivityLogResponse
)
from app.schemas.inquiry import (
    InquiryCreate, InquiryUpdate, InquiryAnswer, InquiryResponse,
    InquiryListResponse, InquiryDetailResponse,
    CustomerInquiryHistoryResponse
)


# ── OrderDetailResponse ────────────────────────────────────────────────────────
# customer.py가 order.py(OrderListResponse)를 import하므로 순환 참조 방지를 위해
# 모든 스키마 import 완료 후 여기에 정의
class OrderDetailResponse(OrderResponse):
    """주문 상세 조회용 (모든 연관 정보 포함)"""
    customer: Optional[CustomerResponse] = None
    address: Optional[AddressResponse] = None
    items: List[OrderItemResponse] = []
    sends: List[SendResponse] = []
