import React, { useState, useEffect } from "react";
import {
  Package,
  User,
  MapPin,
  Truck,
  FileText,
  CreditCard,
  Calendar,
  DollarSign,
  Plus,
  Minus,
  ArrowRight,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { ordersApi } from "../api/ordersApi";
import { customersApi } from "../api/customersApi";
import { addressesApi } from "../api/addressesApi";
import { orderItemsApi } from "../api/orderItemsApi";
import { sendsApi } from "../api/sendsApi";
import type {
  OrderResponse,
} from "../types/order";
import type { OrderItemResponse } from "../types/orderItem";
import type { CustomerResponse } from "../types/customer";
import type { AddressResponse } from "../types/address";
import type { SendListResponse } from "../types/send";
import Badge from "../components/common/Badge";
import Tabs from "../components/common/Tabs";
import LoadingSpinner from "../components/common/LoadingSpinner";
import Modal from "../components/common/Modal";
import {
  OrderChannel,
  OrderStatus,
  ORDER_CHANNEL_LABELS,
} from "../utils/constants";

interface OrderDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: number | null;
}

const OrderDetailModal: React.FC<OrderDetailModalProps> = ({
  isOpen,
  onClose,
  orderId,
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 주문 데이터
  const [order, setOrder] = useState<OrderResponse | null>(null);
  const [orderItems, setOrderItems] = useState<OrderItemResponse[]>([]);
  const [customer, setCustomer] = useState<CustomerResponse | null>(null);
  const [address, setAddress] = useState<AddressResponse | null>(null);
  const [sends, setSends] = useState<SendListResponse[]>([]);

  // 탭별 로딩 상태
  const [loadingItems, setLoadingItems] = useState(false);
  const [loadingCustomer, setLoadingCustomer] = useState(false);
  const [loadingAddress, setLoadingAddress] = useState(false);
  const [loadingSends, setLoadingSends] = useState(false);

  // 탭 상태
  const [activeTab, setActiveTab] = useState("order");
  
  // 주문 품목 토글 상태
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());
  
  const toggleItem = (itemId: number) => {
    setExpandedItems((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  };

  useEffect(() => {
    if (isOpen && orderId) {
      fetchOrderDetail(orderId);
    } else {
      // 모달이 닫히면 상태 초기화
      setOrder(null);
      setOrderItems([]);
      setCustomer(null);
      setAddress(null);
      setActiveTab("order");
      setError(null);
      setLoading(true);
    }
  }, [isOpen, orderId]);

  const fetchOrderDetail = async (id: number) => {
    try {
      setLoading(true);
      setError(null);

      // 주문 기본 정보만 가져오기
      const orderResponse = await ordersApi.getOrder(id);
      if (!orderResponse.data.data) {
        throw new Error("주문 정보를 불러올 수 없습니다.");
      }
      const orderData = orderResponse.data.data;
      setOrder(orderData);
    } catch (err: any) {
      console.error("주문 상세 정보를 불러오는데 실패했습니다.", err);
      setError(
        err.response?.data?.message ||
          err.message ||
          "주문 상세 정보를 불러오는데 실패했습니다."
      );
    } finally {
      setLoading(false);
    }
  };

  // 탭별 데이터 로딩
  const loadTabData = async (tab: string) => {
    if (!order) return;

    switch (tab) {
      case "items":
        if (orderItems.length === 0 && !loadingItems) {
          try {
            setLoadingItems(true);
            const response = await orderItemsApi.getItemsByOrder(order.order_id);
            if (response.data.data) {
              setOrderItems(response.data.data);
            }
          } catch (err) {
            console.error("주문 품목을 불러오는데 실패했습니다.", err);
          } finally {
            setLoadingItems(false);
          }
        }
        break;

      case "customer":
        if (!customer && order.customer_id && !loadingCustomer) {
          try {
            setLoadingCustomer(true);
            const response = await customersApi.getCustomer(order.customer_id);
            if (response.data.data) {
              setCustomer(response.data.data);
            }
          } catch (err) {
            console.error("고객 정보를 불러오는데 실패했습니다.", err);
          } finally {
            setLoadingCustomer(false);
          }
        }
        break;

      case "address":
        if (!address && order.address_id && !loadingAddress) {
          try {
            setLoadingAddress(true);
            const response = await addressesApi.getAddress(order.address_id);
            if (response.data.data) {
              setAddress(response.data.data);
            }
          } catch (err) {
            console.error("배송지 정보를 불러오는데 실패했습니다.", err);
          } finally {
            setLoadingAddress(false);
          }
        }
        break;

      case "sends":
        if (sends.length === 0 && !loadingSends) {
          try {
            setLoadingSends(true);
            const response = await sendsApi.getSendsByOrder(order.order_id);
            if (response.data.data) {
              setSends(response.data.data);
            }
          } catch (err) {
            console.error("발송 정보를 불러오는데 실패했습니다.", err);
          } finally {
            setLoadingSends(false);
          }
        }
        break;
    }
  };

  // 탭 변경 시 데이터 로딩
  useEffect(() => {
    if (order && activeTab) {
      loadTabData(activeTab);
    }
  }, [activeTab, order]);

  // 구독 호수를 포맷하는 함수 (예: "202501" -> "25년 01월호")
  const formatIssue = (issue: string | null): string => {
    if (!issue || issue.length !== 6) return "-";
    const year = issue.substring(0, 4);
    const month = issue.substring(4, 6);
    const shortYear = year.substring(2);
    return `${shortYear}년 ${month}월호`;
  };

  // 날짜 포맷 함수
  const formatDateTime = (dateString: string | null | undefined): string => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // 금액 포맷 함수
  const formatAmount = (amount: number | null | undefined): string => {
    if (amount === null || amount === undefined) return "0원";
    return `${Number(amount).toLocaleString()}원`;
  };

  const getOrderStatusBadge = (status: OrderStatus) => {
    const statusMap: Record<
      OrderStatus,
      {
        variant: "warning" | "info" | "success" | "danger" | "default";
        label: string;
      }
    > = {
      ORDERED: { variant: "warning", label: "주문됨" },
      PAID: { variant: "info", label: "결제완료" },
      SHIPPING: { variant: "success", label: "배송중" },
      COMPLETED: { variant: "success", label: "완료" },
      CANCELLED: { variant: "danger", label: "취소됨" },
    };
    return statusMap[status] || { variant: "default" as const, label: status };
  };

  const tabs = [
    { key: "order", label: "주문", icon: <FileText className="w-4 h-4" /> },
    { key: "items", label: "주문 품목", icon: <Package className="w-4 h-4" /> },
    { key: "customer", label: "고객", icon: <User className="w-4 h-4" /> },
    { key: "address", label: "배송지", icon: <MapPin className="w-4 h-4" /> },
    { key: "sends", label: "발송", icon: <Truck className="w-4 h-4" /> },
  ];

  // 금액 정보 컴포넌트 - 계산 흐름을 보여주는 형태
  const AmountCard = ({ 
    label, 
    amount, 
    isHighlight = false,
    isNegative = false
  }: { 
    label: string; 
    amount: number; 
    isHighlight?: boolean;
    isNegative?: boolean;
  }) => (
    <div className={`p-4 rounded-lg border ${isHighlight ? 'bg-accent/10 border-2 border-accent/40' : 'bg-white border border-line'}`}>
      <div className="text-xs text-muted mb-2">{label}</div>
      <div className={`${isHighlight ? 'text-2xl' : 'text-lg'} font-bold ${isNegative && amount > 0 ? 'text-danger' : isHighlight ? 'text-accent' : 'text-ink'}`}>
        {isNegative && amount > 0 ? '-' : ''}{formatAmount(amount)}
      </div>
    </div>
  );

  // 날짜 정보 컴포넌트 - 타임라인처럼
  const DateTimeCard = ({ 
    label, 
    value, 
    isImportant = false,
    isWarning = false
  }: { 
    label: string; 
    value: string; 
    isImportant?: boolean;
    isWarning?: boolean;
  }) => (
    <div className={`p-3 rounded-lg border ${isWarning ? 'bg-red-50/50 border-red-200/50' : 'bg-white border border-line'}`}>
      <div className="text-xs text-muted mb-1.5">{label}</div>
      <div className={`text-sm ${isImportant ? 'font-bold' : 'font-medium'} ${isWarning ? 'text-danger' : 'text-ink'}`}>
        {value}
      </div>
    </div>
  );

  // ID 정보 컴포넌트 - 작고 덜 중요하게
  const IdCard = ({ 
    label, 
    value 
  }: { 
    label: string; 
    value: string | number; 
  }) => (
    <div className="flex items-center justify-between p-2.5 bg-white/50 rounded border border-line/50">
      <span className="text-xs text-muted">{label}</span>
      <span className="text-xs font-mono text-muted">#{value}</span>
    </div>
  );

  // 텍스트 정보 컴포넌트 - 읽기 쉽게
  const TextCard = ({ 
    label, 
    value 
  }: { 
    label: string; 
    value: string; 
  }) => (
    <div className="p-3 bg-white rounded-lg border border-line">
      <div className="text-xs text-muted mb-2">{label}</div>
      <div className="text-sm font-medium text-ink">{value}</div>
    </div>
  );

  // 메모 컴포넌트 - 넓은 공간, 읽기 쉽게
  const MemoCard = ({ 
    title, 
    content,
    variant = "default"
  }: { 
    title: string; 
    content: string;
    variant?: "default" | "info" | "warning";
  }) => {
    const variantStyles = {
      default: "bg-paper border-line",
      info: "bg-blue-50/50 border-blue-200/50",
      warning: "bg-amber-50/50 border-amber-200/50"
    };
    return (
      <div className={`p-5 rounded-lg border ${variantStyles[variant]}`}>
        <div className="text-sm font-semibold text-ink mb-3">{title}</div>
        <div className="text-sm text-ink whitespace-pre-wrap leading-relaxed bg-white/80 p-4 rounded border border-line/50 min-h-[80px]">
          {content}
        </div>
      </div>
    );
  };

  // 주소 컴포넌트 - 지도처럼 생각하기 쉽게
  const AddressCard = ({ address }: { address: AddressResponse }) => (
    <div className="p-5 bg-paper rounded-lg border border-line">
      <div className="flex items-center gap-2 mb-4">
        <MapPin className="w-4 h-4 text-success-600" />
        <h3 className="text-sm font-semibold text-ink">배송 주소</h3>
      </div>
      <div className="space-y-3">
        <div className="flex items-center gap-2 p-3 bg-white rounded-lg border border-line">
          <span className="text-xs text-muted w-16">우편번호</span>
          <span className="text-sm font-mono font-semibold text-ink">{address.postal_code}</span>
        </div>
        <div className="p-4 bg-white rounded-lg border-2 border-success-200">
          <div className="text-xs text-muted mb-2">주소</div>
          <p className="text-sm font-medium text-ink leading-relaxed">{address.address}</p>
        </div>
        {address.nation && address.nation !== "대한민국" && (
          <div className="p-2 bg-white/50 rounded border border-line">
            <span className="text-xs text-muted">국가: </span>
            <span className="text-xs font-medium text-ink">{address.nation}</span>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`주문 상세 - ${
        order?.external_order_id || (orderId ? `#${orderId}` : "")
      }`}
      size="full"
    >
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <LoadingSpinner />
        </div>
      ) : error || !order ? (
        <div className="text-center py-12">
          <p className="text-sm text-danger">
            {error || "주문을 찾을 수 없습니다."}
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {/* 탭 */}
          <div>
            <Tabs
              tabs={tabs}
              activeTab={activeTab}
              onChange={setActiveTab}
            />
          </div>

          {/* 탭 컨텐츠 */}
          <div className="space-y-5">
            {/* 주문 탭 */}
            {activeTab === "order" && (
              <div className="space-y-5">
                {/* 기본 정보 섹션 */}
                <div className="p-5 bg-paper rounded-lg border border-line">
                  <div className="flex items-center gap-2 mb-4">
                    <FileText className="w-4 h-4 text-accent" />
                    <h3 className="text-sm font-bold text-ink">기본 정보</h3>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted min-w-[100px]">외부 주문 ID:</span>
                      <span className="text-sm font-mono font-medium text-ink">
                        {order.external_order_id || "-"}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted min-w-[100px]">주문 채널:</span>
                      <Badge
                        variant={
                          order.order_channel === "CAFE24"
                            ? "cafe24"
                            : order.order_channel === "GPMALL"
                            ? "gpmall"
                            : "default"
                        }
                        size="sm"
                      >
                        {ORDER_CHANNEL_LABELS[order.order_channel as OrderChannel] ||
                          order.order_channel}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted min-w-[100px]">주문 상태:</span>
                      {(() => {
                        const status = getOrderStatusBadge(
                          order.order_status as OrderStatus
                        );
                        return (
                          <Badge variant={status.variant} size="sm">
                            {status.label}
                          </Badge>
                        );
                      })()}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted min-w-[100px]">결제 방법:</span>
                      <span className="text-sm font-medium text-ink">
                        {order.payment_method || "-"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 금액 정보 섹션 - 계산 흐름을 시각적으로 표현 */}
                <div className="p-5 bg-gradient-to-br from-paper to-accent/5 rounded-lg border border-line">
                  <div className="flex items-center gap-2 mb-4">
                    <DollarSign className="w-4 h-4 text-accent" />
                    <h3 className="text-sm font-bold text-ink">금액 정보</h3>
                  </div>
                  
                  {/* 계산 흐름 - 가로 배치 */}
                  <div className="flex flex-wrap items-center gap-2">
                    {/* 주문금액 */}
                    <div className="p-3 bg-white rounded-lg border border-line flex-shrink-0">
                      <div className="text-xs text-muted mb-1">주문금액</div>
                      <div className="text-base font-bold text-ink whitespace-nowrap">
                        {formatAmount(order.total_amount || 0)}
                      </div>
                    </div>

                    {/* 할인금액 */}
                    {(order.discount_amount && order.discount_amount > 0) ? (
                      <>
                        <div className="flex items-center justify-center text-danger">
                          <Minus className="w-4 h-4" />
                        </div>
                        <div className="p-3 bg-red-50/50 rounded-lg border border-red-200/50 flex-shrink-0">
                          <div className="text-xs text-danger-700 mb-1">할인금액</div>
                          <div className="text-base font-bold text-danger whitespace-nowrap">
                            {formatAmount(order.discount_amount)}
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
                    {(order.send_fee && order.send_fee > 0) ? (
                      <>
                        <div className="flex items-center justify-center text-success-600">
                          <Plus className="w-4 h-4" />
                        </div>
                        <div className="p-3 bg-green-50/50 rounded-lg border border-green-200/50 flex-shrink-0">
                          <div className="text-xs text-success-700 mb-1">배송비</div>
                          <div className="text-base font-bold text-success-600 whitespace-nowrap">
                            {formatAmount(order.send_fee)}
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
                        {formatAmount(order.payment_amount || 0)}
                      </div>
                    </div>

                    {/* 환불금액 */}
                    {(order.refund_amount && order.refund_amount > 0) ? (
                      <>
                        <div className="flex items-center justify-center text-danger">
                          <ArrowRight className="w-4 h-4" />
                        </div>
                        <div className="p-3 bg-red-50/80 rounded-lg border border-red-300/50 flex-shrink-0">
                          <div className="text-xs text-danger-700 mb-1 font-semibold">환불금액</div>
                          <div className="text-base font-bold text-danger whitespace-nowrap">
                            -{formatAmount(order.refund_amount)}
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex items-center justify-center text-muted opacity-40">
                          <ArrowRight className="w-4 h-4" />
                        </div>
                        <div className="p-3 bg-white/50 rounded-lg border border-line/50 flex-shrink-0 opacity-40">
                          <div className="text-xs text-muted mb-1 font-semibold">환불금액</div>
                          <div className="text-sm font-medium text-muted whitespace-nowrap">
                            환불하지 않음
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* 일시 정보 섹션 */}
                <div className="p-5 bg-paper rounded-lg border border-line">
                  <div className="flex items-center gap-2 mb-4">
                    <Calendar className="w-4 h-4 text-accent" />
                    <h3 className="text-sm font-bold text-ink">일시 정보</h3>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted min-w-[100px]">주문 일시:</span>
                      <span className="text-sm font-bold text-ink">
                        {formatDateTime(order.order_at)}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted min-w-[100px]">결제 일시:</span>
                      <span className={`text-sm font-medium ${order.payment_at ? 'text-ink font-semibold' : 'text-muted'}`}>
                        {formatDateTime(order.payment_at)}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted min-w-[100px]">취소 일시:</span>
                      <span className={`text-sm font-medium ${order.cancelled_at ? 'text-danger font-semibold' : 'text-muted'}`}>
                        {formatDateTime(order.cancelled_at)}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 pt-2 border-t border-line">
                      <span className="text-xs text-muted min-w-[100px]">생성 일시:</span>
                      <span className="text-sm font-medium text-ink">
                        {formatDateTime(order.created_at)}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted min-w-[100px]">수정 일시:</span>
                      <span className="text-sm font-medium text-ink">
                        {formatDateTime(order.updated_at)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 메모 정보 섹션 */}
                <div className="space-y-4">
                  <MemoCard 
                    title="고객 요청사항" 
                    content={order.request_memo || "-"}
                    variant="info"
                  />
                  <MemoCard 
                    title="관리자 메모" 
                    content={order.admin_memo || "-"}
                    variant="warning"
                  />
                </div>
              </div>
            )}

            {/* 주문 품목 탭 */}
            {activeTab === "items" && (
              <div className="space-y-3">
                {loadingItems ? (
                  <div className="flex items-center justify-center py-12">
                    <LoadingSpinner />
                  </div>
                ) : orderItems.length > 0 ? (
                  orderItems.map((item, index) => {
                    const isExpanded = expandedItems.has(item.order_item_id);
                    return (
                      <div
                        key={item.order_item_id}
                        className="bg-paper rounded-lg border border-line hover:border-accent/40 transition-colors overflow-hidden"
                      >
                        {/* 상품 헤더 - 클릭 가능 */}
                        <div 
                          className="flex items-start gap-3 p-4 cursor-pointer hover:bg-paper/80 transition-colors"
                          onClick={() => toggleItem(item.order_item_id)}
                        >
                          <div className="w-6 h-6 bg-accent/10 rounded flex items-center justify-center text-accent text-xs font-bold flex-shrink-0">
                            {index + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <Badge
                                variant={
                                  item.product_kind === "YEARLY"
                                    ? "info"
                                    : item.product_kind === "MONTHLY"
                                    ? "success"
                                    : "default"
                                }
                                size="sm"
                              >
                                {item.product_kind === "YEARLY"
                                  ? "연간"
                                  : item.product_kind === "MONTHLY"
                                  ? "월간"
                                  : "단품"}
                              </Badge>
                              <p className="text-sm font-bold text-ink truncate">
                                {item.product_name}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-xs text-muted font-mono">
                                {item.product_code}
                              </p>
                              {item.external_order_item_id && (
                                <>
                                  <span className="text-xs text-muted">•</span>
                                  <p className="text-xs text-muted font-mono">
                                    외부 ID: {item.external_order_item_id}
                                  </p>
                                </>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-3 flex-shrink-0">
                            <div className="text-right">
                              <div className="text-sm font-bold text-accent">
                                {formatAmount(item.sale * item.order_num)}
                              </div>
                            </div>
                            {isExpanded ? (
                              <ChevronUp className="w-4 h-4 text-muted" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-muted" />
                            )}
                          </div>
                        </div>
                        
                        {/* 상세 정보 - 토글 */}
                        {isExpanded && (
                          <div className="px-4 pb-4 space-y-3 border-t border-line">

                            {/* 가격 정보 - 가로 배치 */}
                            <div className="flex flex-wrap items-center gap-2 pt-3">
                        {/* 정가 */}
                        <div className="p-2 bg-white rounded border border-line flex-shrink-0">
                          <div className="text-xs text-muted mb-0.5">정가</div>
                          <div className="text-sm font-semibold text-ink whitespace-nowrap">{formatAmount(item.price)}</div>
                        </div>
                        
                        {/* 할인금액 */}
                        {item.sale > 0 && item.price > item.sale ? (
                          <>
                            <div className="flex items-center justify-center text-danger">
                              <Minus className="w-3.5 h-3.5" />
                            </div>
                            <div className="p-2 bg-red-50/50 rounded border border-red-200/50 flex-shrink-0">
                              <div className="text-xs text-danger-700 mb-0.5">할인금액</div>
                              <div className="text-sm font-semibold text-danger whitespace-nowrap">
                                {formatAmount(item.price - item.sale)}
                              </div>
                            </div>
                          </>
                        ) : null}
                        
                        {/* 할인가 */}
                        {item.sale > 0 ? (
                          <>
                            <div className="flex items-center justify-center">
                              <span className="text-xs font-bold text-accent">=</span>
                            </div>
                            <div className="p-2 bg-green-50/50 rounded border border-green-200/50 flex-shrink-0">
                              <div className="text-xs text-success-700 mb-0.5">할인가</div>
                              <div className="text-sm font-semibold text-success-600 whitespace-nowrap">{formatAmount(item.sale)}</div>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="flex items-center justify-center opacity-40">
                              <span className="text-xs font-bold text-muted">=</span>
                            </div>
                            <div className="p-2 bg-white/50 rounded border border-line/50 flex-shrink-0 opacity-40">
                              <div className="text-xs text-muted mb-0.5">할인가</div>
                              <div className="text-sm font-medium text-muted whitespace-nowrap">-</div>
                            </div>
                          </>
                        )}
                        
                        {/* 수량 */}
                        <div className="flex items-center justify-center">
                          <span className="text-xs font-bold text-accent">×</span>
                        </div>
                        <div className="p-2 bg-white rounded border border-line flex-shrink-0">
                          <div className="text-xs text-muted mb-0.5">수량</div>
                          <div className="text-sm font-semibold text-ink whitespace-nowrap">{item.order_num}개</div>
                        </div>
                        
                        {/* 합계 */}
                        <div className="flex items-center justify-center">
                          <span className="text-sm font-bold text-accent">=</span>
                        </div>
                        <div className="p-2.5 bg-accent/10 rounded border border-accent/30 flex-shrink-0">
                          <div className="text-xs font-semibold text-ink mb-0.5">합계</div>
                          <div className="text-base font-bold text-accent whitespace-nowrap">
                            {formatAmount(item.sale * item.order_num)}
                          </div>
                        </div>

                        {/* 환불 */}
                        {item.refund && Number(item.refund) > 0 ? (
                          <>
                            <div className="flex items-center justify-center text-danger">
                              <ArrowRight className="w-3.5 h-3.5" />
                            </div>
                            <div className="p-2 bg-red-50/50 rounded border border-red-200/50 flex-shrink-0">
                              <div className="text-xs text-danger-700 mb-0.5">환불</div>
                              <div className="text-sm font-semibold text-danger whitespace-nowrap">-{formatAmount(item.refund)}</div>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="flex items-center justify-center text-muted opacity-40">
                              <ArrowRight className="w-3.5 h-3.5" />
                            </div>
                            <div className="p-2 bg-white/50 rounded border border-line/50 flex-shrink-0 opacity-40">
                              <div className="text-xs text-muted mb-0.5">환불</div>
                              <div className="text-sm font-medium text-muted whitespace-nowrap">환불하지 않음</div>
                            </div>
                          </>
                        )}
                      </div>

                            {/* 구독 정보 */}
                            {(item.subscribe_start_issue || item.subscribe_period || item.final_subscribe_end_issue || item.last_send_issue) && (
                              <div className="p-2.5 bg-blue-50/50 rounded border border-blue-200/50">
                          <div className="space-y-2">
                            {item.subscribe_start_issue && (
                              <div className="flex items-center gap-2 text-xs">
                                <span className="text-muted min-w-[80px]">구독 기간:</span>
                                <span className="font-semibold text-ink">
                                  {formatIssue(item.subscribe_start_issue)}
                                  {item.subscribe_end_issue && ` ~ ${formatIssue(item.subscribe_end_issue)}`}
                                </span>
                              </div>
                            )}
                            {item.subscribe_period && (
                              <div className="flex items-center gap-2 text-xs">
                                <span className="text-muted min-w-[80px]">구독 기간(개월):</span>
                                <span className="font-semibold text-ink">{item.subscribe_period}개월</span>
                              </div>
                            )}
                            {item.final_subscribe_end_issue && (
                              <div className="flex items-center gap-2 text-xs">
                                <span className="text-muted min-w-[80px]">최종 구독 종료:</span>
                                <span className="font-semibold text-ink">
                                  {formatIssue(item.final_subscribe_end_issue)}
                                </span>
                              </div>
                            )}
                            {item.last_send_issue && (
                              <div className="flex items-center gap-2 text-xs">
                                <span className="text-muted min-w-[80px]">마지막 발송:</span>
                                <span className="font-semibold text-ink">
                                  {formatIssue(item.last_send_issue)}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                            {/* 메모 */}
                            <div className="pt-2 border-t border-line">
                              <div className="text-xs text-muted mb-1">메모</div>
                              <div className="text-xs text-ink bg-white/50 p-2 rounded border border-line/50 whitespace-pre-wrap min-h-[40px]">
                                {item.memo || "-"}
                              </div>
                            </div>

                            {/* 일시 정보 */}
                            <div className="pt-3 border-t border-line">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                          <div className="flex items-center gap-2">
                            <span className="text-muted min-w-[80px]">생성 일시:</span>
                            <span className="font-medium text-ink">
                              {formatDateTime(item.created_at)}
                            </span>
                          </div>
                          {item.sended_at && (
                            <div className="flex items-center gap-2">
                              <span className="text-muted min-w-[80px]">발송 일시:</span>
                              <span className="font-medium text-ink">
                                {formatDateTime(item.sended_at)}
                              </span>
                            </div>
                          )}
                          {item.cancelled_at && (
                            <div className="flex items-center gap-2">
                              <span className="text-muted min-w-[80px]">취소 일시:</span>
                              <span className="font-semibold text-danger">
                                {formatDateTime(item.cancelled_at)}
                              </span>
                            </div>
                          )}
                          <div className="flex items-center gap-2">
                            <span className="text-muted min-w-[80px]">수정 일시:</span>
                            <span className="font-medium text-ink">
                              {formatDateTime(item.updated_at)}
                            </span>
                          </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-12">
                    <Package className="w-12 h-12 text-muted mx-auto mb-3 opacity-50" />
                    <p className="text-sm text-muted">주문 품목이 없습니다.</p>
                  </div>
                )}
              </div>
            )}

            {/* 고객 탭 */}
            {activeTab === "customer" && (
              <div className="space-y-5">
                {loadingCustomer ? (
                  <div className="flex items-center justify-center py-12">
                    <LoadingSpinner />
                  </div>
                ) : customer ? (
                  <>
                    {/* 고객 정보 */}
                    <div className="p-5 bg-paper rounded-lg border border-line">
                      <div className="flex items-center gap-2 mb-4">
                        <User className="w-4 h-4 text-accent" />
                        <h3 className="text-sm font-bold text-ink">고객 정보</h3>
                      </div>
                      <div className="space-y-3">
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-muted min-w-[100px]">고객명:</span>
                          <span className="text-sm font-semibold text-ink">{customer.customer_name}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-muted min-w-[100px]">연락처:</span>
                          <span className="text-sm font-medium text-ink">
                            {customer.customer_phone}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-muted min-w-[100px]">이메일:</span>
                          <span className="text-sm font-medium text-ink break-all">
                            {customer.customer_email || "-"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* 상세 정보 */}
                    <div className="p-5 bg-paper rounded-lg border border-line">
                      <div className="flex items-center gap-2 mb-4">
                        <FileText className="w-4 h-4 text-accent" />
                        <h3 className="text-sm font-bold text-ink">상세 정보</h3>
                      </div>
                      <div className="space-y-3">
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-muted min-w-[100px]">생성 채널:</span>
                          <Badge
                            variant={
                              customer.create_channel === "CAFE24"
                                ? "cafe24"
                                : customer.create_channel === "GPMALL"
                                ? "gpmall"
                                : "default"
                            }
                            size="sm"
                          >
                            {ORDER_CHANNEL_LABELS[
                              customer.create_channel as OrderChannel
                            ] || customer.create_channel}
                          </Badge>
                        </div>
                        {customer.last_order_at && (
                          <div className="flex items-center gap-3 pt-2 border-t border-line">
                            <span className="text-xs text-muted min-w-[100px]">최근 주문 일시:</span>
                            <span className="text-sm font-bold text-ink">
                              {formatDateTime(customer.last_order_at)}
                            </span>
                          </div>
                        )}
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-muted min-w-[100px]">생성 일시:</span>
                          <span className="text-sm font-medium text-ink">
                            {formatDateTime(customer.created_at)}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-muted min-w-[100px]">수정 일시:</span>
                          <span className="text-sm font-medium text-ink">
                            {formatDateTime(customer.updated_at)}
                          </span>
                        </div>
                        {customer.deleted_at && (
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-muted min-w-[100px]">삭제 일시:</span>
                            <span className="text-sm font-semibold text-danger">
                              {formatDateTime(customer.deleted_at)}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {customer.admin_memo && (
                      <MemoCard 
                        title="관리자 메모" 
                        content={customer.admin_memo}
                        variant="warning"
                      />
                    )}
                  </>
                ) : (
                  <div className="text-center py-12">
                    <User className="w-12 h-12 text-muted mx-auto mb-3 opacity-50" />
                    <p className="text-sm text-muted">고객 정보를 불러올 수 없습니다.</p>
                  </div>
                )}
              </div>
            )}

            {/* 배송지 탭 */}
            {activeTab === "address" && (
              <div className="space-y-5">
                {loadingAddress ? (
                  <div className="flex items-center justify-center py-12">
                    <LoadingSpinner />
                  </div>
                ) : address ? (
                  <>
                    {/* 수령인 정보 */}
                    <div className="p-5 bg-paper rounded-lg border border-line">
                      <div className="flex items-center gap-2 mb-4">
                        <User className="w-4 h-4 text-accent" />
                        <h3 className="text-sm font-bold text-ink">수령인 정보</h3>
                      </div>
                      <div className="space-y-3">
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-muted min-w-[100px]">수령인:</span>
                          <span className="text-sm font-semibold text-ink">{address.address_name}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-muted min-w-[100px]">연락처:</span>
                          <span className="text-sm font-medium text-ink">{address.phone}</span>
                        </div>
                      </div>
                    </div>

                    {/* 주소 정보 */}
                    <div className="p-5 bg-paper rounded-lg border border-line">
                      <div className="flex items-center gap-2 mb-4">
                        <MapPin className="w-4 h-4 text-accent" />
                        <h3 className="text-sm font-bold text-ink">주소 정보</h3>
                      </div>
                      <div className="space-y-3">
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-muted min-w-[100px]">우편번호:</span>
                          <span className="text-sm font-mono font-semibold text-ink">
                            {address.postal_code}
                          </span>
                        </div>
                        <div className="flex items-start gap-3 pt-2 border-t border-line">
                          <span className="text-xs text-muted min-w-[100px] pt-1">주소:</span>
                          <span className="text-sm font-medium text-ink leading-relaxed flex-1">
                            {address.address}
                          </span>
                        </div>
                        {address.nation && address.nation !== "대한민국" && (
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-muted min-w-[100px]">국가:</span>
                            <span className="text-sm font-medium text-ink">{address.nation}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* 배송 메모 */}
                    {address.address_memo && (
                      <MemoCard 
                        title="배송 메모" 
                        content={address.address_memo}
                        variant="info"
                      />
                    )}

                    {/* 기타 정보 */}
                    <div className="p-5 bg-paper rounded-lg border border-line">
                      <div className="flex items-center gap-2 mb-4">
                        <FileText className="w-4 h-4 text-accent" />
                        <h3 className="text-sm font-bold text-ink">기타 정보</h3>
                      </div>
                      <div className="space-y-3">
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-muted min-w-[100px]">생성 일시:</span>
                          <span className="text-sm font-medium text-ink">
                            {formatDateTime(address.created_at)}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-muted min-w-[100px]">수정 일시:</span>
                          <span className="text-sm font-medium text-ink">
                            {formatDateTime(address.updated_at)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-12">
                    <MapPin className="w-12 h-12 text-muted mx-auto mb-3 opacity-50" />
                    <p className="text-sm text-muted">배송지 정보를 불러올 수 없습니다.</p>
                  </div>
                )}
              </div>
            )}

            {/* 발송 탭 */}
            {activeTab === "sends" && (
              <div className="space-y-5">
                {loadingSends ? (
                  <div className="flex items-center justify-center py-12">
                    <LoadingSpinner />
                  </div>
                ) : sends.length > 0 ? (
                  <div className="space-y-3">
                    {sends.map((send) => (
                      <div
                        key={send.send_id}
                        className="p-4 bg-paper rounded-lg border border-line"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <Badge
                            variant={
                              send.send_status === "DELIVERED"
                                ? "success"
                                : send.send_status === "CANCELLED"
                                ? "default"
                                : "info"
                            }
                            size="sm"
                          >
                            {send.send_status}
                          </Badge>
                          {send.tracking_no && (
                            <span className="text-sm font-mono text-accent">
                              {send.tracking_no}
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-muted space-y-1">
                          <p>발송일: {send.send_date ? new Date(send.send_date).toLocaleDateString("ko-KR") : "-"}</p>
                          <p>택배사: {send.courier_company || "-"}</p>
                          <p>수령인: {send.address_name}</p>
                          <p>연락처: {send.phone}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Truck className="w-12 h-12 text-muted mx-auto mb-3 opacity-50" />
                    <p className="text-sm text-muted">발송 내역이 없습니다.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
};

export default OrderDetailModal;
