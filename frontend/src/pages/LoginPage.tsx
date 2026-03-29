import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { authAPI } from "@/api/authApi";

interface LoginForm {
  email: string;
  password: string;
}

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, isAuthenticated, isLoading: authLoading } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>();

  // 이미 인증된 경우 대시보드로
  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      navigate("/", { replace: true });
    }
  }, [isAuthenticated, authLoading, navigate]);

  // 관리자 미존재 시 초기 설정 페이지로
  useEffect(() => {
    if (authLoading) return;
    authAPI.checkAdminExists().then(({ exists }) => {
      if (!exists) navigate("/init-admin", { replace: true });
    }).catch(() => {});
  }, [authLoading, navigate]);

  const onSubmit = async (data: LoginForm) => {
    setIsLoading(true);
    setError(null);
    try {
      await login({ email: data.email, plain_password: data.password });
      navigate("/", { replace: true });
    } catch {
      setError("이메일 또는 비밀번호가 올바르지 않습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-6 w-6 border-2 border-gray-200 border-t-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm">
        {/* 헤더 */}
        <div className="text-center mb-8">
          <h1 className="text-xl font-bold text-gray-900">목자의 지혜</h1>
          <p className="text-sm text-gray-500 mt-1">관리자 시스템</p>
        </div>

        {/* 로그인 카드 */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <Label htmlFor="email" className="text-sm text-gray-700 mb-1.5 block">
                이메일
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="admin@example.com"
                autoComplete="email"
                {...register("email", {
                  required: "이메일을 입력해주세요.",
                  pattern: {
                    value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                    message: "올바른 이메일 형식이 아닙니다.",
                  },
                })}
              />
              {errors.email && (
                <p className="text-xs text-red-500 mt-1">{errors.email.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="password" className="text-sm text-gray-700 mb-1.5 block">
                비밀번호
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="pr-9"
                  {...register("password", {
                    required: "비밀번호를 입력해주세요.",
                  })}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="text-xs text-red-500 mt-1">{errors.password.message}</p>
              )}
            </div>

            {error && (
              <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <Button
              type="submit"
              className="w-full mt-2"
              disabled={isLoading}
            >
              {isLoading ? "로그인 중..." : "로그인"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
