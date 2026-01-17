import React, { useState } from "react";
import { ArrowLeft, Save } from "lucide-react";
import { useNavigate } from "react-router-dom";
import Button from "../components/common/Button";
import Card from "../components/common/Card";
import Input from "../components/common/Input";
import Textarea from "../components/common/Textarea";
import Alert from "../components/common/Alert";
import Breadcrumb from "../components/common/Breadcrumb";
import { customerAPI, CustomerCreate } from "../api/customerApi";

const SOURCE_OPTIONS = ["CAFE24", "GPMALL", "OFFLINE", "기타"];

interface CustomerRegisterPageProps {
  onBack?: () => void;
}

const CustomerRegisterPage: React.FC<CustomerRegisterPageProps> = ({
  onBack,
}) => {
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [formData, setFormData] = useState<CustomerCreate>({
    customer_name: "",
    customer_phone: "",
    customer_email: "",
    create_channel: "CAFE24",
    admin_memo: null,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    // 유효성 검사
    if (!formData.customer_name || !formData.customer_phone) {
      setError("이름과 연락처는 필수입니다.");
      return;
    }

    try {
      await customerAPI.create(formData);
      setSuccess("고객이 등록되었습니다.");
      setTimeout(() => {
        navigate("/customer/list");
      }, 1500);
    } catch (err: any) {
      setError(err?.message || "고객 등록에 실패했습니다.");
    }
  };

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      navigate("/customer/list");
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

        {/* 성공 메시지 */}
        {success && <Alert type="success">{success}</Alert>}

        {/* 에러 메시지 */}
        {error && <Alert type="error">{error}</Alert>}

        {/* 폼 */}
        <Card className="unified-card">
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* 이름 */}
            <div>
              <Input
                label="이름"
                type="text"
                value={formData.customer_name}
                onChange={(e) =>
                  setFormData({ ...formData, customer_name: e.target.value })
                }
                required
                placeholder="홍길동"
              />
            </div>

            {/* 연락처 */}
            <div>
              <Input
                label="연락처"
                type="tel"
                value={formData.customer_phone}
                onChange={(e) =>
                  setFormData({ ...formData, customer_phone: e.target.value })
                }
                required
                placeholder="010-0000-0000"
              />
            </div>

            {/* 이메일 */}
            <div>
              <Input
                label="이메일"
                type="email"
                value={formData.customer_email || ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    customer_email: e.target.value || null,
                  })
                }
                placeholder="email@example.com"
              />
            </div>

            {/* 유입 경로 */}
            <div>
              <label className="unified-label mb-2 block">
                유입 경로 <span className="text-red-500 ml-1">*</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {SOURCE_OPTIONS.map((source) => {
                  const label =
                    source === "CAFE24"
                      ? "Cafe24"
                      : source === "GPMALL"
                      ? "갓피플몰"
                      : source === "OFFLINE"
                      ? "오프라인"
                      : source;
                  const isSelected = formData.create_channel === source;
                  return (
                    <button
                      key={source}
                      type="button"
                      onClick={() =>
                        setFormData({ ...formData, create_channel: source })
                      }
                      className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                        isSelected
                          ? "bg-accent text-white shadow-sm"
                          : "bg-paper text-ink border border-line hover:border-accent/50 hover:bg-accent/5"
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 관리자 메모 */}
            <div>
              <Textarea
                label="관리자 메모"
                value={formData.admin_memo || ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    admin_memo: e.target.value || null,
                  })
                }
                placeholder="관리자 메모를 입력하세요"
                rows={3}
              />
            </div>

            {/* 버튼 */}
            <div className="flex items-center justify-end space-x-3 pt-4 border-t">
              <Button type="button" onClick={handleBack} variant="secondary">
                취소
              </Button>
              <Button type="submit" variant="primary" icon={Save}>
                등록
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
};

export default CustomerRegisterPage;
