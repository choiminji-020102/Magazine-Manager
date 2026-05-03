import api from "./axios";
import type { ResponseModel } from "../types/api";
import type { DispatchSummaryResponse } from "../types/dispatch";

export const dispatchApi = {
  // GET /dispatches/summary - 발송 현황 요약
  getDispatchSummary: (issue: string) => {
    return api.get<ResponseModel<DispatchSummaryResponse>>(
      "/dispatches/summary",
      { params: { issue } }
    );
  },

  // 엑셀 다운로드 관련 기능은 `dispatchExcelApi.ts`로 완전히 분리됨.
};
