import React, { useState } from "react";
import {
  Globe,
  Lock,
  Mail,
  Eye,
  EyeOff,
  AlertCircle,
  User,
} from "lucide-react";

import { authAPI } from "../api/authApi";
import { AdminRole } from "../api/adminApi";
import Input from "../components/common/Input";
import Button from "../components/common/Button";
import Alert from "../components/common/Alert";
import { getErrorMessage } from "../utils/errorHandler";

interface SignupPageProps {
  onSignupSuccess?: () => void;
  onBackToLogin?: () => void;
}

const SignupPage: React.FC<SignupPageProps> = ({
  onSignupSuccess,
  onBackToLogin,
}) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess(false);

    // 유효성 검사
    if (!email || !password || !confirmPassword || !name) {
      setError("모든 필드를 입력해주세요.");
      return;
    }

    if (password !== confirmPassword) {
      setError("비밀번호가 일치하지 않습니다.");
      return;
    }

    if (password.length < 8) {
      setError("비밀번호는 8자 이상이어야 합니다.");
      return;
    }

    setLoading(true);

    try {
      // 최초 관리자 생성 API 사용 (일반 회원가입은 백엔드에 없으므로)
      await authAPI.initFirstAdmin({
        email,
        plain_password: password,
        name,
        role: AdminRole.MANAGER,
        is_active: true,
      });

      setSuccess(true);
      setError("");

      // 성공 후 2초 뒤 로그인 페이지로 이동
      setTimeout(() => {
        if (onSignupSuccess) {
          onSignupSuccess();
        }
      }, 2000);
    } catch (err) {
      setError(
        getErrorMessage(err) || "회원가입에 실패했습니다. 다시 시도해주세요."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 antialiased">
      <div className="w-full max-w-md">
        {/* 로고 및 헤더 */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-extrabold text-blue-600 mb-2">
            목자의 지혜
          </h1>
          <p className="text-gray-600 text-sm">관리자 계정을 생성하세요</p>
        </div>

        {/* 회원가입 카드 */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-8">
          {/* 성공 메시지 */}
          {success && (
            <div className="mb-6">
              <Alert type="success">
                회원가입이 완료되었습니다! 로그인 페이지로 이동합니다...
              </Alert>
            </div>
          )}

          {/* 에러 메시지 */}
          {error && !success && (
            <div className="mb-6">
              <Alert type="error">{error}</Alert>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <Input
              id="name"
              type="text"
              label="이름"
              icon={User}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="이름을 입력하세요"
              required
              disabled={loading}
            />

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
                placeholder="비밀번호를 입력하세요 (8자 이상)"
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

            <div className="relative">
              <Input
                id="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                label="비밀번호 확인"
                icon={Lock}
                iconPosition="left"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="비밀번호를 다시 입력하세요"
                required
                disabled={loading}
                className="pr-12"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-[50px] text-gray-400 hover:text-gray-600 transition-colors z-10"
                tabIndex={-1}
                aria-label={
                  showConfirmPassword ? "비밀번호 숨기기" : "비밀번호 보기"
                }
              >
                {showConfirmPassword ? (
                  <EyeOff className="w-5 h-5" />
                ) : (
                  <Eye className="w-5 h-5" />
                )}
              </button>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              loading={loading}
              className="w-full"
            >
              회원가입
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

          {/* 로그인 링크 */}
          <div className="text-center">
            <p className="text-sm text-gray-600">
              이미 계정이 있으신가요?{" "}
              <button
                type="button"
                onClick={onBackToLogin}
                className="text-blue-600 hover:text-blue-700 font-semibold transition-colors"
              >
                로그인
              </button>
            </p>
          </div>
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
                회원가입에 문제가 있으신가요?
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

export default SignupPage;
