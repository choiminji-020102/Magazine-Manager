import api from "./axios";
import type { ResponseModel } from "../types/api";
import type { PauseCreate, PauseUpdate, PauseResponse, PauseByIssueResponse } from "../types/pause";

export const pausesApi = {
  // GET /order-items/{order_item_id}/pauses - 품목별 휴지 목록
  getPausesByOrderItem: (orderItemId: number) => {
    return api.get<ResponseModel<PauseResponse[]>>(`/order-items/${orderItemId}/pauses`);
  },

  // POST /order-items/{order_item_id}/pauses - 휴지 등록
  createPause: (orderItemId: number, data: PauseCreate) => {
    return api.post<ResponseModel<PauseResponse>>(`/order-items/${orderItemId}/pauses`, data);
  },

  // GET /pauses/{pause_id} - 휴지 상세 조회
  getPause: (pauseId: number) => {
    return api.get<ResponseModel<PauseResponse>>(`/pauses/${pauseId}`);
  },

  // PUT /pauses/{pause_id} - 휴지 수정
  updatePause: (pauseId: number, data: PauseUpdate) => {
    return api.put<ResponseModel<PauseResponse>>(`/pauses/${pauseId}`, data);
  },

  // DELETE /pauses/{pause_id} - 휴지 삭제
  deletePause: (pauseId: number) => {
    return api.delete<ResponseModel<void>>(`/pauses/${pauseId}`);
  },

  // GET /pauses/issue/{issue} - 호수별 휴지 목록
  getPausesByIssue: (issue: string) => {
    return api.get<ResponseModel<PauseByIssueResponse[]>>(`/pauses/issue/${issue}`);
  },
};
