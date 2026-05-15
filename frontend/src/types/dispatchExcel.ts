// 기출유 발송 엑셀 관련 타입 (백엔드 SHIPPING_REFACTOR_PLAN.md §5 기준)

// ── 후보 (단품) ──────────────────────────────────────────────────────────────

export interface MonthlyExcelCandidateItem {
  send_item_id: number;
  product_code: string;
  product_name: string;
  prefix: string;          // W0/WB/HN/CL/CH/JN
  column_label: string;    // 말씀함께/큰글자/꿀땅/저학년/고학년/청소년
  send_num: number;
}

export interface MonthlyExcelCandidate {
  send_id: number;
  order_id: number;
  recipient_name: string;
  recipient_phone: string;
  postal_code: string;
  recipient_address: string;
  customer_memo?: string | null;
  items: MonthlyExcelCandidateItem[];
}

export interface MonthlyExcelCandidatesResponse {
  issue: string;
  total: number;
  candidates: MonthlyExcelCandidate[];
}

// ── 후보 (정기구독 A/B 공용) ─────────────────────────────────────────────────

export interface YearlyExcelCandidate {
  send_id: number;
  send_item_id: number;
  order_id: number;
  order_item_id: number;
  recipient_name: string;
  recipient_phone: string;
  postal_code: string;
  recipient_address: string;
  product_code: string;
  prefix: string;                     // W0/WB/HN/CL/CH/JN
  display_product_name: string;       // 기본판/큰글자/꿀땅/저학년/고학년/청소년
  issue: string;                      // YYYYMM (SendItem.issue, 엑셀 발행호 컬럼)
  send_num: number;
  final_subscribe_start_issue: string;
  final_subscribe_end_issue: string;
  start_label: string;                // "2026년 04월"
  period_label: string;               // "26년 04월호~27년 03월호"
}

export interface YearlyExcelCandidatesResponse {
  issue: string;
  total: number;
  candidates: YearlyExcelCandidate[];
}

// ── 다운로드 요청 ────────────────────────────────────────────────────────────

export interface MonthlyExcelDownloadRequest {
  send_ids: number[];
  send_date: string;   // YYYYMMDD
}

export interface YearlyExcelDownloadRequest {
  send_ids: number[];
  issue: string;       // YYYYMM
}

// ── 다운로드 응답 헤더 파싱 결과 ─────────────────────────────────────────────

export interface ExcelDownloadMeta {
  filename: string;
  includedCount: number;
  skippedCount: number;
}

// ── 후보 (VIP) ────────────────────────────────────────────────────────────────
// VIP 엑셀은 단품 형식 99% 재사용. 차이: country_code 노출 + product_kind(비고용)

export interface VipExcelCandidateItem {
  send_item_id: number;
  product_code: string;
  product_name: string;
  prefix: string;                      // W0/WB/HN/CL/CH/JN
  display_product_name: string;        // 기본판/큰글자/꿀땅/저학년/고학년/청소년
  issue: string;                       // YYYYMM
  send_num: number;
  product_kind: "YEARLY" | "MONTHLY";  // 비고 컬럼 표시용 ("정기"/"단품")
}

export interface VipExcelCandidate {
  send_id: number;
  recipient_name: string;
  recipient_phone: string;
  country_code: string;                // 단품과 달리 KR 외 가능
  postal_code: string;
  recipient_address: string;
  customer_memo?: string | null;
  items: VipExcelCandidateItem[];
}

export interface VipExcelCandidatesResponse {
  slot_number: number;
  slot_label: string | null;
  issue: string;
  total: number;
  candidates: VipExcelCandidate[];
}

export interface VipExcelDownloadRequest {
  send_ids: number[];
  send_date: string;   // YYYYMMDD
}
