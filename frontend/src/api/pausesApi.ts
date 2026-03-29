import api from "./axios";
import type { ResponseModel, PaginatedResponse } from "../types/api";
import type {
  PauseCreate,
  PauseBatchCreate,
  PauseUpdate,
  PauseResponse,
  PauseBatchCreateResponse,
  PauseByIssueResponse,
} from "../types/pause";

export const pausesApi = {
  // GET /pauses - 휴지 목록 조회
  getPauses: (params: {
    page?: number;
    limit?: number;
    order_item_id?: number | null;
    pause_issue?: string | null;
    is_deleted?: boolean;
    admin_id?: number | null;
    sort_by?: string;
    sort_order?: string;
  }) => {
    return api.get<PaginatedResponse<PauseResponse>>("/pauses", { params });
  },

  // GET /order-items/{order_item_id}/pauses - 품목별 휴지 목록
  getPausesByOrderItem: (orderItemId: number) => {
    return api.get<ResponseModel<PauseResponse[]>>(`/order-items/${orderItemId}/pauses`);
  },

  // POST /pauses - 휴지 단건 등록
  createPause: (data: PauseCreate) => {
    return api.post<ResponseModel<PauseResponse>>("/pauses", data);
  },

  // POST /pauses/batch - 휴지 다건 등록
  batchCreatePause: (data: PauseBatchCreate) => {
    return api.post<ResponseModel<PauseBatchCreateResponse>>("/pauses/batch", data);
  },

  // GET /pauses/{pause_id} - 휴지 상세 조회
  getPause: (pauseId: number) => {
    return api.get<ResponseModel<PauseResponse>>(`/pauses/${pauseId}`);
  },

  // PUT /pauses/{pause_id} - 휴지 수정 (사유만)
  updatePause: (pauseId: number, data: PauseUpdate) => {
    return api.put<ResponseModel<PauseResponse>>(`/pauses/${pauseId}`, data);
  },

  // DELETE /pauses/{pause_id} - 휴지 소프트 삭제
  deletePause: (pauseId: number) => {
    return api.delete<ResponseModel<PauseResponse>>(`/pauses/${pauseId}`);
  },

  // POST /pauses/{pause_id}/restore - 휴지 복구
  restorePause: (pauseId: number) => {
    return api.post<ResponseModel<PauseResponse>>(`/pauses/${pauseId}/restore`);
  },

  // GET /pauses/by-issue/{issue} - 호수별 휴지 목록
  getPausesByIssue: (issue: string) => {
    return api.get<ResponseModel<PauseByIssueResponse[]>>(`/pauses/by-issue/${issue}`);
  },
};
