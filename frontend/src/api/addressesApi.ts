import api from "./axios";
import { logApiError } from "../utils/errorHandler";
import type {
  AddressResponse,
  AddressCreate,
  AddressUpdate,
} from "../types/address";
import type { ResponseModel } from "../types/api";

// Re-export for backward compatibility
export type {
  AddressResponse,
  AddressCreate,
  AddressUpdate,
};

// API 함수들
export const addressAPI = {
  /**
   * 고객별 배송지 목록 조회
   * GET /addresses/customer/{customer_id}
   */
  getByCustomer: async (customerId: number): Promise<AddressResponse[]> => {
    try {
      const response = await api.get<ResponseModel<AddressResponse[]>>(
        `/addresses/customer/${customerId}`
      );
      return response.data.data;
    } catch (err) {
      logApiError(err as any, "GET_ADDRESSES_BY_CUSTOMER");
      throw err;
    }
  },

  /**
   * 배송지 상세 조회
   * GET /addresses/{address_id}
   */
  getById: async (addressId: number): Promise<AddressResponse> => {
    try {
      const response = await api.get<ResponseModel<AddressResponse>>(
        `/addresses/${addressId}`
      );
      return response.data.data;
    } catch (err) {
      logApiError(err as any, "GET_ADDRESS_BY_ID");
      throw err;
    }
  },

  /**
   * 배송지 등록 (동일 주소 있으면 기존 반환)
   * POST /addresses
   */
  create: async (data: AddressCreate): Promise<AddressResponse> => {
    try {
      const response = await api.post<ResponseModel<AddressResponse>>(
        "/addresses",
        data
      );
      return response.data.data;
    } catch (err) {
      logApiError(err as any, "CREATE_ADDRESS");
      throw err;
    }
  },

  /**
   * 배송지 수정 (nation, postal_code, address_memo만 수정 가능)
   * PUT /addresses/{address_id}
   */
  update: async (
    addressId: number,
    data: AddressUpdate
  ): Promise<AddressResponse> => {
    try {
      const response = await api.put<ResponseModel<AddressResponse>>(
        `/addresses/${addressId}`,
        data
      );
      return response.data.data;
    } catch (err) {
      logApiError(err as any, "UPDATE_ADDRESS");
      throw err;
    }
  },
};
