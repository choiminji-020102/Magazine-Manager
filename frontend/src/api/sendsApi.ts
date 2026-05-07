import api from "./axios";
import type { ResponseModel, PaginatedResponse } from "../types/api";
import type {
  SendResponse,
  SendDetailResponse,
  SendListQuery,
  SendTrackingUpdate,
  SendAdminMemoUpdate,
  SendResendRequest,
} from "../types/send";

export const sendsApi = {
  // GET /sends - 발송 목록 조회
  getSends: (params: SendListQuery) => {
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

  // PATCH /sends/{send_id}/tracking - DELIVERED Send 운송장/배송업체/배송방법 수정
  updateTracking: (sendId: number, data: SendTrackingUpdate) => {
    return api.patch<ResponseModel<SendResponse>>(`/sends/${sendId}/tracking`, data);
  },

  // PATCH /sends/{send_id}/admin-memo - 관리자 메모 수정 (상태 무관)
  updateAdminMemo: (sendId: number, data: SendAdminMemoUpdate) => {
    return api.patch<ResponseModel<SendResponse>>(`/sends/${sendId}/admin-memo`, data);
  },

  // POST /sends/{send_id}/resend - DELIVERED Send 재배송 이력 기록 (Send 본체 변경 없음)
  resendSend: (sendId: number, data: SendResendRequest) => {
    return api.post<ResponseModel<SendResponse>>(`/sends/${sendId}/resend`, data);
  },
};
