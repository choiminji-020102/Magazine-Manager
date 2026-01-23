import api from "./axios";
import { logApiError } from "../utils/errorHandler";
import type {
  CourierCompany,
  SendStatus,
  SendItemInput,
  SendAddressInput,
  SendResponse,
  SendListResponse,
  SendItemResponse,
  SendDetailResponse,
  SendCreate,
  SendUpdate,
  SendStatusUpdate,
  SendTrackingUpdate,
} from "../types/send";
import type { PaginatedResponse, ResponseModel } from "../types/api";

// Re-export for backward compatibility
export type {
  CourierCompany,
  SendStatus,
  SendItemInput,
  SendAddressInput,
  SendResponse,
  SendListResponse,
  SendItemResponse,
  SendDetailResponse,
  SendCreate,
  SendUpdate,
  SendStatusUpdate,
  SendTrackingUpdate,
};

// API 함수들
export const sendAPI = {
  /**
   * 발송 목록 조회 (페이지네이션)
   * GET /sends?page=1&limit=20&send_status=&courier=&send_date=&search=
   */
  getAll: async (params?: {
    page?: number;
    limit?: number;
    send_status?: string;
    courier?: string;
    send_date?: string;
    search?: string;
  }): Promise<PaginatedResponse<SendListResponse>> => {
    try {
      const response = await api.get<PaginatedResponse<SendListResponse>>(
        "/sends",
        { params }
      );
      return response.data;
    } catch (err) {
      logApiError(err as any, "GET_ALL_SENDS");
      throw err;
    }
  },

  /**
   * 날짜별 발송 조회
   * GET /sends/date/{send_date}
   */
  getByDate: async (sendDate: string): Promise<SendListResponse[]> => {
    try {
      const response = await api.get<ResponseModel<SendListResponse[]>>(
        `/sends/date/${sendDate}`
      );
      return response.data.data;
    } catch (err) {
      logApiError(err as any, "GET_SENDS_BY_DATE");
      throw err;
    }
  },

  /**
   * 발송 상세 조회
   * GET /sends/{send_id}
   */
  getById: async (sendId: number): Promise<SendDetailResponse> => {
    try {
      const response = await api.get<ResponseModel<SendDetailResponse>>(
        `/sends/${sendId}`
      );
      return response.data.data;
    } catch (err) {
      logApiError(err as any, "GET_SEND_BY_ID");
      throw err;
    }
  },

  /**
   * 발송 등록
   * POST /sends
   */
  create: async (data: SendCreate): Promise<SendDetailResponse> => {
    try {
      const response = await api.post<ResponseModel<SendDetailResponse>>(
        "/sends",
        data
      );
      return response.data.data;
    } catch (err) {
      logApiError(err as any, "CREATE_SEND");
      throw err;
    }
  },

  /**
   * 발송 수정
   * PUT /sends/{send_id}
   */
  update: async (
    sendId: number,
    data: SendUpdate
  ): Promise<SendResponse> => {
    try {
      const response = await api.put<ResponseModel<SendResponse>>(
        `/sends/${sendId}`,
        data
      );
      return response.data.data;
    } catch (err) {
      logApiError(err as any, "UPDATE_SEND");
      throw err;
    }
  },

  /**
   * 발송 상태 변경
   * PATCH /sends/{send_id}/status
   */
  updateStatus: async (
    sendId: number,
    data: SendStatusUpdate
  ): Promise<SendResponse> => {
    try {
      const response = await api.patch<ResponseModel<SendResponse>>(
        `/sends/${sendId}/status`,
        data
      );
      return response.data.data;
    } catch (err) {
      logApiError(err as any, "UPDATE_SEND_STATUS");
      throw err;
    }
  },

  /**
   * 운송장 정보 등록
   * PATCH /sends/{send_id}/tracking
   */
  updateTracking: async (
    sendId: number,
    data: SendTrackingUpdate
  ): Promise<SendResponse> => {
    try {
      const response = await api.patch<ResponseModel<SendResponse>>(
        `/sends/${sendId}/tracking`,
        data
      );
      return response.data.data;
    } catch (err) {
      logApiError(err as any, "UPDATE_SEND_TRACKING");
      throw err;
    }
  },

  /**
   * 발송 취소
   * PATCH /sends/{send_id}/cancel
   */
  cancel: async (sendId: number): Promise<SendResponse> => {
    try {
      const response = await api.patch<ResponseModel<SendResponse>>(
        `/sends/${sendId}/cancel`
      );
      return response.data.data;
    } catch (err) {
      logApiError(err as any, "CANCEL_SEND");
      throw err;
    }
  },
};
