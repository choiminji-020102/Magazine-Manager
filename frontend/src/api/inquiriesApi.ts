import api from "./axios";
import { logApiError } from "../utils/errorHandler";
import type {
  InquiryResponse,
  InquiryListResponse,
  InquiryDetailResponse,
  CustomerQuickSearchResponse,
  CustomerInquiryHistoryResponse,
  InquiryCreate,
  InquiryUpdate,
  InquiryAnswer,
} from "../types/inquiry";
import type { PaginatedResponse, ResponseModel } from "../types/api";

// Re-export for backward compatibility
export type {
  InquiryResponse,
  InquiryListResponse,
  InquiryDetailResponse,
  CustomerQuickSearchResponse,
  CustomerInquiryHistoryResponse,
  InquiryCreate,
  InquiryUpdate,
  InquiryAnswer,
};

// API 함수들
export const inquiryAPI = {
  /**
   * 전화번호 뒤4자리로 고객 빠른 검색
   * GET /inquiries/search/phone4/{phone_num4}
   */
  searchByPhone4: async (
    phoneNum4: string
  ): Promise<CustomerQuickSearchResponse[]> => {
    try {
      const response = await api.get<
        ResponseModel<CustomerQuickSearchResponse[]>
      >(`/inquiries/search/phone4/${phoneNum4}`);
      return response.data.data;
    } catch (err) {
      logApiError(err as any, "SEARCH_CUSTOMERS_BY_PHONE4");
      throw err;
    }
  },

  /**
   * 고객 문의 이력 조회 (주문내역 + 문의내역)
   * GET /inquiries/customer/{customer_id}/history
   */
  getCustomerHistory: async (
    customerId: number
  ): Promise<CustomerInquiryHistoryResponse> => {
    try {
      const response = await api.get<ResponseModel<CustomerInquiryHistoryResponse>>(
        `/inquiries/customer/${customerId}/history`
      );
      return response.data.data;
    } catch (err) {
      logApiError(err as any, "GET_CUSTOMER_INQUIRY_HISTORY");
      throw err;
    }
  },

  /**
   * 문의 목록 조회 (페이지네이션)
   * GET /inquiries?page=1&limit=20&customer_id=&inquiry_type=&inquiry_status=&search=&start_date=&end_date=
   */
  getAll: async (params?: {
    page?: number;
    limit?: number;
    customer_id?: number;
    inquiry_type?: string;
    inquiry_status?: string;
    search?: string;
    start_date?: string;
    end_date?: string;
  }): Promise<PaginatedResponse<InquiryListResponse>> => {
    try {
      const response = await api.get<PaginatedResponse<InquiryListResponse>>(
        "/inquiries",
        { params }
      );
      return response.data;
    } catch (err) {
      logApiError(err as any, "GET_ALL_INQUIRIES");
      throw err;
    }
  },

  /**
   * 문의 상세 조회
   * GET /inquiries/{inquiry_id}
   */
  getById: async (inquiryId: number): Promise<InquiryDetailResponse> => {
    try {
      const response = await api.get<ResponseModel<InquiryDetailResponse>>(
        `/inquiries/${inquiryId}`
      );
      return response.data.data;
    } catch (err) {
      logApiError(err as any, "GET_INQUIRY_BY_ID");
      throw err;
    }
  },

  /**
   * 문의 등록
   * POST /inquiries
   */
  create: async (data: InquiryCreate): Promise<InquiryResponse> => {
    try {
      const response = await api.post<ResponseModel<InquiryResponse>>(
        "/inquiries",
        data
      );
      return response.data.data;
    } catch (err) {
      logApiError(err as any, "CREATE_INQUIRY");
      throw err;
    }
  },

  /**
   * 문의 수정
   * PUT /inquiries/{inquiry_id}
   */
  update: async (
    inquiryId: number,
    data: InquiryUpdate
  ): Promise<InquiryResponse> => {
    try {
      const response = await api.put<ResponseModel<InquiryResponse>>(
        `/inquiries/${inquiryId}`,
        data
      );
      return response.data.data;
    } catch (err) {
      logApiError(err as any, "UPDATE_INQUIRY");
      throw err;
    }
  },

  /**
   * 문의 답변
   * PATCH /inquiries/{inquiry_id}/answer
   */
  answer: async (
    inquiryId: number,
    data: InquiryAnswer
  ): Promise<InquiryResponse> => {
    try {
      const response = await api.patch<ResponseModel<InquiryResponse>>(
        `/inquiries/${inquiryId}/answer`,
        data
      );
      return response.data.data;
    } catch (err) {
      logApiError(err as any, "ANSWER_INQUIRY");
      throw err;
    }
  },

  /**
   * 문의 삭제
   * DELETE /inquiries/{inquiry_id}
   */
  delete: async (inquiryId: number): Promise<void> => {
    try {
      await api.delete(`/inquiries/${inquiryId}`);
    } catch (err) {
      logApiError(err as any, "DELETE_INQUIRY");
      throw err;
    }
  },

  /**
   * 고객별 문의 목록
   * GET /inquiries/customer/{customer_id}?limit=10
   */
  getByCustomer: async (
    customerId: number,
    limit: number = 10
  ): Promise<InquiryResponse[]> => {
    try {
      const response = await api.get<ResponseModel<InquiryResponse[]>>(
        `/inquiries/customer/${customerId}`,
        { params: { limit } }
      );
      return response.data.data;
    } catch (err) {
      logApiError(err as any, "GET_INQUIRIES_BY_CUSTOMER");
      throw err;
    }
  },
};
