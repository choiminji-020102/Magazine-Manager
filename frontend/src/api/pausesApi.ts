import api from "./axios";
import { logApiError } from "../utils/errorHandler";
import type {
  PauseResponse,
  PauseByIssueResponse,
  PauseCreate,
  PauseUpdate,
} from "../types/pause";
import type { ResponseModel } from "../types/api";

// Re-export for backward compatibility
export type {
  PauseResponse,
  PauseByIssueResponse,
  PauseCreate,
  PauseUpdate,
};

// API 함수들
export const pauseAPI = {
  /**
   * 품목별 휴지 목록
   * GET /order-items/{order_item_id}/pauses
   */
  getByOrderItem: async (orderItemId: number): Promise<PauseResponse[]> => {
    try {
      const response = await api.get<ResponseModel<PauseResponse[]>>(
        `/order-items/${orderItemId}/pauses`
      );
      return response.data.data;
    } catch (err) {
      logApiError(err as any, "GET_PAUSES_BY_ORDER_ITEM");
      throw err;
    }
  },

  /**
   * 휴지 등록
   * POST /order-items/{order_item_id}/pauses
   */
  create: async (
    orderItemId: number,
    data: PauseCreate
  ): Promise<PauseResponse> => {
    try {
      const response = await api.post<ResponseModel<PauseResponse>>(
        `/order-items/${orderItemId}/pauses`,
        data
      );
      return response.data.data;
    } catch (err) {
      logApiError(err as any, "CREATE_PAUSE");
      throw err;
    }
  },

  /**
   * 휴지 상세 조회
   * GET /pauses/{pause_id}
   */
  getById: async (pauseId: number): Promise<PauseResponse> => {
    try {
      const response = await api.get<ResponseModel<PauseResponse>>(
        `/pauses/${pauseId}`
      );
      return response.data.data;
    } catch (err) {
      logApiError(err as any, "GET_PAUSE_BY_ID");
      throw err;
    }
  },

  /**
   * 휴지 수정
   * PUT /pauses/{pause_id}
   */
  update: async (
    pauseId: number,
    data: PauseUpdate
  ): Promise<PauseResponse> => {
    try {
      const response = await api.put<ResponseModel<PauseResponse>>(
        `/pauses/${pauseId}`,
        data
      );
      return response.data.data;
    } catch (err) {
      logApiError(err as any, "UPDATE_PAUSE");
      throw err;
    }
  },

  /**
   * 휴지 삭제
   * DELETE /pauses/{pause_id}
   */
  delete: async (pauseId: number): Promise<void> => {
    try {
      await api.delete(`/pauses/${pauseId}`);
    } catch (err) {
      logApiError(err as any, "DELETE_PAUSE");
      throw err;
    }
  },

  /**
   * 호수별 휴지 목록
   * GET /pauses/issue/{issue}
   */
  getByIssue: async (issue: string): Promise<PauseByIssueResponse[]> => {
    try {
      const response = await api.get<ResponseModel<PauseByIssueResponse[]>>(
        `/pauses/issue/${issue}`
      );
      return response.data.data;
    } catch (err) {
      logApiError(err as any, "GET_PAUSES_BY_ISSUE");
      throw err;
    }
  },
};
