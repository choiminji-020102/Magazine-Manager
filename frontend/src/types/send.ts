// Send 관련 타입

export type CourierCompany =
  | "CJ대한통운"
  | "로젠택배"
  | "우체국택배"
  | "한진택배"
  | "롯데택배";

export type SendStatus = "PREPARING" | "SHIPPED" | "DELIVERED" | "CANCELLED";

export interface SendItemInput {
  order_item_id: number;
  send_num: number;
}

export interface SendAddressInput {
  address_name: string;
  phone: string;
  nation?: string | null;
  postal_code: string;
  address: string;
  address_memo?: string | null;
}

export interface SendCreate {
  order_id: number;
  address_id?: number | null;
  address?: SendAddressInput | null;
  send_date?: string | null;
  courier_company?: CourierCompany | null;
  tracking_no?: string | null;
  send_status?: SendStatus | null;
  send_memo?: string | null;
  items: SendItemInput[];
}

export interface SendUpdate {
  send_date?: string | null;
  courier_company?: CourierCompany | null;
  tracking_no?: string | null;
  send_status?: SendStatus | null;
  send_memo?: string | null;
  address?: SendAddressInput | null;
}

export interface SendStatusUpdate {
  status: SendStatus;
}

export interface SendTrackingUpdate {
  courier_company: CourierCompany;
  tracking_no: string;
}

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
  cancelled_at?: string | null;
}

export interface SendResponse {
  send_id: number;
  order_id: number;
  address_id?: number | null;
  send_date?: string | null;
  courier_company?: string | null;
  tracking_no?: string | null;
  send_status: string;
  send_memo?: string | null;
  address_name: string;
  phone: string;
  nation?: string | null;
  postal_code: string;
  address: string;
  address_memo?: string | null;
  created_at: string;
  updated_at: string;
  cancelled_at?: string | null;
}

export interface SendDetailResponse extends SendResponse {
  items: SendItemResponse[];
  item_count: number;
}

export interface SendListResponse extends SendResponse {
  item_count: number;
}
