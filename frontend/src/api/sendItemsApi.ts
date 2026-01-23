import api from "./axios";
import { logApiError } from "../utils/errorHandler";
import type {
  SendItemResponse,
  SendItemCreate,
  SendItemUpdate,
} from "../types/sendItem";
import type { ResponseModel } from "../types/api";

// Re-export for backward compatibility
export type {
  SendItemResponse,
  SendItemCreate,
  SendItemUpdate,
};

// API 함수들
export const sendItemAPI = {
  /**
   * 발송별 품목 목록
   * GET /sends/{send_id}/items
   */
  getBySend: async (sendId: number): Promise<SendItemResponse[]> => {
    try {
      const response = await api.get<ResponseModel<SendItemResponse[]>>(
        `/sends/${sendId}/items`
      );
      return response.data.data;
    } catch (err) {
      logApiError(err as any, "GET_SEND_ITEMS");
      throw err;
    }
  },

  /**
   * 발송 품목 추가
   * POST /sends/{send_id}/items
   */
  create: async (
    sendId: number,
    data: SendItemCreate
  ): Promise<SendItemResponse> => {
    try {
      const response = await api.post<ResponseModel<SendItemResponse>>(
        `/sends/${sendId}/items`,
        data
      );
      return response.data.data;
    } catch (err) {
      logApiError(err as any, "CREATE_SEND_ITEM");
      throw err;
    }
  },

  /**
   * 발송 품목 상세
   * GET /send-items/{send_item_id}
   */
  getById: async (sendItemId: number): Promise<SendItemResponse> => {
    try {
      const response = await api.get<ResponseModel<SendItemResponse>>(
        `/send-items/${sendItemId}`
      );
      return response.data.data;
    } catch (err) {
      logApiError(err as any, "GET_SEND_ITEM_BY_ID");
      throw err;
    }
  },

  /**
   * 발송 품목 수정
   * PUT /send-items/{send_item_id}
   */
  update: async (
    sendItemId: number,
    data: SendItemUpdate
  ): Promise<SendItemResponse> => {
    try {
      const response = await api.put<ResponseModel<SendItemResponse>>(
        `/send-items/${sendItemId}`,
        data
      );
      return response.data.data;
    } catch (err) {
      logApiError(err as any, "UPDATE_SEND_ITEM");
      throw err;
    }
  },

  /**
   * 발송 품목 삭제
   * DELETE /send-items/{send_item_id}
   */
  delete: async (sendItemId: number): Promise<void> => {
    try {
      await api.delete(`/send-items/${sendItemId}`);
    } catch (err) {
      logApiError(err as any, "DELETE_SEND_ITEM");
      throw err;
    }
  },
};
