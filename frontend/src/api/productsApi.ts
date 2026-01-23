import api from "./axios";
import { logApiError } from "../utils/errorHandler";
import type {
  ProductKind,
  Product,
  ProductCreate,
  ProductUpdate,
} from "../types/product";
import type { PaginatedResponse, ResponseModel } from "../types/api";

// Re-export for backward compatibility
export type { ProductKind, Product, ProductCreate, ProductUpdate };

// API 함수들
export const productAPI = {
  /**
   * 상품 목록 조회 (페이지네이션)
   * GET /products?page=1&limit=20&search=&kind=&is_active=
   */
  getAll: async (params?: {
    page?: number;
    limit?: number;
    search?: string;
    kind?: string;
    is_active?: boolean;
  }): Promise<PaginatedResponse<Product>> => {
    try {
      const response = await api.get<PaginatedResponse<Product>>("/products", {
        params,
      });
      return response.data;
    } catch (err) {
      logApiError(err as any, "GET_ALL_PRODUCTS");
      throw err;
    }
  },

  /**
   * 상품종류별 조회
   * GET /products/kind/{product_kind}?active_only=true
   */
  getByKind: async (
    productKind: string,
    activeOnly: boolean = true
  ): Promise<Product[]> => {
    try {
      const response = await api.get<ResponseModel<Product[]>>(
        `/products/kind/${productKind}`,
        { params: { active_only: activeOnly } }
      );
      return response.data.data;
    } catch (err) {
      logApiError(err as any, "GET_PRODUCTS_BY_KIND");
      throw err;
    }
  },

  /**
   * 상품코드로 조회
   * GET /products/code/{product_code}
   */
  getByCode: async (productCode: string): Promise<Product> => {
    try {
      const response = await api.get<ResponseModel<Product>>(
        `/products/code/${productCode}`
      );
      return response.data.data;
    } catch (err) {
      logApiError(err as any, "GET_PRODUCT_BY_CODE");
      throw err;
    }
  },

  /**
   * 특정 상품 조회
   * GET /products/{product_id}
   */
  getById: async (productId: number): Promise<Product> => {
    try {
      const response = await api.get<ResponseModel<Product>>(
        `/products/${productId}`
      );
      return response.data.data;
    } catch (err) {
      logApiError(err as any, "GET_PRODUCT_BY_ID");
      throw err;
    }
  },

  /**
   * 상품 생성
   * POST /products
   */
  create: async (data: ProductCreate): Promise<Product> => {
    try {
      const response = await api.post<ResponseModel<Product>>("/products", data);
      return response.data.data;
    } catch (err) {
      logApiError(err as any, "CREATE_PRODUCT");
      throw err;
    }
  },

  /**
   * 상품 수정
   * PUT /products/{product_id}
   */
  update: async (
    productId: number,
    data: ProductUpdate
  ): Promise<Product> => {
    try {
      const response = await api.put<ResponseModel<Product>>(
        `/products/${productId}`,
        data
      );
      return response.data.data;
    } catch (err) {
      logApiError(err as any, "UPDATE_PRODUCT");
      throw err;
    }
  },

  /**
   * 상품 삭제
   * DELETE /products/{product_id}
   */
  delete: async (productId: number): Promise<void> => {
    try {
      await api.delete(`/products/${productId}`);
    } catch (err) {
      logApiError(err as any, "DELETE_PRODUCT");
      throw err;
    }
  },

  /**
   * 상품 활성화/비활성화
   * PATCH /products/{product_id}/activate
   */
  activate: async (productId: number): Promise<{ is_active: boolean }> => {
    try {
      const response = await api.patch<ResponseModel<{ is_active: boolean }>>(
        `/products/${productId}/activate`
      );
      return response.data.data;
    } catch (err) {
      logApiError(err as any, "ACTIVATE_PRODUCT");
      throw err;
    }
  },
};
