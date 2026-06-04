import api from "./axios";
import type { ResponseModel, PaginatedResponse } from "../types/api";
import type { AddressCreate, AddressUpdate, AddressResponse } from "../types/address";

export const addressesApi = {
  // GET /addresses - 배송지 목록 조회
  getAddresses: (params?: {
    page?: number;
    limit?: number;
    customer_id?: number | null;
    postal_code?: string | null;
    country_code?: string | null;
    vip_slot_number?: number | null;
    sort_by?: string;
    sort_order?: string;
  }) => {
    return api.get<PaginatedResponse<AddressResponse>>("/addresses", { params });
  },

  // GET /addresses/{address_id} - 배송지 상세 조회
  getAddress: (addressId: number) => {
    return api.get<ResponseModel<AddressResponse>>(`/addresses/${addressId}`);
  },

  // GET /customers/{customer_id}/addresses - 고객별 배송지 목록 조회
  getAddressesByCustomer: (customerId: number) => {
    return api.get<ResponseModel<AddressResponse[]>>(`/customers/${customerId}/addresses`);
  },

  // POST /addresses - 배송지 등록
  createAddress: (data: AddressCreate) => {
    return api.post<ResponseModel<AddressResponse>>("/addresses", data);
  },

  // PUT /addresses/{address_id} - 배송지 수정 (admin_memo, vip1~vip6)
  updateAddress: (addressId: number, data: AddressUpdate) => {
    return api.put<ResponseModel<AddressResponse>>(`/addresses/${addressId}`, data);
  },

  // DELETE /addresses/{address_id} - 배송지 삭제
  deleteAddress: (addressId: number) => {
    return api.delete<ResponseModel<void>>(`/addresses/${addressId}`);
  },
};
