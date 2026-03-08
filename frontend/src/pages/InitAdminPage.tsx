import React, { useState, useEffect } from "react";
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
import { AdminRole } from "../types/admin.ts";
import { useAuth } from "../contexts/AuthContext";
import Input from "../components/common/Input";
import Button from "../components/common/Button";
import Alert from "../components/common/Alert";
import { getErrorMessage } from "../utils/errorHandler";

interface InitAdminPageProps {
  onBackToLogin?: () => void;
}

const InitAdminPage: React.FC<InitAdminPageProps> = ({ onBackToLogin }) => {
  const { login } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  const [adminExists, setAdminExists] = useState(false);

  // 페이지 진입 시 관리자 존재 여부 확인
  useEffect(() => {
    const checkAdmin = async () => {
      try {
        const result = await authAPI.checkAdminExists();
        if (result.exists) {
          setAdminExists(true);
        }
      } catch (err) {
        // API 호출 실패 시에도 계속 진행 (네트워크 오류 등)
        console.error("관리자 존재 여부 확인 실패:", err);
      } finally {
        setChecking(false);
      }
    };

    checkAdmin();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // 유효성 검사
    if (!name || !email || !password || !confirmPassword) {
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
      // 최초 관리자 생성
      await authAPI.initFirstAdmin({
        email: email,
        plain_password: password,
        admin_name: name,
        admin_role: AdminRole.SUPER_ADMIN,
        is_active: true,
      });

      // 생성 성공 후 자동 로그인
      await login({ email, plain_password: password });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  // 확인 중일 때 로딩 표시
  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 antialiased">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent mx-auto mb-4"></div>
          <p className="text-muted">확인 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 antialiased">
      <div className="w-full max-w-lg">
        {/* 로고 및 헤더 */}
        <div className="text-center mb-8">
          <button
            onClick={onBackToLogin}
            className="cursor-pointer hover:opacity-80 transition-opacity"
            aria-label="로그인 페이지로 이동"
          >
            <img
              src="/logo.png"
              alt="목자의 지혜"
              className="h-20 w-auto object-contain mx-auto mb-2"
              onError={(e) => {
                // 이미지가 없을 경우 기본 텍스트 표시
                const target = e.target as HTMLImageElement;
                target.style.display = "none";
                const parent = target.parentElement;
                if (parent) {
                  const fallback = parent.querySelector('.logo-fallback') as HTMLElement;
                  if (fallback) fallback.style.display = "block";
                }
              }}
            />
            <h1 className="text-4xl font-extrabold text-accent mb-2 hidden logo-fallback">
              목자의 지혜
            </h1>
          </button>
        </div>

        {/* 초기화 카드 */}
        <div className="bg-white rounded-lg shadow-sm border border-line p-8">
          {adminExists ? (
            // 관리자가 이미 존재하는 경우: 메시지만 표시
            <>
              <div className="mb-6 p-4 bg-chip border border-line rounded-lg">
                <div className="flex items-start space-x-3">
                  <AlertCircle className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-muted">
                    <p className="font-semibold text-ink mb-1">
                      최초 관리자 생성 불가
                    </p>
                    <p>
                      이미 관리자가 존재합니다. 최초 관리자 생성은 시스템에 관리자가 없을 때만 가능합니다.
                    </p>
                  </div>
                </div>
              </div>
              <div className="mt-6">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={onBackToLogin}
                  className="w-full"
                >
                  로그인 페이지로 돌아가기
                </Button>
              </div>
            </>
          ) : (
            // 관리자가 없는 경우: 폼 표시
            <>
              <div className="mb-6 p-4 bg-chip border border-line rounded-lg">
                <div className="flex items-start space-x-3">
                  <AlertCircle className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-muted">
                    <p className="font-semibold text-ink mb-1">
                      최초 관리자 계정 생성
                    </p>
                    <p>
                      시스템에 관리자가 없어 최초 관리자 계정을 생성합니다.
                      <br />
                      최초 관리자는 자동으로{" "}
                      <strong>최고 관리자(SUPER_ADMIN)</strong> 권한이 부여됩니다.
                    </p>
                  </div>
                </div>
              </div>

              {error && (
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
                  최초 관리자 생성 및 로그인
                </Button>
              </form>
            </>
          )}
        </div>

        {/* 하단 정보 */}
        <div className="mt-6 text-center space-y-3">
          <div className="flex items-center justify-center space-x-2 text-sm text-muted">
            <Globe className="w-4 h-4" />
            <span>한국어 (KOR)</span>
          </div>
          <div className="text-xs text-muted">
            © 2025 목자의 지혜. All rights reserved.
          </div>
        </div>
      </div>
    </div>
  );
};

export default InitAdminPage;
