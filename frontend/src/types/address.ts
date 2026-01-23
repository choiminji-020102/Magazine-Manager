// Address 관련 타입

export interface AddressResponse {
  address_id: number;
  customer_id: number;
  address_name: string;
  phone: string;
  nation: string;
  postal_code: string;
  address: string;
  address_memo: string | null;
  created_at: string;
  updated_at: string;
}

export interface AddressCreate {
  customer_id: number;
  address_name: string;
  phone: string;
  nation?: string;
  postal_code: string;
  address: string;
  address_memo?: string | null;
}

export interface AddressUpdate {
  nation?: string;
  postal_code?: string;
  address_memo?: string | null;
}
