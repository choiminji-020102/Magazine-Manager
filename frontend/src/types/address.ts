// Address 관련 타입

export interface AddressCreate {
  customer_id?: number | null;
  address_name: string;
  phone: string;
  nation?: string | null;
  postal_code: string;
  address: string;
  address_memo?: string | null;
}

export interface AddressUpdate {
  nation?: string | null;
  postal_code?: string | null;
  address_memo?: string | null;
}

export interface AddressResponse {
  address_id: number;
  customer_id?: number | null;
  address_name: string;
  phone: string;
  nation?: string | null;
  postal_code: string;
  address: string;
  address_memo?: string | null;
  created_at: string;
  updated_at: string;
}
