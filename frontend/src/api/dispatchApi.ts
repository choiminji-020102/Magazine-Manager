import api from "./axios";
import { logApiError } from "../utils/errorHandler";
import type {
  DispatchTarget,
  DispatchTargetsResponse,
  DispatchGenerateRequest,
  DispatchCreatedItem,
  DispatchErrorItem,
  DispatchGenerateResponse,
  SubscriptionStats,
  DispatchSummaryResponse,
} from "../types/dispatch";
import type { ResponseModel } from "../types/api";

// Re-export for backward compatibility
export type {
  DispatchTarget,
  DispatchTargetsResponse,
  DispatchGenerateRequest,
  DispatchCreatedItem,
  DispatchErrorItem,
  DispatchGenerateResponse,
  SubscriptionStats,
  DispatchSummaryResponse,
};

// API 함수들
export const dispatchAPI = {
  /**
   * 호수별 발송 대상 조회
   * GET /dispatch/issue/{issue}/targets
   */
  getTargets: async (issue: string): Promise<DispatchTargetsResponse> => {
    try {
      const response = await api.get<ResponseModel<DispatchTargetsResponse>>(
        `/dispatch/issue/${issue}/targets`
      );
      return response.data.data;
    } catch (err) {
      logApiError(err as any, "GET_DISPATCH_TARGETS");
      throw err;
    }
  },

  /**
   * 호수별 발송 일괄 생성
   * POST /dispatch/issue/{issue}/generate
   */
  generate: async (
    issue: string,
    data: DispatchGenerateRequest
  ): Promise<DispatchGenerateResponse> => {
    try {
      const response = await api.post<ResponseModel<DispatchGenerateResponse>>(
        `/dispatch/issue/${issue}/generate`,
        data
      );
      return response.data.data;
    } catch (err) {
      logApiError(err as any, "GENERATE_DISPATCH");
      throw err;
    }
  },

  /**
   * 호수별 발송 현황 요약
   * GET /dispatch/issue/{issue}/summary
   */
  getSummary: async (issue: string): Promise<DispatchSummaryResponse> => {
    try {
      const response = await api.get<ResponseModel<DispatchSummaryResponse>>(
        `/dispatch/issue/${issue}/summary`
      );
      return response.data.data;
    } catch (err) {
      logApiError(err as any, "GET_DISPATCH_SUMMARY");
      throw err;
    }
  },
};
