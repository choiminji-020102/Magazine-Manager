// Product 관련 타입

export enum ProductKind {
  YEARLY = "YEARLY",
  MONTHLY = "MONTHLY",
  SINGLE = "SINGLE",
}

export interface Product {
  product_id: number;
  product_code: string;
  product_kind: ProductKind;
  product_name: string;
  unit_weight: number;
  unit_width: number;
  unit_length: number;
  unit_height: number;
  price: number;
  sale: number;
  purchase: number;
  stock_quantity: number;
  is_active: boolean;
  external_product_code_cafe24: string | null;
  external_product_code_gpmall: string | null;
  subscribe_start_issue: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProductCreate {
  product_code: string;
  product_kind: ProductKind;
  product_name: string;
  unit_weight?: number;
  unit_width?: number;
  unit_length?: number;
  unit_height?: number;
  price: number;
  sale: number;
  purchase?: number;
  stock_quantity?: number;
  is_active?: boolean;
  external_product_code_cafe24?: string | null;
  external_product_code_gpmall?: string | null;
  subscribe_start_issue?: string | null;
}

export interface ProductUpdate {
  product_code?: string;
  product_kind?: ProductKind;
  product_name?: string;
  unit_weight?: number;
  unit_width?: number;
  unit_length?: number;
  unit_height?: number;
  price?: number;
  sale?: number;
  purchase?: number;
  stock_quantity?: number;
  is_active?: boolean;
  external_product_code_cafe24?: string | null;
  external_product_code_gpmall?: string | null;
  subscribe_start_issue?: string | null;
}
