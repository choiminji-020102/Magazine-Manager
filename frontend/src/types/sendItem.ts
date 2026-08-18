// SendItem 관련 타입

export interface SendItemCreate {
  order_item_id: number;
  issue: string;        // 발송 호 (YYYYMM, 필수)
  // send_num 은 서버가 OrderItem.order_num 으로 스냅샷 — 클라이언트 입력 불가.
}

export interface SendItemUpdate {
  admin_memo?: string | null;
}

export interface SendItemResponse {
  send_item_id: number;
  send_id: number;
  order_item_id: number;
  product_code: string;
  product_name: string;
  issue: string;
  send_num: number;
  cost_price: number;
  unit_weight?: number | null;
  unit_width?: number | null;
  unit_length?: number | null;
  unit_height?: number | null;
  admin_memo?: string | null;
  cancelled_at?: string | null;
  created_at: string;
  updated_at: string;
}

