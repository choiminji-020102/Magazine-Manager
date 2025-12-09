import React, { useState } from "react";
import { Globe, Lock, Mail, Eye, EyeOff, AlertCircle } from "lucide-react";

import { useAuth } from "../contexts/AuthContext";
import Input from "../components/common/Input";
import Button from "../components/common/Button";
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
      // 로그인 성공은 AuthContext에서 처리됨
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 antialiased">
      <div className="w-full max-w-lg">
        {/* 로고 및 헤더 */}
        <div className="text-center mb-8">
          <button
            onClick={() => {
              setEmail("");
              setPassword("");
              setError("");
            }}
            className="cursor-pointer hover:opacity-80 transition-opacity"
            aria-label="홈으로 이동"
          >
            <h1 className="text-4xl font-extrabold text-blue-600 mb-2">
              목자의 지혜
            </h1>
          </button>
          <p className="text-gray-600 text-sm">
            목자의 지혜 관리자를 위한 시스템입니다.
            <br />
            관리자 등록은 최상위 관리자에게 요청해주세요.
          </p>
        </div>

        {/* 로그인 카드 */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-8">
          {error && (
            <div className="mb-6">
              <Alert type="error">{error}</Alert>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <Input
              id="email"
              type="email"
              label="이메일"
              icon={Mail}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="이메일을 입력하세요"
              required
              disabled={loading}
            />

            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                label="비밀번호"
                icon={Lock}
                iconPosition="left"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="비밀번호를 입력하세요"
                required
                disabled={loading}
                className="pr-12"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-[50px] text-gray-400 hover:text-gray-600 transition-colors z-10"
                tabIndex={-1}
                aria-label={showPassword ? "비밀번호 숨기기" : "비밀번호 보기"}
              >
                {showPassword ? (
                  <EyeOff className="w-5 h-5" />
                ) : (
                  <Eye className="w-5 h-5" />
                )}
              </button>
            </div>

            {/* 로그인 유지 & 비밀번호 찾기 */}
            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                />
                <span className="text-gray-700">로그인 상태 유지</span>
              </label>
              <button
                type="button"
                onClick={() => alert("비밀번호 찾기 기능")}
                className="text-blue-600 hover:text-blue-700 font-medium transition-colors"
              >
                비밀번호 찾기
              </button>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              loading={loading}
              className="w-full"
            >
              로그인
            </Button>
          </form>

          {/* 구분선 */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200"></div>
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="px-3 bg-white text-gray-500">또는</span>
            </div>
          </div>

          {/* 최초 관리자 생성 링크 */}
          {onShowInitAdmin && (
            <div className="text-center">
              <p className="text-sm text-gray-600 mb-2">
                최초 관리자 계정이 필요하신가요?
              </p>
              <button
                type="button"
                onClick={onShowInitAdmin}
                className="text-blue-600 hover:text-blue-700 font-semibold transition-colors text-sm underline"
              >
                최초 관리자 계정 생성
              </button>
            </div>
          )}
        </div>

        {/* 하단 정보 */}
        <div className="mt-6 text-center space-y-3">
          <div className="flex items-center justify-center space-x-2 text-sm text-gray-500">
            <Globe className="w-4 h-4" />
            <span>한국어 (KOR)</span>
          </div>
          <div className="text-xs text-gray-400">
            © 2025 목자의 지혜. All rights reserved.
          </div>
        </div>

        {/* 도움말 카드 */}
        <div className="mt-6 bg-blue-50 border border-blue-100 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-semibold text-blue-900 mb-1">
                로그인에 문제가 있으신가요?
              </p>
              <p className="text-blue-700">
                고객센터 <span className="font-medium">1234-5678</span> 또는{" "}
                <button
                  type="button"
                  onClick={() => alert("헬프데스크로 이동")}
                  className="underline hover:text-blue-900"
                >
                  헬프데스크
                </button>
                를 이용해주세요.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
