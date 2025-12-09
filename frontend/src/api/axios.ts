import axios, {
  AxiosError,
  AxiosInstance,
  InternalAxiosRequestConfig,
} from "axios";

// 토큰 저장 키
const ACCESS_TOKEN_KEY = "access_token";
const REFRESH_TOKEN_KEY = "refresh_token";

// 토큰 유틸리티 함수
export const tokenUtils = {
  getAccessToken: (): string | null => localStorage.getItem(ACCESS_TOKEN_KEY),
  getRefreshToken: (): string | null => localStorage.getItem(REFRESH_TOKEN_KEY),

  setTokens: (accessToken: string, refreshToken: string): void => {
    localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  },

  clearTokens: (): void => {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  },

  hasTokens: (): boolean => {
    return !!localStorage.getItem(ACCESS_TOKEN_KEY);
  },
};

// Axios 인스턴스 생성
const api: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api",
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 10000,
});

// 토큰 갱신 중인지 추적
let isRefreshing = false;
// 토큰 갱신 대기 중인 요청들
let refreshSubscribers: Array<(token: string) => void> = [];

// 갱신 완료 후 대기 중인 요청들 처리
const onRefreshed = (newAccessToken: string): void => {
  refreshSubscribers.forEach((callback) => callback(newAccessToken));
  refreshSubscribers = [];
};

// 토큰 갱신 대기열에 요청 추가
const addRefreshSubscriber = (callback: (token: string) => void): void => {
  refreshSubscribers.push(callback);
};

// Request Interceptor - 모든 요청에 Access Token 첨부
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const accessToken = tokenUtils.getAccessToken();
    if (accessToken && config.headers) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
    return config;
  },
  (error: AxiosError) => {
    return Promise.reject(error);
  }
);

// Response Interceptor - 401 에러 시 토큰 갱신 처리
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    // 401 에러가 아니거나, 이미 재시도한 요청이면 에러 반환
    if (error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(error);
    }

    // 로그인, 리프레시, 최초 관리자 생성 요청은 재시도하지 않음
    const excludedUrls = ["/auth/login", "/auth/refresh", "/auth/signup/init"];
    if (excludedUrls.some((url) => originalRequest.url?.includes(url))) {
      return Promise.reject(error);
    }

    // 이미 토큰 갱신 중이면 대기열에 추가
    if (isRefreshing) {
      return new Promise((resolve) => {
        addRefreshSubscriber((newAccessToken: string) => {
          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
          }
          resolve(api(originalRequest));
        });
      });
    }

    originalRequest._retry = true;
    isRefreshing = true;

    const accessToken = tokenUtils.getAccessToken();
    const refreshToken = tokenUtils.getRefreshToken();

    // 토큰이 없으면 로그아웃 처리
    if (!accessToken || !refreshToken) {
      isRefreshing = false;
      tokenUtils.clearTokens();
      window.dispatchEvent(new CustomEvent("auth:logout"));
      return Promise.reject(error);
    }

    try {
      // 토큰 갱신 요청 (interceptor 우회를 위해 axios 직접 사용)
      const response = await axios.post(
        `${api.defaults.baseURL}/auth/refresh`,
        {
          access_token: accessToken,
          refresh_token: refreshToken,
        },
        {
          headers: { "Content-Type": "application/json" },
        }
      );

      const { access_token: newAccessToken, refresh_token: newRefreshToken } =
        response.data;

      // 새 토큰 저장
      tokenUtils.setTokens(newAccessToken, newRefreshToken);

      // 대기 중인 요청들 처리
      onRefreshed(newAccessToken);

      // 원래 요청 재시도
      if (originalRequest.headers) {
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
      }

      return api(originalRequest);
    } catch (refreshError) {
      // 토큰 갱신 실패 시 로그아웃 처리
      tokenUtils.clearTokens();
      refreshSubscribers = [];
      window.dispatchEvent(new CustomEvent("auth:logout"));
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);

export default api;
