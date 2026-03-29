import api from "./axios";
import type { ResponseModel, PaginatedResponse } from "../types/api";
import type {
  OrderListQuery,
  OrderCreate,
  OrderUpdate,
  OrderResponse,
  OrderListResponse,
  OrderDetailResponse,
  OrderStatusUpdate,
  OrderCancelRequest,
  OrderPaymentUpdate,
} from "../types/order";

export const ordersApi = {
  // GET /orders - 주문 목록 조회
  getOrders: (params?: OrderListQuery) => {
    return api.get<PaginatedResponse<OrderListResponse>>("/orders", { params });
  },

  // GET /orders/external/{external_order_id} - 외부 주문번호로 주문 조회
  getOrderByExternalId: (externalOrderId: string) => {
    return api.get<ResponseModel<OrderResponse>>(`/orders/external/${externalOrderId}`);
  },

  // GET /orders/customer/{customer_id} - 고객별 주문 이력
  getOrdersByCustomer: (customerId: number) => {
    return api.get<ResponseModel<OrderResponse[]>>(`/orders/customer/${customerId}`);
  },

  // GET /orders/{order_id} - 주문 상세 조회 (고객·배송지·품목·발송 포함)
  getOrder: (orderId: number) => {
    return api.get<ResponseModel<OrderDetailResponse>>(`/orders/${orderId}`);
  },

  // POST /orders - 주문 등록
  createOrder: (data: OrderCreate) => {
    return api.post<ResponseModel<OrderResponse>>("/orders", data);
  },

  // PUT /orders/{order_id} - 주문 수정
  updateOrder: (orderId: number, data: OrderUpdate) => {
    return api.put<ResponseModel<OrderResponse>>(`/orders/${orderId}`, data);
  },

  // PATCH /orders/{order_id}/status - 주문 상태 변경
  updateOrderStatus: (orderId: number, data: OrderStatusUpdate) => {
    return api.patch<ResponseModel<OrderResponse>>(`/orders/${orderId}/status`, data);
  },

  // POST /orders/{order_id}/payment - 결제 완료 처리
  completePayment: (orderId: number, data?: OrderPaymentUpdate) => {
    return api.post<ResponseModel<OrderResponse>>(`/orders/${orderId}/payment`, data ?? {});
  },

  // POST /orders/{order_id}/cancel - 주문 취소
  cancelOrder: (orderId: number, data: OrderCancelRequest) => {
    return api.post<ResponseModel<OrderResponse>>(`/orders/${orderId}/cancel`, data);
  },
};
