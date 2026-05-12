import api from "./axios";
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

  // POST /dispatches/transition-to-delivered - [배송완료 처리]: PREPARING → DELIVERED 일괄 전환
  transitionToDelivered: (data: TransitionToDeliveredRequest) => {
    return api.post<ResponseModel<TransitionToDeliveredResponse>>(
      "/dispatches/transition-to-delivered",
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
