import api from "./axios";
import type { ResponseModel, PaginatedResponse, ResponseBase } from "../types/api";
import type {
  CustomerListQuery,
  CustomerCreate,
  CustomerUpdate,
  CustomerResponse,
} from "../types/customer";

export const customersApi = {
  // GET /customers - 고객 목록 조회
  getCustomers: (params: CustomerListQuery) => {
    return api.get<PaginatedResponse<CustomerResponse>>("/customers", { params });
  },

  // GET /customers/{customer_id} - 고객 상세 조회
  getCustomer: (customerId: number) => {
    return api.get<ResponseModel<CustomerResponse>>(`/customers/${customerId}`);
  },

  // POST /customers - 고객 등록
  createCustomer: (data: CustomerCreate) => {
    return api.post<ResponseModel<CustomerResponse>>("/customers", data);
  },

  // PUT /customers/{customer_id} - 고객 수정
  updateCustomer: (customerId: number, data: CustomerUpdate) => {
    return api.put<ResponseModel<CustomerResponse>>(`/customers/${customerId}`, data);
  },

  // DELETE /customers/{customer_id} - 고객 삭제
  deleteCustomer: (customerId: number) => {
    return api.delete<ResponseBase>(`/customers/${customerId}`);
  },

  // PATCH /customers/{customer_id}/restore - 삭제된 고객 복원
  restoreCustomer: (customerId: number) => {
    return api.patch<ResponseModel<CustomerResponse>>(`/customers/${customerId}/restore`);
  },
};
