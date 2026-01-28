import api from "./axios";
import type { ResponseModel } from "../types/api";
import type {
  DispatchTargetsResponse,
  DispatchGenerateRequest,
  DispatchGenerateResponse,
  DispatchSummaryResponse,
  SingleTargetsResponse,
} from "../types/dispatch";

export const dispatchApi = {
  // GET /dispatch/issue/{issue}/targets - 호수별 발송 대상 조회 (YEARLY/MONTHLY)
  getDispatchTargets: (
    issue: string,
    params?: { product_code?: string | null; base_code?: string | null }
  ) => {
    return api.get<ResponseModel<DispatchTargetsResponse>>(`/dispatch/issue/${issue}/targets`, {
      params,
    });
  },

  // POST /dispatch/issue/{issue}/generate - 호수별 발송 일괄 생성 (YEARLY/MONTHLY)
  generateDispatch: (issue: string, data: DispatchGenerateRequest) => {
    return api.post<ResponseModel<DispatchGenerateResponse>>(
      `/dispatch/issue/${issue}/generate`,
      data
    );
  },

  // GET /dispatch/issue/{issue}/summary - 호수별 발송 현황 요약 (YEARLY/MONTHLY)
  getDispatchSummary: (
    issue: string,
    params?: { product_code?: string | null; base_code?: string | null }
  ) => {
    return api.get<ResponseModel<DispatchSummaryResponse>>(`/dispatch/issue/${issue}/summary`, {
      params,
    });
  },

  // GET /dispatch/single/{product_code}/targets - SINGLE 상품 발송 대상 조회
  getSingleTargets: (productCode: string) => {
    return api.get<ResponseModel<SingleTargetsResponse>>(
      `/dispatch/single/${productCode}/targets`
    );
  },

  // POST /dispatch/single/{product_code}/generate - SINGLE 상품 발송 일괄 생성
  generateSingleDispatch: (productCode: string, data: DispatchGenerateRequest) => {
    return api.post<ResponseModel<DispatchGenerateResponse>>(
      `/dispatch/single/${productCode}/generate`,
      data
    );
  },
};
