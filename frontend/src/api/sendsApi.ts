import api from "./axios";
import type { ResponseModel, PaginatedResponse } from "../types/api";
import type {
  SendUpdate,
  SendResponse,
  SendDetailResponse,
  SendStatusUpdate,
  SendTrackingUpdate,
  SendBatchStatusResponse,
} from "../types/send";

export const sendsApi = {
  // GET /sends - 발송 목록 조회
  getSends: (params: {
    page?: number;
    limit?: number;
    send_status?: string | null;
    courier_company?: string | null;
    tracking_no?: string | null;
    start_date?: string | null;
    end_date?: string | null;
    is_cancelled?: boolean | null;
    recipient_search?: string | null;
    postal_code?: string | null;
    issue?: string | null;
    product_kind?: string | null;   // YEARLY | MONTHLY (SendItem → OrderItem 조인)
    sort_by?: string;
    sort_order?: string;
  }) => {
    return api.get<PaginatedResponse<SendResponse>>("/sends", { params });
  },

  // GET /orders/{order_id}/sends - 주문별 발송 목록
  getSendsByOrder: (orderId: number) => {
    return api.get<ResponseModel<SendResponse[]>>(`/orders/${orderId}/sends`);
  },

  // GET /sends/{send_id} - 발송 상세 조회
  getSend: (sendId: number) => {
    return api.get<ResponseModel<SendDetailResponse>>(`/sends/${sendId}`);
  },

  // PUT /sends/{send_id} - 발송 수정
  updateSend: (sendId: number, data: SendUpdate) => {
    return api.put<ResponseModel<SendDetailResponse>>(`/sends/${sendId}`, data);
  },

  // PATCH /sends/{send_id}/status - 발송 상태 변경
  updateSendStatus: (sendId: number, data: SendStatusUpdate) => {
    return api.patch<ResponseModel<SendResponse>>(`/sends/${sendId}/status`, data);
  },

  // POST /sends/batch/shipping - 일괄 배송중 전환
  batchShipping: (sendIds: number[]) => {
    return api.post<ResponseModel<SendBatchStatusResponse>>("/sends/batch/shipping", { send_ids: sendIds });
  },

  // POST /sends/batch/delivered - 일괄 배송완료 전환
  batchDelivered: (sendIds: number[]) => {
    return api.post<ResponseModel<SendBatchStatusResponse>>("/sends/batch/delivered", { send_ids: sendIds });
  },

  // PATCH /sends/{send_id}/tracking - SHIPPING/DELIVERED Send 운송장/배송업체/배송방법 수정
  updateTracking: (sendId: number, data: SendTrackingUpdate) => {
    return api.patch<ResponseModel<SendResponse>>(`/sends/${sendId}/tracking`, data);
  },

  // POST /sends/{send_id}/cancel - 발송 취소
  cancelSend: (sendId: number) => {
    return api.post<ResponseModel<SendResponse>>(`/sends/${sendId}/cancel`);
  },
};
