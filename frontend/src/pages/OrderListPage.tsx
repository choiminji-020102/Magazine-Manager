import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import * as XLSX from "xlsx";
import {
  Download,
  RefreshCw,
  Plus,
  Filter,
  Search,
  ChevronDown,
  ArrowUpDown,
  Package,
  CreditCard,
  Truck,
  Clock,
  AlertCircle,
  X,
  RotateCcw,
  Store,
  ShoppingCart,
  Building2,
  CheckCircle,
  XCircle,
} from "lucide-react";
import Card from "../components/common/Card";
import Button from "../components/common/Button";
import Badge from "../components/common/Badge";
import { Column } from "../components/common/Table";
import ListPage from "../components/common/ListPage";
import SlidePanel from "../components/common/SlidePanel";
import Tabs from "../components/common/Tabs";
import Textarea from "../components/common/Textarea";
import Input from "../components/common/Input";
import Breadcrumb from "../components/common/Breadcrumb";
import StatCard from "../components/common/StatCard";
import {
  OrderChannel,
  OrderStatus,
  ORDER_CHANNEL_LABELS,
  ORDER_STATUS_LABELS,
} from "../utils/constants";
import { ordersApi } from "../api/ordersApi";
import { addressesApi } from "../api/addressesApi";
import { orderItemsApi } from "../api/orderItemsApi";
import OrderDetailModal from "./OrderDetailPage";
import type {
  OrderListResponse,
  OrderListQuery,
  OrderResponse,
} from "../types/order";
import type { OrderItemDetailResponse, OrderItemResponse } from "../types/orderItem";
import type { AddressResponse, AddressCreate } from "../types/address";

const OrderListPage: React.FC = () => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<OrderListResponse[]>([]);
  const [loading, setLoading] = useState(false);

  // 탭 상태
  const [channelTab, setChannelTab] = useState<"ALL" | "CAFE24" | "GPMALL" | "OFFLINE">("ALL");

  // 필터 상태
  const [searchValue, setSearchValue] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [channelFilter, setChannelFilter] = useState<string>("");
  const [paymentFilter, setPaymentFilter] = useState<string>("");
  const [dateFilter, setDateFilter] = useState({ start: "", end: "" });
  const [showFilters, setShowFilters] = useState(false);
  const [showSortMenu, setShowSortMenu] = useState(false);
  const sortButtonRef = useRef<HTMLDivElement>(null);
  const [sortMenuPosition, setSortMenuPosition] = useState({ top: 0, left: 0 });

  // 페이지네이션
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(20);
  const [sortKey, setSortKey] = useState("order_at");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  // 선택된 주문
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());

  // 모달 상태
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);

  // 배송지 변경 모달 상태
  const [isAddressChangePanelOpen, setIsAddressChangePanelOpen] =
    useState(false);
  const [
    selectedOrderItemForAddressChange,
    setSelectedOrderItemForAddressChange,
  ] = useState<OrderItemDetailResponse | null>(null);
  const [newAddress, setNewAddress] = useState({
    address_name: "",
    phone: "",
    postal_code: "",
    address: "",
    address_memo: "",
  });
  const [currentAddress, setCurrentAddress] = useState<AddressResponse | null>(null);

  // 우편번호 검색 핸들러
  const handlePostcodeSearch = () => {
    if (typeof window !== "undefined" && (window as any).daum?.Postcode) {
      new (window as any).daum.Postcode({
        oncomplete: function (data: any) {
          // 주소 타입에 따라 주소 선택
          let addr = "";
          if (data.userSelectedType === "R") {
            // 도로명 주소 선택
            addr = data.roadAddress;
          } else {
            // 지번 주소 선택
            addr = data.jibunAddress;
          }

          // 우편번호와 주소 정보를 해당 필드에 넣는다.
          setNewAddress({
            ...newAddress,
            postal_code: data.zonecode,
            address: addr,
          });
        },
      }).open();
    } else {
      alert(
        "우편번호 검색 서비스를 불러올 수 없습니다. 페이지를 새로고침해주세요."
      );
    }
  };

  const handleConfirmAddressChange = async () => {
    if (!selectedOrderItemForAddressChange) return;

    try {
      // 주문 정보 가져오기 (customer_id를 위해)
      const orderResponse = await ordersApi.getOrder(selectedOrderItemForAddressChange.order_id);
      if (!orderResponse.data.data) {
        alert("주문 정보를 불러올 수 없습니다.");
        return;
      }
      const order = orderResponse.data.data;

      // 새 배송지 생성
      const addressData: AddressCreate = {
        customer_id: order.customer_id,
      address_name: newAddress.address_name,
      phone: newAddress.phone,
      nation: "대한민국",
      postal_code: newAddress.postal_code,
        address: newAddress.address,
        address_memo: newAddress.address_memo || null,
      };

      const addressResponse = await addressesApi.createAddress(addressData);
      if (!addressResponse.data.data) {
        alert("배송지 생성에 실패했습니다.");
        return;
      }

      // 주문 품목의 배송지 업데이트
      await orderItemsApi.updateOrderItem(selectedOrderItemForAddressChange.order_item_id, {
        address: {
          address_name: newAddress.address_name,
          phone: newAddress.phone,
          nation: "대한민국",
          postal_code: newAddress.postal_code,
          address: newAddress.address,
          address_memo: newAddress.address_memo || null,
        },
      });

    setIsAddressChangePanelOpen(false);
    setSelectedOrderItemForAddressChange(null);
    setNewAddress({
      address_name: "",
      phone: "",
      postal_code: "",
        address: "",
      address_memo: "",
    });

      alert("배송지가 변경되었습니다.");
    } catch (error: any) {
      console.error("배송지 변경에 실패했습니다.", error);
      alert(error.response?.data?.message || "배송지 변경에 실패했습니다.");
    }
  };


  // 데이터 상태
  const [totalCount, setTotalCount] = useState(0);


  // 탭 변경 핸들러
  const handleChannelTabChange = (tab: "ALL" | "CAFE24" | "GPMALL" | "OFFLINE") => {
    setChannelTab(tab);
    setChannelFilter(tab === "ALL" ? "" : tab);
    setCurrentPage(1);
  };

  useEffect(() => {
    setCurrentPage(1); // 필터 변경 시 첫 페이지로
  }, [statusFilter, channelFilter, paymentFilter, dateFilter.start, dateFilter.end, searchValue]);

  useEffect(() => {
    fetchOrders();
  }, [currentPage, statusFilter, channelFilter, paymentFilter, dateFilter, searchValue, sortKey, sortDirection]);

  // 외부 클릭 시 정렬 메뉴 닫기 및 위치 계산
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (
        !target.closest(".sort-menu-container") &&
        !target.closest(".sort-menu-dropdown")
      ) {
        setShowSortMenu(false);
      }
    };
    if (showSortMenu && sortButtonRef.current) {
      const rect = sortButtonRef.current.getBoundingClientRect();
      const cardRect = sortButtonRef.current
        .closest(".relative")
        ?.getBoundingClientRect();
      if (cardRect) {
        setSortMenuPosition({
          top: rect.bottom - cardRect.top + 8,
          left: rect.left - cardRect.left,
        });
      }
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showSortMenu]);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const query: OrderListQuery = {
        page: currentPage,
        limit: pageSize,
        search: searchValue || null,
        channel: channelFilter || null,
        order_status: statusFilter || null,
        start_date: dateFilter.start || null,
        end_date: dateFilter.end || null,
      };

      const response = await ordersApi.getOrders(query);
      if (response.data && response.data.data) {
        setOrders(response.data.data);
        setTotalCount(response.data.pagination?.total || 0);
      } else {
        console.error("응답 데이터 형식이 올바르지 않습니다:", response);
        setOrders([]);
        setTotalCount(0);
      }
    } catch (err: any) {
      console.error("주문 목록을 불러오는데 실패했습니다.", err);
      console.error("에러 상세:", {
        message: err.message,
        response: err.response?.data,
        status: err.response?.status,
        url: err.config?.url,
      });
      setOrders([]);
      setTotalCount(0);
      const errorMessage = err.response?.data?.message || err.response?.data?.detail || err.message || "주문 목록을 불러오는데 실패했습니다.";
      alert(errorMessage);
    } finally {
    setLoading(false);
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedOrders(new Set(paginatedOrders.map((o) => String(o.order_id))));
    } else {
      setSelectedOrders(new Set());
    }
  };

  const handleSelectOrder = (orderId: string, checked: boolean) => {
    const newSelected = new Set(selectedOrders);
    if (checked) {
      newSelected.add(orderId);
    } else {
      newSelected.delete(orderId);
    }
    setSelectedOrders(newSelected);
  };

  const handleViewDetail = (order: OrderListResponse) => {
    setSelectedOrderId(order.order_id);
    setIsDetailModalOpen(true);
  };

  // 엑셀 다운로드 함수
  const handleExportExcel = (selectedOnly: boolean = false) => {
    let dataToExport: OrderListResponse[];

    if (selectedOnly && selectedOrders.size > 0) {
      dataToExport = paginatedOrders.filter((order) =>
        selectedOrders.has(String(order.order_id))
      );
    } else {
      dataToExport = paginatedOrders;
    }

    if (dataToExport.length === 0) {
      alert("다운로드할 데이터가 없습니다.");
      return;
    }

    const excelData = dataToExport.map((order) => ({
      주문번호: `#${order.order_id}`,
      외부주문번호: order.external_order_id || "-",
      주문일시: new Date(order.order_at).toLocaleString("ko-KR"),
      주문채널:
        ORDER_CHANNEL_LABELS[order.order_channel as OrderChannel] || order.order_channel,
      주문상태: ORDER_STATUS_LABELS[order.order_status as OrderStatus] || order.order_status,
      고객명: order.customer_name || `고객 ID: ${order.customer_id}`,
      연락처: order.customer_phone || "-",
      결제금액: order.payment_amount,
      주문금액: order.total_amount,
      할인금액: order.discount_amount || 0,
      배송비: order.send_fee || 0,
    }));

    const ws = XLSX.utils.json_to_sheet(excelData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "주문 목록");

    const fileName = `주문목록_${new Date().toISOString().split("T")[0]}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  // 필터링과 정렬은 서버 사이드에서 처리되므로 클라이언트 사이드 필터링 제거
  const totalPages = Math.ceil(totalCount / pageSize);
  const paginatedOrders = orders;

  // 통계 (클라이언트 사이드에서 계산 - 실제로는 서버에서 제공하는 것이 좋음)
  const stats = {
    total: totalCount,
    pending: orders.filter((o) => o.order_status === "ORDERED").length,
    paid: orders.filter((o) => o.order_status === "PAID").length,
    shipping: orders.filter((o) => o.order_status === "SHIPPING").length,
    completed: orders.filter((o) => o.order_status === "COMPLETED").length,
    cancelled: orders.filter((o) => o.order_status === "CANCELLED").length,
    offlineUnpaid: orders.filter(
      (o) => o.order_channel === "OFFLINE"
    ).length,
    // 채널별 통계 (현재 로드된 데이터 기준)
    cafe24: orders.filter((o) => o.order_channel === "CAFE24").length,
    gpmall: orders.filter((o) => o.order_channel === "GPMALL").length,
    offline: orders.filter((o) => o.order_channel === "OFFLINE").length,
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


  const columns: Column<OrderListResponse>[] = [
    {
      key: "external_order_id",
      label: "외부주문번호",
      sortable: true,
      align: "center",
      render: (value) => (
        <span className="font-mono text-sm text-ink">
          {value || "-"}
        </span>
      ),
    },
    {
      key: "order_at",
      label: "주문일시",
      sortable: true,
      align: "center",
      render: (value) => (
        <span className="text-sm">
          {new Date(value).toLocaleString("ko-KR", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      ),
    },
    {
      key: "order_channel",
      label: "주문 채널",
      align: "center",
      render: (value) => (
        <div className="flex justify-center">
          <Badge
            variant={
              value === "CAFE24"
                ? "cafe24"
                : value === "GPMALL"
                ? "gpmall"
                : "default"
            }
            size="sm"
          >
            {ORDER_CHANNEL_LABELS[value as OrderChannel] || value}
          </Badge>
        </div>
      ),
    },
    {
      key: "order_status",
      label: "주문상태",
      align: "center",
      render: (value) => {
        const status = getOrderStatusBadge(value as OrderStatus);
        return (
          <div className="flex justify-center">
            <Badge variant={status.variant} size="sm">
              {status.label}
            </Badge>
          </div>
        );
      },
    },
    {
      key: "customer_name",
      label: "고객명",
      align: "center",
      render: (_value, row) => (
        <span className="font-medium text-ink">
          {row.customer_name || `고객 ID: ${row.customer_id}`}
        </span>
      ),
    },
    {
      key: "customer_phone",
      label: "연락처",
      align: "center",
      render: (value) => (
        <span className="text-sm">{value || "-"}</span>
      ),
    },
    {
      key: "item_count",
      label: "품목 수",
      align: "center",
      render: (value) => (
        <span className="text-sm">{value || 0}개</span>
      ),
    },
    {
      key: "total_amount",
      label: "주문금액",
      align: "center",
      sortable: true,
      render: (value) => (
        <span className="text-sm">
          {Number(value).toLocaleString()}원
        </span>
      ),
    },
    {
      key: "discount_amount",
      label: "할인금액",
      align: "center",
      sortable: true,
      render: (value) => (
        <span className="text-sm text-muted">
          {value ? `-${Number(value).toLocaleString()}원` : "0원"}
        </span>
      ),
    },
    {
      key: "refund_amount",
      label: "환불금액",
      align: "center",
      sortable: true,
      render: (value) => (
        <span className="text-sm text-danger">
          {value ? `-${Number(value).toLocaleString()}원` : "0원"}
        </span>
      ),
    },
    {
      key: "send_fee",
      label: "배송비",
      align: "center",
      sortable: true,
      render: (value) => (
        <span className="text-sm text-muted">
          {value ? `${Number(value).toLocaleString()}원` : "0원"}
        </span>
      ),
    },
    {
      key: "payment_amount",
      label: "결제금액",
      align: "center",
      sortable: true,
      render: (value) => (
        <span className="font-medium">
          {Number(value).toLocaleString()}원
        </span>
      ),
    },
  ];

  return (
    <div className="min-h-screen">
      <div className="max-w-[1600px] mx-auto px-6 py-6">
        <Breadcrumb
          items={[
            { label: "주문 관리", path: "/order/list" },
            { label: "주문 목록" },
          ]}
        />

        {/* 페이지 헤더 */}
        <div className="mb-8 anim-rise">
          <div className="flex items-start justify-between">
            <div></div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                icon={RefreshCw}
                onClick={fetchOrders}
                loading={loading}
                className="unified-btn-outline"
              >
                새로고침
              </Button>
              <Button
                size="sm"
                icon={Plus}
                onClick={() => navigate("/order/register")}
                className="unified-btn"
              >
                주문 등록
              </Button>
            </div>
          </div>
        </div>

        {/* 통계 카드 */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2 mb-6">
          <div className="bg-paper rounded-lg border border-line">
            <StatCard
              title="전체 주문"
              value={stats.total}
              icon={Package}
              color="accent"
              valueColor="text-accent"
            />
              </div>
          <div className="bg-paper rounded-lg border border-line">
            <StatCard
              title="주문 대기"
              value={stats.pending}
              icon={Clock}
              color="blue"
              valueColor="text-warning-600"
            />
              </div>
          <div className="bg-paper rounded-lg border border-line">
            <StatCard
              title="결제 완료"
              value={stats.paid}
              icon={CreditCard}
              color="green"
              valueColor="text-info-600"
            />
            </div>
          <div className="bg-paper rounded-lg border border-line">
            <StatCard
              title="배송 중"
              value={stats.shipping}
              icon={Truck}
              color="purple"
            />
              </div>
          <div className="bg-paper rounded-lg border border-line">
            <StatCard
              title="완료"
              value={stats.completed}
              icon={CheckCircle}
              color="subscription-active"
              valueColor="text-subscription-active-600"
            />
              </div>
          <div className="bg-paper rounded-lg border border-line">
            <StatCard
              title="취소됨"
              value={stats.cancelled}
              icon={XCircle}
              color="red"
            />
            </div>
          <div className="bg-paper rounded-lg border border-warning-200 bg-warning-50/50">
            <StatCard
              title="오프라인 미입금"
              value={stats.offlineUnpaid}
              icon={AlertCircle}
              color="red"
              valueColor="text-warning-700"
            />
              </div>
          <div className="bg-paper rounded-lg border border-line">
            <StatCard
              title="오늘 주문"
              value={orders.filter((o) => {
                const today = new Date();
                const orderDate = new Date(o.order_at);
                return (
                  orderDate.getDate() === today.getDate() &&
                  orderDate.getMonth() === today.getMonth() &&
                  orderDate.getFullYear() === today.getFullYear()
                );
              }).length}
              icon={ShoppingCart}
              color="blue"
            />
              </div>
            </div>

        {/* 주문 채널 탭 */}
        <div className="mb-6">
          <Tabs
            tabs={[
              {
                key: "ALL",
                label: "전체",
                icon: <Package className="w-4 h-4" />,
                count: stats.total,
              },
              {
                key: "CAFE24",
                label: "Cafe24",
                icon: <Store className="w-4 h-4" />,
                count: stats.cafe24,
              },
              {
                key: "GPMALL",
                label: "갓피플몰",
                icon: <ShoppingCart className="w-4 h-4" />,
                count: stats.gpmall,
              },
              {
                key: "OFFLINE",
                label: "오프라인",
                icon: <Building2 className="w-4 h-4" />,
                count: stats.offline,
              },
            ]}
            activeTab={channelTab}
            onChange={(key) => handleChannelTabChange(key as "ALL" | "CAFE24" | "GPMALL" | "OFFLINE")}
          />
        </div>

        {/* 검색 및 필터 */}
        <div className="relative">
          <Card className="unified-card mb-6 overflow-hidden" padding="none">
          <div className="p-4 bg-gradient-to-r from-paper to-white">
              {/* 상단: 필터 버튼, 정렬 버튼, 검색 바 */}
              <div className="flex items-center gap-3 mb-4">
              <button
                onClick={() => setShowFilters(!showFilters)}
                  className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-md font-medium text-sm transition-all ${
                  showFilters
                    ? "bg-accent text-white"
                    : "bg-white text-ink border border-line hover:border-accent/30"
                }`}
              >
                <Filter className="w-4 h-4" />
                필터
                <ChevronDown
                  className={`w-4 h-4 transition-transform ${
                    showFilters ? "rotate-180" : ""
                  }`}
                />
                </button>
                <div
                  className="relative sort-menu-container"
                  ref={sortButtonRef}
                >
                  <button
                    onClick={() => setShowSortMenu(!showSortMenu)}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-md font-medium text-sm bg-white text-ink border border-line hover:border-accent/30 transition-all"
                  >
                    <ArrowUpDown className="w-4 h-4" />
                    정렬
              </button>
                </div>
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted" />
                  <input
                    type="text"
                    placeholder="예: 홍길동, 010-1234-5678, CAFE24-20240101-12345"
                    value={searchValue}
                    onChange={(e) => setSearchValue(e.target.value)}
                    className="unified-input pl-10 w-full"
                  />
                </div>
                {(searchValue ||
                  statusFilter ||
                  channelFilter ||
                  paymentFilter ||
                  dateFilter.start ||
                  dateFilter.end) && (
                  <button
                    onClick={() => {
                      setSearchValue("");
                      setStatusFilter("");
                      setChannelFilter("");
                      setPaymentFilter("");
                      setDateFilter({ start: "", end: "" });
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-md font-medium text-sm bg-accent text-white hover:bg-accent/90 transition-all"
                  >
                    <RotateCcw className="w-4 h-4" />
                    필터&정렬 초기화
                  </button>
                )}
            </div>

              {/* 선택된 필터 태그들 */}
              {(statusFilter ||
                channelFilter ||
                paymentFilter ||
                dateFilter.start ||
                dateFilter.end) && (
                <div className="flex items-center gap-2 flex-wrap mb-4">
                  {statusFilter && (
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-md text-sm font-medium">
                      주문상태:{" "}
                      {ORDER_STATUS_LABELS[statusFilter as OrderStatus]}
                      <button
                        onClick={() => setStatusFilter("")}
                        className="hover:text-blue-900"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                  {channelFilter && (
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-md text-sm font-medium">
                      주문 채널:{" "}
                      {ORDER_CHANNEL_LABELS[channelFilter as OrderChannel]}
                      <button
                        onClick={() => setChannelFilter("")}
                        className="hover:text-blue-900"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                  {paymentFilter && (
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-md text-sm font-medium">
                      결제방법: {paymentFilter}
                      <button
                        onClick={() => setPaymentFilter("")}
                        className="hover:text-blue-900"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                  {(dateFilter.start || dateFilter.end) && (
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-md text-sm font-medium">
                      주문일: {dateFilter.start || "이전"} ~{" "}
                      {dateFilter.end || "이후"}
                      <button
                        onClick={() => setDateFilter({ start: "", end: "" })}
                        className="hover:text-blue-900"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* 필터 옵션 */}
            {showFilters && (
                <div className="pt-4 border-t border-line">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label className="unified-label">주문상태</label>
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="unified-input w-full"
                    >
                      <option value="">전체</option>
                      {Object.values(OrderStatus).map((status) => (
                        <option key={status} value={status}>
                          {ORDER_STATUS_LABELS[status]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="unified-label">주문 채널</label>
                    <select
                      value={channelFilter}
                      onChange={(e) => setChannelFilter(e.target.value)}
                      className="unified-input w-full"
                    >
                      <option value="">전체</option>
                        {Object.values(OrderChannel).map((channel) => (
                        <option key={channel} value={channel}>
                          {ORDER_CHANNEL_LABELS[channel]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                      <label className="unified-label">결제방법</label>
                      <select
                        value={paymentFilter}
                        onChange={(e) => setPaymentFilter(e.target.value)}
                        className="unified-input w-full"
                      >
                        <option value="">전체</option>
                        <option value="카드결제">카드결제</option>
                        <option value="계좌이체">계좌이체</option>
                        <option value="무통장입금">무통장입금</option>
                      </select>
                    </div>
                    <div>
                      <label className="unified-label">주문일 (시작)</label>
                    <input
                      type="date"
                      value={dateFilter.start}
                      onChange={(e) =>
                          setDateFilter({
                            ...dateFilter,
                            start: e.target.value,
                          })
                      }
                      className="unified-input w-full"
                    />
                  </div>
                  <div>
                      <label className="unified-label">주문일 (종료)</label>
                    <input
                      type="date"
                      value={dateFilter.end}
                      onChange={(e) =>
                        setDateFilter({ ...dateFilter, end: e.target.value })
                      }
                      className="unified-input w-full"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </Card>

          {/* 정렬 메뉴 */}
          {showSortMenu && (
            <div
              className="absolute sort-menu-dropdown bg-white border border-line rounded-md shadow-lg z-[100] min-w-[200px]"
              style={{
                top: `${sortMenuPosition.top}px`,
                left: `${sortMenuPosition.left}px`,
              }}
            >
              <button
                        onClick={() => {
                  setSortKey("order_at");
                  setSortDirection("desc");
                  setShowSortMenu(false);
                }}
                className="w-full text-left px-4 py-2 hover:bg-paper text-sm"
              >
                주문일 최신순
              </button>
              <button
                        onClick={() => {
                  setSortKey("order_at");
                  setSortDirection("asc");
                  setShowSortMenu(false);
                }}
                className="w-full text-left px-4 py-2 hover:bg-paper text-sm"
              >
                주문일 오래된순
              </button>
              <div className="border-t border-line my-1"></div>
              <button
                onClick={() => {
                  setSortKey("payment_at");
                  setSortDirection("desc");
                  setShowSortMenu(false);
                }}
                className="w-full text-left px-4 py-2 hover:bg-paper text-sm"
              >
                결제일 최신순
              </button>
              <button
                onClick={() => {
                  setSortKey("payment_at");
                  setSortDirection("asc");
                  setShowSortMenu(false);
                }}
                className="w-full text-left px-4 py-2 hover:bg-paper text-sm"
              >
                결제일 오래된순
              </button>
              <div className="border-t border-line my-1"></div>
              <button
                onClick={() => {
                  setSortKey("payment_amount");
                  setSortDirection("desc");
                  setShowSortMenu(false);
                }}
                className="w-full text-left px-4 py-2 hover:bg-paper text-sm"
              >
                결제금액 높은순
              </button>
              <button
                onClick={() => {
                  setSortKey("payment_amount");
                  setSortDirection("asc");
                  setShowSortMenu(false);
                }}
                className="w-full text-left px-4 py-2 hover:bg-paper text-sm"
              >
                결제금액 낮은순
              </button>
              <div className="border-t border-line my-1"></div>
              <button
                onClick={() => {
                  setSortKey("customer_name");
                  setSortDirection("asc");
                  setShowSortMenu(false);
                }}
                className="w-full text-left px-4 py-2 hover:bg-paper text-sm"
              >
                고객명 가나다순
              </button>
              <button
                onClick={() => {
                  setSortKey("customer_name");
                  setSortDirection("desc");
                  setShowSortMenu(false);
                }}
                className="w-full text-left px-4 py-2 hover:bg-paper text-sm"
              >
                고객명 역순
              </button>
            </div>
          )}
        </div>

        {/* 테이블 */}
        <ListPage
          data={paginatedOrders}
          columns={columns}
          keyExtractor={(item) => String(item.order_id)}
          onRowClick={handleViewDetail}
          rowClassName={(item) =>
            item.order_channel === "OFFLINE"
              ? "bg-warning-50/50"
              : ""
          }
          hoverable
          selectable
          selectedItems={selectedOrders}
          onSelectAll={handleSelectAll}
          onSelectItem={(id, checked) => handleSelectOrder(String(id), checked)}
          allSelected={
            paginatedOrders.length > 0 &&
            selectedOrders.size === paginatedOrders.length
          }
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          totalItems={totalCount}
          itemsPerPage={pageSize}
        />

        {/* 주문 상세 모달 */}
        <OrderDetailModal
          isOpen={isDetailModalOpen}
          onClose={() => {
            setIsDetailModalOpen(false);
            setSelectedOrderId(null);
          }}
          orderId={selectedOrderId}
        />

        {/* 배송지 변경 패널 */}
        <SlidePanel
          isOpen={isAddressChangePanelOpen}
          onClose={() => {
            setIsAddressChangePanelOpen(false);
            setSelectedOrderItemForAddressChange(null);
            setNewAddress({
              address_name: "",
              phone: "",
              postal_code: "",
              address: "",
              address_memo: "",
            });
            setCurrentAddress(null);
          }}
          title="배송지 변경"
          size="lg"
        >
          {selectedOrderItemForAddressChange && (
                <div className="space-y-4">
              <div className="p-4 bg-info-50 border border-info-200 rounded-lg">
                <p className="text-sm text-info-800 font-medium mb-1">
                  배송지 변경 안내
                </p>
                <p className="text-xs text-info-700">
                  이미 발송된 건은 변경할 수 없으며, 미발송분부터 적용됩니다.
                        </p>
                        </div>

              {/* 변경할 품목 */}
                  <div className="p-4 bg-paper rounded-lg border border-line">
                <h3 className="text-sm font-semibold text-ink mb-4 uppercase tracking-wide">
                  변경할 품목
                </h3>
                          <div className="flex items-center gap-2">
                            <Badge
                              variant={
                      selectedOrderItemForAddressChange.product_kind ===
                      "YEARLY"
                                  ? "info"
                        : selectedOrderItemForAddressChange.product_kind ===
                          "MONTHLY"
                                  ? "success"
                                  : "default"
                              }
                              size="sm"
                            >
                    {selectedOrderItemForAddressChange.product_kind === "YEARLY"
                                ? "연간"
                      : selectedOrderItemForAddressChange.product_kind ===
                        "MONTHLY"
                                ? "월간"
                                : "단품"}
                            </Badge>
                  <p className="text-sm font-medium text-ink">
                    {selectedOrderItemForAddressChange.product_name}
                  </p>
                          </div>
                        </div>

              {/* 현재 배송지 */}
                        <div className="p-4 bg-paper rounded-lg border border-line">
                <h3 className="text-sm font-semibold text-ink mb-4 uppercase tracking-wide">
                  현재 배송지
                            </h3>
                {currentAddress ? (
                  <div className="space-y-2">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="text-xs text-muted uppercase tracking-wide block mb-1">
                                수령인
                              </label>
                              <p className="text-sm text-ink font-medium">
                          {currentAddress.address_name}
                              </p>
                      </div>
                            <div>
                              <label className="text-xs text-muted uppercase tracking-wide block mb-1">
                                연락처
                              </label>
                              <p className="text-sm text-ink font-medium">
                          {currentAddress.phone}
                              </p>
                            </div>
                            <div>
                              <label className="text-xs text-muted uppercase tracking-wide block mb-1">
                                우편번호
                              </label>
                              <p className="text-sm text-ink font-medium">
                          {currentAddress.postal_code}
                              </p>
                            </div>
                            <div>
                              <label className="text-xs text-muted uppercase tracking-wide block mb-1">
                                국가
                              </label>
                              <p className="text-sm text-ink font-medium">
                          {currentAddress.nation || "대한민국"}
                              </p>
                      </div>
                            </div>
                            <div>
                              <label className="text-xs text-muted uppercase tracking-wide block mb-1">
                                주소
                              </label>
                              <p className="text-sm text-ink font-medium">
                        {currentAddress.address}
                              </p>
                            </div>
                    {currentAddress.address_memo && (
                            <div>
                                <label className="text-xs text-muted uppercase tracking-wide block mb-1">
                                  배송 특이사항
                                </label>
                                <p className="text-sm text-ink font-medium">
                          {currentAddress.address_memo}
                                </p>
                              </div>
                            )}
                          </div>
                ) : (
                  <p className="text-sm text-muted">
                    배송지 정보를 찾을 수 없습니다.
                  </p>
                      )}
              </div>

              {/* 새 배송지 */}
                        <div className="p-4 bg-paper rounded-lg border border-line">
                <h3 className="text-sm font-semibold text-ink mb-4 uppercase tracking-wide">
                  새 배송지
                            </h3>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      label="수령인"
                      value={newAddress.address_name}
                      onChange={(e) =>
                        setNewAddress({
                          ...newAddress,
                          address_name: e.target.value,
                        })
                      }
                      placeholder="수령인 이름을 입력하세요"
                      required
                    />
                    <Input
                      label="수령인 연락처"
                      value={newAddress.phone}
                      onChange={(e) =>
                        setNewAddress({ ...newAddress, phone: e.target.value })
                      }
                      placeholder="연락처를 입력하세요"
                      required
                    />
                    <div>
                      <label className="block text-sm font-medium text-muted mb-2 uppercase tracking-wider text-xs">
                        배송지 우편번호
                        <span className="text-red-500 ml-1">*</span>
                      </label>
                      <div className="flex gap-2">
                        <Input
                          value={newAddress.postal_code}
                          onChange={(e) =>
                            setNewAddress({
                              ...newAddress,
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
                  </div>
                  <Input
                    label="배송지 주소"
                    value={newAddress.address}
                    onChange={(e) =>
                      setNewAddress({ ...newAddress, address: e.target.value })
                    }
                    placeholder="주소를 입력하세요"
                    required
                    readOnly
                  />
                  <Textarea
                    label="배송 특이사항"
                    value={newAddress.address_memo}
                    onChange={(e) =>
                      setNewAddress({
                        ...newAddress,
                        address_memo: e.target.value,
                      })
                    }
                    placeholder="배송 특이사항을 입력하세요"
                    rows={2}
                  />
                </div>
              </div>

              <div className="p-4 bg-warning-50 border border-warning-200 rounded-lg">
                <p className="text-sm text-warning-700">
                  <strong>적용 범위:</strong> 미발송분부터 적용됩니다.
                </p>
              </div>

              {/* 하단 버튼 */}
              <div className="flex justify-end gap-2 pt-4 border-t border-line">
                                <Button
                  variant="ghost"
                                  onClick={() => {
                    setIsAddressChangePanelOpen(false);
                    setSelectedOrderItemForAddressChange(null);
                    setNewAddress({
                      address_name: "",
                      phone: "",
                      postal_code: "",
                      address: "",
                      address_memo: "",
                    });
                  }}
                >
                  취소
                </Button>
                <Button
                  onClick={handleConfirmAddressChange}
                  disabled={
                    !newAddress.address_name ||
                    !newAddress.phone ||
                    !newAddress.postal_code ||
                    !newAddress.address
                  }
                >
                  변경 적용
                                </Button>
                              </div>
                                </div>
          )}
        </SlidePanel>

        {/* 배송지 변경 패널 */}
        <SlidePanel
          isOpen={isAddressChangePanelOpen}
          onClose={() => {
            setIsAddressChangePanelOpen(false);
            setSelectedOrderItemForAddressChange(null);
            setNewAddress({
              address_name: "",
              phone: "",
              postal_code: "",
              address: "",
              address_memo: "",
            });
            setCurrentAddress(null);
          }}
          title="배송지 변경"
          size="lg"
        >
          {selectedOrderItemForAddressChange && (
            <div className="space-y-4">
              <div className="p-4 bg-info-50 border border-info-200 rounded-lg">
                <p className="text-sm text-info-800 font-medium mb-1">
                  배송지 변경 안내
                </p>
                <p className="text-xs text-info-700">
                  이미 발송된 건은 변경할 수 없으며, 미발송분부터 적용됩니다.
                </p>
              </div>

              {/* 변경할 품목 */}
              <div className="p-4 bg-paper rounded-lg border border-line">
                <h3 className="text-sm font-semibold text-ink mb-4 uppercase tracking-wide">
                  변경할 품목
                </h3>
                <div className="flex items-center gap-2">
                  <Badge
                    variant={
                      selectedOrderItemForAddressChange.product_kind ===
                      "YEARLY"
                        ? "info"
                        : selectedOrderItemForAddressChange.product_kind ===
                          "MONTHLY"
                        ? "success"
                        : "default"
                    }
                    size="sm"
                  >
                    {selectedOrderItemForAddressChange.product_kind === "YEARLY"
                      ? "연간"
                      : selectedOrderItemForAddressChange.product_kind ===
                        "MONTHLY"
                      ? "월간"
                      : "단품"}
                  </Badge>
                  <p className="text-sm font-medium text-ink">
                    {selectedOrderItemForAddressChange.product_name}
                  </p>
                </div>
              </div>

              {/* 현재 배송지 */}
              <div className="p-4 bg-paper rounded-lg border border-line">
                <h3 className="text-sm font-semibold text-ink mb-4 uppercase tracking-wide">
                  현재 배송지
                </h3>
                {currentAddress ? (
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs text-muted uppercase tracking-wide block mb-1">
                            수령인
                          </label>
                          <p className="text-sm text-ink font-medium">
                            {currentAddress.address_name}
                          </p>
                        </div>
                        <div>
                          <label className="text-xs text-muted uppercase tracking-wide block mb-1">
                            연락처
                          </label>
                          <p className="text-sm text-ink font-medium">
                            {currentAddress.phone}
                          </p>
                        </div>
                        <div>
                          <label className="text-xs text-muted uppercase tracking-wide block mb-1">
                            우편번호
                          </label>
                          <p className="text-sm text-ink font-medium">
                            {currentAddress.postal_code}
                          </p>
                        </div>
                        <div>
                          <label className="text-xs text-muted uppercase tracking-wide block mb-1">
                            국가
                          </label>
                          <p className="text-sm text-ink font-medium">
                          {currentAddress.nation || "대한민국"}
                          </p>
                        </div>
                      </div>
                        <div>
                          <label className="text-xs text-muted uppercase tracking-wide block mb-1">
                            주소
                          </label>
                          <p className="text-sm text-ink font-medium">
                        {currentAddress.address}
                      </p>
                      </div>
                      {currentAddress.address_memo && (
                        <div>
                          <label className="text-xs text-muted uppercase tracking-wide block mb-1">
                            배송 특이사항
                          </label>
                          <p className="text-sm text-ink font-medium">
                            {currentAddress.address_memo}
                          </p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-muted">
                      배송지 정보를 찾을 수 없습니다.
                    </p>
                )}
              </div>

              {/* 새 배송지 */}
              <div className="p-4 bg-paper rounded-lg border border-line">
                <h3 className="text-sm font-semibold text-ink mb-4 uppercase tracking-wide">
                  새 배송지
                </h3>
          <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      label="수령인"
                      value={newAddress.address_name}
                      onChange={(e) =>
                        setNewAddress({
                          ...newAddress,
                          address_name: e.target.value,
                        })
                      }
                      placeholder="수령인 이름을 입력하세요"
                      required
                    />
                    <Input
                      label="수령인 연락처"
                      value={newAddress.phone}
                      onChange={(e) =>
                        setNewAddress({ ...newAddress, phone: e.target.value })
                      }
                      placeholder="연락처를 입력하세요"
                      required
                    />
            <div>
                      <label className="block text-sm font-medium text-muted mb-2 uppercase tracking-wider text-xs">
                        배송지 우편번호
                        <span className="text-red-500 ml-1">*</span>
                      </label>
                      <div className="flex gap-2">
                        <Input
                          value={newAddress.postal_code}
                onChange={(e) =>
                            setNewAddress({
                              ...newAddress,
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
            </div>
            <Input
                    label="배송지 주소"
                    value={newAddress.address}
              onChange={(e) =>
                      setNewAddress({ ...newAddress, address: e.target.value })
                    }
                    placeholder="주소를 입력하세요"
                    required
                    readOnly
                  />
                  <Textarea
                    label="배송 특이사항"
                    value={newAddress.address_memo}
                    onChange={(e) =>
                      setNewAddress({
                        ...newAddress,
                        address_memo: e.target.value,
                      })
                    }
                    placeholder="배송 특이사항을 입력하세요"
                    rows={2}
            />
          </div>
              </div>

              <div className="p-4 bg-warning-50 border border-warning-200 rounded-lg">
                <p className="text-sm text-warning-700">
                  <strong>적용 범위:</strong> 미발송분부터 적용됩니다.
                </p>
              </div>

              {/* 하단 버튼 */}
              <div className="flex justify-end gap-2 pt-4 border-t border-line">
              <Button
                variant="ghost"
                  onClick={() => {
                    setIsAddressChangePanelOpen(false);
                    setSelectedOrderItemForAddressChange(null);
                    setNewAddress({
                      address_name: "",
                      phone: "",
                      postal_code: "",
                      address: "",
                      address_memo: "",
                    });
                  }}
              >
                취소
              </Button>
              <Button
                  onClick={handleConfirmAddressChange}
                  disabled={
                    !newAddress.address_name ||
                    !newAddress.phone ||
                    !newAddress.postal_code ||
                    !newAddress.address
                  }
                >
                  변경 적용
              </Button>
              </div>
            </div>
          )}
        </SlidePanel>

      </div>
    </div>
  );
};

export default OrderListPage;
