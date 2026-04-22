import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff } from "lucide-react";
import { authAPI } from "@/api/authApi";
import { getErrorMessage } from "@/utils/errorHandler";

interface InitAdminForm {
  admin_name: string;
  email: string;
  admin_password: string;
  admin_password_confirm: string;
}

export default function InitAdminPage() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<InitAdminForm>();

  const password = watch("admin_password");

  // 관리자 이미 존재하면 로그인 페이지로
  useEffect(() => {
    authAPI.checkAdminExists().then(({ exists }) => {
      if (exists) navigate("/login", { replace: true });
    }).catch(() => {});
  }, [navigate]);

  const onSubmit = async (data: InitAdminForm) => {
    setIsLoading(true);
    setError(null);
    try {
      await authAPI.initFirstAdmin({
        admin_name: data.admin_name,
        email: data.email,
        plain_password: data.admin_password,
        admin_role: "SUPER_ADMIN" as any,
        is_active: true,
      });
      navigate("/login", { replace: true });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-xl font-bold text-gray-900">목자의 지혜</h1>
          <p className="text-sm text-gray-500 mt-1">최초 관리자 계정 설정</p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
          <div className="mb-4 p-3 bg-blue-50 rounded-md border border-blue-200">
            <p className="text-xs text-blue-700">
              아직 등록된 관리자가 없습니다. 최초 슈퍼관리자 계정을 생성해주세요.
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <Label htmlFor="admin_name" className="text-sm text-gray-700 mb-1.5 block">
                이름
              </Label>
              <Input
                id="admin_name"
                placeholder="관리자 이름"
                {...register("admin_name", { required: "이름을 입력해주세요." })}
              />
              {errors.admin_name && (
                <p className="text-xs text-red-500 mt-1">{errors.admin_name.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="email" className="text-sm text-gray-700 mb-1.5 block">
                이메일
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="admin@example.com"
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
              <Label htmlFor="admin_password" className="text-sm text-gray-700 mb-1.5 block">
                비밀번호
              </Label>
              <div className="relative">
                <Input
                  id="admin_password"
                  type={showPassword ? "text" : "password"}
                  placeholder="8자 이상, 영문+숫자+특수문자 포함"
                  className="pr-9"
                  {...register("admin_password", {
                    required: "비밀번호를 입력해주세요.",
                    minLength: { value: 8, message: "비밀번호는 8자 이상이어야 합니다." },
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
              {errors.admin_password && (
                <p className="text-xs text-red-500 mt-1">{errors.admin_password.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="admin_password_confirm" className="text-sm text-gray-700 mb-1.5 block">
                비밀번호 확인
              </Label>
              <div className="relative">
                <Input
                  id="admin_password_confirm"
                  type={showPasswordConfirm ? "text" : "password"}
                  placeholder="비밀번호 재입력"
                  className="pr-9"
                  {...register("admin_password_confirm", {
                    required: "비밀번호 확인을 입력해주세요.",
                    validate: (v) => v === password || "비밀번호가 일치하지 않습니다.",
                  })}
                />
                <button
                  type="button"
                  onClick={() => setShowPasswordConfirm(!showPasswordConfirm)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPasswordConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.admin_password_confirm && (
                <p className="text-xs text-red-500 mt-1">{errors.admin_password_confirm.message}</p>
              )}
            </div>

            {error && (
              <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <Button type="submit" className="w-full mt-2" disabled={isLoading}>
              {isLoading ? "생성 중..." : "관리자 계정 생성"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
