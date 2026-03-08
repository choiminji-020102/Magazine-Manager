import React, { useState, useEffect, useRef, useCallback } from "react";
import { Save, Plus, X, Search, MapPin, Minus, User, Package, CreditCard, FileText, MessageSquare } from "lucide-react";
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
import type { CustomerResponse } from "../types/customer";
import { customersApi } from "../api/customersApi";
import { productsApi } from "../api/productsApi";
import { ordersApi } from "../api/ordersApi";
import { addressesApi } from "../api/addressesApi";
import type { ProductResponse } from "../types/product";
import type { AddressResponse } from "../types/address";
import type { OrderCreate } from "../types/order";

// ProductResponse를 Product로 사용
type Product = ProductResponse;

interface OrderProduct {
  id?: string; // 고유 식별자 (추가 시 생성)
  product_id: number;
  product_code: string;
  product_kind: "YEARLY" | "MONTHLY" | "SINGLE";
  product_name: string;
  price: number;
  sale: number;
  order_num: number;
  subscribe_start_issue: string | null;
  subscribe_end_issue: string | null;
  subscribe_period?: number | null; // 구독 기간(개월)
  final_subscribe_end_issue?: string | null;
  issue: string | null; // MONTHLY용 단일 호수
  address_id: number | null;
  memo?: string | null; // 상품별 메모
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

const BOOK_TYPES = [
  { 
    id: "basic", 
    label: "말씀함께[기본판]", 
    keywords: ["말씀함께[기본판]", "말씀함께[기본"],
    searchKeywords: ["말씀함께[기본판]", "기본판"]
  },
  { 
    id: "large", 
    label: "말씀함께[큰글자판]", 
    keywords: ["말씀함께[큰글자판]", "큰글자판"],
    searchKeywords: ["말씀함께[큰글자판]", "큰글자판"]
  },
  { 
    id: "child_high", 
    label: "어린이 말씀함께[고학년 4-6학년]", 
    keywords: ["어린이 말씀함께 [고학년", "어린이 말씀함께[고학년", "고학년 4-6학년", "고학년 4~6학년"],
    searchKeywords: ["어린이 말씀함께 [고학년", "고학년"]
  },
  { 
    id: "child_low", 
    label: "어린이 말씀함께[저학년 1-3학년]", 
    keywords: ["어린이 말씀함께 [저학년", "어린이 말씀함께[저학년", "저학년 1-3학년", "저학년 1~3학년"],
    searchKeywords: ["어린이 말씀함께 [저학년", "저학년"]
  },
  { 
    id: "youth", 
    label: "청소년 말씀함께", 
    keywords: ["청소년 말씀함께"],
    searchKeywords: ["청소년 말씀함께"]
  },
  { 
    id: "kkulddang", 
    label: "꿀땅", 
    keywords: ["꿀땅"],
    searchKeywords: ["꿀땅"]
  },
  { 
    id: "single", 
    label: "단행본", 
    keywords: ["단행본"],
    searchKeywords: ["단행본"]
  },
];

const PAYMENT_METHOD_OPTIONS = ["카드결제", "계좌이체", "무통장입금", "기타"];

const SOURCE_OPTIONS: Array<{ value: "CAFE24" | "GPMALL" | "OFFLINE"; label: string }> = [
  { value: "CAFE24", label: "Cafe24" },
  { value: "GPMALL", label: "갓피플몰" },
  { value: "OFFLINE", label: "오프라인" },
];

// 상품명에서 책 종류 추출
const extractBookType = (productName: string): string | null => {
  // 우선순위: 더 구체적인 키워드부터 매칭
  for (const bookType of BOOK_TYPES) {
    if (bookType.keywords.some(keyword => productName.includes(keyword))) {
      return bookType.id;
    }
  }
  return null;
};

// YYYYMM 형식에서 period 개월 후 계산 (시작호 포함)
// 예: start_issue="202602", period=12 → "202701"
const calculateSubscribeEndIssue = (startIssue: string, period: number): string => {
  if (!startIssue || startIssue.length !== 6) {
    return startIssue;
  }
  
  const year = parseInt(startIssue.substring(0, 4));
  const month = parseInt(startIssue.substring(4, 6));
  
  // period - 1 개월 후 (시작호 포함이므로)
  const totalMonths = year * 12 + month + (period - 1);
  const endYear = Math.floor((totalMonths - 1) / 12);
  const endMonth = ((totalMonths - 1) % 12) + 1;
  
  return `${String(endYear).padStart(4, '0')}${String(endMonth).padStart(2, '0')}`;
};

// product의 subscribe_start_issue와 product_kind를 기반으로 구독 정보 자동 계산
const calculateSubscribeInfo = (
  subscribeStartIssue: string | null | undefined,
  productKind: "YEARLY" | "MONTHLY" | "SINGLE"
): {
  subscribe_start_issue: string | null;
  subscribe_end_issue: string | null;
  subscribe_period: number | null;
  final_subscribe_end_issue: string | null;
  issue: string | null;
} => {
  if (!subscribeStartIssue) {
    return {
      subscribe_start_issue: null,
      subscribe_end_issue: null,
      subscribe_period: null,
      final_subscribe_end_issue: null,
      issue: null,
    };
  }
  
  if (productKind === "YEARLY") {
    const defaultPeriod = 12;
    const endIssue = calculateSubscribeEndIssue(subscribeStartIssue, defaultPeriod);
    return {
      subscribe_start_issue: subscribeStartIssue,
      subscribe_end_issue: endIssue,
      subscribe_period: defaultPeriod,
      final_subscribe_end_issue: endIssue,
      issue: null,
    };
  } else if (productKind === "MONTHLY") {
    const defaultPeriod = 1;
    return {
      subscribe_start_issue: subscribeStartIssue,
      subscribe_end_issue: subscribeStartIssue,
      subscribe_period: defaultPeriod,
      final_subscribe_end_issue: subscribeStartIssue,
      issue: subscribeStartIssue,
    };
  } else {
    // SINGLE의 경우 구독 정보 없음
    return {
      subscribe_start_issue: null,
      subscribe_end_issue: null,
      subscribe_period: null,
      final_subscribe_end_issue: null,
      issue: null,
    };
  }
};

const OrderRegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // 고객 정보
  const [customerSearch, setCustomerSearch] = useState("");
  const [searchResults, setSearchResults] = useState<CustomerResponse[]>([]);
  const [customerSearchLoading, setCustomerSearchLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [isNewCustomer, setIsNewCustomer] = useState(true);
  const [customerForm, setCustomerForm] = useState({
    customer_name: "",
    customer_phone: "",
    customer_email: "",
    create_channel: "OFFLINE" as "CAFE24" | "GPMALL" | "OFFLINE",
    admin_memo: "",
  });

  // 주문 정보
  const [orderChannel, setOrderChannel] = useState<OrderChannel>(OrderChannel.OFFLINE);
  const [orderStatus, setOrderStatus] = useState<OrderStatus>(OrderStatus.ORDERED);
  const [externalOrderId, setExternalOrderId] = useState("");
  const [paymentAt, setPaymentAt] = useState(
    new Date().toISOString().slice(0, 16)
  );
  const [paymentMethod, setPaymentMethod] = useState("카드결제");

  // 상품 정보
  const [products, setProducts] = useState<OrderProduct[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [productSearchResults, setProductSearchResults] = useState<Product[]>([]);
  const [selectedBookType, setSelectedBookType] = useState<string | null>(null);
  const [productSearchLoading, setProductSearchLoading] = useState(false);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

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
  const [customerAddresses, setCustomerAddresses] = useState<AddressResponse[]>([]);
  const [addressLoading, setAddressLoading] = useState(false);
  const [selectedAddressId, setSelectedAddressId] = useState<number | null>(null);
  const [isNewAddress, setIsNewAddress] = useState(true);

  // 결제 정보
  const [discountAmount, setDiscountAmount] = useState(0);
  const [sendFee, setSendFee] = useState(0);
  const [requestMemo, setRequestMemo] = useState("");
  const [adminMemo, setAdminMemo] = useState("");

  // 고객 검색
  const handleCustomerSearch = async () => {
    if (!customerSearch.trim()) {
      setSearchResults([]);
      setHasSearched(false);
      return;
    }
    
    setCustomerSearchLoading(true);
    setError("");
    setHasSearched(true);
    try {
      const response = await customersApi.getCustomers({
        page: 1,
        limit: 20, // 검색 결과는 최대 20개까지
        search: customerSearch.trim(),
        sort: "created_at",
        order: "desc",
        deleted_only: false,
      });
      setSearchResults(response.data.data);
    } catch (err: any) {
      console.error('Error searching customers:', err);
      setError("고객 검색 중 오류가 발생했습니다.");
      setSearchResults([]);
    } finally {
      setCustomerSearchLoading(false);
    }
  };

  // 고객 선택
  const handleSelectCustomer = async (customer: CustomerResponse) => {
    setSelectedCustomerId(customer.customer_id);
    setIsNewCustomer(false);
    setCustomerForm({
      customer_name: customer.customer_name,
      customer_phone: customer.customer_phone,
      customer_email: customer.customer_email || "",
      create_channel: customer.create_channel as "CAFE24" | "GPMALL" | "OFFLINE",
      admin_memo: customer.admin_memo || "",
    });
    // 검색 결과는 유지하여 선택된 고객을 계속 표시할 수 있도록 함
    
    // 고객 선택 시 배송지 목록 불러오기
    setAddressLoading(true);
    try {
      const response = await addressesApi.getAddressesByCustomer(customer.customer_id);
      setCustomerAddresses(response.data.data || []);
    } catch (err: any) {
      console.error('Error loading addresses:', err);
      setCustomerAddresses([]);
    } finally {
      setAddressLoading(false);
    }
    
    // 배송지 정보 초기화
    setOrderAddress({
      address_name: "",
      phone: "",
      nation: "대한민국",
      postal_code: "",
      address1: "",
      address2: "",
      address_memo: "",
    });
    setSelectedAddressId(null);
    setIsNewAddress(true);
  };

  // 상품 검색 (debounce 적용)
  const handleProductSearch = useCallback(async (searchTerm: string, showAll: boolean = false) => {
    setProductSearchLoading(true);
    try {
      const response = await productsApi.getProducts({
        page: 1,
        limit: 50, // 검색 결과는 최대 50개까지
        search: showAll ? null : (searchTerm.trim() || null),
        kind: null,
        is_active: true, // 활성화된 상품만 검색
      });
      setProductSearchResults(response.data.data);
      setHighlightedIndex(-1);
    } catch (error) {
      console.error('Error searching products:', error);
      setError("상품 검색 중 오류가 발생했습니다.");
      setProductSearchResults([]);
    } finally {
      setProductSearchLoading(false);
    }
  }, []);

  // 검색어 변경 시 debounce 적용
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // 검색어가 있고 책 종류가 선택되었을 때만 검색
    if (productSearch.trim() && selectedBookType) {
      searchTimeoutRef.current = setTimeout(() => {
        handleProductSearch(productSearch, false);
      }, 300); // 300ms debounce
    } else if (!productSearch.trim() && selectedBookType) {
      // 검색어가 없지만 책 종류가 선택된 경우 해당 책 종류의 상품 로드
      const bookType = BOOK_TYPES.find((bt) => bt.id === selectedBookType);
      if (bookType && bookType.searchKeywords.length > 0) {
        const searchKeyword = bookType.searchKeywords[0];
        handleProductSearch(searchKeyword, false);
      }
    } else {
      // 책 종류가 선택되지 않았으면 검색 결과 초기화
      setProductSearchResults([]);
    }

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [productSearch, selectedBookType, handleProductSearch]);

  // 키보드 네비게이션
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (productSearchResults.length === 0 || !productSearch.trim()) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev < productSearchResults.length - 1 ? prev + 1 : prev
        );
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : -1));
      } else if (e.key === "Enter" && highlightedIndex >= 0) {
        e.preventDefault();
        handleSelectProduct(productSearchResults[highlightedIndex]);
      } else if (e.key === "Escape") {
        setProductSearchResults([]);
        setHighlightedIndex(-1);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [productSearchResults, highlightedIndex, productSearch]);

  // 상품 선택 - 바로 주문 품목에 추가
  const handleSelectProduct = (product: Product) => {
    setError("");
    setSuccess("");
    
    // product의 subscribe_start_issue를 사용하여 구독 정보 자동 계산
    const subscribeInfo = calculateSubscribeInfo(product.subscribe_start_issue, product.product_kind);
    
    // 상품 종류별 검증
    if (product.product_kind === "YEARLY") {
      if (!subscribeInfo.subscribe_start_issue || !subscribeInfo.subscribe_end_issue) {
        setError("구독 정보를 자동으로 계산할 수 없습니다. 상품의 구독 시작 호를 확인해주세요.");
        return;
      }
    } else if (product.product_kind === "MONTHLY") {
      if (!subscribeInfo.issue) {
        setError("호수 정보를 자동으로 계산할 수 없습니다. 상품의 구독 시작 호를 확인해주세요.");
        return;
      }
    }
    
    // 상품 추가
    const orderProduct: OrderProduct = {
      id: `${product.product_id}-${Date.now()}-${Math.random()}`, // 고유 ID 생성
      product_id: product.product_id,
      product_code: product.product_code,
      product_kind: product.product_kind,
      product_name: product.product_name,
      price: product.price,
      sale: product.sale,
      order_num: 1,
      subscribe_start_issue: subscribeInfo.subscribe_start_issue,
      subscribe_end_issue: subscribeInfo.subscribe_end_issue,
      subscribe_period: subscribeInfo.subscribe_period,
      final_subscribe_end_issue: subscribeInfo.final_subscribe_end_issue,
      issue: subscribeInfo.issue,
      address_id: null,
      memo: null,
    };
    
    setProducts([...products, orderProduct]);
    setSuccess("상품이 추가되었습니다.");
    setHighlightedIndex(-1);
  };

  // 책 종류별 필터링
  const filteredByBookType = selectedBookType
    ? productSearchResults.filter((product) => {
        const bookType = extractBookType(product.product_name);
        return bookType === selectedBookType;
      })
    : productSearchResults;

  // 검색 결과 그룹화 (구매형태별)
  const groupedResults = filteredByBookType.reduce((acc, product) => {
    const kind = product.product_kind;
    if (!acc[kind]) {
      acc[kind] = [];
    }
    acc[kind].push(product);
    return acc;
  }, {} as Record<string, Product[]>);

  const kindLabels: Record<string, string> = {
    YEARLY: "연간 구독",
    MONTHLY: "월간 단품",
    SINGLE: "단행본",
  };

  // 책 종류 선택 핸들러
  const handleBookTypeSelect = async (bookTypeId: string) => {
    setSelectedBookType(bookTypeId);
    setProductSearch(""); // 검색어 초기화
    
    // 책 종류를 선택하면 해당 책의 모든 상품을 로드
      const bookType = BOOK_TYPES.find((bt) => bt.id === bookTypeId);
      if (bookType && bookType.searchKeywords.length > 0) {
        // 책 종류의 검색 키워드로 검색 (첫 번째 키워드 사용)
        const searchKeyword = bookType.searchKeywords[0];
        await handleProductSearch(searchKeyword, false);
    }
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
          });
        },
      }).open();
    } else {
      alert(
        "우편번호 검색 서비스를 불러올 수 없습니다. 페이지를 새로고침해주세요."
      );
    }
  };

  const handleRemoveProduct = (id: string) => {
    setProducts(products.filter((p) => p.id !== id));
  };

  // 상품 수량 업데이트
  const handleUpdateProductQuantity = (id: string, newQuantity: number) => {
    if (newQuantity < 1) {
      return;
    }
    setProducts(
      products.map((p) =>
        p.id === id ? { ...p, order_num: newQuantity } : p
      )
    );
  };

  // 상품 정가 업데이트
  const handleUpdateProductPrice = (id: string, newPrice: number) => {
    if (newPrice < 0) {
      return;
    }
    setProducts(
      products.map((p) =>
        p.id === id ? { ...p, price: newPrice } : p
      )
    );
  };

  // 상품 할인가 업데이트
  const handleUpdateProductSale = (id: string, newSale: number) => {
    if (newSale < 0) {
      return;
    }
    setProducts(
      products.map((p) =>
        p.id === id ? { ...p, sale: newSale } : p
      )
    );
  };

  // 상품 구독 기간 업데이트
  const handleUpdateProductSubscribePeriod = (id: string, newPeriod: number) => {
    if (newPeriod < 1) {
      return;
    }
    setProducts(
      products.map((p) => {
        if (p.id !== id) return p;
        
        // 구독 기간이 변경되면 종료 호수 재계산
        let newEndIssue: string | null = null;
        let newFinalEndIssue: string | null = null;
        
        if (p.product_kind === "YEARLY" && p.subscribe_start_issue) {
          newEndIssue = calculateSubscribeEndIssue(p.subscribe_start_issue, newPeriod);
          newFinalEndIssue = newEndIssue;
        } else if (p.product_kind === "MONTHLY" && p.subscribe_start_issue) {
          newEndIssue = p.subscribe_start_issue;
          newFinalEndIssue = p.subscribe_start_issue;
        }
        
        return {
          ...p,
          subscribe_period: newPeriod,
          subscribe_end_issue: newEndIssue,
          final_subscribe_end_issue: newFinalEndIssue,
        };
      })
    );
  };

  // 상품 메모 업데이트
  const handleUpdateProductMemo = (id: string, newMemo: string | null) => {
    setProducts(
      products.map((p) =>
        p.id === id ? { ...p, memo: newMemo || null } : p
      )
    );
  };

  // order_channel 변경 시 external_order_id 초기화 (OFFLINE 선택 시)
  useEffect(() => {
    if (orderChannel === OrderChannel.OFFLINE) {
      setExternalOrderId("");
    }
  }, [orderChannel]);

  // 결제 여부 state
  const [isPaid, setIsPaid] = useState(false);

  // 결제 여부 변경 시 처리
  const handlePaymentToggle = (paid: boolean) => {
    setIsPaid(paid);
    if (paid) {
      // 결제 완료로 변경
      setOrderStatus(OrderStatus.PAID);
      setPaymentAt(new Date().toISOString().slice(0, 16));
    } else {
      // 결제 미완료로 변경
      setOrderStatus(OrderStatus.ORDERED);
      setPaymentAt("");
    }
  };

  // order_status 변경 시 isPaid 동기화 (체크박스로 변경한 경우 제외)
  useEffect(() => {
    setIsPaid(orderStatus === OrderStatus.PAID);
  }, [orderStatus]);

  // 총액 계산
  // total_amount = sale(할인가) * order_num의 합
  const totalAmount = products.reduce(
    (sum, p) => sum + p.sale * p.order_num,
    0
  );
  // payment_amount = total_amount - discount_amount(주문 전체 할인) + send_fee
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

    // 주문 상태가 결제 완료인데 결제 일시가 없으면 에러
    if (orderStatus === OrderStatus.PAID && !paymentAt) {
      setError("결제 완료 상태일 경우 결제 일시를 입력해주세요.");
      return;
    }

    try {
      // 주문 데이터 구성
      const orderData: OrderCreate = {
        customer_id: selectedCustomerId || null,
        customer: selectedCustomerId
          ? null
          : {
              customer_name: customerForm.customer_name,
              customer_phone: customerForm.customer_phone,
              customer_email: customerForm.customer_email?.trim() || null,
              create_channel: customerForm.create_channel || null,
              admin_memo: customerForm.admin_memo?.trim() || null,
            },
        // 기존 배송지를 선택한 경우 address_id 사용, 새 배송지인 경우 address 객체 사용
        address_id: selectedAddressId && !isNewAddress ? selectedAddressId : null,
        address: selectedAddressId && !isNewAddress
          ? null
          : {
              address_name: orderAddress.address_name,
              phone: orderAddress.phone,
              nation: orderAddress.nation || "대한민국",
              postal_code: orderAddress.postal_code,
              address: orderAddress.address1, // 주소와 상세주소를 모두 포함한 값
              address_memo: orderAddress.address_memo?.trim() || null,
            },
        external_order_id: externalOrderId?.trim() || null,
        order_channel: orderChannel,
        order_status: orderStatus,
        discount_amount: discountAmount,
        send_fee: sendFee,
        payment_method: paymentMethod || null,
        payment_at: paymentAt || null,
        request_memo: requestMemo?.trim() || null,
        admin_memo: adminMemo?.trim() || null,
        items: products.map((product) => ({
          product_code: product.product_code,
          order_num: product.order_num,
          price: product.price ?? null,
          sale: product.sale ?? null,
          subscribe_period: product.subscribe_period ?? undefined,
          memo: product.memo?.trim() || null,
        })),
      };

      await ordersApi.createOrder(orderData);
      setSuccess("주문이 등록되었습니다.");
      setTimeout(() => {
        navigate("/order/list");
      }, 1500);
    } catch (err: any) {
      console.error('Error creating order:', err);
      setError(err?.response?.data?.message || err?.message || "주문 등록에 실패했습니다.");
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
              <div className="flex items-center gap-2 mb-4">
                <User className="w-4 h-4 text-accent" />
                <h3 className="text-sm font-semibold text-ink uppercase tracking-wide">
                  고객 정보
                </h3>
              </div>

              {/* 고객 검색 영역 (고정) */}
              <div className="space-y-3 pb-4 border-b border-line min-h-[120px]">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-ink">
                    고객 검색
                  </label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setIsNewCustomer(true);
                      setSelectedCustomerId(null);
                      setCustomerForm({
                        customer_name: "",
                        customer_phone: "",
                        customer_email: "",
                        create_channel: "OFFLINE",
                        admin_memo: "",
                      });
                      setSearchResults([]);
                      setCustomerSearch("");
                      setHasSearched(false);
                      setCustomerAddresses([]);
                      setOrderAddress({
                        address_name: "",
                        phone: "",
                        nation: "대한민국",
                        postal_code: "",
                        address1: "",
                        address2: "",
                        address_memo: "",
                      });
                    }}
                  >
                    새 고객 입력
                  </Button>
                </div>

                {/* 고객 검색 입력 */}
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted" />
                    <input
                      type="text"
                      placeholder="고객명, 연락처로 검색..."
                      value={customerSearch}
                      onChange={(e) => {
                        setCustomerSearch(e.target.value);
                        if (!e.target.value.trim()) {
                          setHasSearched(false);
                          setSearchResults([]);
                        }
                      }}
                      onKeyPress={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleCustomerSearch();
                        }
                      }}
                      className="unified-input pl-10 w-full"
                      disabled={customerSearchLoading}
                    />
                    {customerSearchLoading && (
                      <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                        <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin"></div>
                      </div>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={handleCustomerSearch}
                    disabled={customerSearchLoading}
                    loading={customerSearchLoading}
                  >
                    검색
                  </Button>
                </div>

                {/* 검색 결과 */}
                {customerSearchLoading && (
                  <div className="p-4 text-center text-sm text-muted border border-line rounded-lg bg-paper">
                    <p>고객을 검색하는 중...</p>
                  </div>
                )}
                {!customerSearchLoading && searchResults.length > 0 && (() => {
                  // 선택된 고객만 표시
                  const selectedCustomer = searchResults.find(c => selectedCustomerId === c.customer_id && !isNewCustomer);
                  
                  // 선택된 고객이 있으면 선택된 고객만 표시, 없으면 전체 목록 표시
                  if (selectedCustomer) {
                    return (
                      <div className="grid grid-cols-1 gap-2">
                        <div
                          key={selectedCustomer.customer_id}
                          className="p-3 border border-accent bg-accent/5 rounded-lg cursor-pointer transition-all"
                          onClick={() => handleSelectCustomer(selectedCustomer)}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-medium text-ink text-sm">
                                  {selectedCustomer.customer_name}
                                </span>
                                <Badge variant="info" size="sm">
                                  선택됨
                                </Badge>
                              </div>
                              <p className="text-xs text-muted mb-1">
                                {selectedCustomer.customer_phone}
                              </p>
                              {selectedCustomer.customer_email && (
                                <p className="text-xs text-muted">
                                  {selectedCustomer.customer_email}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  }
                  
                  // 선택된 고객이 없으면 전체 목록 표시
                  return (
                    <div className="grid grid-cols-1 gap-2">
                      {searchResults.map((customer) => (
                        <div
                          key={customer.customer_id}
                          className="p-3 border border-line rounded-lg cursor-pointer transition-all hover:border-accent/50 hover:bg-neutral-50"
                          onClick={() => handleSelectCustomer(customer)}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-medium text-ink text-sm">
                                  {customer.customer_name}
                                </span>
                              </div>
                              <p className="text-xs text-muted mb-1">
                                {customer.customer_phone}
                              </p>
                              {customer.customer_email && (
                                <p className="text-xs text-muted">
                                  {customer.customer_email}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
                {!customerSearchLoading && hasSearched && searchResults.length === 0 && (
                  <div className="p-4 text-center text-sm text-muted border border-line rounded-lg bg-paper">
                    <p className="font-medium mb-1">검색 결과가 없습니다.</p>
                    <p className="text-xs">다른 검색어를 입력해보세요.</p>
                  </div>
                )}
                {!customerSearchLoading && !hasSearched && searchResults.length === 0 && (
                  <div className="p-4 text-center text-sm text-muted border border-line rounded-lg bg-paper">
                    <p className="text-xs">고객명 또는 연락처로 검색하거나 새 고객을 입력하세요.</p>
                  </div>
                )}
              </div>

              {/* 고객 입력 폼 */}
              <div className="grid grid-cols-2 gap-4">
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
                    placeholder="010-1234-5678"
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
                      create_channel: e.target.value as "CAFE24" | "GPMALL" | "OFFLINE",
                    })
                  }
                  required
                  options={SOURCE_OPTIONS}
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
                    placeholder="예: VIP 고객, 특별 할인 적용"
                    rows={2}
                  />
                </div>
              </div>
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

              {/* 배송지 목록 영역 (고정) */}
              <div className="space-y-3 pb-4 border-b border-line min-h-[120px]">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-ink">
                    저장된 배송지
                  </label>
                  {selectedCustomerId && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setIsNewAddress(true);
                        setSelectedAddressId(null);
                        setOrderAddress({
                          address_name: "",
                          phone: "",
                          nation: "대한민국",
                          postal_code: "",
                          address1: "",
                          address2: "",
                          address_memo: "",
                        });
                      }}
                    >
                      새 배송지 입력
                    </Button>
                  )}
                </div>
                
                {/* 고객이 선택되지 않은 경우 */}
                {!selectedCustomerId && (
                  <div className="p-4 text-center text-sm text-muted border border-line rounded-lg bg-paper">
                    <p className="font-medium mb-1">고객을 먼저 선택해주세요</p>
                    <p className="text-xs">고객을 선택하면 저장된 배송지 목록이 표시됩니다.</p>
                  </div>
                )}
                
                {/* 고객이 선택된 경우 */}
                {selectedCustomerId && (
                  <>
                    {addressLoading && (
                      <div className="p-4 text-center text-sm text-muted border border-line rounded-lg bg-paper">
                        <p>배송지를 불러오는 중...</p>
                      </div>
                    )}
                    
                    {!addressLoading && customerAddresses.length > 0 && (() => {
                      // 선택된 배송지만 표시
                      const selectedAddress = customerAddresses.find(a => selectedAddressId === a.address_id && !isNewAddress);
                      
                      // 선택된 배송지가 있으면 선택된 배송지만 표시, 없으면 전체 목록 표시
                      if (selectedAddress) {
                        return (
                          <div className="grid grid-cols-1 gap-2">
                            <div
                              key={selectedAddress.address_id}
                              className="p-3 border border-accent bg-accent/5 rounded-lg cursor-pointer transition-all"
                              onClick={() => {
                                setOrderAddress({
                                  address_name: selectedAddress.address_name,
                                  phone: selectedAddress.phone,
                                  nation: selectedAddress.nation || "대한민국",
                                  postal_code: selectedAddress.postal_code,
                                  address1: selectedAddress.address,
                                  address2: "",
                                  address_memo: selectedAddress.address_memo || "",
                                });
                                setSelectedAddressId(selectedAddress.address_id);
                                setIsNewAddress(false);
                              }}
                            >
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="font-medium text-ink text-sm">
                                      {selectedAddress.address_name}
                                    </span>
                                    <Badge variant="info" size="sm">
                                      선택됨
                                    </Badge>
                                  </div>
                                  <p className="text-xs text-muted mb-1">
                                    {selectedAddress.phone}
                                  </p>
                                  <p className="text-xs text-muted">
                                    ({selectedAddress.postal_code}) {selectedAddress.address}
                                  </p>
                                  {selectedAddress.address_memo && (
                                    <p className="text-xs text-muted mt-1">
                                      메모: {selectedAddress.address_memo}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      }
                      
                      // 선택된 배송지가 없으면 전체 목록 표시
                      return (
                        <div className="grid grid-cols-1 gap-2">
                          {customerAddresses.map((address) => (
                            <div
                              key={address.address_id}
                              className="p-3 border border-line rounded-lg cursor-pointer transition-all hover:border-accent/50 hover:bg-neutral-50"
                              onClick={() => {
                                setOrderAddress({
                                  address_name: address.address_name,
                                  phone: address.phone,
                                  nation: address.nation || "대한민국",
                                  postal_code: address.postal_code,
                                  address1: address.address,
                                  address2: "",
                                  address_memo: address.address_memo || "",
                                });
                                setSelectedAddressId(address.address_id);
                                setIsNewAddress(false);
                              }}
                            >
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="font-medium text-ink text-sm">
                                      {address.address_name}
                                    </span>
                                  </div>
                                  <p className="text-xs text-muted mb-1">
                                    {address.phone}
                                  </p>
                                  <p className="text-xs text-muted">
                                    ({address.postal_code}) {address.address}
                                  </p>
                                  {address.address_memo && (
                                    <p className="text-xs text-muted mt-1">
                                      메모: {address.address_memo}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                    
                    {!addressLoading && customerAddresses.length === 0 && (
                      <div className="p-4 text-center text-sm text-muted border border-line rounded-lg bg-paper">
                        <p className="font-medium mb-1">저장된 배송지가 없습니다.</p>
                        <p className="text-xs">새 배송지를 입력해주세요.</p>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* 배송지 입력 폼 */}
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
                  placeholder="홍길동"
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
                  placeholder="010-1234-5678"
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
                      placeholder="12345"
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
                <div className="col-span-2">
                <Input
                  label="주소"
                  value={orderAddress.address1}
                  onChange={(e) =>
                    setOrderAddress({
                      ...orderAddress,
                      address1: e.target.value,
                    })
                  }
                    placeholder="주소와 상세주소를 모두 입력하세요 (예: 서울시 강남구 테헤란로 123 101동 101호)"
                  required
                  />
                  <p className="text-xs text-muted mt-1">
                    주소와 상세주소를 모두 입력해주세요
                  </p>
                </div>
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
                    placeholder="예: 부재 시 경비실에 맡겨주세요"
                    rows={2}
                  />
                </div>
              </div>
            </div>
          </Card>

            {/* 상품 정보 */}
          <Card className="unified-card">
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <Package className="w-4 h-4 text-accent" />
                <h3 className="text-sm font-semibold text-ink uppercase tracking-wide">
                  상품 정보
                </h3>
              </div>

              {/* 책 종류 선택 */}
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-ink mb-2 block">
                    책 종류 선택
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {BOOK_TYPES.map((bookType) => (
                      <button
                        key={bookType.id}
                        type="button"
                        onClick={() => handleBookTypeSelect(bookType.id)}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                          selectedBookType === bookType.id
                            ? "bg-accent text-white shadow-sm"
                            : "bg-white text-ink border border-line hover:border-accent/50 hover:bg-accent/5"
                        }`}
                      >
                        {bookType.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* 상품 검색 */}
              <div className="space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted" />
                  <input
                    type="text"
                    placeholder="예: 말씀함께[기본판] 또는 MSH202401"
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    className="unified-input pl-10 w-full"
                    autoComplete="off"
                  />
                  {productSearchLoading && (
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                      <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin"></div>
                    </div>
                  )}
                </div>
              </div>

              {/* 선택된 책 종류 표시 */}
              {selectedBookType && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted">선택된 책:</span>
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-accent/10 text-accent rounded-md text-sm font-medium">
                    {BOOK_TYPES.find((bt) => bt.id === selectedBookType)?.label}
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedBookType(null);
                        setProductSearch("");
                        setProductSearchResults([]);
                      }}
                      className="hover:text-accent/80"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              )}

              {/* 검색 결과 */}
              {selectedBookType && filteredByBookType.length > 0 && (
                <div className="border border-line rounded-lg overflow-hidden">
                  <div className="max-h-96 overflow-y-auto">
                    <div className="grid grid-cols-2 gap-0">
                      {/* 연간 구독 */}
                      {groupedResults["YEARLY"] && (
                        <div className="border-r border-line last:border-r-0">
                          <div className="px-3 py-2 bg-neutral-50 border-b border-line">
                            <span className="text-xs font-semibold text-muted uppercase tracking-wide">
                              {kindLabels["YEARLY"] || "연간 구독"} ({groupedResults["YEARLY"].length})
                            </span>
                          </div>
                          <div className="divide-y divide-line">
                            {groupedResults["YEARLY"].map((product) => {
                              const globalIndex = filteredByBookType.findIndex(
                                (p) => p.product_id === product.product_id
                              );
                              const isHighlighted = globalIndex === highlightedIndex;
                              return (
                                <div
                                  key={product.product_id}
                                  className={`p-3 cursor-pointer transition-colors ${
                                    isHighlighted
                                      ? "bg-accent/10"
                                      : "hover:bg-neutral-50"
                                  }`}
                                  onClick={() => handleSelectProduct(product)}
                                  onMouseEnter={() => setHighlightedIndex(globalIndex)}
                                >
                                  <div className="flex items-center gap-2">
                                    <p className="text-sm font-medium text-ink flex-1 truncate">
                                      {product.product_name}
                                    </p>
                                    <Badge variant="info" size="sm">
                                      연간
                                    </Badge>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                      
                      {/* 월간 단품 */}
                      {groupedResults["MONTHLY"] && (
                        <div>
                          <div className="px-3 py-2 bg-neutral-50 border-b border-line">
                            <span className="text-xs font-semibold text-muted uppercase tracking-wide">
                              {kindLabels["MONTHLY"] || "월간 단품"} ({groupedResults["MONTHLY"].length})
                            </span>
                          </div>
                          <div className="divide-y divide-line">
                            {groupedResults["MONTHLY"].map((product) => {
                              const globalIndex = filteredByBookType.findIndex(
                                (p) => p.product_id === product.product_id
                              );
                              const isHighlighted = globalIndex === highlightedIndex;
                              return (
                                <div
                                  key={product.product_id}
                                  className={`p-3 cursor-pointer transition-colors ${
                                    isHighlighted
                                      ? "bg-accent/10"
                                      : "hover:bg-neutral-50"
                                  }`}
                                  onClick={() => handleSelectProduct(product)}
                                  onMouseEnter={() => setHighlightedIndex(globalIndex)}
                                >
                                  <div className="flex items-center gap-2">
                                    <p className="text-sm font-medium text-ink flex-1 truncate">
                                      {product.product_name}
                                    </p>
                                    <Badge variant="success" size="sm">
                                      월간
                                    </Badge>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                      
                      {/* 단행본 (전체 너비) */}
                      {groupedResults["SINGLE"] && (
                        <div className="col-span-2 border-t border-line">
                          <div className="px-3 py-2 bg-neutral-50 border-b border-line">
                            <span className="text-xs font-semibold text-muted uppercase tracking-wide">
                              {kindLabels["SINGLE"] || "단행본"} ({groupedResults["SINGLE"].length})
                            </span>
                          </div>
                          <div className="divide-y divide-line">
                            {groupedResults["SINGLE"].map((product) => {
                              const globalIndex = filteredByBookType.findIndex(
                                (p) => p.product_id === product.product_id
                              );
                              const isHighlighted = globalIndex === highlightedIndex;
                              return (
                                <div
                                  key={product.product_id}
                                  className={`p-3 cursor-pointer transition-colors ${
                                    isHighlighted
                                      ? "bg-accent/10"
                                      : "hover:bg-neutral-50"
                                  }`}
                                  onClick={() => handleSelectProduct(product)}
                                  onMouseEnter={() => setHighlightedIndex(globalIndex)}
                                >
                                  <div className="flex items-center gap-2">
                                    <p className="text-sm font-medium text-ink flex-1 truncate">
                                      {product.product_name}
                                    </p>
                                    <Badge variant="default" size="sm">
                                      단품
                                    </Badge>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  {productSearchResults.length >= 50 && (
                    <div className="px-3 py-2 bg-warning-50 border-t border-line text-xs text-warning-700 text-center">
                      검색 결과가 많습니다. 더 정확한 검색어를 입력해주세요.
                    </div>
                  )}
                </div>
              )}

              {/* 검색 결과 없음 */}
              {selectedBookType &&
                !productSearchLoading &&
                filteredByBookType.length === 0 &&
                productSearchResults.length > 0 && (
                  <div className="p-4 text-center text-sm text-muted border border-line rounded-lg bg-paper">
                    <p className="font-medium mb-1">
                      {BOOK_TYPES.find((bt) => bt.id === selectedBookType)?.label} 상품이 없습니다.
                    </p>
                    <p className="text-xs">다른 책 종류를 선택하거나 검색어를 변경해보세요.</p>
                  </div>
                )}

              {/* 전체 결과 없음 */}
              {selectedBookType &&
                !productSearchLoading &&
                productSearchResults.length === 0 && (
                  <div className="p-4 text-center text-sm text-muted border border-line rounded-lg bg-paper">
                    <p className="font-medium mb-1">상품을 불러올 수 없습니다.</p>
                    <p className="text-xs">잠시 후 다시 시도해주세요.</p>
                  </div>
                )}


              {/* 추가된 상품 목록 */}
              {products.length > 0 && (
                <div className="space-y-2 pt-4 border-t border-line">
                  <h4 className="text-sm font-semibold text-ink mb-2">
                    추가된 상품 ({products.length})
                  </h4>
                  {products.map((product) => (
                    <div
                      key={product.id}
                      className="p-3 bg-white rounded-lg border border-line"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
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
                          <span className="font-medium text-ink truncate">
                            {product.product_name}
                          </span>
                    </div>
                          <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              handleUpdateProductQuantity(
                                product.id!,
                                Math.max(1, product.order_num - 1)
                              )
                            }
                            disabled={product.order_num <= 1}
                            className="h-7 w-7 p-0 flex items-center justify-center"
                          >
                            <Minus style={{ width: '14px', height: '14px', minWidth: '14px', minHeight: '14px' }} />
                          </Button>
                            <input
                        type="number"
                              min="1"
                            value={product.order_num}
                            onChange={(e) => {
                              const value = parseInt(e.target.value) || 1;
                              handleUpdateProductQuantity(product.id!, Math.max(1, value));
                            }}
                              className="w-12 h-7 px-1 text-center text-sm font-medium text-ink border border-line rounded-md focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent [&::-webkit-inner-spin-button]:hidden [&::-webkit-outer-spin-button]:hidden [-moz-appearance:textfield]"
                          />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                            onClick={() =>
                              handleUpdateProductQuantity(
                                product.id!,
                                product.order_num + 1
                              )
                            }
                            className="h-7 w-7 p-0 flex items-center justify-center"
                          >
                            <Plus style={{ width: '14px', height: '14px', minWidth: '14px', minHeight: '14px' }} />
                    </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              icon={X}
                              onClick={() => handleRemoveProduct(product.id!)}
                              className="flex-shrink-0 ml-1"
                            >
                              <span className="sr-only">제거</span>
                            </Button>
                </div>
                    </div>
                      <div className="mt-3">
                        {/* 정가, 할인가, 구독 기간, 메모 한 줄 배치 */}
                        <div className="grid grid-cols-5 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-muted mb-1">
                              정가 (원)
                            </label>
                            <input
                              type="number"
                              min="0"
                              value={product.price}
                              onChange={(e) => {
                                const value = parseInt(e.target.value) || 0;
                                handleUpdateProductPrice(product.id!, value);
                              }}
                              className="w-full h-8 px-2 text-sm text-ink border border-line rounded-md focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent [&::-webkit-inner-spin-button]:hidden [&::-webkit-outer-spin-button]:hidden [-moz-appearance:textfield]"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-muted mb-1">
                              할인가 (원)
                            </label>
                            <input
                              type="number"
                              min="0"
                              value={product.sale}
                              onChange={(e) => {
                                const value = parseInt(e.target.value) || 0;
                                handleUpdateProductSale(product.id!, value);
                              }}
                              className="w-full h-8 px-2 text-sm text-ink border border-line rounded-md focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent [&::-webkit-inner-spin-button]:hidden [&::-webkit-outer-spin-button]:hidden [-moz-appearance:textfield]"
                            />
                          </div>
                          {product.product_kind === "YEARLY" ? (
                            <div>
                              <label className="block text-xs font-medium text-muted mb-1">
                                구독 기간 (개월)
                              </label>
                              <input
                                type="number"
                                min="1"
                                value={product.subscribe_period || ""}
                                onChange={(e) => {
                                  const value = parseInt(e.target.value) || 1;
                                  handleUpdateProductSubscribePeriod(product.id!, value);
                                }}
                                className="w-full h-8 px-2 text-sm text-ink border border-line rounded-md focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent [&::-webkit-inner-spin-button]:hidden [&::-webkit-outer-spin-button]:hidden [-moz-appearance:textfield]"
                              />
                            </div>
                          ) : (
                            <div></div>
                          )}
                          <div className="col-span-2">
                            <label className="block text-xs font-medium text-muted mb-1">
                              메모
                            </label>
                            <input
                              type="text"
                              value={product.memo || ""}
                              onChange={(e) => handleUpdateProductMemo(product.id!, e.target.value)}
                              placeholder="예: 특별 포장 요청"
                              className="w-full h-8 px-2 text-sm text-ink border border-line rounded-md focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>

          {/* 결제 정보 */}
          <Card className="unified-card">
            <div className="p-6 space-y-6">
              <div className="flex items-center gap-2 mb-4">
                <CreditCard className="w-4 h-4 text-accent" />
                <h3 className="text-sm font-semibold text-ink uppercase tracking-wide">
                  결제 정보
                </h3>
              </div>

              {/* 할인 금액 및 배송비 입력 */}
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

              {/* 계산 흐름 - 가로 배치 */}
              <div className="flex flex-wrap items-center gap-2">
                {/* 주문금액 */}
                <div className="p-3 bg-white rounded-lg border border-line flex-shrink-0">
                  <div className="text-xs text-muted mb-1">주문금액</div>
                  <div className="text-base font-bold text-ink whitespace-nowrap">
                  {totalAmount.toLocaleString()}원
              </div>
            </div>

                {/* 할인금액 */}
                {discountAmount > 0 ? (
                  <>
                    <div className="flex items-center justify-center text-danger">
                      <Minus className="w-4 h-4" />
                    </div>
                    <div className="p-3 bg-red-50/50 rounded-lg border border-red-200/50 flex-shrink-0">
                      <div className="text-xs text-danger-700 mb-1">할인금액</div>
                      <div className="text-base font-bold text-danger whitespace-nowrap">
                        {discountAmount.toLocaleString()}원
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center justify-center text-muted opacity-40">
                      <Minus className="w-4 h-4" />
                    </div>
                    <div className="p-3 bg-white/50 rounded-lg border border-line/50 flex-shrink-0 opacity-40">
                      <div className="text-xs text-muted mb-1">할인금액</div>
                      <div className="text-base font-bold text-muted whitespace-nowrap">-</div>
                    </div>
                  </>
                )}

                {/* 배송비 */}
                {sendFee > 0 ? (
                  <>
                    <div className="flex items-center justify-center text-success-600">
                      <Plus className="w-4 h-4" />
                    </div>
                    <div className="p-3 bg-green-50/50 rounded-lg border border-green-200/50 flex-shrink-0">
                      <div className="text-xs text-success-700 mb-1">배송비</div>
                      <div className="text-base font-bold text-success-600 whitespace-nowrap">
                        {sendFee.toLocaleString()}원
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center justify-center text-muted opacity-40">
                      <Plus className="w-4 h-4" />
                    </div>
                    <div className="p-3 bg-white/50 rounded-lg border border-line/50 flex-shrink-0 opacity-40">
                      <div className="text-xs text-muted mb-1">배송비</div>
                      <div className="text-base font-bold text-muted whitespace-nowrap">-</div>
                    </div>
                  </>
                )}

                {/* 등호 */}
                <div className="flex items-center justify-center">
                  <span className="text-lg font-bold text-accent">=</span>
                </div>

                {/* 최종 결제금액 */}
                <div className="p-3 bg-gradient-to-br from-accent/20 to-accent/10 rounded-lg border border-accent/50 flex-shrink-0">
                  <div className="text-xs text-accent-700 mb-1 font-semibold">최종 결제금액</div>
                  <div className="text-lg font-bold text-accent whitespace-nowrap">
                      {finalPaymentAmount.toLocaleString()}원
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* 주문 정보 */}
          <Card className="unified-card">
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <FileText className="w-4 h-4 text-accent" />
                <h3 className="text-sm font-semibold text-ink uppercase tracking-wide">
                  주문 정보
                </h3>
              </div>
              <div className="space-y-4">
                {/* 주문 경로 및 외부 주문 ID */}
              <div className="grid grid-cols-2 gap-4">
            <div>
                  <label className="unified-label mb-2 block">
                      주문 경로 <span className="text-red-500 ml-1">*</span>
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
                  <div>
                <Input
                      label="외부 주문 ID"
                      type="text"
                      value={externalOrderId}
                      onChange={(e) => setExternalOrderId(e.target.value)}
                      placeholder="예: CAFE24-20240101-12345"
                      disabled={orderChannel === OrderChannel.OFFLINE}
                    />
                  </div>
                </div>

                {/* 결제 방법 */}
                <div>
                  <label className="unified-label mb-2 block">
                    결제 방법
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {PAYMENT_METHOD_OPTIONS.map((method) => {
                      const isSelected = paymentMethod === method;
                      return (
                        <button
                          key={method}
                          type="button"
                          onClick={() => setPaymentMethod(method)}
                          className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                            isSelected
                              ? "bg-accent text-white shadow-sm"
                              : "bg-paper text-ink border border-line hover:border-accent/50 hover:bg-accent/5"
                          }`}
                        >
                          {method}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 결제 여부 확인 */}
                <div className="flex items-center gap-3 p-4 bg-neutral-50 rounded-lg border border-line">
                  <input
                    type="checkbox"
                    id="isPaid"
                    checked={isPaid}
                    onChange={(e) => handlePaymentToggle(e.target.checked)}
                    className="w-5 h-5 text-accent border-line rounded focus:ring-2 focus:ring-accent focus:ring-offset-0 cursor-pointer"
                  />
                  <label htmlFor="isPaid" className="text-sm font-medium text-ink cursor-pointer flex-1">
                    결제를 완료했습니다
                  </label>
                </div>

                {/* 주문 상태 */}
                <div>
                  <label className="unified-label mb-2 block">
                    주문 상태 <span className="text-red-500 ml-1">*</span>
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {Object.values(OrderStatus).map((status) => {
                      const isSelected = orderStatus === status;
                      return (
                        <button
                          key={status}
                          type="button"
                          onClick={() => {
                            setOrderStatus(status);
                            // 주문 상태가 PAID로 변경되면 결제 여부 체크
                            if (status === OrderStatus.PAID) {
                              setIsPaid(true);
                              if (!paymentAt) {
                                setPaymentAt(new Date().toISOString().slice(0, 16));
                              }
                            } else {
                              setIsPaid(false);
                            }
                          }}
                          className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                            isSelected
                              ? "bg-accent text-white shadow-sm"
                              : "bg-paper text-ink border border-line hover:border-accent/50 hover:bg-accent/5"
                          }`}
                        >
                          {ORDER_STATUS_LABELS[status] || status}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 결제 일시 (결제 완료일 때만 표시) */}
                {isPaid && (
                <Input
                  label="결제 일시"
                  type="datetime-local"
                  value={paymentAt}
                  onChange={(e) => setPaymentAt(e.target.value)}
                    required
                  />
                )}
            </div>
            </div>
          </Card>

          {/* 메모 */}
          <Card className="unified-card">
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <MessageSquare className="w-4 h-4 text-accent" />
                <h3 className="text-sm font-semibold text-ink uppercase tracking-wide">
                  메모
                </h3>
              </div>
              <Textarea
                label="고객 요청사항"
                value={requestMemo}
                onChange={(e) => setRequestMemo(e.target.value)}
                placeholder="예: 부재 시 경비실에 맡겨주세요"
                rows={2}
              />
              <Textarea
                label="관리자 메모"
                value={adminMemo}
                onChange={(e) => setAdminMemo(e.target.value)}
                    placeholder="예: VIP 고객, 특별 할인 적용"
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
