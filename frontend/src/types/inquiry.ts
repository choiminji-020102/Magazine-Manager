// Inquiry 관련 타입

export interface InquiryCreate {
  customer_id: number;
  inquiry_type: string;
  inquiry_category?: string | null;
  title?: string | null;
  content?: string | null;
  order_id?: number | null;
  order_item_id?: number | null;
}

export interface InquiryUpdate {
  inquiry_type?: string | null;
  inquiry_category?: string | null;
  title?: string | null;
  content?: string | null;
  answer?: string | null;
  inquiry_status?: string | null;
  order_id?: number | null;
  order_item_id?: number | null;
}

export interface InquiryAnswer {
  answer: string;
  inquiry_status: string;
}

export interface InquiryResponse {
  inquiry_id: number;
  customer_id: number;
  inquiry_type: string;
  inquiry_category?: string | null;
  title?: string | null;
  content?: string | null;
  answer?: string | null;
  inquiry_status: string;
  order_id?: number | null;
  order_item_id?: number | null;
  handled_by?: number | null;
  handled_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface InquiryListResponse {
  inquiry_id: number;
  customer_id: number;
  customer_name: string;
  customer_phone: string;
  inquiry_type: string;
  inquiry_category?: string | null;
  title?: string | null;
  inquiry_status: string;
  handled_by?: number | null;
  handler_name?: string | null;
  created_at: string;
}

export interface InquiryDetailResponse extends InquiryResponse {
  customer_name?: string | null;
  customer_phone?: string | null;
  handler_name?: string | null;
}

export interface CustomerQuickSearchResponse {
  customer_id: number;
  customer_name: string;
  customer_phone: string;
  customer_email?: string | null;
  create_channel?: string | null;
  created_at: string;
}

export interface CustomerInquiryHistoryResponse {
  customer: CustomerQuickSearchResponse;
  orders_count: number;
  inquiries_count: number;
  recent_orders: Record<string, any>[];
  recent_inquiries: InquiryResponse[];
}
