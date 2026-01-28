import api from "./axios";
import type { ResponseModel } from "../types/api";
import type { AddressCreate, AddressUpdate, AddressResponse } from "../types/address";

export const addressesApi = {
  // GET /addresses/customer/{customer_id} - 고객별 배송지 목록 조회
  getAddressesByCustomer: (customerId: number) => {
    return api.get<ResponseModel<AddressResponse[]>>(`/addresses/customer/${customerId}`);
  },

  // GET /addresses/{address_id} - 배송지 상세 조회
  getAddress: (addressId: number) => {
    return api.get<ResponseModel<AddressResponse>>(`/addresses/${addressId}`);
  },

  // POST /addresses - 배송지 등록
  createAddress: (data: AddressCreate) => {
    return api.post<ResponseModel<AddressResponse>>("/addresses", data);
  },

  // PUT /addresses/{address_id} - 배송지 수정
  updateAddress: (addressId: number, data: AddressUpdate) => {
    return api.put<ResponseModel<AddressResponse>>(`/addresses/${addressId}`, data);
  },
};
