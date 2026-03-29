// Product 관련 타입

export enum ProductKind {
  YEARLY = "YEARLY",
  MONTHLY = "MONTHLY",
}

export interface ProductListQuery {
  page: number;
  limit: number;
  search?: string | null;
  product_kind?: ProductKind | null;
  is_active?: boolean | null;
  subscribe_start_issue?: string | null;
  sort_by?: string;
  sort_order?: string;
}

export interface ProductCreate {
  product_code: string;
  product_kind: ProductKind;
  product_name: string;
  external_product_code_gpmall?: string | null;
  list_price: number;
  sale_price: number;
  cost_price: number;
  stock_quantity: number;
  unit_weight?: number | null;
  unit_width?: number | null;
  unit_length?: number | null;
  unit_height?: number | null;
  is_active: boolean;
  // subscribe_start_issue는 product_code에서 자동 파싱 — 직접 입력 불가
}

export interface ProductUpdate {
  product_code?: string | null;
  product_kind?: ProductKind | null;
  product_name?: string | null;
  external_product_code_gpmall?: string | null;
  list_price?: number | null;
  sale_price?: number | null;
  cost_price?: number | null;
  stock_quantity?: number | null;
  unit_weight?: number | null;
  unit_width?: number | null;
  unit_length?: number | null;
  unit_height?: number | null;
  is_active?: boolean | null;
  // subscribe_start_issue는 불변 — 수정 불가
}

export interface ProductStockUpdate {
  stock_quantity: number;
}

export interface ProductResponse {
  product_id: number;
  product_code: string;
  product_kind: ProductKind;
  product_name: string;
  external_product_code_gpmall?: string | null;
  list_price: number;
  sale_price: number;
  cost_price: number;
  stock_quantity: number;
  unit_weight?: number | null;
  unit_width?: number | null;
  unit_length?: number | null;
  unit_height?: number | null;
  is_active: boolean;
  subscribe_start_issue?: string | null;
  created_at: string;
  updated_at: string;
}
