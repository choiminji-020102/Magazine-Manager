// Customer 관련 타입

export type CustomerChannel = "CAFE24" | "GPMALL" | "OFFLINE";

export interface CustomerResponse {
  customer_id: number;
  customer_name: string;
  customer_phone: string;
  customer_phone_num4: string;
  customer_email: string | null;
  create_channel: string;
  admin_memo: string | null;
  last_order_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CustomerListQuery {
  page?: number; // 기본값: 1
  limit?: number; // 기본값: 20
  search?: string | null;
  channel?: string | null;
  sort?: string; // 기본값: "created_at"
  order?: "ASC" | "DESC"; // 기본값: "DESC"
}

export interface CustomerCreate {
  customer_name?: string; // 기본값: ""
  customer_phone: string;
  customer_email?: string | null;
  create_channel?: CustomerChannel; // 기본값: "OFFLINE"
  admin_memo?: string | null;
}

export interface CustomerUpdate {
  customer_name?: string | null;
  customer_phone?: string | null;
  customer_email?: string | null;
  admin_memo?: string | null;
}

// Alias for backward compatibility
export type Customer = CustomerResponse;
