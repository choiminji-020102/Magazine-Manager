// Product 관련 타입

export enum ProductKind {
  YEARLY = "YEARLY",
  MONTHLY = "MONTHLY",
  SINGLE = "SINGLE",
}

export interface ProductListQuery {
  page: number;
  limit: number;
  search?: string | null;
  kind?: string | null;
  is_active?: boolean | null;
}

export interface ProductCreate {
  product_code: string;
  product_kind: ProductKind;
  product_name: string;
  unit_weight?: number | null;
  unit_width?: number | null;
  unit_length?: number | null;
  unit_height?: number | null;
  price: number;
  sale: number;
  purchase: number;
  stock_quantity: number;
  is_active: boolean;
  external_product_code_cafe24?: string | null;
  external_product_code_gpmall?: string | null;
  subscribe_start_issue?: string | null;
}

export interface ProductUpdate {
  product_name?: string | null;
  unit_weight?: number | null;
  unit_width?: number | null;
  unit_length?: number | null;
  unit_height?: number | null;
  price?: number | null;
  sale?: number | null;
  purchase?: number | null;
  stock_quantity?: number | null;
  is_active?: boolean | null;
  external_product_code_cafe24?: string | null;
  external_product_code_gpmall?: string | null;
  subscribe_start_issue?: string | null;
}

export interface ProductResponse {
  product_id: number;
  product_code: string;
  product_kind: ProductKind;
  product_name: string;
  unit_weight?: number | null;
  unit_width?: number | null;
  unit_length?: number | null;
  unit_height?: number | null;
  price: number;
  sale: number;
  purchase: number;
  stock_quantity: number;
  is_active: boolean;
  external_product_code_cafe24?: string | null;
  external_product_code_gpmall?: string | null;
  subscribe_start_issue?: string | null;
  created_at: string;
  updated_at: string;
}
