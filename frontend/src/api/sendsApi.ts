import api from "./axios";
import type { ResponseModel, PaginatedResponse } from "../types/api";
import type {
  SendCreate,
  SendUpdate,
  SendResponse,
  SendDetailResponse,
  SendListResponse,
  SendStatusUpdate,
  SendTrackingUpdate,
} from "../types/send";

export const sendsApi = {
  // GET /sends - 발송 목록 조회
  getSends: (params: {
    page?: number;
    limit?: number;
    send_status?: string | null;
    courier?: string | null;
    send_date?: string | null;
    search?: string | null;
  }) => {
    return api.get<PaginatedResponse<SendListResponse>>("/sends", { params });
  },

  // GET /sends/order/{order_id} - 주문별 발송 목록
  getSendsByOrder: (orderId: number) => {
    return api.get<ResponseModel<SendListResponse[]>>(`/sends/order/${orderId}`);
  },

  // GET /sends/date/{send_date} - 날짜별 발송 조회
  getSendsByDate: (sendDate: string) => {
    return api.get<ResponseModel<SendListResponse[]>>(`/sends/date/${sendDate}`);
  },

  // GET /sends/{send_id} - 발송 상세 조회
  getSend: (sendId: number) => {
    return api.get<ResponseModel<SendDetailResponse>>(`/sends/${sendId}`);
  },

  // POST /sends - 발송 등록
  createSend: (data: SendCreate) => {
    return api.post<ResponseModel<SendDetailResponse>>("/sends", data);
  },

  // PUT /sends/{send_id} - 발송 수정
  updateSend: (sendId: number, data: SendUpdate) => {
    return api.put<ResponseModel<SendResponse>>(`/sends/${sendId}`, data);
  },

  // PATCH /sends/{send_id}/status - 발송 상태 변경
  updateSendStatus: (sendId: number, data: SendStatusUpdate) => {
    return api.patch<ResponseModel<SendResponse>>(`/sends/${sendId}/status`, data);
  },

  // PATCH /sends/{send_id}/tracking - 운송장 정보 등록
  updateTracking: (sendId: number, data: SendTrackingUpdate) => {
    return api.patch<ResponseModel<SendResponse>>(`/sends/${sendId}/tracking`, data);
  },

  // PATCH /sends/{send_id}/cancel - 발송 취소
  cancelSend: (sendId: number) => {
    return api.patch<ResponseModel<SendResponse>>(`/sends/${sendId}/cancel`);
  },

  // GET /sends/export/excel - 발송 데이터 엑셀 다운로드
  exportSendsToExcel: (params?: { send_date?: string | null; send_status?: string | null }) => {
    return api.get("/sends/export/excel", {
      params,
      responseType: "blob",
    });
  },
};
