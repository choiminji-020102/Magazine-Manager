import api from "./axios";
import type { ResponseModel } from "../types/api";
import type {
  OrderItemCreate,
  OrderItemUpdate,
  OrderItemResponse,
  OrderItemDetailResponse,
  SubscriptionUpdate,
} from "../types/orderItem";

export const orderItemsApi = {
  // GET /orders/{order_id}/items - 주문별 품목 목록
  getOrderItems: (orderId: number) => {
    return api.get<ResponseModel<OrderItemDetailResponse[]>>(`/orders/${orderId}/items`);
  },

  // GET /order-items/{order_item_id} - 품목 상세 조회
  getOrderItem: (orderItemId: number) => {
    return api.get<ResponseModel<OrderItemDetailResponse>>(`/order-items/${orderItemId}`);
  },

  // POST /orders/{order_id}/items - 품목 추가
  createOrderItem: (orderId: number, data: OrderItemCreate) => {
    return api.post<ResponseModel<OrderItemResponse>>(`/orders/${orderId}/items`, data);
  },

  // PUT /order-items/{order_item_id} - 품목 수정
  updateOrderItem: (orderItemId: number, data: OrderItemUpdate) => {
    return api.put<ResponseModel<OrderItemResponse>>(`/order-items/${orderItemId}`, data);
  },

  // PATCH /order-items/{order_item_id}/cancel - 품목 취소
  cancelOrderItem: (orderItemId: number) => {
    return api.patch<ResponseModel<OrderItemResponse>>(`/order-items/${orderItemId}/cancel`);
  },

  // PATCH /order-items/{order_item_id}/subscription - 구독 정보 수정
  updateSubscription: (orderItemId: number, data: SubscriptionUpdate) => {
    return api.patch<ResponseModel<OrderItemResponse>>(
      `/order-items/${orderItemId}/subscription`,
      data
    );
  },
};
