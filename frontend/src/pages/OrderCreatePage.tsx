import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { ChevronRight, ChevronLeft, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AddressSearchField } from "@/components/common/AddressSearchField";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { customersApi } from "@/api/customersApi";
import { productsApi } from "@/api/productsApi";
import { ordersApi } from "@/api/ordersApi";
import { toast } from "@/hooks/use-toast";
import { formatAmount, formatPhone } from "@/utils/format";
import { PAYMENT_METHOD_OPTIONS } from "@/utils/constants";
import type { CustomerResponse } from "@/types/customer";
import type { AddressResponse } from "@/types/address";
import type { ProductResponse } from "@/types/product";
import type { OrderCreate, OrderItemCreateInOrder } from "@/types/order";
import { PaymentMethod } from "@/types/order";

const STEPS = ["고객 선택", "배송지 선택", "상품 선택", "최종 확인"];

interface OrderItem {
  product: ProductResponse;
  order_num: number;
  sale_price: number;
  subscribe_period?: number;
}

export default function OrderCreatePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [step, setStep] = useState(0);

  // 단계별 데이터
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerResponse | null>(null);
  const [newCustomer, setNewCustomer] = useState({ name: "", phone: "", email: "" });
  const [customerMode, setCustomerMode] = useState<"search" | "new">("search");

  const [selectedAddress, setSelectedAddress] = useState<AddressResponse | null>(null);
  const [newAddress, setNewAddress] = useState({
    recipient_name: "",
    recipient_phone: "",
    postal_code: "",
    recipient_address: "",
    customer_memo: "",
  });
  const [addressMode, setAddressMode] = useState<"existing" | "new">("existing");
  const [customerAddresses, setCustomerAddresses] = useState<AddressResponse[]>([]);

  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [channel, setChannel] = useState("OFFLINE");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [paymentMethodError, setPaymentMethodError] = useState(false);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [adminMemo, setAdminMemo] = useState("");

  // 즉시 결제완료 등록
  const [isPaidOnCreate, setIsPaidOnCreate] = useState(false);

  // 고객 검색
  const [customerSearchInput, setCustomerSearchInput] = useState("");
  const [phoneSearchResults, setPhoneSearchResults] = useState<CustomerResponse[]>([]);
  const [phoneSearchLoading, setPhoneSearchLoading] = useState(false);

  // 상품 카탈로그
  const [allProducts, setAllProducts] = useState<ProductResponse[]>([]);
  const [allProductsLoading, setAllProductsLoading] = useState(false);
  const [productKindFilter, setProductKindFilter] = useState<"all" | "YEARLY" | "MONTHLY">("all");

  const createMutation = useMutation({
    mutationFn: (data: OrderCreate) => ordersApi.createOrder(data),
    onSuccess: () => {
      toast.success("주문이 등록되었습니다.");
      navigate("/orders");
    },
    onError: () => toast.error("주문 등록 실패"),
  });

  const handleCustomerSearch = async () => {
    const q = customerSearchInput.trim();
    if (!q) return;
    setPhoneSearchLoading(true);
    try {
      // 숫자만 입력 → 연락처 뒤 4자리 검색, 그 외 → 이름/이메일 검색
      const isNumeric = /^\d+$/.test(q);
      const res = await customersApi.getCustomers({
        page: 1,
        limit: 20,
        phone_num4: isNumeric ? q.slice(-4) : null,
        search: isNumeric ? null : q,
      });
      setPhoneSearchResults(res.data.items);
    } catch {
      toast.error("검색 실패");
    } finally {
      setPhoneSearchLoading(false);
    }
  };

  const handleSelectCustomer = async (customer: CustomerResponse) => {
    setSelectedCustomer(customer);
    // 배송지 목록 로드
    try {
      const res = await customersApi.getCustomer(customer.customer_id);
      setCustomerAddresses(res.data.data?.addresses ?? []);
    } catch {}
  };

  // 상품 선택 단계 진입 시 전체 상품 자동 로드
  useEffect(() => {
    if (step === 2 && allProducts.length === 0 && !allProductsLoading) {
      setAllProductsLoading(true);
      productsApi
        .getProducts({ page: 1, limit: 50, is_active: true })
        .then((res) => setAllProducts(res.data.items))
        .catch(() => toast.error("상품 목록 로드 실패"))
        .finally(() => setAllProductsLoading(false));
    }
  }, [step]);

  // 고객 상세 패널에서 "주문 등록" 클릭 시 고객 자동 선택
  useEffect(() => {
    const prefilledCustomer = location.state?.prefilledCustomer as CustomerResponse | undefined;
    if (prefilledCustomer) {
      handleSelectCustomer(prefilledCustomer).then(() => setStep(1));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addOrderItem = (product: ProductResponse) => {
    setOrderItems((prev) => {
      // 중복 체크를 updater 안에서 수행 (stale closure 방지)
      if (prev.some((i) => i.product.product_id === product.product_id)) {
        toast.warning("이미 추가된 상품입니다.");
        return prev;
      }
      return [
        ...prev,
        {
          product,
          order_num: 1,
          sale_price: product.sale_price,
          subscribe_period: product.product_kind === "YEARLY" ? 12 : undefined,
        },
      ];
    });
  };

  const removeOrderItem = (productId: number) => {
    setOrderItems((prev) => prev.filter((i) => i.product.product_id !== productId));
  };

  const totalAmount = orderItems.reduce(
    (sum, item) => sum + item.sale_price * item.order_num,
    0
  );
  const paymentAmount = totalAmount - discountAmount;

  const handleSubmit = () => {
    // 필수 필드 검증
    if (!paymentMethod) {
      setPaymentMethodError(true);
      toast.error("결제 방법을 선택해주세요.");
      return;
    }

    const itemsPayload: OrderItemCreateInOrder[] = orderItems.map((item) => ({
      product_code: item.product.product_code,
      order_num: item.order_num,
      sale_price: item.sale_price,
      subscribe_period: item.subscribe_period,
    }));

    const payload: OrderCreate = {
      items: itemsPayload,
      order_channel: channel,
      payment_method: paymentMethod as PaymentMethod,
      discount_amount: discountAmount,
      admin_memo: adminMemo || null,
      ...(isPaidOnCreate && {
        order_status: "PAID",
        payment_at: new Date().toISOString(),
      }),
    };

    // 고객
    if (customerMode === "search" && selectedCustomer) {
      payload.customer_id = selectedCustomer.customer_id;
    } else {
      payload.customer = {
        customer_name: newCustomer.name,
        customer_phone: newCustomer.phone,
        customer_email: newCustomer.email || null,
        create_channel: channel,
      };
    }

    // 배송지
    if (addressMode === "existing" && selectedAddress) {
      payload.address_id = selectedAddress.address_id;
    } else {
      payload.address = {
        recipient_name: newAddress.recipient_name,
        recipient_phone: newAddress.recipient_phone,
        postal_code: newAddress.postal_code,
        recipient_address: newAddress.recipient_address,
        customer_memo: newAddress.customer_memo || null,
      };
    }

    createMutation.mutate(payload);
  };

  const canProceed = () => {
    if (step === 0) {
      if (customerMode === "search") return !!selectedCustomer;
      return !!newCustomer.name && !!newCustomer.phone;
    }
    if (step === 1) {
      if (addressMode === "existing") return !!selectedAddress;
      return !!newAddress.recipient_name && !!newAddress.recipient_phone && !!newAddress.postal_code && !!newAddress.recipient_address;
    }
    if (step === 2) return orderItems.length > 0;
    if (step === 3) return !!paymentMethod;
    return true;
  };

  return (
    <div className="flex-1 overflow-y-auto">
    <div className="max-w-2xl mx-auto p-6">
      {/* 스텝 표시 */}
      <div className="flex items-center mb-8">
        {STEPS.map((s, i) => (
          <div key={i} className="flex items-center">
            <div
              className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-medium transition-colors ${
                i < step
                  ? "bg-blue-600 text-white"
                  : i === step
                  ? "bg-blue-600 text-white"
                  : "bg-gray-200 text-gray-500"
              }`}
            >
              {i < step ? <Check className="h-3.5 w-3.5" /> : i + 1}
            </div>
            <span
              className={`ml-2 text-sm ${
                i === step ? "text-gray-900 font-medium" : "text-gray-400"
              }`}
            >
              {s}
            </span>
            {i < STEPS.length - 1 && (
              <ChevronRight className="h-4 w-4 text-gray-300 mx-3" />
            )}
          </div>
        ))}
      </div>

      {/* 스텝 콘텐츠 */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 min-h-[320px]">
        {/* 스텝 1: 고객 선택 */}
        {step === 0 && (
          <div className="space-y-4">
            <div className="flex gap-2 mb-4">
              <button
                className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${
                  customerMode === "search"
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-gray-600 border-gray-300"
                }`}
                onClick={() => setCustomerMode("search")}
              >
                기존 고객
              </button>
              <button
                className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${
                  customerMode === "new"
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-gray-600 border-gray-300"
                }`}
                onClick={() => setCustomerMode("new")}
              >
                신규 고객
              </button>
            </div>

            {customerMode === "search" ? (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <Input
                    placeholder="이름 또는 연락처 뒤 4자리"
                    value={customerSearchInput}
                    onChange={(e) => setCustomerSearchInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleCustomerSearch()}
                  />
                  <Button size="sm" onClick={handleCustomerSearch} disabled={phoneSearchLoading}>
                    검색
                  </Button>
                </div>
                {phoneSearchResults.length > 0 && (
                  <div className="border border-gray-200 rounded-md divide-y">
                    {phoneSearchResults.map((c) => (
                      <button
                        key={c.customer_id}
                        onClick={() => handleSelectCustomer(c)}
                        className={`w-full flex items-center justify-between px-3 py-2.5 text-sm hover:bg-gray-50 transition-colors ${
                          selectedCustomer?.customer_id === c.customer_id ? "bg-blue-50" : ""
                        }`}
                      >
                        <div>
                          <span className="font-medium">{c.customer_name}</span>
                          <span className="text-gray-400 ml-2 font-mono text-xs">
                            {formatPhone(c.customer_phone)}
                          </span>
                        </div>
                        {selectedCustomer?.customer_id === c.customer_id && (
                          <Check className="h-4 w-4 text-blue-600" />
                        )}
                      </button>
                    ))}
                  </div>
                )}
                {selectedCustomer && (
                  <div className="bg-blue-50 border border-blue-200 rounded-md p-3 text-sm">
                    <div className="font-medium text-blue-900">{selectedCustomer.customer_name}</div>
                    <div className="text-blue-700 font-mono text-xs mt-0.5">
                      {formatPhone(selectedCustomer.customer_phone)}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <Label>고객명 <span className="text-red-500 ml-0.5">*</span></Label>
                  <Input
                    className="mt-1"
                    value={newCustomer.name}
                    onChange={(e) => setNewCustomer((p) => ({ ...p, name: e.target.value }))}
                    placeholder="고객 이름"
                  />
                </div>
                <div>
                  <Label>연락처 <span className="text-red-500 ml-0.5">*</span></Label>
                  <Input
                    className="mt-1"
                    value={newCustomer.phone}
                    onChange={(e) => setNewCustomer((p) => ({ ...p, phone: e.target.value }))}
                    placeholder="010-0000-0000"
                  />
                </div>
                <div>
                  <Label>이메일</Label>
                  <Input
                    type="email"
                    className="mt-1"
                    value={newCustomer.email}
                    onChange={(e) => setNewCustomer((p) => ({ ...p, email: e.target.value }))}
                    placeholder="(선택)"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* 스텝 2: 배송지 선택 */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="flex gap-2 mb-4">
              <button
                className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${
                  addressMode === "existing"
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-gray-600 border-gray-300"
                }`}
                onClick={() => setAddressMode("existing")}
                disabled={customerAddresses.length === 0}
              >
                기존 배송지
                {customerAddresses.length === 0 && (
                  <span className="ml-1 text-xs opacity-70">(없음)</span>
                )}
              </button>
              <button
                className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${
                  addressMode === "new"
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-gray-600 border-gray-300"
                }`}
                onClick={() => setAddressMode("new")}
              >
                신규 입력
              </button>
            </div>

            {addressMode === "existing" ? (
              <div className="space-y-2">
                {customerAddresses.length === 0 ? (
                  <p className="text-sm text-gray-400">등록된 배송지가 없습니다.</p>
                ) : (
                  customerAddresses.map((addr) => (
                    <button
                      key={addr.address_id}
                      onClick={() => setSelectedAddress(addr)}
                      className={`w-full text-left border rounded-lg p-3 transition-colors ${
                        selectedAddress?.address_id === addr.address_id
                          ? "border-blue-500 bg-blue-50"
                          : "border-gray-200 hover:bg-gray-50"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm">{addr.recipient_name}</span>
                        <span className="text-xs text-gray-400 font-mono">
                          {formatPhone(addr.recipient_phone)}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        ({addr.postal_code}) {addr.recipient_address}
                      </div>
                    </button>
                  ))
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>수령인 <span className="text-red-500 ml-0.5">*</span></Label>
                    <Input
                      className="mt-1"
                      value={newAddress.recipient_name}
                      onChange={(e) =>
                        setNewAddress((p) => ({ ...p, recipient_name: e.target.value }))
                      }
                      placeholder="수령인 이름"
                    />
                  </div>
                  <div>
                    <Label>연락처 <span className="text-red-500 ml-0.5">*</span></Label>
                    <Input
                      className="mt-1"
                      value={newAddress.recipient_phone}
                      onChange={(e) =>
                        setNewAddress((p) => ({ ...p, recipient_phone: e.target.value }))
                      }
                      placeholder="010-0000-0000"
                    />
                  </div>
                </div>
                <AddressSearchField
                  postalCode={newAddress.postal_code}
                  address={newAddress.recipient_address}
                  onChange={(postal_code, recipient_address) =>
                    setNewAddress((p) => ({ ...p, postal_code, recipient_address }))
                  }
                  required
                />
                <div>
                  <Label>배송 메모</Label>
                  <Input
                    className="mt-1"
                    value={newAddress.customer_memo}
                    onChange={(e) =>
                      setNewAddress((p) => ({ ...p, customer_memo: e.target.value }))
                    }
                    placeholder="(선택)"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* 스텝 3: 상품 선택 */}
        {step === 2 && (
          <div className="space-y-4">
            {/* 종류 필터 탭 */}
            <div className="flex gap-1.5">
              {(["all", "YEARLY", "MONTHLY"] as const).map((kind) => (
                <button
                  key={kind}
                  onClick={() => setProductKindFilter(kind)}
                  className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${
                    productKindFilter === kind
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white text-gray-600 border-gray-300 hover:border-gray-400"
                  }`}
                >
                  {kind === "all" ? "전체" : kind === "YEARLY" ? "정기구독" : "단품"}
                </button>
              ))}
            </div>

            {/* 상품 카탈로그 그리드 */}
            {allProductsLoading ? (
              <div className="flex justify-center py-6">
                <LoadingSpinner />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {allProducts
                  .filter((p) => productKindFilter === "all" || p.product_kind === productKindFilter)
                  .map((p) => {
                    const isAdded = orderItems.some((i) => i.product.product_id === p.product_id);
                    return (
                      <button
                        key={p.product_id}
                        onClick={() => addOrderItem(p)}
                        className={`relative text-left border rounded-lg p-3 transition-all ${
                          isAdded
                            ? "border-blue-500 bg-blue-50"
                            : "border-gray-200 bg-white hover:border-blue-300 hover:bg-gray-50"
                        }`}
                      >
                        {isAdded && (
                          <span className="absolute top-2 right-2 flex items-center justify-center w-5 h-5 rounded-full bg-blue-600 text-white">
                            <Check className="h-3 w-3" />
                          </span>
                        )}
                        <div className="pr-6">
                          <div
                            className={`inline-block text-[10px] font-medium px-1.5 py-0.5 rounded mb-1 ${
                              p.product_kind === "YEARLY"
                                ? "bg-purple-100 text-purple-700"
                                : "bg-emerald-100 text-emerald-700"
                            }`}
                          >
                            {p.product_kind === "YEARLY" ? "정기구독" : "단품"}
                          </div>
                          <div className="text-sm font-medium text-gray-900 leading-snug">
                            {p.product_name}
                          </div>
                          <div className="text-xs text-gray-400 font-mono mt-0.5">
                            {p.product_code}
                          </div>
                          <div className="text-sm font-semibold text-blue-700 mt-1.5">
                            {formatAmount(p.sale_price)}
                          </div>
                        </div>
                      </button>
                    );
                  })}
              </div>
            )}

            {orderItems.length > 0 && (
              <div className="space-y-2">
                {orderItems.map((item) => (
                  <div
                    key={item.product.product_id}
                    className="border border-gray-200 rounded-lg p-3"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="text-sm font-medium">{item.product.product_name}</div>
                        <div className="text-xs text-gray-400 font-mono">
                          {item.product.product_code}
                        </div>
                      </div>
                      <button
                        onClick={() => removeOrderItem(item.product.product_id)}
                        className="text-gray-300 hover:text-red-400 text-xs"
                      >
                        ✕
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <Label className="text-xs">수량</Label>
                        <Input
                          type="number"
                          min={1}
                          className="mt-1 h-7 text-xs"
                          value={item.order_num}
                          onChange={(e) =>
                            setOrderItems((prev) =>
                              prev.map((i) =>
                                i.product.product_id === item.product.product_id
                                  ? { ...i, order_num: parseInt(e.target.value) || 1 }
                                  : i
                              )
                            )
                          }
                        />
                      </div>
                      <div>
                        <Label className="text-xs">판매가</Label>
                        <Input
                          type="number"
                          min={0}
                          className="mt-1 h-7 text-xs"
                          value={item.sale_price}
                          onChange={(e) =>
                            setOrderItems((prev) =>
                              prev.map((i) =>
                                i.product.product_id === item.product.product_id
                                  ? { ...i, sale_price: parseInt(e.target.value) || 0 }
                                  : i
                              )
                            )
                          }
                        />
                      </div>
                      {item.product.product_kind === "YEARLY" && (
                        <div>
                          <Label className="text-xs">구독기간(개월)</Label>
                          <Input
                            type="number"
                            min={1}
                            max={24}
                            className="mt-1 h-7 text-xs"
                            value={item.subscribe_period ?? 12}
                            onChange={(e) =>
                              setOrderItems((prev) =>
                                prev.map((i) =>
                                  i.product.product_id === item.product.product_id
                                    ? { ...i, subscribe_period: parseInt(e.target.value) || 12 }
                                    : i
                                )
                              )
                            }
                          />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 스텝 4: 최종 확인 */}
        {step === 3 && (
          <div className="space-y-4">
            {/* 채널 / 결제수단 */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>주문 채널</Label>
                <Select value={channel} onValueChange={setChannel}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="OFFLINE">오프라인</SelectItem>
                    <SelectItem value="GPMALL">갓피플몰</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className={paymentMethodError ? "text-red-500" : ""}>
                  결제 방법 <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={paymentMethod}
                  onValueChange={(v) => { setPaymentMethod(v); setPaymentMethodError(false); }}
                >
                  <SelectTrigger className={`mt-1 ${paymentMethodError ? "border-red-500 focus:ring-red-500" : ""}`}>
                    <SelectValue placeholder="선택해주세요" />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHOD_OPTIONS.map((m) => (
                      <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {paymentMethodError && (
                  <p className="text-xs text-red-500 mt-1">결제 방법을 선택해주세요.</p>
                )}
              </div>
            </div>

            {/* 금액 요약 */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">상품금액</span>
                <span>{formatAmount(totalAmount)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500">할인금액</span>
                <div className="flex items-center gap-1">
                  <span>-</span>
                  <Input
                    type="number"
                    min={0}
                    className="w-24 h-6 text-xs"
                    value={discountAmount || ""}
                    onChange={(e) => setDiscountAmount(parseInt(e.target.value) || 0)}
                  />
                  <span className="text-xs">원</span>
                </div>
              </div>
              <hr className="border-gray-200" />
              <div className="flex justify-between font-semibold">
                <span>결제금액</span>
                <span className="text-blue-700">{formatAmount(paymentAmount)}</span>
              </div>
            </div>

            {/* 즉시 결제완료 */}
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isPaidOnCreate}
                onChange={(e) => setIsPaidOnCreate(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-blue-600"
              />
              <span className="text-sm text-gray-700">결제 완료로 등록</span>
              <span className="text-xs text-gray-400">(현장 결제 시 체크)</span>
            </label>

            {/* 메모 */}
            <div>
              <Label>관리자 메모</Label>
              <textarea
                className="mt-1 w-full border border-gray-300 rounded-md p-2 text-sm resize-none h-16 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="(선택)"
                value={adminMemo}
                onChange={(e) => setAdminMemo(e.target.value)}
              />
            </div>

            {/* 확인 요약 */}
            <div className="text-xs text-gray-500 space-y-1">
              <div>
                고객:{" "}
                {selectedCustomer?.customer_name ?? newCustomer.name} (
                {formatPhone(selectedCustomer?.customer_phone ?? newCustomer.phone)})
              </div>
              <div>
                배송지:{" "}
                {selectedAddress
                  ? `(${selectedAddress.postal_code}) ${selectedAddress.recipient_address}`
                  : `(${newAddress.postal_code}) ${newAddress.recipient_address}`}
              </div>
              <div>상품: {orderItems.map((i) => i.product.product_name).join(", ")}</div>
            </div>
          </div>
        )}
      </div>

      {/* 버튼 */}
      <div className="flex items-center justify-between mt-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => (step === 0 ? navigate("/orders") : setStep((s) => s - 1))}
          className="gap-1"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          {step === 0 ? "취소" : "이전"}
        </Button>

        {step < STEPS.length - 1 ? (
          <Button
            size="sm"
            onClick={() => setStep((s) => s + 1)}
            disabled={!canProceed()}
            className="gap-1"
          >
            다음
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        ) : (
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={createMutation.isPending}
          >
            {createMutation.isPending ? "등록 중..." : "주문 등록"}
          </Button>
        )}
      </div>
    </div>
    </div>
  );
}
