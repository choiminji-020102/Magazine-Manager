import api from "./axios";
import type { ResponseModel, PaginatedResponse } from "../types/api";
import type {
  InquiryCreate,
  InquiryUpdate,
  InquiryAnswer,
  InquiryResponse,
  InquiryListResponse,
  InquiryDetailResponse,
  CustomerQuickSearchResponse,
  CustomerInquiryHistoryResponse,
} from "../types/inquiry";

export const inquiriesApi = {
  // GET /inquiries/search/phone4/{phone_num4} - 전화번호 뒤4자리로 고객 검색
  searchByPhone4: (phoneNum4: string) => {
    return api.get<ResponseModel<CustomerQuickSearchResponse[]>>(
      `/inquiries/search/phone4/${phoneNum4}`
    );
  },

  // GET /inquiries/customer/{customer_id}/history - 고객 문의 내역 조회
  getCustomerHistory: (customerId: number) => {
    return api.get<ResponseModel<CustomerInquiryHistoryResponse>>(
      `/inquiries/customer/${customerId}/history`
    );
  },

  // GET /inquiries - 문의 목록 조회
  getInquiries: (params: {
    page?: number;
    limit?: number;
    customer_id?: number | null;
    inquiry_type?: string | null;
    inquiry_status?: string | null;
    search?: string | null;
    start_date?: string | null;
    end_date?: string | null;
  }) => {
    return api.get<PaginatedResponse<InquiryListResponse>>("/inquiries", { params });
  },

  // GET /inquiries/{inquiry_id} - 문의 상세 조회
  getInquiry: (inquiryId: number) => {
    return api.get<ResponseModel<InquiryDetailResponse>>(`/inquiries/${inquiryId}`);
  },

  // POST /inquiries - 문의 등록
  createInquiry: (data: InquiryCreate) => {
    return api.post<ResponseModel<InquiryResponse>>("/inquiries", data);
  },

  // PUT /inquiries/{inquiry_id} - 문의 수정
  updateInquiry: (inquiryId: number, data: InquiryUpdate) => {
    return api.put<ResponseModel<InquiryResponse>>(`/inquiries/${inquiryId}`, data);
  },

  // PATCH /inquiries/{inquiry_id}/answer - 문의 답변
  answerInquiry: (inquiryId: number, data: InquiryAnswer) => {
    return api.patch<ResponseModel<InquiryResponse>>(`/inquiries/${inquiryId}/answer`, data);
  },

  // DELETE /inquiries/{inquiry_id} - 문의 삭제
  deleteInquiry: (inquiryId: number) => {
    return api.delete<ResponseModel<void>>(`/inquiries/${inquiryId}`);
  },

  // GET /inquiries/customer/{customer_id} - 고객별 문의 목록
  getCustomerInquiries: (customerId: number, limit: number = 10) => {
    return api.get<ResponseModel<InquiryResponse[]>>(`/inquiries/customer/${customerId}`, {
      params: { limit },
    });
  },
};
