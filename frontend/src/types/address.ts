// Address 관련 타입 (백엔드 스키마 기준)

export interface AddressCreate {
  customer_id: number;
  recipient_name: string;       // 불변
  recipient_phone: string;      // 불변
  country_code?: string;        // 기본값: "KR", 불변
  postal_code: string;          // 불변
  recipient_address: string;    // 불변
  customer_memo?: string | null;
  admin_memo?: string | null;
}

export interface AddressUpdate {
  admin_memo?: string | null;
  vip1?: boolean;
  vip2?: boolean;
  vip3?: boolean;
  vip4?: boolean;
  vip5?: boolean;
  vip6?: boolean;
}

export interface AddressListQuery {
  page?: number;
  limit?: number;
  customer_id?: number | null;
  postal_code?: string | null;
  country_code?: string | null;
  vip_slot_number?: number | null;
  sort_by?: string;
  sort_order?: string;
}

export interface AddressResponse {
  address_id: number;
  customer_id: number;
  recipient_name: string;
  recipient_phone: string;
  country_code: string;
  postal_code: string;
  recipient_address: string;
  customer_memo?: string | null;
  admin_memo?: string | null;
  vip1: boolean;
  vip2: boolean;
  vip3: boolean;
  vip4: boolean;
  vip5: boolean;
  vip6: boolean;
  created_at: string;
  updated_at: string;
}
