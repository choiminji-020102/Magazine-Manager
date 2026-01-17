import api from "./axios";
import { logApiError } from "../utils/errorHandler";

// 타입 정의
export interface Customer {
  customer_id: number;
  customer_name: string;
  customer_phone: string;
  customer_phone_num4: string;
  customer_email: string | null;
  create_channel: string;
  admin_memo: string | null;
  last_order_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface CustomerCreate {
  customer_name: string;
  customer_phone: string;
  customer_email?: string | null;
  create_channel: string;
  admin_memo?: string | null;
}

export interface CustomerUpdate {
  customer_name?: string;
  customer_phone?: string;
  customer_email?: string | null;
  create_channel?: string;
  admin_memo?: string | null;
}

// API 함수들
export const customerAPI = {
  /**
   * 모든 고객 조회
   * GET /customer
   */
  getAll: async (): Promise<Customer[]> => {
    try {
      const response = await api.get<Customer[]>("/customer");
      return response.data;
    } catch (err) {
      logApiError(err as any, "GET_ALL_CUSTOMERS");
      throw err;
    }
  },

  /**
   * 특정 고객 조회
   * GET /customer/{customer_id}
   */
  getById: async (customerId: number): Promise<Customer> => {
    try {
      const response = await api.get<Customer>(`/customer/${customerId}`);
      return response.data;
    } catch (err) {
      logApiError(err as any, "GET_CUSTOMER_BY_ID");
      throw err;
    }
  },

  /**
   * 고객 생성
   * POST /customer
   */
  create: async (data: CustomerCreate): Promise<Customer> => {
    try {
      const response = await api.post<Customer>("/customer", data);
      return response.data;
    } catch (err) {
      logApiError(err as any, "CREATE_CUSTOMER");
      throw err;
    }
  },

  /**
   * 고객 수정
   * PUT /customer/{customer_id}
   */
  update: async (
    customerId: number,
    data: CustomerUpdate
  ): Promise<Customer> => {
    try {
      const response = await api.put<Customer>(`/customer/${customerId}`, data);
      return response.data;
    } catch (err) {
      logApiError(err as any, "UPDATE_CUSTOMER");
      throw err;
    }
  },

  /**
   * 고객 삭제 (소프트 삭제)
   * DELETE /customer/{customer_id}
   */
  delete: async (customerId: number): Promise<void> => {
    try {
      await api.delete(`/customer/${customerId}`);
    } catch (err) {
      logApiError(err as any, "DELETE_CUSTOMER");
      throw err;
    }
  },
};
