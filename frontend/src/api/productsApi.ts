import api from "./axios";
import type { ResponseModel, PaginatedResponse } from "../types/api";
import type {
  ProductListQuery,
  ProductCreate,
  ProductUpdate,
  ProductStockUpdate,
  ProductResponse,
} from "../types/product";

export const productsApi = {
  // GET /products - 상품 목록 조회
  getProducts: (params: ProductListQuery) => {
    return api.get<PaginatedResponse<ProductResponse>>("/products", { params });
  },

  // GET /products/code/{product_code} - 상품코드로 조회
  getProductByCode: (productCode: string) => {
    return api.get<ResponseModel<ProductResponse>>(`/products/code/${productCode}`);
  },

  // GET /products/{product_id} - 상품 상세 조회
  getProduct: (productId: number) => {
    return api.get<ResponseModel<ProductResponse>>(`/products/${productId}`);
  },

  // POST /products - 상품 등록
  createProduct: (data: ProductCreate) => {
    return api.post<ResponseModel<ProductResponse>>("/products", data);
  },

  // PUT /products/{product_id} - 상품 수정
  updateProduct: (productId: number, data: ProductUpdate) => {
    return api.put<ResponseModel<ProductResponse>>(`/products/${productId}`, data);
  },

  // DELETE /products/{product_id} - 상품 삭제
  deleteProduct: (productId: number) => {
    return api.delete<ResponseModel<void>>(`/products/${productId}`);
  },

  // PATCH /products/{product_id}/activate - 상품 활성화
  activateProduct: (productId: number) => {
    return api.patch<ResponseModel<ProductResponse>>(`/products/${productId}/activate`);
  },

  // PATCH /products/{product_id}/deactivate - 상품 비활성화
  deactivateProduct: (productId: number) => {
    return api.patch<ResponseModel<ProductResponse>>(`/products/${productId}/deactivate`);
  },

  // PATCH /products/{product_id}/stock - 재고 수정
  updateStock: (productId: number, data: ProductStockUpdate) => {
    return api.patch<ResponseModel<ProductResponse>>(`/products/${productId}/stock`, data);
  },
};
