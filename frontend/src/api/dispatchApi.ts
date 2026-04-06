import api from "./axios";
import type { ResponseModel } from "../types/api";
import type {
  DispatchTargetsResponse,
  DispatchGenerateRequest,
  DispatchGenerateResponse,
  DispatchSummaryResponse,
  DispatchTrackingUploadResponse,
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

  // GET /dispatches/yearly/export - YEARLY 엑셀 다운로드
  exportYearlyDispatch: (issue: string) => {
    return api.get("/dispatches/yearly/export", {
      params: { issue },
      responseType: "blob",
    });
  },

  // GET /dispatches/monthly/export - MONTHLY 엑셀 다운로드
  exportMonthlyDispatch: (issue: string) => {
    return api.get("/dispatches/monthly/export", {
      params: { issue },
      responseType: "blob",
    });
  },

  // POST /dispatches/yearly/upload-tracking - YEARLY 송장 업로드
  uploadYearlyTracking: (issue: string, file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return api.post<ResponseModel<DispatchTrackingUploadResponse>>(
      "/dispatches/yearly/upload-tracking",
      formData,
      {
        params: { issue },
        headers: { "Content-Type": "multipart/form-data" },
      }
    );
  },

  // POST /dispatches/monthly/upload-tracking - MONTHLY 송장 업로드
  uploadMonthlyTracking: (issue: string, file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return api.post<ResponseModel<DispatchTrackingUploadResponse>>(
      "/dispatches/monthly/upload-tracking",
      formData,
      {
        params: { issue },
        headers: { "Content-Type": "multipart/form-data" },
      }
    );
  },
};
