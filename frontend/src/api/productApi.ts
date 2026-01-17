import api from "./axios";
import { logApiError } from "../utils/errorHandler";

// 타입 정의
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
}

// API 함수들
export const productAPI = {
  /**
   * 모든 상품 조회
   * GET /product
   */
  getAll: async (): Promise<Product[]> => {
    try {
      const response = await api.get<Product[]>("/product");
      return response.data;
    } catch (err) {
      logApiError(err as any, "GET_ALL_PRODUCTS");
      throw err;
    }
  },

  /**
   * 특정 상품 조회
   * GET /product/{product_id}
   */
  getById: async (productId: number): Promise<Product> => {
    try {
      const response = await api.get<Product>(`/product/${productId}`);
      return response.data;
    } catch (err) {
      logApiError(err as any, "GET_PRODUCT_BY_ID");
      throw err;
    }
  },

  /**
   * 상품 생성
   * POST /product
   */
  create: async (data: ProductCreate): Promise<Product> => {
    try {
      const response = await api.post<Product>("/product", data);
      return response.data;
    } catch (err) {
      logApiError(err as any, "CREATE_PRODUCT");
      throw err;
    }
  },

  /**
   * 상품 수정
   * PUT /product/{product_id}
   */
  update: async (
    productId: number,
    data: ProductUpdate
  ): Promise<Product> => {
    try {
      const response = await api.put<Product>(`/product/${productId}`, data);
      return response.data;
    } catch (err) {
      logApiError(err as any, "UPDATE_PRODUCT");
      throw err;
    }
  },

  /**
   * 상품 삭제
   * DELETE /product/{product_id}
   */
  delete: async (productId: number): Promise<void> => {
    try {
      await api.delete(`/product/${productId}`);
    } catch (err) {
      logApiError(err as any, "DELETE_PRODUCT");
      throw err;
    }
  },
};
