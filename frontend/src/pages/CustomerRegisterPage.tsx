import React, { useState, useEffect } from "react";
import {
  Save,
  User,
  Phone,
  Mail,
  FileText,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Store,
  ShoppingBag,
  MapPin,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import Button from "../components/common/Button";
import Card, { CardHeader, CardContent } from "../components/common/Card";
import Input from "../components/common/Input";
import Textarea from "../components/common/Textarea";
import Alert from "../components/common/Alert";
import Breadcrumb from "../components/common/Breadcrumb";
import { customersApi } from "../api/customersApi";
import { CustomerCreate } from "../types/customer";
import type { CustomerChannel } from "../types/customer";

const SOURCE_OPTIONS: CustomerChannel[] = ["CAFE24", "GPMALL", "OFFLINE"];

interface CustomerRegisterPageProps {
  onBack?: () => void;
}

interface FieldErrors {
  customer_name?: string;
  customer_phone?: string;
  customer_email?: string;
  create_channel?: string;
}

const CustomerRegisterPage: React.FC<CustomerRegisterPageProps> = ({
  onBack,
}) => {
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [formData, setFormData] = useState<CustomerCreate>({
    customer_name: "",
    customer_phone: "",
    customer_email: null,
    create_channel: "CAFE24",
    admin_memo: null,
  });

  // 전화번호 자동 포맷팅
  const formatPhoneNumber = (value: string): string => {
    const numbers = value.replace(/[^\d]/g, "");
    if (numbers.length <= 3) return numbers;
    if (numbers.length <= 7)
      return `${numbers.slice(0, 3)}-${numbers.slice(3)}`;
    if (numbers.length <= 11)
      return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7)}`;
    return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7, 11)}`;
  };

  // 이메일 유효성 검사
  const validateEmail = (email: string): boolean => {
    if (!email) return true; // 선택 필드이므로 빈 값은 유효
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // 전화번호 유효성 검사
  const validatePhone = (phone: string): boolean => {
    const numbers = phone.replace(/[^\d]/g, "");
    return numbers.length >= 10 && numbers.length <= 11;
  };

  // 실시간 유효성 검사
  useEffect(() => {
    const errors: FieldErrors = {};

    if (touched.customer_name && !formData.customer_name.trim()) {
      errors.customer_name = "이름을 입력해주세요.";
    }

    if (touched.customer_phone) {
      if (!formData.customer_phone.trim()) {
        errors.customer_phone = "연락처를 입력해주세요.";
      } else if (!validatePhone(formData.customer_phone)) {
        errors.customer_phone = "올바른 연락처 형식이 아닙니다.";
      }
    }

    if (touched.customer_email && formData.customer_email) {
      if (!validateEmail(formData.customer_email)) {
        errors.customer_email = "올바른 이메일 형식이 아닙니다.";
      }
    }

    if (touched.create_channel && !formData.create_channel) {
      errors.create_channel = "유입 경로를 선택해주세요.";
    }

    setFieldErrors(errors);
  }, [formData, touched]);

  const handleBlur = (field: string) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value);
    setFormData({ ...formData, customer_phone: formatted });
    if (touched.customer_phone) {
      setTouched((prev) => ({ ...prev, customer_phone: true }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    // 모든 필드 터치 처리
    const allTouched = {
      customer_name: true,
      customer_phone: true,
      customer_email: true,
      create_channel: true,
    };
    setTouched(allTouched);

    // 유효성 검사
    const errors: FieldErrors = {};
    if (!formData.customer_name.trim()) {
      errors.customer_name = "이름을 입력해주세요.";
    }
    if (!formData.customer_phone.trim()) {
      errors.customer_phone = "연락처를 입력해주세요.";
    } else if (!validatePhone(formData.customer_phone)) {
      errors.customer_phone = "올바른 연락처 형식이 아닙니다.";
    }
    if (formData.customer_email && !validateEmail(formData.customer_email)) {
      errors.customer_email = "올바른 이메일 형식이 아닙니다.";
    }
    if (!formData.create_channel) {
      errors.create_channel = "유입 경로를 선택해주세요.";
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setError("입력 정보를 확인해주세요.");
      return;
    }

    setIsSubmitting(true);
    try {
      await customersApi.createCustomer(formData);
      setSuccess("고객이 성공적으로 등록되었습니다.");
      setTimeout(() => {
        navigate("/customer/list");
      }, 1500);
    } catch (err: any) {
      setError(err?.response?.data?.detail || err?.message || "고객 등록에 실패했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      navigate("/customer/list");
    }
  };

  const getChannelIcon = (channel: CustomerChannel) => {
    switch (channel) {
      case "CAFE24":
        return Store;
      case "GPMALL":
        return ShoppingBag;
      case "OFFLINE":
        return MapPin;
      default:
        return Store;
    }
  };

  const getChannelLabel = (channel: CustomerChannel) => {
    switch (channel) {
      case "CAFE24":
        return "Cafe24";
      case "GPMALL":
        return "갓피플몰";
      case "OFFLINE":
        return "오프라인";
      default:
        return channel;
    }
  };

  return (
    <div className="min-h-screen">
      <div className="max-w-[1600px] mx-auto px-6 py-6">
        <Breadcrumb
          items={[
            { label: "고객 관리", path: "/customer/list" },
            { label: "고객 등록" },
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
                  value={formData.customer_name}
                  onChange={(e) => {
                    setFormData({ ...formData, customer_name: e.target.value });
                    if (touched.customer_name) {
                      setTouched((prev) => ({ ...prev, customer_name: true }));
                    }
                  }}
                  onBlur={() => handleBlur("customer_name")}
                  required
                  placeholder="홍길동"
                  icon={User}
                  error={fieldErrors.customer_name}
                  className="transition-all"
                />
              </div>

              {/* 연락처 */}
              <div className="space-y-2">
                <Input
                  label="연락처"
                  type="tel"
                  value={formData.customer_phone}
                  onChange={handlePhoneChange}
                  onBlur={() => handleBlur("customer_phone")}
                  required
                  placeholder="010-0000-0000"
                  icon={Phone}
                  error={fieldErrors.customer_phone}
                  className="transition-all"
                  maxLength={13}
                />
                {!fieldErrors.customer_phone && formData.customer_phone && (
                  <p className="text-xs text-muted flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    올바른 형식입니다.
                  </p>
                )}
              </div>

              {/* 이메일 */}
              <div className="space-y-2">
                <Input
                  label="이메일"
                  type="email"
                  value={formData.customer_email || ""}
                  onChange={(e) => {
                    setFormData({
                      ...formData,
                      customer_email: e.target.value || null,
                    });
                    if (touched.customer_email) {
                      setTouched((prev) => ({ ...prev, customer_email: true }));
                    }
                  }}
                  onBlur={() => handleBlur("customer_email")}
                  placeholder="email@example.com (선택사항)"
                  icon={Mail}
                  error={fieldErrors.customer_email}
                  className="transition-all"
                />
                {!fieldErrors.customer_email &&
                  formData.customer_email &&
                  validateEmail(formData.customer_email) && (
                    <p className="text-xs text-muted flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      올바른 이메일 형식입니다.
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
                  <FileText className="w-5 h-5 text-accent" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-ink">추가 정보</h2>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* 유입 경로 */}
              <div className="space-y-3">
                <label className="block text-sm font-medium text-ink uppercase tracking-wider text-xs">
                  유입 경로 <span className="text-red-500 ml-1">*</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {SOURCE_OPTIONS.map((source) => {
                    const Icon = getChannelIcon(source);
                    const label = getChannelLabel(source);
                    const isSelected = formData.create_channel === source;
                    return (
                      <button
                        key={source}
                        type="button"
                        onClick={() => {
                          setFormData({ ...formData, create_channel: source });
                          handleBlur("create_channel");
                        }}
                        className={`relative p-4 rounded-lg border-2 transition-all duration-200 ${
                          isSelected
                            ? "border-accent bg-accent/5 shadow-md scale-[1.02]"
                            : "border-line bg-panel hover:border-accent/50 hover:bg-accent/5"
                        }`}
                      >
                        <div className="flex flex-col items-center gap-2">
                          <div
                            className={`p-3 rounded-lg ${
                              isSelected
                                ? "bg-accent text-white"
                                : "bg-chip text-muted"
                            } transition-colors`}
                          >
                            <Icon className="w-5 h-5" />
                          </div>
                          <span
                            className={`text-sm font-medium ${
                              isSelected ? "text-accent" : "text-ink"
                            }`}
                          >
                            {label}
                          </span>
                        </div>
                        {isSelected && (
                          <div className="absolute top-2 right-2">
                            <CheckCircle2 className="w-5 h-5 text-accent" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
                {fieldErrors.create_channel && (
                  <p className="text-xs text-red-600 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {fieldErrors.create_channel}
                  </p>
                )}
              </div>

              {/* 관리자 메모 */}
              <div className="space-y-2">
                <Textarea
                  label="관리자 메모"
                  value={formData.admin_memo || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      admin_memo: e.target.value || null,
                    })
                  }
                  placeholder="고객에 대한 추가 메모를 입력하세요 (선택사항)"
                  rows={4}
                  className="transition-all"
                />
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
};

export default CustomerRegisterPage;
