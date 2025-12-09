import { AxiosError } from "axios";

interface ApiErrorResponse {
  detail?: string;
}

/**
 * API 에러를 일관된 형식으로 처리하는 유틸리티
 */
export const getErrorMessage = (error: unknown): string => {
  if (!error) return "알 수 없는 오류가 발생했습니다.";

  const axiosError = error as AxiosError<ApiErrorResponse>;

  // 네트워크 에러
  if (!axiosError.response) {
    return "네트워크 연결을 확인해주세요.";
  }

  // 서버 응답 에러
  const status = axiosError.response.status;
  const detail = axiosError.response.data?.detail;

  if (detail) {
    return detail;
  }

  // 상태 코드별 기본 메시지
  const statusMessages: Record<number, string> = {
    400: "잘못된 요청입니다.",
    401: "인증이 필요합니다. 다시 로그인해주세요.",
    403: "권한이 없습니다.",
    404: "요청한 리소스를 찾을 수 없습니다.",
    500: "서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.",
  };

  return statusMessages[status] || "오류가 발생했습니다. 다시 시도해주세요.";
};

export const logApiError = (
  error: AxiosError<ApiErrorResponse>,
  context: string = ""
): void => {
  const method = error.config?.method?.toUpperCase() || "UNKNOWN";
  const url = error.config?.url || "UNKNOWN";
  const status = error.response?.status ?? "no response";
  const message = error.response?.data?.detail ?? error.message;

  console.error(
    `[API ERROR] [${context}] ${method} ${url} → status: ${status} → message: ${message}`
  );
};
