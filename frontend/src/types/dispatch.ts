// Dispatch 관련 타입 (새 백엔드 스키마 기준)

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
