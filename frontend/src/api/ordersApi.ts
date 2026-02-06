import api from "./axios";
import type { ResponseModel, PaginatedResponse } from "../types/api";
import type {
  OrderListQuery,
  OrderCreate,
  OrderUpdate,
  OrderResponse,
  OrderDetailResponse,
  OrderListResponse,
  OrderStatusUpdate,
} from "../types/order";
import type { SendListResponse } from "../types/send";

export const ordersApi = {
  // GET /orders - 주문 목록 조회
  getOrders: (params?: OrderListQuery) => {
    return api.get<PaginatedResponse<OrderListResponse>>("/orders", { params });
  },

  // GET /orders/channel/{channel} - 채널별 주문 조회
  getOrdersByChannel: (
    channel: string,
    params: { page?: number; limit?: number; order_status?: string | null }
  ) => {
    return api.get<PaginatedResponse<OrderListResponse>>(`/orders/channel/${channel}`, {
      params,
    });
  },

  // GET /orders/external/{external_order_id} - 외부 주문번호로 주문 조회
  getOrderByExternalId: (externalOrderId: string) => {
    return api.get<ResponseModel<OrderDetailResponse>>(`/orders/external/${externalOrderId}`);
  },

  // GET /orders/{order_id} - 주문 상세 조회
  getOrder: (orderId: number) => {
    return api.get<ResponseModel<OrderDetailResponse>>(`/orders/${orderId}`);
  },

  // POST /orders - 주문 등록
  createOrder: (data: OrderCreate) => {
    return api.post<ResponseModel<OrderDetailResponse>>("/orders", data);
  },

  // PUT /orders/{order_id} - 주문 수정
  updateOrder: (orderId: number, data: OrderUpdate) => {
    return api.put<ResponseModel<OrderResponse>>(`/orders/${orderId}`, data);
  },

  // PATCH /orders/{order_id}/status - 주문 상태 변경
  updateOrderStatus: (orderId: number, data: OrderStatusUpdate) => {
    return api.patch<ResponseModel<OrderResponse>>(`/orders/${orderId}/status`, data);
  },

  // PATCH /orders/{order_id}/cancel - 주문 취소
  cancelOrder: (orderId: number) => {
    return api.patch<ResponseModel<OrderResponse>>(`/orders/${orderId}/cancel`);
  },

  // GET /orders/{order_id}/sends - 주문별 발송 목록
  getOrderSends: (orderId: number) => {
    return api.get<ResponseModel<SendListResponse[]>>(`/orders/${orderId}/sends`);
  },

  // GET /orders/customer/{customer_id} - 고객별 주문 이력 조회
  getOrdersByCustomer: (customerId: number) => {
    return api.get<ResponseModel<OrderResponse[]>>(`/orders/customer/${customerId}`);
  },
};
