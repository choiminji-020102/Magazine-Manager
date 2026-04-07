import api from "./axios";
import type { ResponseModel, PaginatedResponse } from "../types/api";
import type {
  CustomerListQuery,
  CustomerCreate,
  CustomerUpdate,
  CustomerResponse,
  CustomerDetailResponse,
} from "../types/customer";

export const customersApi = {
  // GET /customers/search/phone?phone_num4=XXXX - 연락처 뒤 4자리 빠른 검색
  searchByPhone: (phoneNum4: string) => {
    return api.get<ResponseModel<CustomerResponse[]>>("/customers/search/phone", { params: { phone_num4: phoneNum4 } });
  },

  // GET /customers - 고객 목록 조회
  getCustomers: (params: CustomerListQuery) => {
    return api.get<PaginatedResponse<CustomerResponse>>("/customers", { params });
  },

  // GET /customers/{customer_id} - 고객 상세 조회 (주문·배송지 포함)
  getCustomer: (customerId: number) => {
    return api.get<ResponseModel<CustomerDetailResponse>>(`/customers/${customerId}`);
  },

  // POST /customers - 고객 등록
  createCustomer: (data: CustomerCreate) => {
    return api.post<ResponseModel<CustomerResponse>>("/customers", data);
  },

  // PUT /customers/{customer_id} - 고객 수정 (CustomerDetailResponse 반환: 주문·배송지 포함)
  updateCustomer: (customerId: number, data: CustomerUpdate) => {
    return api.put<ResponseModel<CustomerDetailResponse>>(`/customers/${customerId}`, data);
  },

  // PATCH /customers/{customer_id}/activate - 고객 활성화
  activateCustomer: (customerId: number) => {
    return api.patch<ResponseModel<CustomerResponse>>(`/customers/${customerId}/activate`);
  },

  // PATCH /customers/{customer_id}/deactivate - 고객 비활성화
  deactivateCustomer: (customerId: number) => {
    return api.patch<ResponseModel<CustomerResponse>>(`/customers/${customerId}/deactivate`);
  },

  // DELETE /customers/{customer_id} - 고객 삭제 (소프트)
  deleteCustomer: (customerId: number) => {
    return api.delete<ResponseModel<void>>(`/customers/${customerId}`);
  },

  // POST /customers/{customer_id}/restore - 고객 복구
  restoreCustomer: (customerId: number) => {
    return api.post<ResponseModel<CustomerResponse>>(`/customers/${customerId}/restore`);
  },
};
