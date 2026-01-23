// Pause 관련 타입

export interface PauseResponse {
  pause_id: number;
  order_item_id: number;
  pause_issue: string;
  reason: string | null;
  admin_id: number | null;
  admin_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface PauseByIssueResponse extends PauseResponse {
  product_name: string | null;
  customer_id: number | null;
  customer_name: string | null;
  customer_phone: string | null;
}

export interface PauseCreate {
  pause_issue: string;
  reason?: string | null;
}

export interface PauseUpdate {
  pause_issue?: string;
  reason?: string | null;
}
