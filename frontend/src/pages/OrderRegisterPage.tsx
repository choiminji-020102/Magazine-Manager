import React, { useState } from "react";
import { Save, Plus, X, Search, MapPin, Minus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import Button from "../components/common/Button";
import Card from "../components/common/Card";
import Input from "../components/common/Input";
import Textarea from "../components/common/Textarea";
import Select from "../components/common/Select";
import Alert from "../components/common/Alert";
import Badge from "../components/common/Badge";
import Breadcrumb from "../components/common/Breadcrumb";
import {
  OrderChannel,
  OrderStatus,
  ORDER_CHANNEL_LABELS,
  ORDER_STATUS_LABELS,
} from "../utils/constants";
import { Customer } from "../api/customersApi";

interface Product {
  product_id: number;
  product_code: string;
  product_kind: "YEARLY" | "MONTHLY" | "SINGLE";
  product_name: string;
  price: number;
  sale: number;
  purchase: number;
  stock_quantity: number;
  is_active: boolean;
  external_product_code_cafe24: string | null;
  external_product_code_gpmall: string | null;
  created_at: string;
  updated_at: string;
}

interface OrderProduct {
  product_id: number;
  product_code: string;
  product_kind: "YEARLY" | "MONTHLY" | "SINGLE";
  product_name: string;
  price: number;
  sale: number;
  order_num: number;
  subscribe_start_issue: string | null;
  subscribe_end_issue: string | null;
  issue: string | null; // MONTHLY용 단일 호수
  address_id: number | null;
}

interface AddressForm {
  address_name: string;
  phone: string;
  nation: string;
  postal_code: string;
  address1: string;
  address2: string;
  address_memo: string;
}

const PRODUCT_KIND_OPTIONS = [
  { value: "YEARLY", label: "연간" },
  { value: "MONTHLY", label: "월간" },
  { value: "SINGLE", label: "단품" },
];

const PAYMENT_METHOD_OPTIONS = ["카드결제", "계좌이체", "무통장입금", "기타"];

const SOURCE_OPTIONS = ["CAFE24", "GPMALL", "OFFLINE", "기타"];

// 목업 상품 데이터 (실제로는 API에서 가져옴)
const mockProducts: Product[] = [
  // 정기구독 상품 (YEARLY)
  {
    product_id: 1,
    product_code: "YEARLY-2603-BASIC",
    product_kind: "YEARLY",
    product_name: "1년 정기구독 - 26년 3월호 시작 말씀함께[기본판]",
    price: 144000,
    sale: 144000,
    purchase: 0,
    stock_quantity: 0,
    is_active: true,
    external_product_code_cafe24: "CAFE24-Y2603-BASIC",
    external_product_code_gpmall: null,
    created_at: "2024-01-15T00:00:00",
    updated_at: "2024-12-08T00:00:00",
  },
  {
    product_id: 2,
    product_code: "YEARLY-2603-LARGE",
    product_kind: "YEARLY",
    product_name: "1년 정기구독 - 26년 3월호 시작 말씀함께[큰글자판]",
    price: 144000,
    sale: 144000,
    purchase: 0,
    stock_quantity: 0,
    is_active: true,
    external_product_code_cafe24: "CAFE24-Y2603-LARGE",
    external_product_code_gpmall: null,
    created_at: "2024-01-15T00:00:00",
    updated_at: "2024-12-08T00:00:00",
  },
  {
    product_id: 3,
    product_code: "YEARLY-2603-CHILD-HIGH",
    product_kind: "YEARLY",
    product_name:
      "1년 정기구독 - 26년 3월호 시작 어린이 말씀함께 [고학년 4~6학년]",
    price: 144000,
    sale: 144000,
    purchase: 50000,
    stock_quantity: 60,
    is_active: true,
    external_product_code_cafe24: "CAFE24-Y2603-CHILD-HIGH",
    external_product_code_gpmall: null,
    created_at: "2024-01-15T00:00:00",
    updated_at: "2024-12-08T00:00:00",
  },
  {
    product_id: 4,
    product_code: "YEARLY-2603-CHILD-LOW",
    product_kind: "YEARLY",
    product_name:
      "1년 정기구독 - 26년 3월호 시작 어린이 말씀함께 [저학년 1~3학년]",
    price: 144000,
    sale: 144000,
    purchase: 0,
    stock_quantity: 0,
    is_active: true,
    external_product_code_cafe24: "CAFE24-Y2603-CHILD-LOW",
    external_product_code_gpmall: null,
    created_at: "2024-01-15T00:00:00",
    updated_at: "2024-12-08T00:00:00",
  },
  {
    product_id: 5,
    product_code: "YEARLY-2603-YOUTH",
    product_kind: "YEARLY",
    product_name: "1년 정기구독 - 26년 3월호 시작 청소년 말씀함께",
    price: 144000,
    sale: 144000,
    purchase: 0,
    stock_quantity: 0,
    is_active: true,
    external_product_code_cafe24: "CAFE24-Y2603-YOUTH",
    external_product_code_gpmall: null,
    created_at: "2024-01-15T00:00:00",
    updated_at: "2024-12-08T00:00:00",
  },
  {
    product_id: 6,
    product_code: "YEARLY-2603-KKULDDANG",
    product_kind: "YEARLY",
    product_name: "1년 정기구독 - 26년 3월호 시작 꿀땅 [미취학부]",
    price: 144000,
    sale: 144000,
    purchase: 0,
    stock_quantity: 0,
    is_active: true,
    external_product_code_cafe24: "CAFE24-Y2603-KKULDDANG",
    external_product_code_gpmall: null,
    created_at: "2024-01-15T00:00:00",
    updated_at: "2024-12-08T00:00:00",
  },
  // 단품 상품 (MONTHLY) - 26년 2월호
  {
    product_id: 7,
    product_code: "SINGLE-2602-BASIC",
    product_kind: "MONTHLY",
    product_name: "단품 - 26년 2월호 말씀함께 [기본판]",
    price: 15000,
    sale: 15000,
    purchase: 5000,
    stock_quantity: 200,
    is_active: true,
    external_product_code_cafe24: "CAFE24-S2602-BASIC",
    external_product_code_gpmall: null,
    created_at: "2024-01-20T00:00:00",
    updated_at: "2024-12-08T00:00:00",
  },
  {
    product_id: 8,
    product_code: "SINGLE-2602-LARGE",
    product_kind: "MONTHLY",
    product_name: "단품 - 26년 2월호 말씀함께 [큰글자판]",
    price: 15000,
    sale: 15000,
    purchase: 5000,
    stock_quantity: 150,
    is_active: true,
    external_product_code_cafe24: "CAFE24-S2602-LARGE",
    external_product_code_gpmall: null,
    created_at: "2024-01-20T00:00:00",
    updated_at: "2024-12-08T00:00:00",
  },
  {
    product_id: 9,
    product_code: "SINGLE-2602-CHILD-LOW",
    product_kind: "MONTHLY",
    product_name: "단품 - 26년 2월호 어린이 말씀함께 [저학년 1~3학년]",
    price: 15000,
    sale: 15000,
    purchase: 5000,
    stock_quantity: 120,
    is_active: true,
    external_product_code_cafe24: "CAFE24-S2602-CHILD-LOW",
    external_product_code_gpmall: null,
    created_at: "2024-01-20T00:00:00",
    updated_at: "2024-12-08T00:00:00",
  },
  {
    product_id: 10,
    product_code: "SINGLE-2602-CHILD-HIGH",
    product_kind: "MONTHLY",
    product_name: "단품 - 26년 2월호 어린이 말씀함께 [고학년 4~6학년]",
    price: 15000,
    sale: 15000,
    purchase: 5000,
    stock_quantity: 110,
    is_active: true,
    external_product_code_cafe24: "CAFE24-S2602-CHILD-HIGH",
    external_product_code_gpmall: null,
    created_at: "2024-01-20T00:00:00",
    updated_at: "2024-12-08T00:00:00",
  },
  {
    product_id: 11,
    product_code: "SINGLE-2602-YOUTH",
    product_kind: "MONTHLY",
    product_name: "단품 - 26년 2월호 청소년 말씀함께",
    price: 15000,
    sale: 15000,
    purchase: 5000,
    stock_quantity: 90,
    is_active: true,
    external_product_code_cafe24: "CAFE24-S2602-YOUTH",
    external_product_code_gpmall: null,
    created_at: "2024-01-20T00:00:00",
    updated_at: "2024-12-08T00:00:00",
  },
  {
    product_id: 12,
    product_code: "SINGLE-2602-KKULDDANG",
    product_kind: "MONTHLY",
    product_name: "단품 - 26년 2월호 꿀땅 [미취학부]",
    price: 15000,
    sale: 15000,
    purchase: 5000,
    stock_quantity: 80,
    is_active: true,
    external_product_code_cafe24: "CAFE24-S2602-KKULDDANG",
    external_product_code_gpmall: null,
    created_at: "2024-01-20T00:00:00",
    updated_at: "2024-12-08T00:00:00",
  },
  // 단품 상품 (MONTHLY) - 26년 1월호
  {
    product_id: 13,
    product_code: "SINGLE-2601-BASIC",
    product_kind: "MONTHLY",
    product_name: "단품 - 26년 1월호 말씀함께 [기본판]",
    price: 15000,
    sale: 15000,
    purchase: 5000,
    stock_quantity: 180,
    is_active: true,
    external_product_code_cafe24: "CAFE24-S2601-BASIC",
    external_product_code_gpmall: null,
    created_at: "2024-12-01T00:00:00",
    updated_at: "2024-12-08T00:00:00",
  },
  {
    product_id: 14,
    product_code: "SINGLE-2601-LARGE",
    product_kind: "MONTHLY",
    product_name: "단품 - 26년 1월호 말씀함께 [큰글자판]",
    price: 15000,
    sale: 15000,
    purchase: 5000,
    stock_quantity: 130,
    is_active: true,
    external_product_code_cafe24: "CAFE24-S2601-LARGE",
    external_product_code_gpmall: null,
    created_at: "2024-12-01T00:00:00",
    updated_at: "2024-12-08T00:00:00",
  },
  {
    product_id: 15,
    product_code: "SINGLE-2601-YOUTH",
    product_kind: "MONTHLY",
    product_name: "단품 - 26년 1월호 청소년 말씀함께",
    price: 15000,
    sale: 15000,
    purchase: 5000,
    stock_quantity: 85,
    is_active: true,
    external_product_code_cafe24: "CAFE24-S2601-YOUTH",
    external_product_code_gpmall: null,
    created_at: "2024-12-01T00:00:00",
    updated_at: "2024-12-08T00:00:00",
  },
  {
    product_id: 16,
    product_code: "SINGLE-2601-CHILD-LOW",
    product_kind: "MONTHLY",
    product_name: "단품 - 26년 1월호 어린이 말씀함께 [저학년 1~3학년]",
    price: 15000,
    sale: 15000,
    purchase: 5000,
    stock_quantity: 100,
    is_active: true,
    external_product_code_cafe24: "CAFE24-S2601-CHILD-LOW",
    external_product_code_gpmall: null,
    created_at: "2024-12-01T00:00:00",
    updated_at: "2024-12-08T00:00:00",
  },
  {
    product_id: 17,
    product_code: "SINGLE-2601-CHILD-HIGH",
    product_kind: "MONTHLY",
    product_name: "단품 - 26년 1월호 어린이 말씀함께 [고학년 4~6학년]",
    price: 15000,
    sale: 15000,
    purchase: 5000,
    stock_quantity: 95,
    is_active: true,
    external_product_code_cafe24: "CAFE24-S2601-CHILD-HIGH",
    external_product_code_gpmall: null,
    created_at: "2024-12-01T00:00:00",
    updated_at: "2024-12-08T00:00:00",
  },
  {
    product_id: 18,
    product_code: "SINGLE-2601-KKULDDANG",
    product_kind: "MONTHLY",
    product_name: "단품 - 26년 1월호 꿀땅 [미취학부]",
    price: 15000,
    sale: 15000,
    purchase: 5000,
    stock_quantity: 75,
    is_active: true,
    external_product_code_cafe24: "CAFE24-S2601-KKULDDANG",
    external_product_code_gpmall: null,
    created_at: "2024-12-01T00:00:00",
    updated_at: "2024-12-08T00:00:00",
  },
];

// 목업 고객 데이터 (실제로는 API에서 가져옴)
const mockCustomers: Customer[] = [
  {
    customer_id: 1,
    customer_name: "김민수",
    customer_phone: "010-1234-5678",
    customer_phone_num4: "5678",
    customer_email: "minsu.kim@example.com",
    create_channel: "CAFE24",
    admin_memo: null,
    last_order_at: "2024-12-08T00:00:00",
    created_at: "2024-01-15T00:00:00",
    updated_at: "2024-12-08T00:00:00",
    deleted_at: null,
  },
  {
    customer_id: 2,
    customer_name: "이영희",
    customer_phone: "010-2345-6789",
    customer_phone_num4: "6789",
    customer_email: "younghee.lee@example.com",
    create_channel: "GPMALL",
    admin_memo: null,
    last_order_at: "2024-12-05T00:00:00",
    created_at: "2024-02-20T00:00:00",
    updated_at: "2024-12-05T00:00:00",
    deleted_at: null,
  },
  {
    customer_id: 3,
    customer_name: "박철수",
    customer_phone: "010-3456-7890",
    customer_phone_num4: "7890",
    customer_email: "chulsoo.park@example.com",
    create_channel: "OFFLINE",
    admin_memo: null,
    last_order_at: "2024-11-28T00:00:00",
    created_at: "2024-03-10T00:00:00",
    updated_at: "2024-11-28T00:00:00",
    deleted_at: null,
  },
];

const OrderRegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // 고객 정보
  const [customerSearch, setCustomerSearch] = useState("");
  const [searchResults, setSearchResults] = useState<Customer[]>([]);
  const [customerForm, setCustomerForm] = useState({
    customer_name: "",
    customer_phone: "",
    customer_email: "",
    create_channel: "CAFE24" as "CAFE24" | "GPMALL" | "OFFLINE",
    admin_memo: "",
  });

  // 주문 정보
  const [orderChannel, setOrderChannel] = useState<OrderChannel>("CAFE24");
  const [orderStatus, setOrderStatus] = useState<OrderStatus>("ORDERED");
  const [orderAt, setOrderAt] = useState(
    new Date().toISOString().slice(0, 16)
  );
  const [paymentAt, setPaymentAt] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("카드결제");

  // 상품 정보
  const [products, setProducts] = useState<OrderProduct[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [productSearchResults, setProductSearchResults] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [newProduct, setNewProduct] = useState<Partial<OrderProduct>>({
    order_num: 1,
    subscribe_start_issue: null,
    subscribe_end_issue: null,
    issue: null,
    address_id: null,
  });

  // 배송지 정보 (주문 기본 배송지)
  const [orderAddress, setOrderAddress] = useState<AddressForm>({
    address_name: "",
    phone: "",
    nation: "대한민국",
    postal_code: "",
    address1: "",
    address2: "",
    address_memo: "",
  });

  // 결제 정보
  const [discountAmount, setDiscountAmount] = useState(0);
  const [sendFee, setSendFee] = useState(0);
  const [requestMemo, setRequestMemo] = useState("");
  const [adminMemo, setAdminMemo] = useState("");

  // 고객 검색
  const handleCustomerSearch = () => {
    if (!customerSearch.trim()) {
      setSearchResults([]);
      return;
    }
    // 실제로는 API 호출
    const filtered = mockCustomers.filter(
      (c) =>
        c.customer_name.includes(customerSearch) ||
        c.customer_phone.includes(customerSearch)
    );
    setSearchResults(filtered);
  };

  // 고객 선택
  const handleSelectCustomer = (customer: Customer) => {
    setCustomerForm({
      customer_name: customer.customer_name,
      customer_phone: customer.customer_phone,
      customer_email: customer.customer_email || "",
      create_channel: customer.create_channel,
      admin_memo: customer.admin_memo || "",
    });
    setSearchResults([]);
    setCustomerSearch("");
  };

  // 상품 검색
  const handleProductSearch = () => {
    if (!productSearch.trim()) {
      setProductSearchResults([]);
      return;
    }
    // 실제로는 API 호출
    const searchTerm = productSearch.trim().toLowerCase();
    try {
      const filtered = mockProducts.filter(
        (p) =>
          p.product_name.toLowerCase().includes(searchTerm) ||
          p.product_code.toLowerCase().includes(searchTerm)
      );
      setProductSearchResults(filtered);
    } catch (error) {
      console.error('Error searching products:', error);
      setError("상품 검색 중 오류가 발생했습니다.");
    }
  };

  // 상품 선택
  const handleSelectProduct = (product: Product) => {
    setSelectedProduct(product);
    setNewProduct({
      order_num: 1,
      subscribe_start_issue: null,
      subscribe_end_issue: null,
      issue: null,
      address_id: null,
    });
    setProductSearchResults([]);
    setProductSearch("");
  };

  // 우편번호 검색
  const handlePostcodeSearch = () => {
    if (typeof window !== "undefined" && (window as any).daum?.Postcode) {
      new (window as any).daum.Postcode({
        oncomplete: function (data: any) {
          let addr = "";
          if (data.userSelectedType === "R") {
            addr = data.roadAddress;
          } else {
            addr = data.jibunAddress;
          }
          setOrderAddress({
            ...orderAddress,
            postal_code: data.zonecode,
            address1: addr,
            address2: "",
          });
        },
      }).open();
    } else {
      alert(
        "우편번호 검색 서비스를 불러올 수 없습니다. 페이지를 새로고침해주세요."
      );
    }
  };

  const handleAddProduct = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    setError("");
    setSuccess("");
    
    console.log("handleAddProduct called", { selectedProduct, newProduct });
    
    // 검증
    if (!selectedProduct) {
      setError("상품을 검색하여 선택해주세요.");
      return;
    }
    if (!newProduct.order_num || newProduct.order_num < 1) {
      setError("수량은 1개 이상이어야 합니다.");
      return;
    }
    
    // 상품 종류별 검증
    if (selectedProduct.product_kind === "YEARLY") {
      const startIssue = newProduct.subscribe_start_issue?.trim();
      const endIssue = newProduct.subscribe_end_issue?.trim();
      if (!startIssue) {
        setError("구독 시작 호를 입력해주세요.");
        return;
      }
      if (!endIssue) {
        setError("구독 종료 호를 입력해주세요.");
        return;
      }
    } else if (selectedProduct.product_kind === "MONTHLY") {
      const issue = newProduct.issue?.trim();
      if (!issue) {
        setError("호수를 입력해주세요.");
        return;
      }
    }
    
    // 상품 추가
    const orderProduct: OrderProduct = {
      product_id: selectedProduct.product_id,
      product_code: selectedProduct.product_code,
      product_kind: selectedProduct.product_kind,
      product_name: selectedProduct.product_name,
      price: selectedProduct.price,
      sale: selectedProduct.sale,
      order_num: newProduct.order_num || 1,
      subscribe_start_issue: selectedProduct.product_kind === "YEARLY" ? (newProduct.subscribe_start_issue?.trim() || null) : null,
      subscribe_end_issue: selectedProduct.product_kind === "YEARLY" ? (newProduct.subscribe_end_issue?.trim() || null) : null,
      issue: selectedProduct.product_kind === "MONTHLY" ? (newProduct.issue?.trim() || null) : null,
      address_id: null,
    };
    
    console.log("Adding product:", orderProduct);
    setProducts([...products, orderProduct]);
    setSelectedProduct(null);
    setNewProduct({
      order_num: 1,
      subscribe_start_issue: null,
      subscribe_end_issue: null,
      issue: null,
      address_id: null,
    });
    setProductSearch("");
    setProductSearchResults([]);
    setSuccess("상품이 추가되었습니다.");
  };

  const handleRemoveProduct = (index: number) => {
    setProducts(products.filter((_, i) => i !== index));
  };

  // 총액 계산
  const totalAmount = products.reduce(
    (sum, p) => sum + (p.price - p.sale) * p.order_num,
    0
  );
  const finalPaymentAmount = totalAmount - discountAmount + sendFee;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    // 고객 정보 검증
    if (!customerForm.customer_name || !customerForm.customer_phone) {
      setError("고객 이름과 연락처는 필수입니다.");
      return;
    }

    if (products.length === 0) {
      setError("최소 1개 이상의 상품을 추가해주세요.");
      return;
    }

    if (
      !orderAddress.address_name ||
      !orderAddress.phone ||
      !orderAddress.postal_code ||
      !orderAddress.address1
    ) {
      setError("배송지 정보를 모두 입력해주세요.");
      return;
    }

    try {
      // 실제로는 API 호출
      // await orderAPI.create({ ...formData, order_items: products });
      setSuccess("주문이 등록되었습니다.");
      setTimeout(() => {
        navigate("/order/list");
      }, 1500);
    } catch (err: any) {
      setError(err?.message || "주문 등록에 실패했습니다.");
    }
  };

  return (
    <div className="min-h-screen">
      <div className="max-w-[1600px] mx-auto px-6 py-6">
        <Breadcrumb
          items={[
            { label: "주문 관리", path: "/order/list" },
            { label: "주문 등록" },
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

        <form onSubmit={handleSubmit} className="space-y-6">
            {/* 고객 정보 */}
          <Card className="unified-card">
            <div className="p-6 space-y-4">
              <h3 className="text-sm font-semibold text-ink mb-4 uppercase tracking-wide">
                고객 정보
              </h3>

              {/* 고객 검색 */}
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted" />
                  <input
                    type="text"
                    placeholder="고객명, 연락처로 검색..."
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleCustomerSearch();
                      }
                    }}
                    className="unified-input pl-10 w-full"
                  />
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={handleCustomerSearch}
                >
                  검색
                </Button>
              </div>

              {/* 검색 결과 */}
              {searchResults.length > 0 && (
                <div className="border border-line rounded-lg overflow-hidden">
                  <div className="max-h-60 overflow-y-auto">
                    {searchResults.map((customer) => (
                      <div
                        key={customer.customer_id}
                        className="p-3 border-b border-line last:border-b-0 hover:bg-neutral-50 cursor-pointer transition-colors"
                        onClick={() => handleSelectCustomer(customer)}
                      >
                        <p className="text-sm text-ink">
                          <span className="font-medium">
                            {customer.customer_name}
                          </span>{" "}
                          <span className="text-muted">
                            {customer.customer_phone}
                          </span>
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 수동 입력 폼 */}
              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-line">
                  <Input
                  label="이름"
                    type="text"
                  value={customerForm.customer_name}
                    onChange={(e) =>
                    setCustomerForm({
                      ...customerForm,
                      customer_name: e.target.value,
                    })
                    }
                    required
                  placeholder="홍길동"
                  />
                  <Input
                  label="연락처"
                    type="tel"
                  value={customerForm.customer_phone}
                    onChange={(e) =>
                    setCustomerForm({
                      ...customerForm,
                      customer_phone: e.target.value,
                    })
                    }
                    required
                    placeholder="010-0000-0000"
                  />
                  <Input
                  label="이메일"
                    type="email"
                  value={customerForm.customer_email}
                    onChange={(e) =>
                    setCustomerForm({
                      ...customerForm,
                      customer_email: e.target.value,
                    })
                    }
                    placeholder="email@example.com"
                  />
                <Select
                  label="유입 경로"
                  value={customerForm.create_channel}
                    onChange={(e) =>
                    setCustomerForm({
                      ...customerForm,
                      create_channel: e.target.value as
                        | "CAFE24"
                        | "GPMALL"
                        | "OFFLINE",
                    })
                  }
                  required
                  options={SOURCE_OPTIONS.map((source) => ({
                    value: source,
                    label:
                      source === "CAFE24"
                        ? "Cafe24"
                        : source === "GPMALL"
                        ? "갓피플몰"
                        : source === "OFFLINE"
                        ? "오프라인"
                        : source,
                  }))}
                />
                <div className="col-span-2">
                  <Textarea
                    label="관리자 메모"
                    value={customerForm.admin_memo}
                    onChange={(e) =>
                      setCustomerForm({
                        ...customerForm,
                        admin_memo: e.target.value,
                      })
                    }
                    placeholder="관리자 메모를 입력하세요"
                    rows={2}
                  />
                </div>
              </div>
            </div>
          </Card>

            {/* 상품 정보 */}
          <Card className="unified-card">
            <div className="p-6 space-y-4">
              <h3 className="text-sm font-semibold text-ink mb-4 uppercase tracking-wide">
                상품 정보
              </h3>

              {/* 상품 검색 */}
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted" />
                  <input
                    type="text"
                    placeholder="상품명, 상품 코드로 검색..."
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleProductSearch();
                      }
                    }}
                    className="unified-input pl-10 w-full"
                  />
                    </div>
                    <Button
                      type="button"
                  variant="secondary"
                      size="sm"
                  onClick={handleProductSearch}
                    >
                  검색
                    </Button>
                  </div>

              {/* 검색 결과 */}
              {productSearchResults.length > 0 && !selectedProduct && (
                <div className="border border-line rounded-lg overflow-hidden">
                  <div className="max-h-60 overflow-y-auto">
                    {productSearchResults.map((product) => (
                      <div
                        key={product.product_id}
                        className="p-3 border-b border-line last:border-b-0 hover:bg-neutral-50 cursor-pointer transition-colors"
                        onClick={() => handleSelectProduct(product)}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-ink">
                              {product.product_name}
                            </p>
                            <p className="text-xs text-muted mt-1">
                              {product.product_code}
                            </p>
                          </div>
                          <Badge
                            variant={
                              product.product_kind === "YEARLY"
                                ? "info"
                                : product.product_kind === "MONTHLY"
                                ? "success"
                                : "default"
                            }
                            size="sm"
                          >
                            {product.product_kind === "YEARLY"
                              ? "연간"
                              : product.product_kind === "MONTHLY"
                              ? "월간"
                              : "단품"}
                          </Badge>
                        </div>
                      </div>
                    ))}
                    </div>
                </div>
              )}

              {/* 선택된 상품 정보 및 입력 폼 */}
              {selectedProduct && (
                <div className="p-4 bg-paper rounded-lg border border-line space-y-4">
                  <div className="flex items-center gap-3">
                    <Badge
                      variant={
                        selectedProduct.product_kind === "YEARLY"
                          ? "info"
                          : selectedProduct.product_kind === "MONTHLY"
                          ? "success"
                          : "default"
                      }
                      size="sm"
                    >
                      {selectedProduct.product_kind === "YEARLY"
                        ? "연간"
                        : selectedProduct.product_kind === "MONTHLY"
                        ? "월간"
                        : "단품"}
                    </Badge>
                    <div className="flex-1">
                      <h4 className="font-semibold text-ink">
                        {selectedProduct.product_name}
                      </h4>
                      <p className="text-sm text-muted mt-1">
                        {selectedProduct.product_code}
                      </p>
                    </div>
                  </div>

                  {selectedProduct.product_kind === "YEARLY" && (
                    <div className="grid grid-cols-2 gap-4">
                      {/* 첫 번째 행: 판매가, 수량 */}
                    <div>
                        <p className="text-xs text-muted mb-1">판매가</p>
                        <p className="text-sm font-medium text-ink">
                          {selectedProduct.sale.toLocaleString()}원
                        </p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-muted mb-2 uppercase tracking-wider text-xs">
                          수량 <span className="text-red-500 ml-1">*</span>
                      </label>
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            icon={Minus}
                            onClick={() =>
                              setNewProduct({
                                ...newProduct,
                                order_num: Math.max(1, (newProduct.order_num || 1) - 1),
                              })
                            }
                            disabled={(newProduct.order_num || 1) <= 1}
                            className="h-9 w-9 p-0"
                          />
                          <div className="flex-1">
                            <input
                        type="number"
                        min="1"
                              value={newProduct.order_num || 1}
                        onChange={(e) =>
                          setNewProduct({
                            ...newProduct,
                                  order_num: Math.max(1, parseInt(e.target.value) || 1),
                          })
                        }
                              className="w-full h-9 px-3 text-center text-sm font-medium text-ink border border-line rounded-md focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent"
                      />
                    </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            icon={Plus}
                            onClick={() =>
                              setNewProduct({
                                ...newProduct,
                                order_num: (newProduct.order_num || 1) + 1,
                              })
                            }
                            className="h-9 w-9 p-0"
                          />
                        </div>
                      </div>
                      {/* 두 번째 행: 구독 시작 호, 구독 종료 호 */}
                      <Input
                        label="구독 시작 호"
                        type="text"
                        value={newProduct.subscribe_start_issue || ""}
                        onChange={(e) =>
                          setNewProduct({
                            ...newProduct,
                            subscribe_start_issue: e.target.value || null,
                          })
                        }
                        placeholder="202503"
                        required
                      />
                      <Input
                        label="구독 종료 호"
                        type="text"
                        value={newProduct.subscribe_end_issue || ""}
                        onChange={(e) =>
                          setNewProduct({
                            ...newProduct,
                            subscribe_end_issue: e.target.value || null,
                          })
                        }
                        placeholder="202602"
                        required
                      />
                    </div>
                  )}

                  {selectedProduct.product_kind === "MONTHLY" && (
                    <div className="grid grid-cols-2 gap-4">
                      {/* 첫 번째 행: 판매가, 수량 */}
                    <div>
                        <p className="text-xs text-muted mb-1">판매가</p>
                        <p className="text-sm font-medium text-ink">
                          {selectedProduct.sale.toLocaleString()}원
                        </p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-muted mb-2 uppercase tracking-wider text-xs">
                          수량 <span className="text-red-500 ml-1">*</span>
                      </label>
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            icon={Minus}
                            onClick={() =>
                              setNewProduct({
                                ...newProduct,
                                order_num: Math.max(1, (newProduct.order_num || 1) - 1),
                              })
                            }
                            disabled={(newProduct.order_num || 1) <= 1}
                            className="h-9 w-9 p-0"
                          />
                          <div className="flex-1">
                            <input
                        type="number"
                              min="1"
                              value={newProduct.order_num || 1}
                        onChange={(e) =>
                          setNewProduct({
                            ...newProduct,
                                  order_num: Math.max(1, parseInt(e.target.value) || 1),
                          })
                        }
                              className="w-full h-9 px-3 text-center text-sm font-medium text-ink border border-line rounded-md focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent"
                      />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    icon={Plus}
                            onClick={() =>
                              setNewProduct({
                                ...newProduct,
                                order_num: (newProduct.order_num || 1) + 1,
                              })
                            }
                            className="h-9 w-9 p-0"
                          />
                </div>
              </div>
                      {/* 두 번째 행: 호수 */}
                      <Input
                        label="호수"
                        type="text"
                        value={newProduct.issue || ""}
                        onChange={(e) =>
                          setNewProduct({
                            ...newProduct,
                            issue: e.target.value || null,
                          })
                        }
                        placeholder="202502"
                        required
                      />
            </div>
                  )}

                  {selectedProduct.product_kind === "SINGLE" && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                        <p className="text-xs text-muted mb-1">판매가</p>
                        <p className="text-sm font-medium text-ink">
                          {selectedProduct.sale.toLocaleString()}원
                        </p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-muted mb-2 uppercase tracking-wider text-xs">
                          수량 <span className="text-red-500 ml-1">*</span>
                  </label>
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            icon={Minus}
                            onClick={() =>
                              setNewProduct({
                                ...newProduct,
                                order_num: Math.max(1, (newProduct.order_num || 1) - 1),
                              })
                            }
                            disabled={(newProduct.order_num || 1) <= 1}
                            className="h-9 w-9 p-0"
                          />
                          <div className="flex-1">
                            <input
                              type="number"
                              min="1"
                              value={newProduct.order_num || 1}
                    onChange={(e) =>
                                setNewProduct({
                                  ...newProduct,
                                  order_num: Math.max(1, parseInt(e.target.value) || 1),
                                })
                              }
                              className="w-full h-9 px-3 text-center text-sm font-medium text-ink border border-line rounded-md focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent"
                            />
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            icon={Plus}
                            onClick={() =>
                              setNewProduct({
                                ...newProduct,
                                order_num: (newProduct.order_num || 1) + 1,
                              })
                            }
                            className="h-9 w-9 p-0"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 버튼 영역 */}
                  <div className="flex items-center gap-2 pt-2 border-t border-line">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setSelectedProduct(null);
                        setNewProduct({
                          order_num: 1,
                          subscribe_start_issue: null,
                          subscribe_end_issue: null,
                          issue: null,
                          address_id: null,
                        });
                      }}
                      className="flex-1"
                    >
                      취소
                    </Button>
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      icon={Plus}
                      onClick={handleAddProduct}
                      className="flex-1"
                    >
                      상품 추가
                    </Button>
                </div>
                </div>
              )}

              {/* 추가된 상품 목록 */}
              {products.length > 0 && (
                <div className="space-y-3 pt-4 border-t border-line">
                  <h4 className="text-sm font-semibold text-ink">
                    추가된 상품 ({products.length})
                  </h4>
                  {products.map((product, index) => (
                    <div
                      key={index}
                      className="p-4 bg-white rounded-lg border border-line space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={
                              product.product_kind === "YEARLY"
                                ? "info"
                                : product.product_kind === "MONTHLY"
                                ? "success"
                                : "default"
                            }
                            size="sm"
                          >
                            {product.product_kind === "YEARLY"
                              ? "연간"
                              : product.product_kind === "MONTHLY"
                              ? "월간"
                              : "단품"}
                          </Badge>
                          <span className="font-medium text-ink">
                            {product.product_name}
                          </span>
                </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          icon={X}
                          onClick={() => handleRemoveProduct(index)}
                        >
                          제거
                        </Button>
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                          <span className="text-muted">수량:</span>{" "}
                          <span className="text-ink font-medium">
                            {product.order_num}개
                          </span>
                        </div>
                        <div>
                          <span className="text-muted">판매가:</span>{" "}
                          <span className="text-ink font-medium">
                            {product.sale.toLocaleString()}원
                          </span>
                        </div>
                        {product.product_kind === "YEARLY" && (
                          <>
                            <div>
                              <span className="text-muted">구독 시작 호:</span>{" "}
                              <span className="text-ink">
                                {product.subscribe_start_issue || "-"}
                              </span>
                            </div>
                            <div>
                              <span className="text-muted">구독 종료 호:</span>{" "}
                              <span className="text-ink">
                                {product.subscribe_end_issue || "-"}
                              </span>
                            </div>
                          </>
                        )}
                        {product.product_kind === "MONTHLY" && (
                          <div>
                            <span className="text-muted">호수:</span>{" "}
                            <span className="text-ink">
                              {product.issue || "-"}
                            </span>
                          </div>
                        )}
                        <div className="col-span-2 pt-2 border-t border-line">
                          <span className="text-muted">소계:</span>{" "}
                          <span className="text-ink font-semibold">
                            {(product.sale * product.order_num).toLocaleString()}원
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>

          {/* 배송지 정보 */}
          <Card className="unified-card">
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <MapPin className="w-4 h-4 text-accent" />
                <h3 className="text-sm font-semibold text-ink uppercase tracking-wide">
                  배송지 정보
                </h3>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="수령인"
                  value={orderAddress.address_name}
                  onChange={(e) =>
                    setOrderAddress({
                      ...orderAddress,
                      address_name: e.target.value,
                    })
                  }
                  placeholder="수령인 이름을 입력하세요"
                  required
                />
                <Input
                  label="연락처"
                  value={orderAddress.phone}
                  onChange={(e) =>
                    setOrderAddress({
                      ...orderAddress,
                      phone: e.target.value,
                    })
                  }
                  placeholder="연락처를 입력하세요"
                  required
                />
                <div>
                  <label className="block text-sm font-medium text-muted mb-2 uppercase tracking-wider text-xs">
                    우편번호
                    <span className="text-red-500 ml-1">*</span>
                  </label>
                  <div className="flex gap-2">
                    <Input
                      value={orderAddress.postal_code}
                    onChange={(e) =>
                        setOrderAddress({
                          ...orderAddress,
                          postal_code: e.target.value,
                        })
                      }
                      placeholder="우편번호를 입력하세요"
                      required
                      readOnly
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={handlePostcodeSearch}
                    >
                      우편번호 검색
                    </Button>
                </div>
                </div>
                  <Input
                  label="국가"
                  value={orderAddress.nation}
                    onChange={(e) =>
                    setOrderAddress({
                      ...orderAddress,
                      nation: e.target.value,
                    })
                  }
                  placeholder="대한민국"
                  required
                />
                <Input
                  label="주소"
                  value={orderAddress.address1}
                  onChange={(e) =>
                    setOrderAddress({
                      ...orderAddress,
                      address1: e.target.value,
                    })
                  }
                  placeholder="주소를 입력하세요"
                  required
                  readOnly
                />
                <Input
                  label="상세주소"
                  value={orderAddress.address2}
                  onChange={(e) =>
                    setOrderAddress({
                      ...orderAddress,
                      address2: e.target.value,
                    })
                  }
                  placeholder="상세주소를 입력하세요"
                />
                <div className="col-span-2">
                  <Textarea
                    label="배송 특이사항"
                    value={orderAddress.address_memo}
                    onChange={(e) =>
                      setOrderAddress({
                        ...orderAddress,
                        address_memo: e.target.value,
                      })
                    }
                    placeholder="배송 특이사항을 입력하세요"
                    rows={2}
                  />
                </div>
              </div>
            </div>
          </Card>

          {/* 주문 정보 */}
          <Card className="unified-card">
            <div className="p-6 space-y-4">
              <h3 className="text-sm font-semibold text-ink mb-4 uppercase tracking-wide">
                주문 정보
              </h3>
              <div className="grid grid-cols-2 gap-4">
            <div>
                  <label className="unified-label mb-2 block">
                    유입 채널 <span className="text-red-500 ml-1">*</span>
              </label>
                  <div className="flex flex-wrap gap-2">
                    {Object.values(OrderChannel).map((channel) => {
                      const isSelected = orderChannel === channel;
                      return (
                        <button
                          key={channel}
                          type="button"
                          onClick={() => setOrderChannel(channel)}
                          className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                            isSelected
                              ? "bg-accent text-white shadow-sm"
                              : "bg-paper text-ink border border-line hover:border-accent/50 hover:bg-accent/5"
                          }`}
                        >
                          {ORDER_CHANNEL_LABELS[channel] || channel}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <Select
                  label="주문 상태"
                  value={orderStatus}
                onChange={(e) =>
                    setOrderStatus(e.target.value as OrderStatus)
                  }
                  options={Object.values(OrderStatus).map((status) => ({
                    value: status,
                    label: ORDER_STATUS_LABELS[status] || status,
                  }))}
                />
                <Input
                  label="주문 일시"
                  type="datetime-local"
                  value={orderAt}
                  onChange={(e) => setOrderAt(e.target.value)}
                  required
                />
                <Input
                  label="결제 일시"
                  type="datetime-local"
                  value={paymentAt}
                  onChange={(e) => setPaymentAt(e.target.value)}
                />
                <Select
                  label="결제 방법"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  options={PAYMENT_METHOD_OPTIONS.map((method) => ({
                    value: method,
                    label: method,
                  }))}
              />
            </div>
            </div>
          </Card>

          {/* 결제 정보 */}
          <Card className="unified-card">
            <div className="p-6 space-y-4">
              <h3 className="text-sm font-semibold text-ink mb-4 uppercase tracking-wide">
                결제 정보
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="할인 금액"
                  type="number"
                  min="0"
                  value={discountAmount}
                  onChange={(e) =>
                    setDiscountAmount(parseInt(e.target.value) || 0)
                  }
                  placeholder="0"
                />
                <Input
                  label="배송비"
                  type="number"
                  min="0"
                  value={sendFee}
                  onChange={(e) => setSendFee(parseInt(e.target.value) || 0)}
                  placeholder="0"
                />
              </div>
            <div className="p-4 bg-neutral-50 rounded-lg border border-line">
                <div className="space-y-2">
              <div className="flex items-center justify-between">
                    <span className="text-sm text-muted">주문금액</span>
                    <span className="text-sm text-ink font-medium">
                  {totalAmount.toLocaleString()}원
                </span>
              </div>
                  {discountAmount > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted">할인금액</span>
                      <span className="text-sm text-muted">
                        -{discountAmount.toLocaleString()}원
                      </span>
            </div>
                  )}
                  {sendFee > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted">배송비</span>
                      <span className="text-sm text-muted">
                        +{sendFee.toLocaleString()}원
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between pt-2 border-t border-line">
                    <span className="text-lg font-semibold text-ink">
                      최종 결제금액
                    </span>
                    <span className="text-2xl font-bold text-ink">
                      {finalPaymentAmount.toLocaleString()}원
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* 메모 */}
          <Card className="unified-card">
            <div className="p-6 space-y-4">
              <Textarea
                label="고객 요청사항"
                value={requestMemo}
                onChange={(e) => setRequestMemo(e.target.value)}
                placeholder="고객 요청사항을 입력하세요"
                rows={2}
              />
              <Textarea
                label="관리자 메모"
                value={adminMemo}
                onChange={(e) => setAdminMemo(e.target.value)}
                placeholder="관리자 메모를 입력하세요"
                rows={2}
              />
            </div>
          </Card>

            {/* 버튼 */}
          <div className="flex items-center justify-end space-x-3 pt-4">
            <Button
              type="button"
              onClick={() => navigate("/order/list")}
              variant="secondary"
            >
                취소
              </Button>
              <Button type="submit" variant="primary" icon={Save}>
                등록
              </Button>
            </div>
          </form>
      </div>
    </div>
  );
};

export default OrderRegisterPage;
