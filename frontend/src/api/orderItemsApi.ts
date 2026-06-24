import api from "./axios";
import type { ResponseModel, PaginatedResponse } from "../types/api";
import type {
  OrderItemCreate,
  OrderItemListQuery,
  OrderItemUpdate,
  OrderItemAddressUpdate,
  OrderItemAddressUpdateResponse,
  OrderItemCancelCalculateResponse,
  OrderItemCancelRequest,
  OrderItemLastSendIssueUpdate,
  OrderItemResponse,
  OrderItemDetailResponse,
  SubscriptionExtendRequest,
  SubscriptionBatchExtendRequest,
  SubscriptionBatchExtendResponse,
  SubscriptionChangePeriodRequest,
  SubscriptionListItem,
  SubscriptionShortenCalculateRequest,
  SubscriptionShortenCalculateResponse,
  SubscriptionShortenConfirmRequest,
} from "../types/orderItem";

export const orderItemsApi = {
  // GET /order-items - 구독 목록 조회
  listOrderItems: (params?: OrderItemListQuery) => {
    return api.get<PaginatedResponse<SubscriptionListItem>>("/order-items", { params });
  },

  // GET /orders/{order_id}/items - 주문별 품목 목록
  getItemsByOrder: (orderId: number) => {
    return api.get<ResponseModel<OrderItemDetailResponse[]>>(`/orders/${orderId}/items`);
  },

  // GET /order-items/{order_item_id} - 품목 상세 조회
  getOrderItem: (orderItemId: number) => {
    return api.get<ResponseModel<OrderItemDetailResponse>>(`/order-items/${orderItemId}`);
  },

  // POST /order-items - 독립 품목 추가
  createOrderItem: (data: OrderItemCreate) => {
    return api.post<ResponseModel<OrderItemDetailResponse>>("/order-items", data);
  },

  // PUT /order-items/{order_item_id} - 품목 수정
  updateOrderItem: (orderItemId: number, data: OrderItemUpdate) => {
    return api.put<ResponseModel<OrderItemDetailResponse>>(`/order-items/${orderItemId}`, data);
  },

  // PATCH /order-items/{order_item_id}/address - 배송지 변경
  updateAddress: (orderItemId: number, data: OrderItemAddressUpdate) => {
    return api.patch<ResponseModel<OrderItemAddressUpdateResponse>>(`/order-items/${orderItemId}/address`, data);
  },

  // POST /order-items/{order_item_id}/extend - 구독 연장 (단건)
  extendSubscription: (orderItemId: number, data: SubscriptionExtendRequest) => {
    return api.post<ResponseModel<OrderItemDetailResponse>>(`/order-items/${orderItemId}/extend`, data);
  },

  // POST /order-items/batch/extend - 구독 일괄 연장
  batchExtendSubscription: (data: SubscriptionBatchExtendRequest) => {
    return api.post<ResponseModel<SubscriptionBatchExtendResponse>>("/order-items/batch/extend", data);
  },

  // POST /order-items/{order_item_id}/change-period - 구독 기간 이동
  changePeriod: (orderItemId: number, data: SubscriptionChangePeriodRequest) => {
    return api.post<ResponseModel<OrderItemDetailResponse>>(`/order-items/${orderItemId}/change-period`, data);
  },

  // POST /order-items/{order_item_id}/shorten/calculate - 단축 환불 계산
  shortenCalculate: (orderItemId: number, data: SubscriptionShortenCalculateRequest) => {
    return api.post<ResponseModel<SubscriptionShortenCalculateResponse>>(`/order-items/${orderItemId}/shorten/calculate`, data);
  },

  // POST /order-items/{order_item_id}/shorten/confirm - 단축 확정
  shortenConfirm: (orderItemId: number, data: SubscriptionShortenConfirmRequest) => {
    return api.post<ResponseModel<OrderItemDetailResponse>>(`/order-items/${orderItemId}/shorten/confirm`, data);
  },

  // POST /order-items/{order_item_id}/cancel/calculate - 품목 취소 환불 계산 미리보기
  cancelItemCalculate: (orderItemId: number) => {
    return api.post<ResponseModel<OrderItemCancelCalculateResponse>>(`/order-items/${orderItemId}/cancel/calculate`);
  },

  // POST /order-items/{order_item_id}/cancel - 품목 취소
  cancelOrderItem: (orderItemId: number, data: OrderItemCancelRequest) => {
    return api.post<ResponseModel<OrderItemResponse>>(`/order-items/${orderItemId}/cancel`, data);
  },

  // PATCH /order-items/{order_item_id}/last-send-issue - 마지막 발송 호 업데이트
  updateLastSendIssue: (orderItemId: number, data: OrderItemLastSendIssueUpdate) => {
    return api.patch<ResponseModel<OrderItemResponse>>(`/order-items/${orderItemId}/last-send-issue`, data);
  },

  // GET /order-items/expiring-subscribers/excel - 재구독 안내 연락처 엑셀 다운로드
  downloadExpiringSubscribersExcel: async (issue: string): Promise<void> => {
    const response = await api.get<Blob>("/order-items/expiring-subscribers/excel", {
      params: { issue },
      responseType: "blob",
    });
    const url = window.URL.createObjectURL(response.data);
    const a = document.createElement("a");
    a.href = url;
    a.download = `재구독안내_${issue}.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  },
};
