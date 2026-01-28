import api from "./axios";
import type { PaginatedResponse } from "../types/api";
import type { ActivityLogResponse, ActivityLogListQuery } from "../types/activityLog";

export const activityLogsApi = {
  // GET /activity-logs - 활동 로그 조회
  getActivityLogs: (params: ActivityLogListQuery) => {
    return api.get<PaginatedResponse<ActivityLogResponse>>("/activity-logs", { params });
  },
};
