import React, { useState, useEffect } from "react";
import {
  ArrowLeft,
  Save,
  Eye,
  EyeOff,
  User,
  Mail,
  Lock,
  Shield,
  CheckCircle2,
  AlertCircle,
  FileText,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import { adminsApi } from "../api/adminsApi";
import { AdminResponse, AdminRole } from "../types/admin";
import Button from "../components/common/Button";
import Card, { CardHeader, CardContent } from "../components/common/Card";
import Alert from "../components/common/Alert";
import Input from "../components/common/Input";
import Breadcrumb from "../components/common/Breadcrumb";
import LoadingSpinner from "../components/common/LoadingSpinner";
import { getErrorMessage } from "../utils/errorHandler";
import { ADMIN_ROLES } from "../utils/constants";

interface FormData {
  admin_name: string;
  email: string;
  password: string;
  admin_role: AdminRole;
  is_active: boolean;
}

interface FieldErrors {
  admin_name?: string;
  email?: string;
  password?: string;
  admin_role?: string;
}

interface AdminDetailPageProps {
  adminId?: number | string;
  onBack?: () => void;
  onSave?: () => void;
  onRefresh?: () => void;
  isMyPage?: boolean; // 마이페이지에서 사용하는지 여부
}

const AdminDetailPage: React.FC<AdminDetailPageProps> = ({
  adminId,
  onBack,
  onSave,
  onRefresh,
  isMyPage = false,
}) => {
  const navigate = useNavigate();
  const [_admin, setAdmin] = useState<AdminResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isEditing, setIsEditing] = useState(!adminId && !isMyPage); // 새로 만들 때는 편집 모드, 마이페이지는 읽기 모드로 시작
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const isNewAdmin = adminId === "new" || !adminId;
  const [formData, setFormData] = useState<FormData>({
    admin_name: "",
    email: "",
    password: "",
    admin_role: AdminRole.MANAGER,
    is_active: true,
  });

  useEffect(() => {
    if (adminId && adminId !== "new") {
      loadAdmin();
    } else if (adminId === "new") {
      setIsEditing(true);
      setLoading(false);
    } else {
      setLoading(false);
    }
  }, [adminId]);

  const loadAdmin = async () => {
    try {
      setLoading(true);
      setError("");
      const numericId =
        typeof adminId === "string" ? parseInt(adminId, 10) : adminId;
      if (!numericId) return;

      const response = await adminsApi.getAdmin(numericId);
      const data = response.data.data;
      if (!data) {
        throw new Error("관리자 정보를 불러올 수 없습니다.");
      }
      setAdmin(data);
      setFormData({
        admin_name: data.admin_name,
        email: data.email,
        password: "",
        admin_role: data.admin_role as AdminRole,
        is_active: data.is_active,
      });
    } catch (err) {
      setError(
        getErrorMessage(err) || "관리자 정보를 불러오는데 실패했습니다."
      );
    } finally {
      setLoading(false);
    }
  };

  // 이메일 유효성 검사
  const validateEmail = (email: string): boolean => {
    if (!email) return false;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // 비밀번호 유효성 검사
  const validatePassword = (password: string): boolean => {
    return password.length >= 8;
  };

  // 실시간 유효성 검사
  useEffect(() => {
    if (!isNewAdmin) return; // 새 관리자 등록일 때만

    const errors: FieldErrors = {};

    if (touched.admin_name && !formData.admin_name.trim()) {
      errors.admin_name = "이름을 입력해주세요.";
    }

    if (touched.email) {
      if (!formData.email.trim()) {
        errors.email = "이메일을 입력해주세요.";
      } else if (!validateEmail(formData.email)) {
        errors.email = "올바른 이메일 형식이 아닙니다.";
      }
    }

    if (touched.password) {
      if (!formData.password.trim()) {
        errors.password = "비밀번호를 입력해주세요.";
      } else if (!validatePassword(formData.password)) {
        errors.password = "비밀번호는 8자 이상이어야 합니다.";
      }
    }

    setFieldErrors(errors);
  }, [formData, touched, isNewAdmin]);

  const handleBlur = (field: string) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    // 모든 필드 터치 처리 (새 관리자 등록일 때만)
    if (isNewAdmin) {
      const allTouched = {
        admin_name: true,
        email: true,
        password: true,
      };
      setTouched(allTouched);
    }

    // 유효성 검사
    if (!formData.admin_name || !formData.email) {
      setError("이름과 이메일은 필수입니다.");
      return;
    }

    if (!validateEmail(formData.email)) {
      setError("올바른 이메일 형식이 아닙니다.");
      return;
    }

    if (isNewAdmin && !formData.password) {
      setError("비밀번호는 필수입니다.");
      return;
    }

    if (formData.password && !validatePassword(formData.password)) {
      setError("비밀번호는 8자 이상이어야 합니다.");
      return;
    }

    setIsSubmitting(true);
    try {
      if (adminId && adminId !== "new") {
        // 수정
        const numericId =
          typeof adminId === "string" ? parseInt(adminId, 10) : adminId;
        if (!numericId) return;

        await adminsApi.updateAdmin(numericId, {
          admin_name: formData.admin_name,
          email: formData.email,
          plain_password: formData.password ? formData.password : null,
          admin_role: formData.admin_role,
          is_active: formData.is_active,
        });
        setSuccess("관리자 정보가 수정되었습니다.");
        setIsEditing(false);
        loadAdmin();
      } else {
        // 생성
        await adminsApi.createAdmin({
          admin_name: formData.admin_name,
          email: formData.email,
          plain_password: formData.password,
          admin_role: formData.admin_role,
          is_active: formData.is_active,
        });
        setSuccess("관리자가 성공적으로 등록되었습니다.");
        setTimeout(() => {
          if (onSave) {
            onSave();
          } else {
            navigate("/admin/list");
          }
        }, 1500);
      }
    } catch (err) {
      setError(
        getErrorMessage(err) ||
          (adminId && adminId !== "new"
            ? "관리자 정보 수정에 실패했습니다."
            : "관리자 등록에 실패했습니다.")
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      navigate("/system/admin");
    }
  };

  if (loading && adminId && adminId !== "new") {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  // 새 관리자 등록 페이지 (고객 등록 페이지 스타일)
  if (isNewAdmin && !isMyPage) {
    return (
      <div className="min-h-screen">
        <div className="max-w-[1600px] mx-auto px-6 py-6">
          <Breadcrumb
            items={[
              { label: "관리자 관리", path: "/admin/list" },
              { label: "관리자 등록" },
            ]}
          />

          {/* 헤더 */}
          <div className="mb-8 anim-rise">
            <div className="flex items-start justify-between">
              <div></div>
              <div className="flex items-center gap-2"></div>
            </div>
          </div>

          {/* 알림 메시지 */}
          {success && (
            <Alert type="success" className="mb-6">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5" />
                {success}
              </div>
            </Alert>
          )}

          {error && (
            <Alert type="error" className="mb-6">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5" />
                {error}
              </div>
            </Alert>
          )}

          {/* 폼 */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* 기본 정보 섹션 */}
            <Card className="overflow-hidden">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-accent/10 rounded-lg">
                    <User className="w-5 h-5 text-accent" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-ink">기본 정보</h2>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* 이름 */}
                <div className="space-y-2">
                  <Input
                    label="이름"
                    type="text"
                    value={formData.admin_name}
                    onChange={(e) => {
                      setFormData({ ...formData, admin_name: e.target.value });
                      if (touched.admin_name) {
                        setTouched((prev) => ({ ...prev, admin_name: true }));
                      }
                    }}
                    onBlur={() => handleBlur("admin_name")}
                    required
                    placeholder="이름을 입력하세요"
                    icon={User}
                    error={fieldErrors.admin_name}
                    className="transition-all"
                  />
                </div>

                {/* 이메일 */}
                <div className="space-y-2">
                  <Input
                    label="이메일"
                    type="email"
                    value={formData.email}
                    onChange={(e) => {
                      setFormData({ ...formData, email: e.target.value });
                      if (touched.email) {
                        setTouched((prev) => ({ ...prev, email: true }));
                      }
                    }}
                    onBlur={() => handleBlur("email")}
                    required
                    placeholder="email@example.com"
                    icon={Mail}
                    error={fieldErrors.email}
                    className="transition-all"
                  />
                  {!fieldErrors.email &&
                    formData.email &&
                    validateEmail(formData.email) && (
                      <p className="text-xs text-muted flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        올바른 이메일 형식입니다.
                      </p>
                    )}
                </div>

                {/* 비밀번호 */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-ink uppercase tracking-wider text-xs">
                    비밀번호 <span className="text-red-500 ml-1">*</span>
                  </label>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      value={formData.password}
                      onChange={(e) => {
                        setFormData({ ...formData, password: e.target.value });
                        if (touched.password) {
                          setTouched((prev) => ({ ...prev, password: true }));
                        }
                      }}
                      onBlur={() => handleBlur("password")}
                      required
                      placeholder="8자 이상"
                      icon={Lock}
                      iconPosition="left"
                      error={fieldErrors.password}
                      className="transition-all pr-12"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 z-10"
                      aria-label={showPassword ? "비밀번호 숨기기" : "비밀번호 보기"}
                    >
                      {showPassword ? (
                        <EyeOff className="w-5 h-5" />
                      ) : (
                        <Eye className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                  {!fieldErrors.password &&
                    formData.password &&
                    validatePassword(formData.password) && (
                      <p className="text-xs text-muted flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        올바른 비밀번호 형식입니다.
                      </p>
                    )}
                </div>
              </CardContent>
            </Card>

            {/* 추가 정보 섹션 */}
            <Card className="overflow-hidden">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-accent/10 rounded-lg">
                    <Shield className="w-5 h-5 text-accent" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-ink">권한 설정</h2>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* 역할 */}
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-ink uppercase tracking-wider text-xs">
                    역할 <span className="text-red-500 ml-1">*</span>
                  </label>
                  <select
                    value={formData.admin_role}
                    onChange={(e) =>
                      setFormData({ ...formData, admin_role: e.target.value as AdminRole })
                    }
                    className="w-full px-4 py-2.5 text-base border border-line rounded-lg focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all"
                    required
                  >
                    {ADMIN_ROLES.map((role) => (
                      <option key={role.value} value={role.value}>
                        {role.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 계정 활성화 */}
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-ink uppercase tracking-wider text-xs">
                    계정 활성화
                  </label>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() =>
                        setFormData({ ...formData, is_active: !formData.is_active })
                      }
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 ${
                        formData.is_active ? "bg-accent" : "bg-gray-300"
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          formData.is_active ? "translate-x-6" : "translate-x-1"
                        }`}
                      />
                    </button>
                    <span className="text-base text-ink">
                      {formData.is_active ? "활성" : "비활성"}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 버튼 영역 */}
            <div className="flex items-center justify-between pt-6 border-t border-line">
              <Button
                type="button"
                onClick={handleBack}
                variant="secondary"
                className="flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                취소
              </Button>
              <Button
                type="submit"
                variant="primary"
                icon={Save}
                loading={isSubmitting}
                disabled={isSubmitting}
                className="flex items-center gap-2 min-w-[120px]"
              >
                {isSubmitting ? "등록 중..." : "등록하기"}
              </Button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // 기존 수정/상세 페이지 스타일
  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          {onBack && !isMyPage && (
            <Button
              onClick={onBack}
              variant="ghost"
              className="p-2"
              aria-label="뒤로 가기"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </Button>
          )}
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              {isMyPage
                ? "내 정보"
                : adminId && adminId !== "new"
                ? "관리자 정보 수정"
                : "새 관리자 추가"}
            </h2>
            {adminId === "new" && !isMyPage && (
              <p className="text-sm text-gray-600 mt-1">
                새로운 관리자 계정을 생성합니다.
              </p>
            )}
          </div>
        </div>
        {adminId && adminId !== "new" && !isEditing && (
          <Button onClick={() => setIsEditing(true)} variant="primary">
            수정
          </Button>
        )}
      </div>

      {/* 성공 메시지 */}
      {success && <Alert type="success">{success}</Alert>}

      {/* 에러 메시지 */}
      {error && <Alert type="error">{error}</Alert>}

      {/* 폼 */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* 이름 */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              이름 <span className="text-red-500">*</span>
            </label>
            <Input
              id="admin_name"
              type="text"
              value={formData.admin_name}
              onChange={(e) => setFormData({ ...formData, admin_name: e.target.value })}
              disabled={!isEditing}
              required
              placeholder="이름을 입력하세요"
              className="text-base"
            />
          </div>

          {/* 이메일 */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              이메일 <span className="text-red-500">*</span>
            </label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) =>
                setFormData({ ...formData, email: e.target.value })
              }
              disabled={!isEditing || isMyPage}
              required
              placeholder="이메일을 입력하세요"
              className="text-base"
            />
            {isMyPage && (
              <p className="text-xs text-gray-500 mt-1">
                이메일은 변경할 수 없습니다.
              </p>
            )}
          </div>

          {/* 비밀번호 */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              비밀번호 {(!adminId || adminId === "new") && <span className="text-red-500">*</span>}
              {adminId && adminId !== "new" && (
                <span className="text-xs text-gray-500 font-normal ml-2">
                  (변경하지 않으려면 비워두세요)
                </span>
              )}
            </label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                value={formData.password}
                onChange={(e) =>
                  setFormData({ ...formData, password: e.target.value })
                }
                disabled={!isEditing}
                placeholder={
                  adminId && adminId !== "new"
                    ? "비밀번호를 변경하려면 입력하세요"
                    : "8자 이상"
                }
                className="pr-12"
                required={!adminId || adminId === "new"}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                disabled={!isEditing}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 disabled:opacity-50 z-10"
                aria-label={showPassword ? "비밀번호 숨기기" : "비밀번호 보기"}
              >
                {showPassword ? (
                  <EyeOff className="w-5 h-5" />
                ) : (
                  <Eye className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>

          {/* 역할 - 마이페이지에서는 숨김 */}
          {!isMyPage && (
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">
                역할 <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.admin_role}
                onChange={(e) =>
                  setFormData({ ...formData, admin_role: e.target.value as AdminRole })
                }
                disabled={!isEditing}
                className="w-full px-4 py-2.5 text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent disabled:bg-gray-50 disabled:text-gray-500 transition-all"
                required
              >
                {ADMIN_ROLES.map((role) => (
                  <option key={role.value} value={role.value}>
                    {role.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* 활성 상태 - 마이페이지에서는 숨김 */}
          {!isMyPage && (
            <div className="flex items-center gap-3 pt-2">
              <label className="flex items-center gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={(e) =>
                    setFormData({ ...formData, is_active: e.target.checked })
                  }
                  disabled={!isEditing}
                  className="w-5 h-5 text-accent border-gray-300 rounded focus:ring-2 focus:ring-accent focus:ring-offset-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                />
                <span className="text-base font-semibold text-gray-900 group-hover:text-gray-700">
                  계정 활성화
                </span>
              </label>
            </div>
          )}

          {/* 버튼 */}
          {isEditing && (
            <div className="flex items-center justify-end space-x-3 pt-4 border-t">
              {adminId && adminId !== "new" && (
                <Button
                  type="button"
                  onClick={() => {
                    setIsEditing(false);
                    loadAdmin();
                  }}
                  variant="secondary"
                >
                  취소
                </Button>
              )}
              {(!adminId || adminId === "new") && onBack && (
                <Button type="button" onClick={onBack} variant="secondary">
                  취소
                </Button>
              )}
              <Button
                type="submit"
                variant="primary"
                icon={Save}
                iconPosition="left"
              >
                {adminId && adminId !== "new" ? "저장" : "생성"}
              </Button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};

export default AdminDetailPage;
