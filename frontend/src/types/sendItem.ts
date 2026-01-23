// SendItem 관련 타입

export interface SendItemResponse {
  send_item_id: number;
  send_id: number;
  order_item_id: number;
  product_code: string;
  send_num: number;
  purchase: number;
  product_name: string;
  unit_weight: number;
  unit_width: number;
  unit_length: number;
  unit_height: number;
  created_at: string;
  updated_at: string;
  cancelled_at: string | null;
}

export interface SendItemCreate {
  order_item_id: number;
  send_num?: number;
}

export interface SendItemUpdate {
  send_num?: number;
}
