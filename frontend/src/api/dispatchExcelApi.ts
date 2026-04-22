import type { AxiosResponse } from "axios";

import api from "./axios";
import type { ResponseModel } from "../types/api";
import type {
  ExcelDownloadMeta,
  MonthlyExcelCandidatesResponse,
  MonthlyExcelDownloadRequest,
  YearlyExcelCandidatesResponse,
  YearlyExcelDownloadRequest,
} from "../types/dispatchExcel";

// ── 공통 다운로드 유틸 ────────────────────────────────────────────────────────

/**
 * StreamingResponse 응답 헤더에서 파일명 + 스킵 건수 정보 파싱.
 * 백엔드가 CORS expose_headers로 노출한 X-* 헤더를 활용.
 */
function parseExcelDownloadMeta(
  response: AxiosResponse<Blob>,
  fallbackFilename: string,
): ExcelDownloadMeta {
  const cd: string = response.headers["content-disposition"] ?? "";
  // RFC 5987: filename*=UTF-8''... 우선
  let filename = fallbackFilename;
  const filenameStar = /filename\*=UTF-8''([^;]+)/i.exec(cd);
  if (filenameStar?.[1]) {
    filename = decodeURIComponent(filenameStar[1]);
  } else {
    const filenameAscii = /filename="([^"]+)"/i.exec(cd);
    if (filenameAscii?.[1]) filename = filenameAscii[1];
  }

  const included = Number(response.headers["x-included-count"] ?? 0);
  const skipped = Number(response.headers["x-skipped-count"] ?? 0);

  // 백엔드가 한글을 URL-encode해서 보내므로 디코딩 필요 (latin-1 헤더 제약)
  const rawCourier = String(response.headers["x-courier-company"] ?? "");
  let courier = rawCourier;
  try {
    courier = decodeURIComponent(rawCourier);
  } catch {
    // 디코딩 실패 시 원본 유지
  }

  return {
    filename,
    includedCount: Number.isFinite(included) ? included : 0,
    skippedCount: Number.isFinite(skipped) ? skipped : 0,
    courierCompany: courier,
  };
}

/**
 * 브라우저에서 Blob을 파일로 즉시 저장 트리거.
 */
export function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(url);
}

// ── API ──────────────────────────────────────────────────────────────────────

export const dispatchExcelApi = {
  // ── 후보 조회 ────────────────────────────────────────────────────────────

  getMonthlyCandidates: (params: {
    issue: string;
    postal_code?: string | null;
  }) => {
    return api.get<ResponseModel<MonthlyExcelCandidatesResponse>>(
      "/dispatches/excel/monthly/candidates",
      { params },
    );
  },

  getYearlyGichulyuCandidates: (params: {
    issue: string;
    postal_code?: string | null;
    product_codes?: string | null;     // 쉼표 구분 (예: "W0,WB")
  }) => {
    return api.get<ResponseModel<YearlyExcelCandidatesResponse>>(
      "/dispatches/excel/yearly-gichulyu/candidates",
      { params },
    );
  },

  getYearlyPostofficeCandidates: (params: {
    issue: string;
    postal_code?: string | null;
    product_codes?: string | null;
  }) => {
    return api.get<ResponseModel<YearlyExcelCandidatesResponse>>(
      "/dispatches/excel/yearly-postoffice/candidates",
      { params },
    );
  },

  // ── 엑셀 다운로드 (+ SHIPPING 전환) ─────────────────────────────────────

  downloadMonthly: async (
    data: MonthlyExcelDownloadRequest,
  ): Promise<ExcelDownloadMeta> => {
    const response = await api.post<Blob>("/dispatches/excel/monthly", data, {
      responseType: "blob",
    });
    const meta = parseExcelDownloadMeta(
      response,
      `기출유_단품_${data.send_date}.xlsx`,
    );
    triggerBlobDownload(response.data, meta.filename);
    return meta;
  },

  downloadYearlyGichulyu: async (
    data: YearlyExcelDownloadRequest,
  ): Promise<ExcelDownloadMeta> => {
    const response = await api.post<Blob>(
      "/dispatches/excel/yearly-gichulyu",
      data,
      { responseType: "blob" },
    );
    const meta = parseExcelDownloadMeta(
      response,
      `기출유_정기구독_${data.issue}.xlsx`,
    );
    triggerBlobDownload(response.data, meta.filename);
    return meta;
  },

  downloadYearlyPostoffice: async (
    data: YearlyExcelDownloadRequest,
  ): Promise<ExcelDownloadMeta> => {
    const response = await api.post<Blob>(
      "/dispatches/excel/yearly-postoffice",
      data,
      { responseType: "blob" },
    );
    const meta = parseExcelDownloadMeta(
      response,
      `우체국_정기구독_${data.issue}.xlsx`,
    );
    triggerBlobDownload(response.data, meta.filename);
    return meta;
  },
};
