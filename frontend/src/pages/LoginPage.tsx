import React, { useState } from "react";
import { Lock, Mail, Eye, EyeOff, BookOpen, HelpCircle } from "lucide-react";

import { useAuth } from "../contexts/AuthContext";
import Alert from "../components/common/Alert";
import { getErrorMessage } from "../utils/errorHandler";

interface LoginPageProps {
  onShowInitAdmin?: () => void;
}

const LoginPage: React.FC<LoginPageProps> = ({ onShowInitAdmin }) => {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (!email || !password) {
      setError("이메일과 비밀번호를 입력해주세요.");
      setLoading(false);
      return;
    }

    try {
      await login({ email, plain_password: password });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-paper via-white to-primary-50 flex items-center justify-center p-4">
      {/* 배경 장식 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-neutral-200 rounded-full opacity-30 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-primary-200 rounded-full opacity-30 blur-3xl" />
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* 로고 및 헤더 */}
        <div
          className="text-center mb-8 anim-rise"
          style={{ animationDelay: "0ms" }}
        >
          <div className="inline-flex items-center justify-center mb-4">
            <img
              src="/logo.png"
              alt="목자의 지혜"
              className="h-20 w-auto object-contain"
              onError={(e) => {
                // 이미지가 없을 경우 기본 아이콘 표시
                const target = e.target as HTMLImageElement;
                target.style.display = "none";
                const parent = target.parentElement;
                if (parent) {
                  const fallback = parent.querySelector('.logo-fallback') as HTMLElement;
                  if (fallback) fallback.style.display = "flex";
                }
              }}
            />
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-accent to-accent-light shadow-lg hidden items-center justify-center logo-fallback">
              <BookOpen className="w-8 h-8 text-white" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-ink mb-2">목자의 지혜</h1>
          <p className="text-muted text-sm">
            매거진 관리 시스템에 오신 것을 환영합니다
          </p>
        </div>

        {/* 로그인 카드 */}
        <div
          className="bg-white rounded-2xl shadow-elegant border border-line p-8 anim-rise"
          style={{ animationDelay: "100ms" }}
        >
          {error && (
            <div className="mb-6">
              <Alert type="error">{error}</Alert>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="unified-label">이메일</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="이메일을 입력하세요"
                  className="unified-input pl-10"
                  required
                  disabled={loading}
                />
              </div>
            </div>

            <div>
              <label className="unified-label">비밀번호</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="비밀번호를 입력하세요"
                  className="unified-input pl-10 pr-10"
                  required
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted hover:text-ink transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 text-accent border-line rounded focus:ring-accent cursor-pointer"
                />
                <span className="text-muted group-hover:text-ink transition-colors">
                  로그인 상태 유지
                </span>
              </label>
              <button
                type="button"
                className="text-accent hover:text-accent-hover font-medium transition-colors"
              >
                비밀번호 찾기
              </button>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="unified-btn w-full py-3 text-base"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  로그인 중...
                </span>
              ) : (
                "로그인"
              )}
            </button>
          </form>

          {/* 구분선 */}
          {onShowInitAdmin && (
            <>
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-line"></div>
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="px-4 bg-white text-muted">또는</span>
                </div>
              </div>

              <button
                type="button"
                onClick={onShowInitAdmin}
                className="unified-btn-outline w-full"
              >
                최초 관리자 계정 생성
              </button>
            </>
          )}
        </div>

        {/* 도움말 */}
        <div className="mt-6 anim-rise" style={{ animationDelay: "200ms" }}>
          <div className="bg-white/60 backdrop-blur-sm border border-line rounded-xl p-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-info-50 flex items-center justify-center flex-shrink-0">
                <HelpCircle className="w-4 h-4 text-accent" />
              </div>
              <div className="text-sm">
                <p className="font-medium text-ink mb-1">
                  도움이 필요하신가요?
                </p>
                <p className="text-muted text-xs leading-relaxed">
                  로그인 문제는 시스템 관리자에게 문의하세요.
                  <br />
                  관리자 등록은 최상위 관리자만 가능합니다.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* 푸터 */}
        <div className="text-center mt-6 text-xs text-muted">
          © 2025 목자의 지혜. All rights reserved.
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
