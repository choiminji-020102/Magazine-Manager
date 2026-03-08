import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import { tokenUtils } from "../api/axios";
import { authAPI, LoginRequest, LogoutRequest } from "../api/authApi";
import { AdminResponse, AdminRole } from "../types/admin";
import { getErrorMessage } from "../utils/errorHandler";

// 개발 모드에서 로그인 우회 (true로 설정하면 로그인 없이 사용 가능)
const DEV_SKIP_AUTH = false;

// 개발용 더미 관리자
const DEV_ADMIN: AdminResponse = {
  admin_id: 1,
  email: "dev@test.com",
  admin_name: "개발자",
  admin_role: AdminRole.SUPER_ADMIN,
  is_active: true,
  last_login_at: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

// AuthContext 타입 정의
interface AuthContextType {
  // 상태
  isAuthenticated: boolean;
  isLoading: boolean;
  currentAdmin: AdminResponse | null;
  error: string | null;

  // 액션
  login: (credentials: LoginRequest) => Promise<void>;
  logout: () => Promise<void>;
  refreshCurrentAdmin: () => Promise<void>;
  clearError: () => void;
}

// 기본값
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Provider Props 타입
interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  // const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  // const [isLoading, setIsLoading] = useState<boolean>(true);
  // const [currentAdmin, setCurrentAdmin] = useState<AdminResponse | null>(null);
  // 개발 모드면 바로 인증된 상태로 시작
  const [isAuthenticated, setIsAuthenticated] =
    useState<boolean>(DEV_SKIP_AUTH);
  const [isLoading, setIsLoading] = useState<boolean>(!DEV_SKIP_AUTH);
  const [currentAdmin, setCurrentAdmin] = useState<AdminResponse | null>(
    DEV_SKIP_AUTH ? DEV_ADMIN : null
  );
  const [error, setError] = useState<string | null>(null);

  // 에러 초기화
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // 현재 관리자 정보 조회
  const refreshCurrentAdmin = useCallback(async () => {
    try {
      const admin = await authAPI.getMe();
      setCurrentAdmin(admin);
      setIsAuthenticated(true);
    } catch (err) {
      // 인증 실패 시 토큰 제거 및 상태 초기화
      tokenUtils.clearTokens();
      setCurrentAdmin(null);
      setIsAuthenticated(false);
      throw err;
    }
  }, []);

  // 로그인
  const login = useCallback(async (credentials: LoginRequest) => {
    setIsLoading(true);
    setError(null);

    try {
      // 로그인 API 호출
      const tokenResponse = await authAPI.login(credentials);

      // 토큰 저장
      tokenUtils.setTokens(
        tokenResponse.access_token,
        tokenResponse.refresh_token
      );

      // 현재 관리자 정보 조회
      const admin = await authAPI.getMe();
      setCurrentAdmin(admin);
      setIsAuthenticated(true);
    } catch (err) {
      const errorMessage = getErrorMessage(err);
      setError(errorMessage);
      tokenUtils.clearTokens();
      setCurrentAdmin(null);
      setIsAuthenticated(false);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 로그아웃
  const logout = useCallback(async () => {
    const refreshToken = tokenUtils.getRefreshToken();

    try {
      if (refreshToken) {
        const logoutRequest: LogoutRequest = { refresh_token: refreshToken };
        await authAPI.logout(logoutRequest);
      }
    } catch (err) {
      // 로그아웃 API 실패해도 로컬 상태는 초기화
      console.warn("로그아웃 API 호출 실패:", err);
    } finally {
      tokenUtils.clearTokens();
      setCurrentAdmin(null);
      setIsAuthenticated(false);
      setError(null);
    }
  }, []);

  // 초기 인증 상태 확인
  useEffect(() => {
    const initializeAuth = async () => {
      const hasTokens = tokenUtils.hasTokens();

      if (!hasTokens) {
        setIsLoading(false);
        return;
      }

      try {
        await refreshCurrentAdmin();
      } catch (err) {
        // 토큰이 유효하지 않으면 자동으로 정리됨
        console.warn("초기 인증 확인 실패:", err);
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();
  }, [refreshCurrentAdmin]);

  // axios interceptor에서 발생한 로그아웃 이벤트 처리
  useEffect(() => {
    const handleLogoutEvent = () => {
      setCurrentAdmin(null);
      setIsAuthenticated(false);
      setError("세션이 만료되었습니다. 다시 로그인해주세요.");
    };

    window.addEventListener("auth:logout", handleLogoutEvent);
    return () => {
      window.removeEventListener("auth:logout", handleLogoutEvent);
    };
  }, []);

  const value: AuthContextType = {
    isAuthenticated,
    isLoading,
    currentAdmin,
    error,
    login,
    logout,
    refreshCurrentAdmin,
    clearError,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// Custom Hook
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export default AuthContext;
