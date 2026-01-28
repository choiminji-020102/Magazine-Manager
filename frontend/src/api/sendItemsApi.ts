import api from "./axios";
import type { ResponseModel } from "../types/api";
import type { SendItemCreate, SendItemUpdate, SendItemResponse } from "../types/sendItem";

export const sendItemsApi = {
  // GET /sends/{send_id}/items - 발송별 품목 목록
  getSendItems: (sendId: number) => {
    return api.get<ResponseModel<SendItemResponse[]>>(`/sends/${sendId}/items`);
  },

  // POST /sends/{send_id}/items - 발송 품목 추가
  createSendItem: (sendId: number, data: SendItemCreate) => {
    return api.post<ResponseModel<SendItemResponse>>(`/sends/${sendId}/items`, data);
  },

  // GET /send-items/{send_item_id} - 발송 품목 상세
  getSendItem: (sendItemId: number) => {
    return api.get<ResponseModel<SendItemResponse>>(`/send-items/${sendItemId}`);
  },

  // PUT /send-items/{send_item_id} - 발송 품목 수정
  updateSendItem: (sendItemId: number, data: SendItemUpdate) => {
    return api.put<ResponseModel<SendItemResponse>>(`/send-items/${sendItemId}`, data);
  },

  // DELETE /send-items/{send_item_id} - 발송 품목 삭제
  deleteSendItem: (sendItemId: number) => {
    return api.delete<ResponseModel<void>>(`/send-items/${sendItemId}`);
  },
};
