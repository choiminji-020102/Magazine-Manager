import api from "./axios";
import { logApiError } from "../utils/errorHandler";
import type { ActivityLogResponse } from "../types/activityLog";
import type { PaginatedResponse } from "../types/api";

// Re-export for backward compatibility
export type { ActivityLogResponse };

// API 함수들
export const activityLogAPI = {
  /**
   * 활동 로그 조회 (SUPER_ADMIN 전용, 페이지네이션)
   * GET /activity-logs?page=1&limit=20&admin_id=&action=&target_type=&target_id=&start_date=&end_date=
   */
  getAll: async (params?: {
    page?: number;
    limit?: number;
    admin_id?: number;
    action?: string;
    target_type?: string;
    target_id?: number;
    start_date?: string;
    end_date?: string;
  }): Promise<PaginatedResponse<ActivityLogResponse>> => {
    try {
      const response = await api.get<
        PaginatedResponse<ActivityLogResponse>
      >("/activity-logs", { params });
      return response.data;
    } catch (err) {
      logApiError(err as any, "GET_ACTIVITY_LOGS");
      throw err;
    }
  },
};
