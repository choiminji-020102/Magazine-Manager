// 공통 API 응답 타입

export interface ResponseBase {
  message: string;
}

export interface ResponseModel<T> extends ResponseBase {
  data?: T | null;
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

export interface PaginatedResponse<T> {
  total: number;
  page: number;
  limit: number;
  total_pages: number;
  items: T[];
}

export interface ErrorResponse {
  message: string;
  detail?: string | null;
}
