import api from "./axios";
import type { AxiosRequestConfig } from "axios";
import type { ResponseModel } from "../types/api";
import type {
  DispatchSummaryResponse,
  RegeneratePreparingSendsRequest,
  RegeneratePreparingSendsResponse,
  AddToPreparingYearlyRequest,
  AddToPreparingYearlyResponse,
  TransitionToDeliveredRequest,
  TransitionToDeliveredResponse,
  PaidNotPreparedCountResponse,
  PreviewSkippedIssuesRequest,
  PreviewSkippedIssuesResponse,
} from "../types/dispatch";

export const dispatchApi = {
  // GET /dispatches/summary - 발송 현황 요약
  getDispatchSummary: (issue: string) => {
    return api.get<ResponseModel<DispatchSummaryResponse>>(
      "/dispatches/summary",
      { params: { issue } }
    );
  },

  // POST /dispatches/regenerate-preparing-sends - [발송 생성]: scope 별 PREPARING Send 일괄 재계산 (monthly/vipN 용)
  regeneratePreparingSends: (data: RegeneratePreparingSendsRequest) => {
    return api.post<ResponseModel<RegeneratePreparingSendsResponse>>(
      "/dispatches/regenerate-preparing-sends",
      data,
    );
  },

  // POST /dispatches/add-to-preparing-yearly - [정기 신규 결제 추가]: incremental, 기존 박스 보존
  addToPreparingYearly: (data: AddToPreparingYearlyRequest) => {
    return api.post<ResponseModel<AddToPreparingYearlyResponse>>(
      "/dispatches/add-to-preparing-yearly",
      data,
    );
  },

  // POST /dispatches/transition-to-delivered - [발송 완료 처리]: PREPARING → DELIVERED 일괄 전환
  // config: 대량 처리 시 청크별 호출에 타임아웃을 상향하기 위해 선택적으로 전달 가능
  transitionToDelivered: (data: TransitionToDeliveredRequest, config?: AxiosRequestConfig) => {
    return api.post<ResponseModel<TransitionToDeliveredResponse>>(
      "/dispatches/transition-to-delivered",
      data,
      config,
    );
  },

  // POST /dispatches/preview-skipped-issues - [발송 생성] 사전 미리보기: 순차 위반(중간 호 누락) 후보
  previewSkippedIssues: (data: PreviewSkippedIssuesRequest) => {
    return api.post<ResponseModel<PreviewSkippedIssuesResponse>>(
      "/dispatches/preview-skipped-issues",
      data,
    );
  },

  // GET /dispatches/paid-not-prepared-count - 카운트 배너용 (신규 결제 + 박스 처리됨, 16+2 키)
  getPaidNotPreparedCount: () => {
    return api.get<ResponseModel<PaidNotPreparedCountResponse>>(
      "/dispatches/paid-not-prepared-count",
    );
  },

  // 엑셀 다운로드 관련 기능은 `dispatchExcelApi.ts`로 완전히 분리됨.
};
