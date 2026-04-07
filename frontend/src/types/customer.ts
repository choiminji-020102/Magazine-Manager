// Customer 관련 타입

export type CustomerChannel = "CAFE24" | "GPMALL" | "OFFLINE";

export interface CustomerListQuery {
  page: number;
  limit: number;
  search?: string | null;
  create_channel?: CustomerChannel | null;
  is_active?: boolean | null;
  is_deleted?: boolean;
  phone_num4?: string | null;
  admin_memo?: string | null;
  sort_by?: string;
  sort_order?: string;
}

export interface CustomerCreate {
  customer_name: string;
  customer_phone: string;
  customer_email?: string | null;
  create_channel: CustomerChannel;
  admin_memo?: string | null;
}

export interface CustomerUpdate {
  create_channel?: CustomerChannel | null;
  customer_phone?: string | null;
  customer_email?: string | null;
  customer_name?: string | null;
  admin_memo?: string | null;
}

export interface CustomerDetailResponse extends CustomerResponse {
  recent_orders: import("./order").OrderResponse[];
  addresses: import("./address").AddressResponse[];
}

export interface CustomerResponse {
  customer_id: number;
  customer_name: string;
  customer_phone: string;
  customer_phone_num4: string;
  customer_email?: string | null;
  create_channel: string;
  admin_memo?: string | null;
  last_order_at?: string | null;
  is_active: boolean;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}
