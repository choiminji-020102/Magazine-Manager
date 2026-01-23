// Send 관련 타입

import type { SendItemResponse } from "./sendItem";

export type CourierCompany =
  | "CJ대한통운"
  | "로젠택배"
  | "우체국택배"
  | "한진택배"
  | "롯데택배";

export type SendStatus = "PREPARING" | "SHIPPED" | "DELIVERED" | "CANCELLED";

export interface SendItemInput {
  order_item_id: number;
  send_num?: number;
}

export interface SendAddressInput {
  address_name: string;
  phone: string;
  nation?: string;
  postal_code: string;
  address1: string;
  address2?: string;
  address_memo?: string | null;
}

export interface SendResponse {
  send_id: number;
  order_id: number;
  address_id: number | null;
  send_date: string | null;
  courier_company: string | null;
  tracking_no: string | null;
  send_status: SendStatus;
  send_memo: string | null;
  address_name: string;
  phone: string;
  nation: string | null;
  postal_code: string;
  address: string;
  address_memo: string | null;
  created_at: string;
  updated_at: string;
  cancelled_at: string | null;
}

export interface SendListResponse extends SendResponse {
  item_count: number;
}

export interface SendDetailResponse extends SendResponse {
  items: SendItemResponse[];
  item_count: number;
}

// Re-export for convenience
export type { SendItemResponse };

export interface SendCreate {
  order_id: number;
  address_id?: number | null;
  address?: SendAddressInput | null;
  send_date?: string | null;
  courier_company?: CourierCompany | null;
  tracking_no?: string | null;
  send_status?: SendStatus;
  send_memo?: string | null;
  items: SendItemInput[];
}

export interface SendUpdate {
  send_date?: string | null;
  courier_company?: CourierCompany | null;
  tracking_no?: string | null;
  send_status?: SendStatus;
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
