// Pause 관련 타입

export interface PauseCreate {
  order_item_id: number;
  pause_issue: string;
  reason?: string | null;
}

export interface PauseBatchCreate {
  order_item_id: number;
  pause_issues: string[];     // YYYYMM 배열
  reason?: string | null;
}

export interface PauseUpdate {
  // ⚠️ pause_issue 수정 불가 (불변)
  reason?: string | null;
}

export interface PauseResponse {
  pause_id: number;
  order_item_id: number;
  pause_issue: string;
  reason?: string | null;
  admin_id: number;
  is_deleted: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PauseBatchCreateResponse {
  created_count: number;
  prev_final_end_issue: string;
  new_final_end_issue: string;
  next_send_issue?: string | null;
}

export interface PauseByIssueResponse extends PauseResponse {
  product_name?: string | null;
  customer_id?: number | null;
  customer_name?: string | null;
  customer_phone?: string | null;
}
