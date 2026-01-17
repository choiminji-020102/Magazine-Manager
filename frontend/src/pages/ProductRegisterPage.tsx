import React, { useMemo, useState } from "react";
import { Save } from "lucide-react";
import PageHeader from "../components/common/PageHeader";
import Card, { CardHeader, CardContent } from "../components/common/Card";
import Button from "../components/common/Button";
import Input from "../components/common/Input";
import Textarea from "../components/common/Textarea";
import { cafe24API } from "../api/cafe24Api";
import Breadcrumb from "../components/common/Breadcrumb";

interface FieldOption {
  value: string;
  label: string;
}

interface FieldConfig {
  key: string;
  label: string;
  kind?: "text" | "number" | "select" | "textarea";
  placeholder?: string;
  options?: FieldOption[];
  required?: boolean;
}

const jsonFields = new Set([
  "add_category_no",
  "options",
  "expiration_date",
  "icon",
  "buy_group_list",
  "buy_member_id_list",
  "points_amount",
  "product_volume",
  "country_hscode",
  "relational_product",
  "shipping_period",
  "shipping_rates",
  "additional_image",
  "size_guide",
  "product_tag",
  "additional_information",
  "main",
  "exposure_group_list",
]);

const numberFields = new Set([
  "shop_no",
  "product_used_month",
  "buy_unit",
  "minimum_quantity",
  "maximum_quantity",
  "tax_rate",
  "origin_place_no",
]);

const initialFormState: Record<string, string> = {
  mall_id: import.meta.env.VITE_CAFE24_MALL_ID ?? "",
  shop_no: "1",
  display: "T",
  selling: "T",
  product_condition: "U",
  product_used_month: "2",
  add_category_no: JSON.stringify(
    [
      { category_no: 27, recommend: "F", new: "T" },
      { category_no: 28, recommend: "T", new: "F" },
    ],
    null,
    2
  ),
  custom_product_code: "",
  product_name: "iPhone X",
  eng_product_name: "iPhone Ten",
  supply_product_name: "iphone A1865 fdd lte",
  internal_product_name: "Sample Internal product name",
  model_name: "A1865",
  price_excluding_tax: "",
  price: "11000.00",
  retail_price: "0.00",
  supply_price: "9000.00",
  has_option: "T",
  soldout_message: "Sold out",
  options: JSON.stringify(
    [
      { name: "Color", value: ["Red", "Blue", "Green"] },
      { name: "Size", value: ["X", "L", "M", "S"] },
    ],
    null,
    2
  ),
  use_naverpay: "T",
  naverpay_type: "C",
  use_kakaopay: "T",
  image_upload_type: "A",
  detail_image: "/web/product/big/201511/30_shop1_638611.jpg",
  list_image: "",
  tiny_image: "",
  small_image: "",
  manufacturer_code: "M0000000",
  supplier_code: "S0000000",
  brand_code: "B0000000",
  trend_code: "T0000000",
  product_weight: "1.00",
  made_date: "",
  release_date: "",
  expiration_date: JSON.stringify(
    { start_date: "2017-09-08", end_date: "2017-09-14" },
    null,
    2
  ),
  icon: JSON.stringify(["icon_01_01", "icon_02_01"], null, 2),
  price_content: "Sample Content",
  buy_limit_by_product: "T",
  buy_limit_type: "F",
  buy_group_list: JSON.stringify([8, 9], null, 2),
  buy_member_id_list: JSON.stringify(["sampleid", "testid"], null, 2),
  repurchase_restriction: "F",
  single_purchase_restriction: "F",
  single_purchase: "F",
  buy_unit_type: "O",
  buy_unit: "1",
  order_quantity_limit_type: "O",
  minimum_quantity: "1",
  maximum_quantity: "0",
  points_by_product: "T",
  points_setting_by_payment: "C",
  points_amount: JSON.stringify(
    [
      {
        payment_method: "cash",
        points_rate: "100.00",
        points_unit_by_payment: "W",
      },
      {
        payment_method: "mileage",
        points_rate: "10.00",
        points_unit_by_payment: "P",
      },
    ],
    null,
    2
  ),
  except_member_points: "F",
  product_volume: JSON.stringify(
    {
      use_product_volume: "T",
      product_width: 3,
      product_height: 5.5,
      product_length: 7,
    },
    null,
    2
  ),
  description: "Sample Description.",
  mobile_description: "Sample Mobile Description.",
  translated_description: "This is a translated description of product.",
  summary_description: "This is Product Summary.",
  simple_description: "This is Product Description.",
  product_tag: JSON.stringify([], null, 2),
  payment_info: "Sample payment info. You have to Pay.",
  shipping_info: "Sample shipping info. You have to ship.",
  exchange_info: "Sample exchange info. You have to exchange.",
  service_info: "Sample service info. You have to service.",
  hscode: "4303101990",
  country_hscode: JSON.stringify(
    { JPN: "430310011", CHN: "43031020" },
    null,
    2
  ),
  relational_product: JSON.stringify(
    [
      { product_no: 9, interrelated: "T" },
      { product_no: 10, interrelated: "F" },
    ],
    null,
    2
  ),
  shipping_scope: "A",
  shipping_fee_by_product: "T",
  shipping_method: "01",
  shipping_period: JSON.stringify({ minimum: 4, maximum: 10 }, null, 2),
  shipping_area: "All around world",
  shipping_fee_type: "D",
  clearance_category_code: "ACAB0000",
  product_shipping_type: "D",
  shipping_rates: JSON.stringify(
    [
      {
        shipping_rates_min: "2000.00",
        shipping_rates_max: "4000.00",
        shipping_fee: "5000.00",
      },
      {
        shipping_rates_min: "4000.00",
        shipping_rates_max: "6000.00",
        shipping_fee: "2500.00",
      },
    ],
    null,
    2
  ),
  product_material: "Aluminum",
  translate_product_material: "F",
  english_product_material: "Aluminum",
  cloth_fabric: "knit",
  classification_code: "C000000A",
  additional_price: "1100.00",
  margin_rate: "10.00",
  tax_type: "A",
  tax_rate: "10",
  prepaid_shipping_fee: "P",
  origin_classification: "F",
  origin_place_no: "1798",
  origin_place_value: "",
  made_in_code: "KR",
  additional_image: JSON.stringify(
    [
      "201810/a2803c44ee8299486ff19be239cef7d0.jpg",
      "201810/e1ab68969d69287a828438c7684b14c4.jpg",
    ],
    null,
    2
  ),
  adult_certification: "F",
  exposure_limit_type: "M",
  exposure_group_list: JSON.stringify([8, 9], null, 2),
  main: JSON.stringify([], null, 2),
  cultural_tax_deduction: "F",
  size_guide: JSON.stringify(
    { use: "T", type: "default", default: "Male" },
    null,
    2
  ),
  additional_information: JSON.stringify([], null, 2),
};

const requestKeys = Object.keys(initialFormState).filter(
  (key) => key !== "mall_id" && key !== "shop_no"
);

interface ProductRegisterPageProps {
  onBack?: () => void;
}

const ProductRegisterPage: React.FC<ProductRegisterPageProps> = ({
  onBack: _onBack,
}) => {
  const [formData, setFormData] =
    useState<Record<string, string>>(initialFormState);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitResult, setSubmitResult] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);
  const handleChange = (key: string, value: string) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const normalizeFieldValue = (key: string, value: string) => {
    if (jsonFields.has(key)) {
      if (value.trim() === "") {
        return [];
      }
      return JSON.parse(value);
    }
    if (numberFields.has(key)) {
      if (value.trim() === "") {
        return null;
      }
      const numeric = Number(value);
      return Number.isNaN(numeric) ? value : numeric;
    }
    return value;
  };

  const buildPayload = () => {
    const requestPayload: Record<string, any> = {};
    requestKeys.forEach((key) => {
      requestPayload[key] = normalizeFieldValue(key, formData[key] ?? "");
    });
    return {
      shop_no: normalizeFieldValue("shop_no", formData.shop_no) ?? 1,
      request: requestPayload,
    };
  };

  const handleSubmit = async () => {
    setSubmitError(null);
    setSubmitResult(null);
    if (!formData.mall_id) {
      setSubmitError("mall_id가 필요합니다.");
      return;
    }
    try {
      const payload = buildPayload();
      setSubmitting(true);
      const data = await cafe24API.createProduct(formData.mall_id, payload);
      setSubmitResult(data);
    } catch (err: any) {
      const message = err?.message || "Cafe24 상품 등록에 실패했습니다.";
      setSubmitError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const fieldGroups: Array<{ title: string; fields: FieldConfig[] }> = useMemo(
    () => [
      {
        title: "표시 설정",
        fields: [
          {
            key: "display",
            label: "진열상태",
            kind: "select",
            options: [
              { value: "T", label: "진열함" },
              { value: "F", label: "진열안함" },
            ],
          },
          {
            key: "selling",
            label: "판매상태",
            kind: "select",
            options: [
              { value: "T", label: "판매함" },
              { value: "F", label: "판매안함" },
            ],
          },
          // [상품분류 선택]을 못 찾겠음!!!!!!!!
          { key: "main", label: "메인 진열", kind: "textarea" },
          {
            key: "exposure_limit_type",
            label: "표시제한",
            kind: "select",
            options: [
              { value: "A", label: "모두에게 표시" },
              { value: "M", label: "회원에게만 표시" },
            ],
          },
        ],
      },
      {
        title: "기본 정보",
        fields: [
          { key: "product_name", label: "상품명", required: true },
          { key: "eng_product_name", label: "영문 상품명" },
          { key: "internal_product_name", label: "상품명(관리용)" },
          { key: "supply_product_name", label: "공급사 상품명" },
          { key: "model_name", label: "모델명" },
          // 상품 코드 -> 자동생성
          { key: "custom_product_code", label: "자체 상품코드" }, // 중복환인해야함
          {
            key: "product_condition",
            label: "상품 상태(product_condition)",
            kind: "select",
            options: [
              { value: "N", label: "신상품" },
              { value: "B", label: "반품상품" },
              { value: "R", label: "재고상품" },
              { value: "U", label: "중고상품" },
              { value: "E", label: "전시상품" },
              { value: "F", label: "리퍼상품" },
              { value: "S", label: "스크래치 상품" },
            ],
          },
          {
            key: "summary_description",
            label: "상품 요약설명",
            kind: "textarea",
          },
          {
            key: "simple_description",
            label: "상품 간략설명",
            kind: "textarea",
          },
          { key: "description", label: "상품 상세설명", kind: "textarea" },
          {
            key: "mobile_description",
            label: "모바일 상품 상세설명",
            kind: "textarea",
          },
          // [검색어 설정]을 못 찾겠어
        ],
      },
      {
        title: "판매 정보",
        fields: [
          { key: "retail_price", label: "소비자가" },
          { key: "supply_price", label: "공급가", required: true },
          {
            key: "tax_type",
            label: "과세구분",
            kind: "select",
            options: [
              { value: "A", label: "과세상품" },
              { value: "B", label: "면세상품" },
              { value: "C", label: "영세상품" },
            ],
          },
          { key: "tax_rate", label: "과세율" },
          { key: "margin_rate", label: "마진률" },
          { key: "additional_price", label: "판매가 추가금액" },
          { key: "price", label: "상품 판매가", required: true },
          { key: "price_content", label: "판매가 대체문구" },
          {
            key: "buy_limit_by_product",
            label: "구매제한 개별 설정여부",
            kind: "select",
            options: [
              { value: "T", label: "사용함" },
              { value: "F", label: "사용안함" },
            ],
          },
          {
            key: "buy_limit_type",
            label: "구매제한 타입",
            kind: "select",
            options: [
              { value: "N", label: "회원만 구매하며 구매버튼 감추기" },
              { value: "M", label: "회원만 구매하며 구매버튼 보이기" },
              { value: "F", label: "구매제한 안함" },
              { value: "O", label: "지정된 회원만 구매하며 구매버튼 감추기" },
              { value: "D", label: "지정된 회원만 구매하며 구매버튼 보이기" },
            ],
          },
          {
            key: "single_purchase_restriction",
            label: "단독구매 제한", //
            kind: "select",
            options: [
              { value: "T", label: "단독구매 불가" },
              { value: "F", label: "제한안함" },
            ],
          },
          {
            key: "single_purchase",
            label: "단독구매 설정", //
            kind: "select",
            options: [
              { value: "T", label: "단독구매 불가" },
              { value: "F", label: "제한안함" },
              { value: "O", label: "단독구매 전용" },
            ],
          },
          {
            key: "buy_unit_type",
            label: "구매단위 타입", //
            kind: "select",
            options: [
              { value: "P", label: "상품 기준" },
              { value: "O", label: "품목 기준" },
            ],
          },
          { key: "buy_unit", label: "구매단위" },
          {
            key: "order_quantity_limit_type",
            label: "주문수량 제한 기준",
            kind: "select",
            options: [
              { value: "P", label: "상품 기준" },
              { value: "O", label: "품목 기준" },
            ],
          },
          { key: "minimum_quantity", label: "최소 주문수량" },
          { key: "maximum_quantity", label: "최대 주문수량" },
          {
            key: "points_by_product",
            label: "적립금",
            kind: "select",
            options: [
              { value: "F", label: "기본설정 사용(기본 적립금: 0.00%)" },
              { value: "T", label: "개별설정" },
            ],
          },
          {
            key: "points_setting_by_payment",
            label: "결제방식별 적립금 설정",
            kind: "select",
            options: [
              { value: "B", label: "기본 적립금 설정 사용" },
              { value: "C", label: "결제방식에 따른 적립" },
            ],
          },
          {
            key: "adult_certification",
            label: "성인인증",
            kind: "select",
            options: [
              { value: "T", label: "사용함" },
              { value: "F", label: "사용안함" },
            ],
          },
        ],
      },
      {
        title: "옵션/재고 설정",
        fields: [
          {
            key: "has_option",
            label: "옵션사용",
            kind: "select",
            options: [
              { value: "T", label: "사용함" },
              { value: "F", label: "사용안함" },
            ],
          },
        ],
      },
      {
        title: "이미지 정보",
        fields: [
          {
            key: "image_upload_type",
            label: "이미지 업로드 타입",
            kind: "select",
            options: [
              { value: "A", label: "대표이미지등록" },
              { value: "B", label: "개별이미지등록" },
              { value: "C", label: "웹FTP 등록" },
            ],
          },
          { key: "detail_image", label: "상세이미지" },
          { key: "list_image", label: "목록이미지" },
          { key: "tiny_image", label: "작은목록이미지" },
          { key: "small_image", label: "축소이미지" },
          { key: "additional_image", label: "추가이미지 등록" },
        ],
      },
      {
        title: "제작 정보",
        fields: [
          { key: "manufacturer_code", label: "제조사 코드" },
          { key: "supplier_code", label: "공급사 코드" },
          { key: "brand_code", label: "브랜드 코드" },
          { key: "trend_code", label: "트렌드 코드" },
          { key: "classification_code", label: "자체분류 코드" },
          { key: "made_date", label: "제조일자" },
          { key: "release_date", label: "출시일자" },
          { key: "expiration_date", label: "유효기간" },
          {
            key: "origin_classification",
            label: "원산지 구분",
            kind: "select",
            options: [
              { value: "F", label: "국내" },
              { value: "T", label: "국외" },
              { value: "E", label: "기타" },
            ],
          },
          { key: "origin_place_no", label: "원산지 번호" },
          { key: "origin_place_value", label: "원산지 기타정보" },
          { key: "made_in_code", label: "원산지 국가코드" },
          { key: "size_guide", label: "사이즈 가이드" },
          { key: "product_volume", label: "상품 부피 정보" },
        ],
      },
      {
        title: "상세 이용안내",
        fields: [
          { key: "payment_info", label: "상품결제안내", kind: "textarea" },
          { key: "shipping_info", label: "상품배송안내", kind: "textarea" },
          { key: "exchange_info", label: "교환/반품안내", kind: "textarea" },
          { key: "service_info", label: "서비스문의/안내", kind: "textarea" },
        ],
      },
      {
        title: "아이콘 설정",
        fields: [{ key: "icon", label: "아이콘", kind: "textarea" }],
      },
      {
        title: "배송 정보",
        fields: [
          {
            key: "shipping_scope",
            label: "배송정보",
            kind: "select",
            options: [
              { value: "A", label: "국내배송" },
              { value: "B", label: "국내/해외배송" },
              { value: "C", label: "해외배송" },
            ],
          },
          {
            key: "shipping_fee_by_product",
            label: "개별배송여부",
            kind: "select",
            options: [
              { value: "T", label: "T (개별배송)" },
              { value: "F", label: "F (기본배송)" },
            ],
          },
          {
            key: "shipping_method",
            label: "배송방법",
            kind: "select",
            options: [
              { value: "01", label: "택배" },
              { value: "02", label: "빠른등기" },
              { value: "03", label: "일반등기" },
              { value: "04", label: "직접배송" },
              { value: "05", label: "퀵배송" },
              { value: "06", label: "기타" },
              { value: "07", label: "화물배송" },
              { value: "08", label: "매장직접수령" },
              { value: "09", label: "배송필요 없음" },
            ],
          },
          { key: "shipping_period", label: "배송기간", kind: "textarea" },
          { key: "shipping_area", label: "배송지역" },
          {
            key: "shipping_fee_type",
            label: "배송비",
            kind: "select",
            options: [
              { value: "T", label: "배송비 무료" },
              { value: "R", label: "고정배송비 사용" },
              { value: "M", label: "구매 금액에 따른 부과" },
              { value: "D", label: "구매 금액별 차등 배송료 사용" },
              { value: "W", label: "상품 무게별 차등 배송료 사용" },
              { value: "C", label: "상품 수량별 차등 배송료 사용" },
              { value: "N", label: "상품 수량에 비례하여 배송료 부과" },
            ],
          },
          { key: "shipping_rates", label: "배송비 금액" },
          {
            key: "prepaid_shipping_fee",
            label: "배송비 선결제 설정",
            kind: "select",
            options: [
              { value: "C", label: "착불" },
              { value: "P", label: "선결제" },
              { value: "B", label: "선결제/착불" },
            ],
          },
          { key: "product_weight", label: "상품 중량" },
          { key: "hscode", label: "HS 코드" },
          { key: "country_hscode", label: "국가별 HS 코드", kind: "textarea" },
          { key: "clearance_category_code", label: "해외통관코드" },
          { key: "product_material", label: "상품 소재" },
          { key: "english_product_material", label: "영문 상품 소재" },
          {
            key: "translate_product_material",
            label: "상품 소재 번역",
            kind: "select",
            options: [
              { value: "T", label: "사용함" },
              { value: "F", label: "사용안함" },
            ],
          },
          { key: "cloth_fabric", label: "옷감" },
          {
            key: "product_shipping_type",
            label: "상품 배송유형",
            kind: "select",
            options: [
              { value: "D", label: "사입배송" },
              { value: "C", label: "직접배송" },
              { value: "E", label: "기타(창고/위탁)" },
            ],
          },
        ],
      },
      {
        title: "추가구성상품",
        fields: [],
      },
      {
        title: "관련상품",
        fields: [
          { key: "relational_product", label: "관련상품", kind: "textarea" },
        ],
      },

      {
        title: "기타",
        fields: [
          { key: "mall_id", label: "Mall ID", required: true },
          { key: "shop_no", label: "shop_no", kind: "number" },
          { key: "product_used_month", label: "중고상품 사용 개월" },
          {
            key: "add_category_no",
            label: "추가 분류 번호(add_category_no)",
            kind: "textarea",
          },
          {
            key: "options",
            label: "옵션(options)",
            kind: "textarea",
          },
          { key: "soldout_message", label: "품절표시 문구" },
          { key: "price_excluding_tax", label: "상품가(세금 제외)" },
          {
            key: "buy_group_list",
            label: "구매가능 회원 등급",
            kind: "textarea",
          },
          {
            key: "buy_member_id_list",
            label: "구매가능 회원아이디",
            kind: "textarea",
          },
          {
            key: "repurchase_restriction",
            label: "재구매 제한",
            kind: "select",
            options: [
              { value: "T", label: "재구매 불가" },
              { value: "F", label: "제한안함" },
            ],
          },
          { key: "points_amount", label: "적립금 설정 정보", kind: "textarea" },
          {
            key: "except_member_points",
            label: "회원등급 추가 적립 제외",
            kind: "select",
            options: [
              { value: "T", label: "회원등급 추가 적립 제외 설정함" },
              { value: "F", label: "회원등급 추가 적립 제외 설정안함" },
            ],
          },
        ],
      },
      {
        title: "결제/이미지 설정",
        fields: [
          {
            key: "use_naverpay",
            label: "네이버페이 사용여부",
            kind: "select",
            options: [
              { value: "T", label: "사용함" },
              { value: "F", label: "사용안함" },
            ],
          },
          {
            key: "naverpay_type",
            label: "네이버페이 판매타입",
            kind: "select",
            options: [
              { value: "C", label: "네이버페이 + 쇼핑몰 동시판매 상품" },
              { value: "O", label: "네이버페이 전용상품" },
            ],
          },
          {
            key: "use_kakaopay",
            label: "카카오페이 사용여부",
            kind: "select",
            options: [
              { value: "T", label: "사용함" },
              { value: "F", label: "사용안함" },
            ],
          },
          {
            key: "translated_description",
            label: "상품상세설명 번역정보",
            kind: "textarea",
          },
          { key: "product_tag", label: "상품 검색어", kind: "textarea" },
          {
            key: "exposure_group_list",
            label: "표시대상 회원 등급",
            kind: "textarea",
          },
          // { key: "main", label: "메인진열", kind: "textarea" },
          {
            key: "cultural_tax_deduction",
            label: "문화비 소득공제",
            kind: "select",
            options: [
              { value: "T", label: "사용함" },
              { value: "F", label: "사용안함" },
            ],
          },
          // { key: "size_guide", label: "사이즈 가이드", kind: "textarea" },
          {
            key: "additional_information",
            label: "추가항목",
            kind: "textarea",
          },
        ],
      },
    ],
    []
  );

  const inputClassName = "rounded-none text-sm py-2";
  const optionClassName =
    "flex items-center gap-2 text-sm text-gray-700 border border-gray-200 px-3 py-2 rounded-none";

  const renderField = (field: FieldConfig) => {
    const value = formData[field.key] ?? "";
    const commonProps = {
      required: field.required,
    };
    const labelNode = (
      <label className="text-sm font-medium text-gray-700 pt-2">
        {field.label}
        {field.required && <span className="text-red-500 ml-1">*</span>}
      </label>
    );

    if (field.key === "tax_rate") {
      return (
        <div
          key={field.key}
          className="grid grid-cols-[160px_1fr] gap-3 items-start"
        >
          {labelNode}
          <div className="relative">
            <input
              type="number"
              value={value}
              onChange={(e) => handleChange(field.key, e.target.value)}
              className={`w-full border focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${inputClassName} px-4 pr-8`}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">
              %
            </span>
          </div>
        </div>
      );
    }

    if (field.kind === "textarea") {
      return (
        <div
          key={field.key}
          className="grid grid-cols-[160px_1fr] gap-3 items-start"
        >
          {labelNode}
          <Textarea
            {...commonProps}
            value={value}
            className={inputClassName}
            rows={6}
            onChange={(e) => handleChange(field.key, e.target.value)}
          />
        </div>
      );
    }

    if (field.kind === "select" && field.options) {
      return (
        <div
          key={field.key}
          className="grid grid-cols-[160px_1fr] gap-3 items-start"
        >
          {labelNode}
          <div className="flex flex-wrap gap-2">
            {field.options.map((option) => (
              <label key={option.value} className={optionClassName}>
                <input
                  type="radio"
                  name={field.key}
                  value={option.value}
                  checked={value === option.value}
                  onChange={() => handleChange(field.key, option.value)}
                  className="h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
        </div>
      );
    }

    return (
      <div
        key={field.key}
        className="grid grid-cols-[160px_1fr] gap-3 items-start"
      >
        {labelNode}
        <Input
          {...commonProps}
          value={value}
          type={field.kind === "number" ? "number" : "text"}
          placeholder={field.placeholder}
          className={inputClassName}
          onChange={(e) => handleChange(field.key, e.target.value)}
        />
      </div>
    );
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
      <PageHeader
        actions={
          <Button icon={Save} onClick={handleSubmit} loading={submitting}>
            Cafe24 등록
          </Button>
        }
      />

      <Card>
        <CardHeader>등록 안내</CardHeader>
        <CardContent className="text-sm text-gray-600">
          상품 등록은 직접 Cafe24 관리자에서 진행하는 것을 권장합니다.
        </CardContent>
      </Card>

      {fieldGroups.map((group) => (
        <Card key={group.title}>
          <CardHeader>{group.title}</CardHeader>
          <CardContent>
            <div className="grid grid-cols-1">
              {group.fields.map((field, index) => (
                <div
                  key={field.key}
                  className={`py-3 ${
                    index !== group.fields.length - 1
                      ? "border-b border-gray-200"
                      : ""
                  }`}
                >
                  {renderField(field)}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}

      <Card>
        <CardHeader>요청 결과</CardHeader>
        <CardContent className="space-y-3">
          {submitError && <p className="text-sm text-red-600">{submitError}</p>}
          {submitResult && (
            <pre className="text-xs bg-gray-50 p-4 border border-gray-200 overflow-auto">
              {JSON.stringify(submitResult, null, 2)}
            </pre>
          )}
          {!submitResult && !submitError && (
            <p className="text-sm text-gray-500">
              등록 버튼을 누르면 응답을 여기에 표시합니다.
            </p>
          )}
        </CardContent>
      </Card>
      </div>
    </div>
  );
};

export default ProductRegisterPage;
