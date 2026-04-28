import api from "./axios";
import type { ResponseModel } from "../types/api";
import type {
  DispatchTargetsResponse,
  DispatchGenerateRequest,
  DispatchGenerateResponse,
  DispatchSummaryResponse,
} from "../types/dispatch";

export const dispatchApi = {
  // GET /dispatches/yearly/targets - YEARLY 발송 대상 조회
  getYearlyTargets: (params: {
    issue: string;
    product_code?: string | null;
    recipient_search?: string | null;
    page?: number;
    limit?: number;
  }) => {
    return api.get<ResponseModel<DispatchTargetsResponse>>(
      "/dispatches/yearly/targets",
      { params }
    );
  },

  // GET /dispatches/monthly/targets - MONTHLY 발송 대상 조회
  getMonthlyTargets: (params: {
    issue: string;
    product_code?: string | null;
    recipient_search?: string | null;
    page?: number;
    limit?: number;
  }) => {
    return api.get<ResponseModel<DispatchTargetsResponse>>(
      "/dispatches/monthly/targets",
      { params }
    );
  },

  // GET /dispatches/postal-code/13113/targets - 우편번호 13113 발송 대상 조회
  getPostalCode13113Targets: (params: {
    issue: string;
    product_code?: string | null;
    recipient_search?: string | null;
    page?: number;
    limit?: number;
  }) => {
    return api.get<ResponseModel<DispatchTargetsResponse>>(
      "/dispatches/postal-code/13113/targets",
      { params }
    );
  },

  // GET /dispatches/summary - 발송 현황 요약
  getDispatchSummary: (issue: string) => {
    return api.get<ResponseModel<DispatchSummaryResponse>>(
      "/dispatches/summary",
      { params: { issue } }
    );
  },

  // POST /dispatches/yearly/generate - YEARLY 발송 일괄 처리
  generateYearlyDispatch: (data: DispatchGenerateRequest) => {
    return api.post<ResponseModel<DispatchGenerateResponse>>(
      "/dispatches/yearly/generate",
      data
    );
  },

  // POST /dispatches/monthly/generate - MONTHLY 발송 일괄 처리
  generateMonthlyDispatch: (data: DispatchGenerateRequest) => {
    return api.post<ResponseModel<DispatchGenerateResponse>>(
      "/dispatches/monthly/generate",
      data
    );
  },

  // 엑셀 다운로드 관련 기능은 `dispatchExcelApi.ts`로 완전히 분리됨.
};
