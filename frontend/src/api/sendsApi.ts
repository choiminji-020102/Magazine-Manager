import api from "./axios";
import type { ResponseModel, PaginatedResponse } from "../types/api";
import type {
  SendResponse,
  SendDetailResponse,
  OrderItemSendResponse,
  SendListQuery,
  SendTrackingUpdate,
  SendAdminMemoUpdate,
  SendResendRequest,
} from "../types/send";

export const sendsApi = {
  // GET /sends - 발송 목록 조회 (각 박스의 SendItem 목록도 인라인 포함 — 카드 표시용)
  getSends: (params: SendListQuery) => {
    return api.get<PaginatedResponse<SendDetailResponse>>("/sends", { params });
  },

  // GET /orders/{order_id}/sends - 주문별 발송 목록 (주문에 든 모든 품목의 발송이 섞임)
  // 현재 호출처 없음 — 구독 상세 패널은 아래 getSendsByOrderItem 으로 전환됨
  getSendsByOrder: (orderId: number) => {
    return api.get<ResponseModel<SendResponse[]>>(`/orders/${orderId}/sends`);
  },

  // GET /order-items/{order_item_id}/sends - 주문 품목별 발송 이력 (호·상품명 포함, 최신 호 순)
  // getSendsByOrder 와 달리 같은 주문의 다른 품목 발송은 섞이지 않음
  getSendsByOrderItem: (orderItemId: number) => {
    return api.get<ResponseModel<OrderItemSendResponse[]>>(
      `/order-items/${orderItemId}/sends`
    );
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

  // DELETE /sends/{send_id}/preparing - PREPARING 박스 강제 삭제 (잔여 SendItem cascade)
  deletePreparingSend: (sendId: number) => {
    return api.delete<ResponseModel<null>>(`/sends/${sendId}/preparing`);
  },
};
