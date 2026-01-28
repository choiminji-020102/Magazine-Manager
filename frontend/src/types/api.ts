// 공통 API 응답 타입

export interface ResponseBase {
  success: boolean;
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

export interface PaginatedResponse<T> extends ResponseBase {
  data: T[];
  pagination: PaginationMeta;
}

export interface ErrorResponse {
  success: boolean;
  message: string;
  errors?: Record<string, any> | null;
}
