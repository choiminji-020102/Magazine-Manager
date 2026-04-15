// Cafe24 관련 타입

export interface Cafe24OAuthStartResponse {
  authorize_url: string;
}

export interface Cafe24TokenStatusResponse {
  authorized: boolean;
  expires_at?: string | null;
  refresh_token_expires_at?: string | null;
  mall_id: string;
  scopes: string[];
}

export interface Cafe24Product {
  product_no: number;
  product_code: string;
  product_name: string;
  price_excluding_tax: string;
  price: string;
  retail_price: string;
  supply_price: string;
  display: string;
  selling: string;
  list_image: string;
  product_weight: string;
  created_date: string;
  updated_date: string;
  [key: string]: any;
}

export interface Cafe24ProductsResponse {
  products: Cafe24Product[];
}
