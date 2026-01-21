import api from "./axios";
import { logApiError } from "../utils/errorHandler";
import type {
  CustomerResponse,
  CustomerListQuery,
  CustomerCreate,
  CustomerUpdate,
  Customer,
} from "../types/customer";
import type { OrderResponse } from "../types/order";
import type { PaginatedResponse, ResponseModel, ResponseBase } from "../types/api";

// Re-export for backward compatibility
export type {
  CustomerResponse,
  CustomerListQuery,
  CustomerCreate,
  CustomerUpdate,
  Customer,
};

// API 함수들
export const customerAPI = {
  /**
   * 고객 목록 조회 (페이지네이션)
   * GET /customers?page=1&limit=20&search=&channel=&sort=&order=
   */
  getAll: async (
    params?: CustomerListQuery
  ): Promise<PaginatedResponse<CustomerResponse>> => {
    try {
      const response = await api.get<PaginatedResponse<CustomerResponse>>(
        "/customers",
        { params }
      );
      return response.data;
    } catch (err) {
      logApiError(err as any, "GET_ALL_CUSTOMERS");
      throw err;
    }
  },

  /**
   * 특정 고객 조회
   * GET /customers/{customer_id}
   */
  getById: async (customerId: number): Promise<CustomerResponse> => {
    try {
      const response = await api.get<ResponseModel<CustomerResponse>>(
        `/customers/${customerId}`
      );
      if (!response.data.data) {
        throw new Error("고객 정보를 찾을 수 없습니다.");
      }
      return response.data.data;
    } catch (err) {
      logApiError(err as any, "GET_CUSTOMER_BY_ID");
      throw err;
    }
  },

  /**
   * 고객 생성
   * POST /customers
   */
  create: async (data: CustomerCreate): Promise<CustomerResponse> => {
    try {
      const response = await api.post<ResponseModel<CustomerResponse>>(
        "/customers",
        data
      );
      if (!response.data.data) {
        throw new Error("고객 생성에 실패했습니다.");
      }
      return response.data.data;
    } catch (err) {
      logApiError(err as any, "CREATE_CUSTOMER");
      throw err;
    }
  },

  /**
   * 고객 수정
   * PUT /customers/{customer_id}
   */
  update: async (
    customerId: number,
    data: CustomerUpdate
  ): Promise<CustomerResponse> => {
    try {
      const response = await api.put<ResponseModel<CustomerResponse>>(
        `/customers/${customerId}`,
        data
      );
      if (!response.data.data) {
        throw new Error("고객 정보 수정에 실패했습니다.");
      }
      return response.data.data;
    } catch (err) {
      logApiError(err as any, "UPDATE_CUSTOMER");
      throw err;
    }
  },

  /**
   * 고객 삭제 (소프트 삭제)
   * DELETE /customers/{customer_id}
   */
  delete: async (customerId: number): Promise<void> => {
    try {
      await api.delete<ResponseBase>(`/customers/${customerId}`);
    } catch (err) {
      logApiError(err as any, "DELETE_CUSTOMER");
      throw err;
    }
  },

  /**
   * 삭제된 고객 복원
   * PATCH /customers/{customer_id}/restore
   */
  restore: async (customerId: number): Promise<CustomerResponse> => {
    try {
      const response = await api.patch<ResponseModel<CustomerResponse>>(
        `/customers/${customerId}/restore`
      );
      if (!response.data.data) {
        throw new Error("고객 복원에 실패했습니다.");
      }
      return response.data.data;
    } catch (err) {
      logApiError(err as any, "RESTORE_CUSTOMER");
      throw err;
    }
  },

  /**
   * 고객별 주문 이력 조회
   * GET /customers/{customer_id}/orders
   */
  getOrders: async (customerId: number): Promise<OrderResponse[]> => {
    try {
      const response = await api.get<ResponseModel<OrderResponse[]>>(
        `/customers/${customerId}/orders`
      );
      if (!response.data.data) {
        throw new Error("주문 이력을 찾을 수 없습니다.");
      }
      return response.data.data;
    } catch (err) {
      logApiError(err as any, "GET_CUSTOMER_ORDERS");
      throw err;
    }
  },
};
