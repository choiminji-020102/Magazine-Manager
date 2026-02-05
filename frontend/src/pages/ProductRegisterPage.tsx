import React, { useState, useEffect } from "react";
import {
  Save,
  Package,
  DollarSign,
  Box,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Hash,
  Ruler,
  ShoppingBag,
  Calendar,
  Settings,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import Button from "../components/common/Button";
import Card, { CardHeader, CardContent } from "../components/common/Card";
import Input from "../components/common/Input";
import Alert from "../components/common/Alert";
import Breadcrumb from "../components/common/Breadcrumb";
import { productsApi } from "../api/productsApi";
import { ProductCreate, ProductKind } from "../types/product";

interface ProductRegisterPageProps {
  onBack?: () => void;
}

interface FieldErrors {
  product_code?: string;
  product_kind?: string;
  product_name?: string;
  price?: string;
  sale?: string;
  purchase?: string;
  stock_quantity?: string;
}

const PRODUCT_KIND_OPTIONS: { value: ProductKind; label: string; description: string }[] = [
  { value: ProductKind.YEARLY, label: "정기 구독", description: "YEARLY" },
  { value: ProductKind.MONTHLY, label: "월호 단품", description: "MONTHLY" },
  { value: ProductKind.SINGLE, label: "일반 상품", description: "SINGLE" },
];

const ProductRegisterPage: React.FC<ProductRegisterPageProps> = ({ onBack }) => {
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [formData, setFormData] = useState<Omit<ProductCreate, "price" | "sale" | "purchase" | "stock_quantity"> & {
    price: number | "";
    sale: number | "";
    purchase: number | "";
    stock_quantity: number | "";
  }>({
    product_code: "",
    product_kind: ProductKind.SINGLE,
    product_name: "",
    unit_weight: null,
    unit_width: null,
    unit_length: null,
    unit_height: null,
    price: "",
    sale: "",
    purchase: "",
    stock_quantity: "",
    is_active: true,
    external_product_code_cafe24: null,
    external_product_code_gpmall: null,
    subscribe_start_issue: null,
  });

  const isYearly = formData.product_kind === ProductKind.YEARLY;

  // 실시간 유효성 검사
  useEffect(() => {
    const errors: FieldErrors = {};

    if (touched.product_code && !formData.product_code.trim()) {
      errors.product_code = "상품코드를 입력해주세요.";
    }

    if (touched.product_name && !formData.product_name.trim()) {
      errors.product_name = "상품명을 입력해주세요.";
    }


    if (touched.price && (formData.price === "" || (typeof formData.price === "number" && formData.price < 0))) {
      errors.price = formData.price === "" ? "정가를 입력해주세요." : "가격은 0 이상이어야 합니다.";
    }

    if (touched.sale && (formData.sale === "" || (typeof formData.sale === "number" && formData.sale < 0))) {
      errors.sale = formData.sale === "" ? "판매가를 입력해주세요." : "판매가는 0 이상이어야 합니다.";
    }

    if (touched.purchase && (formData.purchase === "" || (typeof formData.purchase === "number" && formData.purchase < 0))) {
      errors.purchase = formData.purchase === "" ? "원가를 입력해주세요." : "구매가는 0 이상이어야 합니다.";
    }

    if (touched.stock_quantity && (formData.stock_quantity === "" || (typeof formData.stock_quantity === "number" && formData.stock_quantity < 0))) {
      errors.stock_quantity = formData.stock_quantity === "" ? "재고수량을 입력해주세요." : "재고수량은 0 이상이어야 합니다.";
    }

    setFieldErrors(errors);
  }, [formData, touched]);

  const handleBlur = (field: string) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    // 모든 필수 필드 터치 처리
    const allTouched = {
      product_code: true,
      product_kind: true,
      product_name: true,
      price: true,
      sale: true,
      purchase: true,
      stock_quantity: true,
    };
    setTouched(allTouched);

    // 유효성 검사
    const errors: FieldErrors = {};
    if (!formData.product_code.trim()) {
      errors.product_code = "상품코드를 입력해주세요.";
    }
    if (!formData.product_name.trim()) {
      errors.product_name = "상품명을 입력해주세요.";
    }
    if (formData.price === "" || (typeof formData.price === "number" && formData.price < 0)) {
      errors.price = formData.price === "" ? "정가를 입력해주세요." : "가격은 0 이상이어야 합니다.";
    }
    if (formData.sale === "" || (typeof formData.sale === "number" && formData.sale < 0)) {
      errors.sale = formData.sale === "" ? "판매가를 입력해주세요." : "판매가는 0 이상이어야 합니다.";
    }
    if (formData.purchase === "" || (typeof formData.purchase === "number" && formData.purchase < 0)) {
      errors.purchase = formData.purchase === "" ? "원가를 입력해주세요." : "구매가는 0 이상이어야 합니다.";
    }
    if (formData.stock_quantity === "" || (typeof formData.stock_quantity === "number" && formData.stock_quantity < 0)) {
      errors.stock_quantity = formData.stock_quantity === "" ? "재고수량을 입력해주세요." : "재고수량은 0 이상이어야 합니다.";
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setError("입력 정보를 확인해주세요.");
      return;
    }

    const submitData: ProductCreate = {
      ...formData,
      price: formData.price === "" ? 0 : formData.price,
      sale: formData.sale === "" ? 0 : formData.sale,
      purchase: formData.purchase === "" ? 0 : formData.purchase,
      stock_quantity: formData.stock_quantity === "" ? 0 : formData.stock_quantity,
    };

    setIsSubmitting(true);
    try {
      await productsApi.createProduct(submitData);
      setSuccess("상품이 성공적으로 등록되었습니다.");
      setTimeout(() => {
        navigate("/product/list");
      }, 1500);
    } catch (err: any) {
      setError(
        err?.response?.data?.detail || err?.message || "상품 등록에 실패했습니다."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      navigate("/product/list");
    }
  };

  return (
    <div className="min-h-screen">
      <div className="max-w-[1600px] mx-auto px-6 py-6">
        <Breadcrumb
          items={[
            { label: "상품 관리", path: "/product/list" },
            { label: "상품 등록" },
          ]}
        />

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
          {/* 1. 상품 생성 유형 선택 (최상단) */}
          <Card className="overflow-hidden">
            <CardHeader>
              <div className="flex items-center gap-2">
                <div className="p-2 bg-accent/10 rounded-lg">
                  <ShoppingBag className="w-5 h-5 text-accent" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-ink">상품 생성 유형</h2>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {PRODUCT_KIND_OPTIONS.map((option) => {
                  const isSelected = formData.product_kind === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => {
                        setFormData({
                          ...formData,
                          product_kind: option.value,
                        });
                        handleBlur("product_kind");
                      }}
                      className={`relative p-5 rounded-lg border-2 transition-all duration-200 text-left ${
                        isSelected
                          ? "border-accent bg-accent/5 shadow-md scale-[1.02]"
                          : "border-line bg-panel hover:border-accent/50 hover:bg-accent/5"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={`p-2 rounded-lg flex-shrink-0 ${
                            isSelected
                              ? "bg-accent text-white"
                              : "bg-chip text-muted"
                          } transition-colors`}
                        >
                          <ShoppingBag className="w-5 h-5" />
                        </div>
                        <div className="flex-1">
                          <div
                            className={`text-base font-semibold mb-1 ${
                              isSelected ? "text-accent" : "text-ink"
                            }`}
                          >
                            {option.label}
                          </div>
                          <div className="text-xs text-muted">
                            {option.description}
                          </div>
                        </div>
                        {isSelected && (
                          <div className="absolute top-3 right-3">
                            <CheckCircle2 className="w-5 h-5 text-accent" />
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
              {fieldErrors.product_kind && (
                <p className="text-xs text-red-600 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {fieldErrors.product_kind}
                </p>
              )}
            </CardContent>
          </Card>

          {/* 2. 기본 정보 섹션 */}
          <Card className="overflow-hidden">
            <CardHeader>
              <div className="flex items-center gap-2">
                <div className="p-2 bg-accent/10 rounded-lg">
                  <Package className="w-5 h-5 text-accent" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-ink">기본 정보</h2>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* 상품코드 */}
              <div className="space-y-2">
                <Input
                  label="상품코드"
                  type="text"
                  value={formData.product_code}
                  onChange={(e) => {
                    setFormData({ ...formData, product_code: e.target.value });
                    if (touched.product_code) {
                      setTouched((prev) => ({ ...prev, product_code: true }));
                    }
                  }}
                  onBlur={() => handleBlur("product_code")}
                  required
                  placeholder="예: PROD-001"
                  icon={Hash}
                  error={fieldErrors.product_code}
                  className="transition-all"
                />
              </div>

              {/* 상품명 */}
              <div className="space-y-2">
                <Input
                  label="상품명"
                  type="text"
                  value={formData.product_name}
                  onChange={(e) => {
                    setFormData({ ...formData, product_name: e.target.value });
                    if (touched.product_name) {
                      setTouched((prev) => ({ ...prev, product_name: true }));
                    }
                  }}
                  onBlur={() => handleBlur("product_name")}
                  required
                  placeholder="상품명을 입력하세요"
                  icon={Package}
                  error={fieldErrors.product_name}
                  className="transition-all"
                />
              </div>

              {/* 활성화 여부 */}
              <div className="space-y-3">
                <label className="block text-sm font-medium text-ink uppercase tracking-wider text-xs">
                  판매 여부
                </label>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="is_active"
                      checked={formData.is_active === true}
                      onChange={() =>
                        setFormData({ ...formData, is_active: true })
                      }
                      className="w-4 h-4 text-accent focus:ring-accent"
                    />
                    <span className="text-sm text-ink">활성화</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="is_active"
                      checked={formData.is_active === false}
                      onChange={() =>
                        setFormData({ ...formData, is_active: false })
                      }
                      className="w-4 h-4 text-accent focus:ring-accent"
                    />
                    <span className="text-sm text-ink">비활성화</span>
                  </label>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 3. 발행 정보 섹션 */}
          <Card className="overflow-hidden">
            <CardHeader>
              <div className="flex items-center gap-2">
                <div className="p-2 bg-accent/10 rounded-lg">
                  <Calendar className="w-5 h-5 text-accent" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-ink">발행 정보</h2>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Input
                  label={isYearly ? "정기구독 시작 월 (YYYYMM)" : "발행월 (YYYYMM)"}
                  type="text"
                  value={formData.subscribe_start_issue || ""}
                  onChange={(e) => {
                    setFormData({
                      ...formData,
                      subscribe_start_issue: e.target.value || null,
                    });
                    if (touched.subscribe_start_issue) {
                      setTouched((prev) => ({ ...prev, subscribe_start_issue: true }));
                    }
                  }}
                  onBlur={() => handleBlur("subscribe_start_issue")}
                  placeholder={isYearly ? "예: 202401" : "예: 202401"}
                  icon={Calendar}
                  className="transition-all"
                  maxLength={6}
                />
              </div>
            </CardContent>
          </Card>

          {/* 4. 가격 정보 섹션 */}
          <Card className="overflow-hidden">
            <CardHeader>
              <div className="flex items-center gap-2">
                <div className="p-2 bg-accent/10 rounded-lg">
                  <DollarSign className="w-5 h-5 text-accent" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-ink">가격 정보</h2>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* 정가 */}
                <div className="space-y-2">
                  <Input
                    label="정가"
                    type="number"
                    value={formData.price}
                    onChange={(e) => {
                      setFormData({
                        ...formData,
                        price: e.target.value === "" ? "" : parseInt(e.target.value) || 0,
                      });
                      if (touched.price) {
                        setTouched((prev) => ({ ...prev, price: true }));
                      }
                    }}
                    onBlur={() => handleBlur("price")}
                    required
                    placeholder="정가를 입력하세요"
                    icon={DollarSign}
                    error={fieldErrors.price}
                    className="transition-all"
                    min="0"
                  />
                </div>

                {/* 판매가 */}
                <div className="space-y-2">
                  <Input
                    label="판매가"
                    type="number"
                    value={formData.sale}
                    onChange={(e) => {
                      setFormData({
                        ...formData,
                        sale: e.target.value === "" ? "" : parseInt(e.target.value) || 0,
                      });
                      if (touched.sale) {
                        setTouched((prev) => ({ ...prev, sale: true }));
                      }
                    }}
                    onBlur={() => handleBlur("sale")}
                    required
                    placeholder="판매가를 입력하세요"
                    icon={DollarSign}
                    error={fieldErrors.sale}
                    className="transition-all"
                    min="0"
                  />
                </div>

                {/* 원가 */}
                <div className="space-y-2">
                  <Input
                    label="원가"
                    type="number"
                    value={formData.purchase}
                    onChange={(e) => {
                      setFormData({
                        ...formData,
                        purchase: e.target.value === "" ? "" : parseInt(e.target.value) || 0,
                      });
                      if (touched.purchase) {
                        setTouched((prev) => ({ ...prev, purchase: true }));
                      }
                    }}
                    onBlur={() => handleBlur("purchase")}
                    required
                    placeholder="원가를 입력하세요"
                    icon={DollarSign}
                    error={fieldErrors.purchase}
                    className="transition-all"
                    min="0"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 5. 상품 규격 (배송) */}
          <Card className="overflow-hidden">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-accent/10 rounded-lg">
                    <Ruler className="w-5 h-5 text-accent" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-ink">상품 규격 (배송)</h2>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* 무게 */}
                  <div className="space-y-2">
                    <Input
                      label="무게 (kg)"
                      type="number"
                      value={formData.unit_weight || ""}
                      onChange={(e) => {
                        setFormData({
                          ...formData,
                          unit_weight: e.target.value
                            ? parseFloat(e.target.value)
                            : null,
                        });
                      }}
                      placeholder="0.0"
                      className="transition-all"
                      step="0.01"
                      min="0"
                    />
                  </div>

                  {/* 너비 */}
                  <div className="space-y-2">
                    <Input
                      label="너비 (cm)"
                      type="number"
                      value={formData.unit_width || ""}
                      onChange={(e) => {
                        setFormData({
                          ...formData,
                          unit_width: e.target.value
                            ? parseFloat(e.target.value)
                            : null,
                        });
                      }}
                      placeholder="0.0"
                      className="transition-all"
                      step="0.01"
                      min="0"
                    />
                  </div>

                  {/* 길이 */}
                  <div className="space-y-2">
                    <Input
                      label="길이 (cm)"
                      type="number"
                      value={formData.unit_length || ""}
                      onChange={(e) => {
                        setFormData({
                          ...formData,
                          unit_length: e.target.value
                            ? parseFloat(e.target.value)
                            : null,
                        });
                      }}
                      placeholder="0.0"
                      className="transition-all"
                      step="0.01"
                      min="0"
                    />
                  </div>

                  {/* 높이 */}
                  <div className="space-y-2">
                    <Input
                      label="높이 (cm)"
                      type="number"
                      value={formData.unit_height || ""}
                      onChange={(e) => {
                        setFormData({
                          ...formData,
                          unit_height: e.target.value
                            ? parseFloat(e.target.value)
                            : null,
                        });
                      }}
                      placeholder="0.0"
                      className="transition-all"
                      step="0.01"
                      min="0"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

          {/* 6. 재고 */}
          <Card className="overflow-hidden">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-accent/10 rounded-lg">
                    <Box className="w-5 h-5 text-accent" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-ink">재고</h2>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Input
                    label="재고수량"
                    type="number"
                    value={formData.stock_quantity}
                    onChange={(e) => {
                      setFormData({
                        ...formData,
                        stock_quantity: e.target.value === "" ? "" : parseInt(e.target.value) || 0,
                      });
                      if (touched.stock_quantity) {
                        setTouched((prev) => ({
                          ...prev,
                          stock_quantity: true,
                        }));
                      }
                    }}
                    onBlur={() => handleBlur("stock_quantity")}
                    required
                    placeholder="재고수량을 입력하세요"
                    icon={Box}
                    error={fieldErrors.stock_quantity}
                    className="transition-all"
                    min="0"
                  />
                </div>
              </CardContent>
            </Card>

          {/* 7. 외부 몰 연동 정보 */}
          <Card className="overflow-hidden">
            <CardHeader>
              <div className="flex items-center gap-2">
                <div className="p-2 bg-accent/10 rounded-lg">
                  <Settings className="w-5 h-5 text-accent" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-ink">외부 몰 연동 정보</h2>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* 외부 상품코드 - Cafe24 */}
              <div className="space-y-2">
                <Input
                  label="Cafe24 상품코드"
                  type="text"
                  value={formData.external_product_code_cafe24 || ""}
                  onChange={(e) => {
                    setFormData({
                      ...formData,
                      external_product_code_cafe24:
                        e.target.value || null,
                    });
                  }}
                  placeholder="Cafe24 상품코드 (선택사항)"
                  icon={Hash}
                  className="transition-all"
                />
              </div>

              {/* 외부 상품코드 - GPMall */}
              <div className="space-y-2">
                <Input
                  label="갓피플몰 상품코드"
                  type="text"
                  value={formData.external_product_code_gpmall || ""}
                  onChange={(e) => {
                    setFormData({
                      ...formData,
                      external_product_code_gpmall: e.target.value || null,
                    });
                  }}
                  placeholder="갓피플몰 상품코드 (선택사항)"
                  icon={Hash}
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

export default ProductRegisterPage;
