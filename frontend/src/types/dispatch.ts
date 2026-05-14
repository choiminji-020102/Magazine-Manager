// Dispatch 관련 타입 (backend/app/schemas/dispatch.py 와 1:1 매핑)

import type { SendMethod, CourierCompany } from "./send";

// ── Scope ─────────────────────────────────────────────────────────────────────

// 8개 — monthly/yearly + vip1..vip6. 프론트 탭/스코프 분기 단일 진실 소스.
export type DispatchScope = "monthly" | "yearly" | "vip1" | "vip2" | "vip3" | "vip4" | "vip5" | "vip6";

// ── 발송 현황 요약 (GET /dispatches/summary) ──────────────────────────────────

export interface DispatchProductStat {
  product_code: string;
  product_name: string;
  total: number;
  dispatched: number;
  pending: number;
}

export interface DispatchSummaryResponse {
  issue: string;
  total_target_count: number;
  dispatched_count: number;
  pending_count: number;
  by_product: DispatchProductStat[];
  by_status: Record<string, number>;
}

// ── [발송 생성] (POST /dispatches/regenerate-preparing-sends) ──────────────────

export interface RegeneratePreparingSendsRequest {
  scope: DispatchScope;
  issue?: string | null;          // YYYYMM (scope=yearly/vipN일 때 필수)
}

export interface RegeneratePreparingSendsResponse {
  scope: string;
  issue?: string | null;
  deleted_count: number;
  created_count: number;
}

// ── [정기 신규 결제 추가] (POST /dispatches/add-to-preparing-yearly) ───────────
// 정기(YEARLY) incremental — 기존 PREPARING 박스 보존, 신규 OI 만 박스 추가

export interface AddToPreparingYearlyRequest {
  issue: string;                  // YYYYMM (필수)
}

export interface AddToPreparingYearlyResponse {
  issue: string;
  created_count: number;
}

// ── [배송완료 처리] (POST /dispatches/transition-to-delivered) ─────────────────

export interface TransitionSendItem {
  // tracking_no 는 입력에서 숫자만 추출돼 저장됨 (공백·하이픈·문자 제거).
  send_id: number;
  tracking_no: string;
}

export interface TransitionToDeliveredRequest {
  sends: TransitionSendItem[];     // min_length=1
  send_method: SendMethod;
  courier_company: CourierCompany;
}

export interface TransitionToDeliveredResponse {
  transitioned_count: number;
}

// ── [발송 생성 사전 미리보기] (POST /dispatches/preview-skipped-issues) ───────
// 순차 발송 위반(중간 호 누락) 검사. scope=monthly 는 호 무관이라 항상 빈 응답.

export interface PreviewSkippedIssuesRequest {
  scope: DispatchScope;
  issue: string;                  // YYYYMM (필수)
}

export interface SequenceViolationItem {
  order_item_id: number;
  product_code: string;
  recipient_name: string;
  missing_issues: string[];       // 누락된 호 (오름차순 YYYYMM)
}

export interface PreviewSkippedIssuesResponse {
  violation_count: number;
  samples: SequenceViolationItem[];  // 최대 3건
}

// ── 카운트 배너 (GET /dispatches/paid-not-prepared-count) ──────────────────────

// 16+2 키 — *_count (발송 미생성 결제: PAID 미반영 OrderItem) + *_preparing (현재 PREPARING Send 박스).
// 단일성 제약(V-7) 덕에 8키 합계 = 묶음별 total.
// 프론트 표시:
// - 카운트 배너 "총 N건" = sendsApi 응답의 total (Send 박스 단위, 필터 적용)
// - 별도 알림 "🔔 발송 미생성 결제 M건" = total_count (OrderItem 단위, 호 무관) — 단위/필터 달라 괄호 패턴 안 씀
export interface PaidNotPreparedCountResponse {
  // 신규 결제 (PAID 미반영)
  monthly_count: number;
  yearly_count: number;
  vip1_count: number;
  vip2_count: number;
  vip3_count: number;
  vip4_count: number;
  vip5_count: number;
  vip6_count: number;
  total_count: number;

  // 박스 처리됨 (현재 PREPARING)
  monthly_preparing: number;
  yearly_preparing: number;
  vip1_preparing: number;
  vip2_preparing: number;
  vip3_preparing: number;
  vip4_preparing: number;
  vip5_preparing: number;
  vip6_preparing: number;
  total_preparing: number;
}
