import React, { useState, useEffect } from "react";
import { ArrowLeft, Save, Eye, EyeOff } from "lucide-react";

import { adminAPI, AdminResponse, AdminRole } from "../api/adminApi";
import Button from "../components/common/Button";
import Alert from "../components/common/Alert";
import Input from "../components/common/Input";
import LoadingSpinner from "../components/common/LoadingSpinner";
import { getErrorMessage } from "../utils/errorHandler";
import { ADMIN_ROLES } from "../utils/constants";

interface FormData {
  name: string;
  email: string;
  password: string;
  role: AdminRole;
  is_active: boolean;
}

interface AdminDetailPageProps {
  adminId?: number | string;
  onBack?: () => void;
  onSave?: () => void;
  onRefresh?: () => void;
}

const AdminDetailPage: React.FC<AdminDetailPageProps> = ({
  adminId,
  onBack,
  onSave,
  onRefresh,
}) => {
  const [admin, setAdmin] = useState<AdminResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isEditing, setIsEditing] = useState(!adminId); // 새로 만들 때는 편집 모드
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    name: "",
    email: "",
    password: "",
    role: AdminRole.MANAGER,
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

      const data = await adminAPI.getById(numericId);
      setAdmin(data);
      setFormData({
        name: data.name,
        email: data.email,
        password: "",
        role: data.role,
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    // 유효성 검사
    if (!formData.name || !formData.email) {
      setError("이름과 이메일은 필수입니다.");
      return;
    }

    if (!adminId && !formData.password) {
      setError("비밀번호는 필수입니다.");
      return;
    }

    if (formData.password && formData.password.length < 8) {
      setError("비밀번호는 8자 이상이어야 합니다.");
      return;
    }

    try {
      if (adminId && adminId !== "new") {
        // 수정
        const numericId =
          typeof adminId === "string" ? parseInt(adminId, 10) : adminId;
        if (!numericId) return;

        await adminAPI.update(numericId, {
          name: formData.name,
          email: formData.email,
          plain_password: formData.password || undefined,
          role: formData.role,
          is_active: formData.is_active,
        });
        setSuccess("관리자 정보가 수정되었습니다.");
        setIsEditing(false);
        loadAdmin();
      } else {
        // 생성
        await adminAPI.create({
          name: formData.name,
          email: formData.email,
          plain_password: formData.password,
          role: formData.role,
          is_active: formData.is_active,
        });
        setSuccess("관리자가 생성되었습니다.");
        if (onRefresh) {
          onRefresh();
        }
        if (onSave) {
          onSave();
        }
      }
    } catch (err) {
      setError(
        getErrorMessage(err) ||
          (adminId && adminId !== "new"
            ? "관리자 정보 수정에 실패했습니다."
            : "관리자 생성에 실패했습니다.")
      );
    }
  };

  if (loading && adminId && adminId !== "new") {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          {onBack && (
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
              {adminId && adminId !== "new"
                ? "관리자 정보 수정"
                : "새 관리자 추가"}
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              {adminId && adminId !== "new"
                ? "관리자 정보를 수정할 수 있습니다."
                : "새로운 관리자 계정을 생성합니다."}
            </p>
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
          <Input
            id="name"
            type="text"
            label="이름"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            disabled={!isEditing}
            required
            placeholder="이름을 입력하세요"
          />

          {/* 이메일 */}
          <Input
            id="email"
            type="email"
            label="이메일"
            value={formData.email}
            onChange={(e) =>
              setFormData({ ...formData, email: e.target.value })
            }
            disabled={!isEditing}
            required
            placeholder="이메일을 입력하세요"
          />

          {/* 비밀번호 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              비밀번호 {(!adminId || adminId === "new") && "*"}
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

          {/* 역할 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              역할 *
            </label>
            <select
              value={formData.role}
              onChange={(e) =>
                setFormData({ ...formData, role: e.target.value as AdminRole })
              }
              disabled={!isEditing}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-500"
              required
            >
              {ADMIN_ROLES.map((role) => (
                <option key={role.value} value={role.value}>
                  {role.label}
                </option>
              ))}
            </select>
          </div>

          {/* 활성 상태 */}
          <div>
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.is_active}
                onChange={(e) =>
                  setFormData({ ...formData, is_active: e.target.checked })
                }
                disabled={!isEditing}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer disabled:opacity-50"
              />
              <span className="text-sm font-medium text-gray-700">
                계정 활성화
              </span>
            </label>
          </div>

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
