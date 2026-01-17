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
  ArrowRight,
  Package,
  CreditCard,
  Truck,
  Clock,
  AlertCircle,
  Save,
  MapPin,
  X,
  RotateCcw,
} from "lucide-react";
import Card from "../components/common/Card";
import Button from "../components/common/Button";
import Badge from "../components/common/Badge";
import Table, { Column } from "../components/common/Table";
import Pagination from "../components/common/Pagination";
import Modal from "../components/common/Modal";
import SlidePanel from "../components/common/SlidePanel";
import Tabs from "../components/common/Tabs";
import Textarea from "../components/common/Textarea";
import Select from "../components/common/Select";
import Input from "../components/common/Input";
import Breadcrumb from "../components/common/Breadcrumb";
import {
  OrderChannel,
  OrderStatus,
  ORDER_CHANNEL_LABELS,
  ORDER_STATUS_LABELS,
} from "../utils/constants";

// DB 스키마 기반 인터페이스
interface Order {
  order_id: number;
  customer_id: number;
  external_order_id: string | null;
  order_channel: "CAFE24" | "GPMALL" | "OFFLINE";
  order_status: "ORDERED" | "PAID" | "CANCELLED" | "SHIPPING" | "COMPLETED";
  total_amount: number;
  discount_amount: number;
  send_fee: number;
  payment_amount: number;
  payment_method: string | null;
  address_id: number | null;
  request_memo: string | null;
  admin_memo: string | null;
  order_at: string;
  payment_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
  order_items?: OrderItem[];
  customer_name?: string;
  customer_phone?: string;
  customer_email?: string;
}

interface OrderItem {
  order_item_id: number;
  external_order_item_id: string | null;
  order_id: number;
  product_code: string;
  product_kind: "YEARLY" | "MONTHLY" | "SINGLE";
  product_name: string;
  price: number;
  sale: number;
  order_num: number;
  subscribe_start_issue: string | null;
  subscribe_end_issue: string | null;
  last_send_issue: string | null;
  final_subscribe_end_issue: string | null;
  address_id: number;
  created_at: string;
  sended_at: string | null;
  cancelled_at: string | null;
  updated_at: string;
}

interface Address {
  address_id: number;
  address_name: string;
  phone: string;
  nation: string;
  postal_code: string;
  address1: string;
  address2: string;
  address_memo: string | null;
  created_at: string;
  updated_at: string;
}

interface Customer {
  customer_id: number;
  customer_name: string;
  customer_phone: string;
  customer_phone_num4: string;
  customer_email: string | null;
  create_channel: "CAFE24" | "GPMALL" | "OFFLINE";
  admin_memo: string | null;
  last_order_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

// 목업 데이터
const mockOrders: Order[] = [
  {
    order_id: 1,
    customer_id: 1,
    external_order_id: "CAFE24-20241208001",
    order_channel: "CAFE24",
    order_status: "COMPLETED",
    total_amount: 240000,
    discount_amount: 5000,
    send_fee: 3000,
    payment_amount: 238000,
    payment_method: "카드결제",
    address_id: 1,
    request_memo: "부재 시 문 앞에 놓아주세요",
    admin_memo: null,
    order_at: "2024-12-08T10:30:00",
    payment_at: "2024-12-08T10:30:00",
    cancelled_at: null,
    created_at: "2024-12-08T10:30:00",
    updated_at: "2024-12-08T10:30:00",
    customer_name: "김민수",
    customer_phone: "010-1234-5678",
    customer_email: "minsu.kim@example.com",
    order_items: [
      {
        order_item_id: 1,
        external_order_item_id: "ITEM-001",
        order_id: 1,
        product_code: "PROD-001",
        product_kind: "YEARLY",
        product_name: "말씀함께 12개월 구독",
        price: 144000,
        sale: 0,
        order_num: 1,
        subscribe_start_issue: "202501",
        subscribe_end_issue: "202512",
        last_send_issue: null,
        final_subscribe_end_issue: null,
        address_id: 1, // 기본 배송지
        created_at: "2024-12-08T10:30:00",
        sended_at: null,
        cancelled_at: null,
        updated_at: "2024-12-08T10:30:00",
      },
      {
        order_item_id: 4,
        external_order_item_id: "ITEM-004",
        order_id: 1,
        product_code: "PROD-002",
        product_kind: "MONTHLY",
        product_name: "꿀땅 6개월 구독",
        price: 96000,
        sale: 5000,
        order_num: 1,
        subscribe_start_issue: "202501",
        subscribe_end_issue: "202506",
        last_send_issue: null,
        final_subscribe_end_issue: null,
        address_id: 4, // 다른 배송지로 변경됨
        created_at: "2024-12-08T10:30:00",
        sended_at: null,
        cancelled_at: null,
        updated_at: "2024-12-08T11:00:00",
      },
    ],
  },
  {
    order_id: 2,
    customer_id: 2,
    external_order_id: "GPMALL-20241207002",
    order_channel: "GPMALL",
    order_status: "SHIPPING",
    total_amount: 96000,
    discount_amount: 5000,
    send_fee: 0,
    payment_amount: 91000,
    payment_method: "계좌이체",
    address_id: 2,
    request_memo: null,
    admin_memo: "특별 처리 필요",
    order_at: "2024-12-07T14:20:00",
    payment_at: "2024-12-07T14:25:00",
    cancelled_at: null,
    created_at: "2024-12-07T14:20:00",
    updated_at: "2024-12-07T14:25:00",
    customer_name: "이영희",
    customer_phone: "010-2345-6789",
    customer_email: "younghee.lee@example.com",
    order_items: [
      {
        order_item_id: 2,
        external_order_item_id: "ITEM-002",
        order_id: 2,
        product_code: "PROD-002",
        product_kind: "MONTHLY",
        product_name: "꿀땅 6개월 구독",
        price: 96000,
        sale: 5000,
        order_num: 1,
        subscribe_start_issue: "202501",
        subscribe_end_issue: "202506",
        last_send_issue: null,
        final_subscribe_end_issue: null,
        address_id: 2,
        created_at: "2024-12-07T14:20:00",
        sended_at: null,
        cancelled_at: null,
        updated_at: "2024-12-07T14:20:00",
      },
    ],
  },
  {
    order_id: 3,
    customer_id: 3,
    external_order_id: null,
    order_channel: "OFFLINE",
    order_status: "ORDERED",
    total_amount: 12000,
    discount_amount: 0,
    send_fee: 0,
    payment_amount: 12000,
    payment_method: null,
    address_id: 3,
    request_memo: null,
    admin_memo: null,
    order_at: "2024-12-06T16:45:00",
    payment_at: null,
    cancelled_at: null,
    created_at: "2024-12-06T16:45:00",
    updated_at: "2024-12-06T16:45:00",
    customer_name: "박철수",
    customer_phone: "010-3456-7890",
    customer_email: "chulsoo.park@example.com",
    order_items: [
      {
        order_item_id: 3,
        external_order_item_id: null,
        order_id: 3,
        product_code: "PROD-003",
        product_kind: "SINGLE",
        product_name: "말씀함께 단품",
        price: 12000,
        sale: 0,
        order_num: 1,
        subscribe_start_issue: null,
        subscribe_end_issue: null,
        last_send_issue: null,
        final_subscribe_end_issue: null,
        address_id: 3,
        created_at: "2024-12-06T16:45:00",
        sended_at: null,
        cancelled_at: null,
        updated_at: "2024-12-06T16:45:00",
      },
    ],
  },
];

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

const mockAddresses: Address[] = [
  {
    address_id: 1,
    address_name: "김민수",
    phone: "010-1234-5678",
    nation: "대한민국",
    postal_code: "06234",
    address1: "서울특별시 강남구 테헤란로 123",
    address2: "101동 101호",
    address_memo: "부재 시 문 앞에 놓아주세요",
    created_at: "2024-12-08T10:30:00",
    updated_at: "2024-12-08T10:30:00",
  },
  {
    address_id: 4,
    address_name: "김민수",
    phone: "010-1234-5678",
    nation: "대한민국",
    postal_code: "13529",
    address1: "경기도 성남시 분당구 판교로 789",
    address2: "501동 501호",
    address_memo: "경비실에 맡겨주세요",
    created_at: "2024-12-08T11:00:00",
    updated_at: "2024-12-08T11:00:00",
  },
  {
    address_id: 2,
    address_name: "이영희",
    phone: "010-2345-6789",
    nation: "대한민국",
    postal_code: "13529",
    address1: "경기도 성남시 분당구 판교로 456",
    address2: "202동 202호",
    address_memo: null,
    created_at: "2024-12-07T14:20:00",
    updated_at: "2024-12-07T14:20:00",
  },
  {
    address_id: 3,
    address_name: "박철수",
    phone: "010-3456-7890",
    nation: "대한민국",
    postal_code: "03051",
    address1: "서울특별시 종로구 세종대로 789",
    address2: "303동 303호",
    address_memo: null,
    created_at: "2024-12-06T16:45:00",
    updated_at: "2024-12-06T16:45:00",
  },
];

const OrderListPage: React.FC = () => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>(mockOrders);
  const [loading, setLoading] = useState(false);

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
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [detailTab, setDetailTab] = useState("info");
  const [newMemo, setNewMemo] = useState("");

  // 배송지 변경 모달 상태
  const [isAddressChangePanelOpen, setIsAddressChangePanelOpen] =
    useState(false);
  const [
    selectedOrderItemForAddressChange,
    setSelectedOrderItemForAddressChange,
  ] = useState<OrderItem | null>(null);
  const [newAddress, setNewAddress] = useState({
    address_name: "",
    phone: "",
    postal_code: "",
    address1: "",
    address2: "",
    address_memo: "",
  });

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
            address1: addr,
            address2: "", // 상세주소는 사용자가 직접 입력
          });
        },
      }).open();
    } else {
      alert(
        "우편번호 검색 서비스를 불러올 수 없습니다. 페이지를 새로고침해주세요."
      );
    }
  };

  // 배송지 변경 핸들러
  const handleOpenAddressChangePanel = (orderItem: OrderItem) => {
    setSelectedOrderItemForAddressChange(orderItem);
    const currentAddress = getAddressById(orderItem.address_id);
    if (currentAddress) {
      setNewAddress({
        address_name: currentAddress.address_name,
        phone: currentAddress.phone,
        postal_code: currentAddress.postal_code,
        address1: currentAddress.address1,
        address2: currentAddress.address2 || "",
        address_memo: currentAddress.address_memo || "",
      });
    } else {
      setNewAddress({
        address_name: "",
        phone: "",
        postal_code: "",
        address1: "",
        address2: "",
        address_memo: "",
      });
    }
    setIsAddressChangePanelOpen(true);
  };

  const handleConfirmAddressChange = () => {
    if (!selectedOrder || !selectedOrderItemForAddressChange) return;

    // 새 배송지 생성 (실제로는 API 호출이지만 여기서는 새 address_id 생성)
    // 임시로 새로운 address_id 생성 (실제로는 API에서 반환된 ID 사용)
    const newAddressId = Math.max(...addresses.map((a) => a.address_id), 0) + 1;

    // 새 주소 객체 생성 (실제로는 API를 통해 생성됨)
    const createdAddress: Address = {
      address_id: newAddressId,
      address_name: newAddress.address_name,
      phone: newAddress.phone,
      nation: "대한민국",
      postal_code: newAddress.postal_code,
      address1: newAddress.address1,
      address2: newAddress.address2 || "",
      address_memo: newAddress.address_memo || "",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // 주소 목록에 추가 (실제로는 API 호출 후 상태 업데이트)
    setAddresses([...addresses, createdAddress]);

    // 주문 품목의 배송지 업데이트
    const updatedOrderItems = selectedOrder.order_items?.map((item) =>
      item.order_item_id === selectedOrderItemForAddressChange.order_item_id
        ? { ...item, address_id: newAddressId }
        : item
    );

    setSelectedOrder({
      ...selectedOrder,
      order_items: updatedOrderItems,
    });

    // 전체 주문 목록도 업데이트
    setOrders(
      orders.map((order) =>
        order.order_id === selectedOrder.order_id
          ? {
              ...order,
              order_items: updatedOrderItems,
            }
          : order
      )
    );

    setIsAddressChangePanelOpen(false);
    setSelectedOrderItemForAddressChange(null);
    setNewAddress({
      address_name: "",
      phone: "",
      postal_code: "",
      address1: "",
      address2: "",
      address_memo: "",
    });
  };

  // 상세보기 패널 상태
  const [isDetailPanelOpen, setIsDetailPanelOpen] = useState(false);
  const [selectedOrderForPanel, setSelectedOrderForPanel] =
    useState<Order | null>(null);

  // 데이터 상태
  const [addresses, setAddresses] = useState<Address[]>(mockAddresses);
  const [customers] = useState<Customer[]>(mockCustomers);

  // 구독 호수를 포맷하는 함수 (예: "202501" -> "25년 01월호")
  const formatIssue = (issue: string | null): string => {
    if (!issue || issue.length !== 6) return "-";
    const year = issue.substring(0, 4);
    const month = issue.substring(4, 6);
    const shortYear = year.substring(2); // "2025" -> "25"
    return `${shortYear}년 ${month}월호`;
  };

  useEffect(() => {
    fetchOrders();
  }, []);

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
    await new Promise((resolve) => setTimeout(resolve, 500));
    setOrders(mockOrders);
    } catch (err: any) {
      console.error("주문 목록을 불러오는데 실패했습니다.", err);
      setOrders([]);
    } finally {
    setLoading(false);
    }
  };

  const handleSort = (key: string, direction: "asc" | "desc") => {
    setSortKey(key);
    setSortDirection(direction);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedOrders(new Set(filteredOrders.map((o) => String(o.order_id))));
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

  const handleViewDetail = (order: Order) => {
    setSelectedOrder(order);
    setNewMemo(order.admin_memo || "");
    setIsDetailModalOpen(true);
    setDetailTab("info");
  };

  const handleViewOrderDetail = (order: Order) => {
    setSelectedOrderForPanel(order);
    setIsDetailPanelOpen(true);
  };

  // 엑셀 다운로드 함수
  const handleExportExcel = (selectedOnly: boolean = false) => {
    let dataToExport: Order[];

    if (selectedOnly && selectedOrders.size > 0) {
      dataToExport = filteredOrders.filter((order) =>
        selectedOrders.has(String(order.order_id))
      );
    } else {
      dataToExport = filteredOrders;
    }

    if (dataToExport.length === 0) {
      alert("다운로드할 데이터가 없습니다.");
      return;
    }

    const excelData = dataToExport.map((order) => ({
      주문번호: order.external_order_id || `#${order.order_id}`,
      주문일시: new Date(order.order_at).toLocaleString("ko-KR"),
      고객명: order.customer_name || `고객 ID: ${order.customer_id}`,
      연락처: order.customer_phone || "-",
      이메일: order.customer_email || "-",
      유입채널:
        ORDER_CHANNEL_LABELS[order.order_channel] || order.order_channel,
      주문상태: ORDER_STATUS_LABELS[order.order_status] || order.order_status,
      결제방법: order.payment_method || "-",
      결제금액: order.payment_amount,
      주문금액: order.total_amount,
      할인금액: order.discount_amount,
      배송비: order.send_fee,
      결제일시: order.payment_at
        ? new Date(order.payment_at).toLocaleString("ko-KR")
        : "-",
    }));

    const ws = XLSX.utils.json_to_sheet(excelData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "주문 목록");

    const fileName = `주문목록_${new Date().toISOString().split("T")[0]}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  const getFilteredOrders = () => {
    let filtered = orders;

    if (searchValue) {
      const search = searchValue.toLowerCase();
      filtered = filtered.filter(
        (o) =>
          o.external_order_id?.toLowerCase().includes(search) ||
          String(o.order_id).includes(search) ||
          o.customer_name?.toLowerCase().includes(search) ||
          o.customer_phone?.includes(search)
      );
    }

    if (statusFilter) {
      filtered = filtered.filter((o) => o.order_status === statusFilter);
    }
    if (channelFilter) {
      filtered = filtered.filter((o) => o.order_channel === channelFilter);
    }
    if (paymentFilter) {
      filtered = filtered.filter((o) => o.payment_method === paymentFilter);
    }

    // 기간 필터
    if (dateFilter.start) {
      const startDate = new Date(dateFilter.start);
      startDate.setHours(0, 0, 0, 0);
      filtered = filtered.filter((o) => {
        const orderDate = new Date(o.order_at);
        orderDate.setHours(0, 0, 0, 0);
        return orderDate >= startDate;
      });
    }
    if (dateFilter.end) {
      const endDate = new Date(dateFilter.end);
      endDate.setHours(23, 59, 59, 999);
      filtered = filtered.filter((o) => {
        const orderDate = new Date(o.order_at);
        return orderDate <= endDate;
      });
    }

    filtered = filtered.sort((a, b) => {
      let aVal: any = a[sortKey as keyof Order];
      let bVal: any = b[sortKey as keyof Order];

      // null/undefined 처리
      if (aVal === null || aVal === undefined) {
        return sortDirection === "asc" ? 1 : -1;
      }
      if (bVal === null || bVal === undefined) {
        return sortDirection === "asc" ? -1 : 1;
      }

      // 날짜 필드 처리
      if (
        sortKey === "order_at" ||
        sortKey === "payment_at" ||
        sortKey === "cancelled_at"
      ) {
        const aDate = new Date(aVal as string).getTime();
        const bDate = new Date(bVal as string).getTime();
        if (sortDirection === "asc") {
          return aDate - bDate;
        }
        return bDate - aDate;
      }

      // 숫자 필드 처리
      if (
        sortKey === "payment_amount" ||
        sortKey === "total_amount" ||
        sortKey === "discount_amount"
      ) {
        const aNum = Number(aVal) || 0;
        const bNum = Number(bVal) || 0;
        if (sortDirection === "asc") {
          return aNum - bNum;
        }
        return bNum - aNum;
      }

      // 문자열 필드 처리
      const aStr = String(aVal).toLowerCase();
      const bStr = String(bVal).toLowerCase();
      if (sortDirection === "asc") {
        if (aStr > bStr) return 1;
        if (aStr < bStr) return -1;
        return 0;
      }
      if (aStr < bStr) return 1;
      if (aStr > bStr) return -1;
      return 0;
    });

    return filtered;
  };

  const filteredOrders = getFilteredOrders();
  const totalPages = Math.ceil(filteredOrders.length / pageSize);
  const paginatedOrders = filteredOrders.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  // 통계
  const stats = {
    total: orders.length,
    pending: orders.filter((o) => o.order_status === "ORDERED").length,
    paid: orders.filter((o) => o.order_status === "PAID").length,
    shipping: orders.filter((o) => o.order_status === "SHIPPING").length,
    completed: orders.filter((o) => o.order_status === "COMPLETED").length,
    offlineUnpaid: orders.filter(
      (o) => o.order_channel === "OFFLINE" && !o.payment_at
    ).length,
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

  const getOrderStatusLabel = (status: OrderStatus) => {
    return ORDER_STATUS_LABELS[status] || status;
  };

  const columns: Column<Order>[] = [
    {
      key: "checkbox",
      label: "선택",
      width: "50px",
      align: "center",
      render: (_, row) => (
        <div className="flex justify-center">
        <input
          type="checkbox"
          checked={selectedOrders.has(String(row.order_id))}
            onChange={(e) =>
              handleSelectOrder(String(row.order_id), e.target.checked)
            }
          className="w-4 h-4 rounded border-line text-accent focus:ring-accent"
        />
        </div>
      ),
    },
    {
      key: "external_order_id",
      label: "주문번호",
      sortable: true,
      align: "center",
      render: (value, row) => (
        <span className="font-mono text-sm text-ink">
          {value || `#${row.order_id}`}
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
      key: "order_channel",
      label: "유입채널",
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

  const detailTabs = [
    { key: "info", label: "기본 정보" },
    { key: "items", label: "주문 품목" },
    { key: "customer", label: "고객 정보" },
    { key: "shipping", label: "배송지" },
    { key: "memos", label: "관리자 메모" },
  ];

  // address_id로 배송지 정보 가져오기
  const getAddressById = (addressId: number): Address | null => {
    return addresses.find((a) => a.address_id === addressId) || null;
  };

  // customer_id로 고객 정보 가져오기
  const getCustomerById = (customerId: number): Customer | null => {
    return (
      customers.find((c: Customer) => c.customer_id === customerId) || null
    );
  };

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
                icon={Download}
                onClick={() => handleExportExcel(false)}
                className="unified-btn-outline"
              >
                엑셀 다운로드
              </Button>
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
        <div
          className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6 anim-rise"
          style={{ animationDelay: "0.1s" }}
        >
          <Card className="unified-card p-5 unified-card-hover cursor-pointer">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted mb-1">전체 주문</p>
                <p className="text-2xl font-bold text-ink">{stats.total}</p>
                <p className="text-xs text-muted mt-0.5">이번 달</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-chip flex items-center justify-center">
                <Package className="w-6 h-6 text-accent" />
              </div>
            </div>
          </Card>
          <Card className="unified-card p-5 unified-card-hover cursor-pointer">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted mb-1">주문 대기</p>
                <p className="text-2xl font-bold text-warning-600">
                  {stats.pending}
                </p>
                <p className="text-xs text-muted mt-0.5">확인 필요</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-warning-100 flex items-center justify-center">
                <Clock className="w-6 h-6 text-warning-600" />
              </div>
            </div>
          </Card>
          <Card className="unified-card p-5 unified-card-hover cursor-pointer">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted mb-1">결제 완료</p>
                <p className="text-2xl font-bold text-info-600">{stats.paid}</p>
                <p className="text-xs text-muted mt-0.5">발송 대기 중</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-info-100 flex items-center justify-center">
                <CreditCard className="w-6 h-6 text-info-600" />
              </div>
            </div>
          </Card>
          <Card className="unified-card p-5 unified-card-hover cursor-pointer border-warning-200 bg-gradient-to-br from-warning-50 to-warning-100/50">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-warning-700 mb-1 font-medium">
                  오프라인 미입금
                </p>
                <p className="text-2xl font-bold text-warning-700">
                  {stats.offlineUnpaid}
                </p>
                <p className="text-xs text-warning-600 mt-0.5 font-medium">
                  ⚠ 즉시 확인
                </p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-warning-200 flex items-center justify-center">
                <AlertCircle className="w-6 h-6 text-warning-700" />
              </div>
            </div>
          </Card>
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
                    placeholder="주문번호, 고객명, 연락처로 검색..."
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
                      유입채널:{" "}
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
                    <label className="unified-label">유입채널</label>
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

        {/* 일괄 작업 */}
        <Card className="unified-card mb-6 p-4 bg-neutral-50 border-neutral-200">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-ink">
              {selectedOrders.size}건 선택됨
            </span>
            <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    icon={Download}
                onClick={() => handleExportExcel(true)}
                disabled={selectedOrders.size === 0}
                  >
                엑셀 다운로드
                  </Button>
              {selectedOrders.size > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedOrders(new Set())}
                  >
                    선택 해제
                  </Button>
              )}
                </div>
              </div>
        </Card>

        {/* 테이블 */}
        <Card className="unified-card">
          <div className="px-4 py-3 border-b border-line flex items-center justify-between">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={
                  filteredOrders.length > 0 &&
                  selectedOrders.size === filteredOrders.length
                }
                onChange={(e) => handleSelectAll(e.target.checked)}
                className="w-4 h-4 rounded border-line text-accent focus:ring-accent"
              />
              <span className="text-sm text-muted">
                전체 {filteredOrders.length}건
              </span>
            </div>
            <span className="text-sm text-muted">
              {(currentPage - 1) * pageSize + 1} -{" "}
              {Math.min(currentPage * pageSize, filteredOrders.length)} /{" "}
              {filteredOrders.length}
            </span>
          </div>

          <Table
            columns={columns}
            data={paginatedOrders}
            keyExtractor={(item) => String(item.order_id)}
            onRowClick={handleViewDetail}
            rowClassName={(item) =>
              item.order_channel === "OFFLINE" && !item.payment_at
                ? "bg-warning-50/50"
                : ""
            }
            hoverable
          />

          {totalPages > 1 && (
            <div className="p-4 border-t border-line">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
              />
            </div>
          )}
        </Card>

        {/* 주문 상세 모달 */}
        <Modal
          isOpen={isDetailModalOpen}
          onClose={() => setIsDetailModalOpen(false)}
          title={`주문 상세 - ${
            selectedOrder?.external_order_id || `#${selectedOrder?.order_id}`
          }`}
          size="xl"
        >
          {selectedOrder && (
            <div>
              <Tabs
                tabs={detailTabs}
                activeTab={detailTab}
                onChange={setDetailTab}
                className="mb-6"
              />

              {detailTab === "info" && (
                <div className="space-y-4">
                  {/* 주문 정보 */}
                  <div className="p-4 bg-paper rounded-lg border border-line">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs text-muted uppercase tracking-wide block mb-1">
                          주문 번호
                        </label>
                        <p className="text-sm text-ink font-medium">
                          {selectedOrder.external_order_id ||
                            `#${selectedOrder.order_id}`}
                        </p>
                      </div>
                      <div>
                        <label className="text-xs text-muted uppercase tracking-wide block mb-1">
                          주문 채널
                        </label>
                        <p className="text-sm text-ink font-medium">
                          {ORDER_CHANNEL_LABELS[
                            selectedOrder.order_channel as OrderChannel
                          ] || selectedOrder.order_channel}
                        </p>
                        </div>
                      <div>
                        <label className="text-xs text-muted uppercase tracking-wide block mb-1">
                          주문 상태
                        </label>
                        <p className="text-sm text-ink font-medium">
                          {getOrderStatusLabel(
                            selectedOrder.order_status as OrderStatus
                          )}
                        </p>
                        </div>
                      <div>
                        <label className="text-xs text-muted uppercase tracking-wide block mb-1">
                          주문 일시
                        </label>
                        <p className="text-sm text-ink font-medium">
                          {new Date(selectedOrder.order_at).toLocaleString(
                            "ko-KR"
                          )}
                        </p>
                        </div>
                      <div>
                        <label className="text-xs text-muted uppercase tracking-wide block mb-1">
                          결제 일시
                        </label>
                        <p className="text-sm text-ink font-medium">
                          {selectedOrder.payment_at
                            ? new Date(selectedOrder.payment_at).toLocaleString(
                                "ko-KR"
                              )
                            : "-"}
                        </p>
                      </div>
                      <div>
                        <label className="text-xs text-muted uppercase tracking-wide block mb-1">
                          취소 일시
                        </label>
                        <p className="text-sm text-ink font-medium">
                          {selectedOrder.cancelled_at
                            ? new Date(
                                selectedOrder.cancelled_at
                              ).toLocaleString("ko-KR")
                            : "-"}
                        </p>
                    </div>
                      </div>
                        </div>

                  {/* 금액 정보 */}
                  <div className="p-4 bg-paper rounded-lg border border-line">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs text-muted uppercase tracking-wide block mb-1">
                          합계액
                        </label>
                        <p className="text-sm text-ink font-medium">
                          {selectedOrder.total_amount.toLocaleString()}원
                        </p>
                        </div>
                      <div>
                        <label className="text-xs text-muted uppercase tracking-wide block mb-1">
                          할인 금액
                        </label>
                        <p className="text-sm text-ink font-medium">
                          {selectedOrder.discount_amount.toLocaleString()}원
                        </p>
                        </div>
                      <div>
                        <label className="text-xs text-muted uppercase tracking-wide block mb-1">
                          배송비
                        </label>
                        <p className="text-sm text-ink font-medium">
                          {selectedOrder.send_fee.toLocaleString()}원
                        </p>
                      </div>
                      <div>
                        <label className="text-xs text-muted uppercase tracking-wide block mb-1">
                          최종 결제 금액
                        </label>
                        <p className="text-base font-bold text-accent">
                          {selectedOrder.payment_amount.toLocaleString()}원
                        </p>
                    </div>
                      <div>
                        <label className="text-xs text-muted uppercase tracking-wide block mb-1">
                          결제 방식
                        </label>
                        <p className="text-sm text-ink font-medium">
                          {selectedOrder.payment_method || "-"}
                        </p>
                  </div>
                    </div>
                  </div>
                </div>
              )}

              {detailTab === "customer" &&
                (() => {
                  const customer = getCustomerById(selectedOrder.customer_id);
                  return customer ? (
                    <div className="space-y-4">
                      <div className="p-4 bg-paper rounded-lg border border-line">
                  <div className="grid grid-cols-2 gap-4">
                          {/* 왼쪽: 고객명, 연락처, 이메일 */}
                          <div className="space-y-4">
                            <div>
                              <label className="text-xs text-muted uppercase tracking-wide block mb-1">
                                고객명
                              </label>
                              <p className="text-sm text-ink font-medium">
                                {customer.customer_name}
                              </p>
                    </div>
                            <div>
                              <label className="text-xs text-muted uppercase tracking-wide block mb-1">
                                연락처
                              </label>
                              <p className="text-sm text-ink font-medium">
                                {customer.customer_phone}
                              </p>
                    </div>
                            <div>
                              <label className="text-xs text-muted uppercase tracking-wide block mb-1">
                                이메일
                              </label>
                              <p className="text-sm text-ink font-medium">
                                {customer.customer_email || "-"}
                              </p>
                  </div>
                </div>
                          {/* 오른쪽: 유입 경로, 최근 주문일시, 생성일시 */}
                          <div className="space-y-4">
                            <div>
                              <label className="text-xs text-muted uppercase tracking-wide block mb-1">
                                유입 경로
                              </label>
                              <p className="text-sm text-ink font-medium">
                                {customer.create_channel === "CAFE24"
                                  ? "Cafe24"
                                  : customer.create_channel === "GPMALL"
                                  ? "갓피플몰"
                                  : customer.create_channel}
                              </p>
                            </div>
                            <div>
                              <label className="text-xs text-muted uppercase tracking-wide block mb-1">
                                최근 주문일시
                              </label>
                              <p className="text-sm text-ink font-medium">
                                {customer.last_order_at
                                  ? new Date(
                                      customer.last_order_at
                                    ).toLocaleString("ko-KR")
                                  : "-"}
                              </p>
                            </div>
                            <div>
                              <label className="text-xs text-muted uppercase tracking-wide block mb-1">
                                생성일시
                              </label>
                              <p className="text-sm text-ink font-medium">
                                {new Date(customer.created_at).toLocaleString(
                                  "ko-KR"
                                )}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                      {/* 관리자 메모 */}
                      {customer.admin_memo && (
                        <div className="p-4 bg-paper rounded-lg border border-line">
                          <label className="text-xs text-muted uppercase tracking-wide block mb-2">
                            관리자 메모
                          </label>
                          <p className="text-sm text-ink whitespace-pre-wrap">
                            {customer.admin_memo}
                          </p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted">
                      고객 정보를 찾을 수 없습니다. (고객 ID:{" "}
                      {selectedOrder.customer_id})
                    </div>
                  );
                })()}

              {detailTab === "items" && (
                <div className="space-y-4">
                  {selectedOrder.order_items &&
                  selectedOrder.order_items.length > 0 ? (
                    selectedOrder.order_items.map((item) => (
                      <div
                        key={item.order_item_id}
                        className="p-3 bg-white rounded border border-line space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
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
                            <span className="font-medium text-ink">
                              {item.product_name}
                            </span>
                          </div>
                          <span className="font-semibold text-ink">
                            {item.price.toLocaleString()}원
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <span className="text-muted">
                              외부 주문 구성 번호:
                            </span>{" "}
                            <span className="text-ink">
                              {item.external_order_item_id || "-"}
                            </span>
                      </div>
                          <div>
                            <span className="text-muted">내부 상품 코드:</span>{" "}
                            <span className="text-ink">
                              {item.product_code}
                      </span>
                          </div>
                          <div>
                            <span className="text-muted">할인 금액:</span>{" "}
                            <span className="text-ink">
                              {item.sale.toLocaleString()}원
                      </span>
                    </div>
                          <div>
                            <span className="text-muted">주문 수량:</span>{" "}
                            <span className="text-ink">{item.order_num}</span>
                  </div>
                          {item.subscribe_start_issue && (
                            <div>
                              <span className="text-muted">구독기간:</span>{" "}
                              <span className="text-ink">
                                {formatIssue(item.subscribe_start_issue)} ~{" "}
                                {formatIssue(item.subscribe_end_issue)}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-muted">
                      주문 품목이 없습니다.
                    </div>
                  )}
                </div>
              )}

              {detailTab === "shipping" &&
                (() => {
                  // 주문 기본 배송지
                  const orderAddress = selectedOrder.address_id
                    ? getAddressById(selectedOrder.address_id)
                    : null;

                  // 주문 품목별 배송지 확인
                  const itemAddresses = selectedOrder.order_items
                    ? selectedOrder.order_items.map((item) => ({
                        item,
                        address: getAddressById(item.address_id),
                      }))
                    : [];

                  // 모든 품목이 같은 배송지인지 확인
                  const allSameAddress =
                    itemAddresses.length > 0 &&
                    itemAddresses.every(
                      (ia) =>
                        ia.address &&
                        ia.address.address_id ===
                          itemAddresses[0].address?.address_id
                    );

                  return (
                <div className="space-y-4">
                      {/* 주문 기본 배송지 */}
                      {orderAddress && (
                        <div className="p-4 bg-paper rounded-lg border border-line">
                          <div className="flex items-center gap-2 mb-4">
                            <MapPin className="w-4 h-4 text-accent" />
                            <h3 className="text-sm font-semibold text-ink uppercase tracking-wide">
                              주문 기본 배송지
                            </h3>
                    </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="text-xs text-muted uppercase tracking-wide block mb-1">
                                수령인
                              </label>
                              <p className="text-sm text-ink font-medium">
                                {orderAddress.address_name}
                              </p>
                      </div>
                            <div>
                              <label className="text-xs text-muted uppercase tracking-wide block mb-1">
                                연락처
                              </label>
                              <p className="text-sm text-ink font-medium">
                                {orderAddress.phone}
                              </p>
                            </div>
                            <div>
                              <label className="text-xs text-muted uppercase tracking-wide block mb-1">
                                우편번호
                              </label>
                              <p className="text-sm text-ink font-medium">
                                {orderAddress.postal_code}
                              </p>
                            </div>
                            <div>
                              <label className="text-xs text-muted uppercase tracking-wide block mb-1">
                                국가
                              </label>
                              <p className="text-sm text-ink font-medium">
                                {orderAddress.nation}
                              </p>
                            </div>
                            <div>
                              <label className="text-xs text-muted uppercase tracking-wide block mb-1">
                                주소
                              </label>
                              <p className="text-sm text-ink font-medium">
                                {orderAddress.address1}
                              </p>
                            </div>
                            <div>
                              <label className="text-xs text-muted uppercase tracking-wide block mb-1">
                                상세주소
                              </label>
                              <p className="text-sm text-ink font-medium">
                                {orderAddress.address2 || "-"}
                              </p>
                            </div>
                            {orderAddress.address_memo && (
                              <div className="col-span-2">
                                <label className="text-xs text-muted uppercase tracking-wide block mb-1">
                                  배송 특이사항
                                </label>
                                <p className="text-sm text-ink font-medium">
                                  {orderAddress.address_memo}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* 품목별 배송지 */}
                      {itemAddresses.length > 0 && (
                        <div className="p-4 bg-paper rounded-lg border border-line">
                          <div className="flex items-center gap-2 mb-4">
                            <Package className="w-4 h-4 text-accent" />
                            <h3 className="text-sm font-semibold text-ink uppercase tracking-wide">
                              품목별 배송지
                            </h3>
                          </div>
                          {allSameAddress && itemAddresses[0].address ? (
                            <div className="p-3 bg-info-50 border border-info-200 rounded-lg">
                              <div className="flex items-center justify-between mb-3">
                                <p className="text-sm text-info-800 font-medium">
                                  모든 품목이 동일한 배송지로 설정되어 있습니다.
                                </p>
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  onClick={() => {
                                    // 첫 번째 품목의 배송지 변경 패널 열기
                                    if (itemAddresses[0].item) {
                                      handleOpenAddressChangePanel(
                                        itemAddresses[0].item
                                      );
                                    }
                                  }}
                                >
                                  배송지 변경
                                </Button>
                              </div>
                              <div className="mt-3 grid grid-cols-2 gap-4">
                                <div>
                                  <label className="text-xs text-muted uppercase tracking-wide block mb-1">
                                    수령인
                                  </label>
                                  <p className="text-sm text-ink font-medium">
                                    {itemAddresses[0].address.address_name}
                                  </p>
                                </div>
                                <div>
                                  <label className="text-xs text-muted uppercase tracking-wide block mb-1">
                                    연락처
                                  </label>
                                  <p className="text-sm text-ink font-medium">
                                    {itemAddresses[0].address.phone}
                                  </p>
                                </div>
                                <div>
                                  <label className="text-xs text-muted uppercase tracking-wide block mb-1">
                                    우편번호
                                  </label>
                                  <p className="text-sm text-ink font-medium">
                                    {itemAddresses[0].address.postal_code}
                                  </p>
                                </div>
                                <div>
                                  <label className="text-xs text-muted uppercase tracking-wide block mb-1">
                                    국가
                                  </label>
                                  <p className="text-sm text-ink font-medium">
                                    {itemAddresses[0].address.nation}
                                  </p>
                                </div>
                                <div>
                                  <label className="text-xs text-muted uppercase tracking-wide block mb-1">
                                    주소
                                  </label>
                                  <p className="text-sm text-ink font-medium">
                                    {itemAddresses[0].address.address1}
                                  </p>
                                </div>
                                <div>
                                  <label className="text-xs text-muted uppercase tracking-wide block mb-1">
                                    상세주소
                                  </label>
                                  <p className="text-sm text-ink font-medium">
                                    {itemAddresses[0].address.address2 || "-"}
                                  </p>
                                </div>
                                {itemAddresses[0].address.address_memo && (
                                  <div className="col-span-2">
                                    <label className="text-xs text-muted uppercase tracking-wide block mb-1">
                                      배송 특이사항
                                    </label>
                                    <p className="text-sm text-ink font-medium">
                                      {itemAddresses[0].address.address_memo}
                                    </p>
                                  </div>
                                )}
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-3">
                              {itemAddresses.map(({ item, address }) => (
                                <div
                                  key={item.order_item_id}
                                  className="p-3 bg-white rounded border border-line space-y-2"
                                >
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
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
                                      <p className="text-sm font-medium text-ink">
                                        {item.product_name}
                                      </p>
                      </div>
                                    <Button
                                      size="sm"
                                      variant="secondary"
                                      onClick={() =>
                                        handleOpenAddressChangePanel(item)
                                      }
                                    >
                                      배송지 변경
                                    </Button>
                      </div>
                                  {address ? (
                                    <div className="grid grid-cols-2 gap-2 text-sm">
                                      <div>
                                        <span className="text-muted">
                                          수령인:
                                        </span>{" "}
                                        <span className="text-ink">
                                          {address.address_name}
                        </span>
                      </div>
                                      <div>
                                        <span className="text-muted">
                                          연락처:
                                        </span>{" "}
                                        <span className="text-ink">
                                          {address.phone}
                                        </span>
                    </div>
                                      <div>
                                        <span className="text-muted">
                                          우편번호:
                                        </span>{" "}
                                        <span className="text-ink">
                                          {address.postal_code}
                                        </span>
                  </div>
                                      <div>
                                        <span className="text-muted">
                                          국가:
                                        </span>{" "}
                                        <span className="text-ink">
                                          {address.nation}
                                        </span>
                </div>
                                      <div>
                                        <span className="text-muted">
                                          주소:
                                        </span>{" "}
                                        <span className="text-ink">
                                          {address.address1}
                      </span>
                    </div>
                                      <div>
                                        <span className="text-muted">
                                          상세주소:
                                        </span>{" "}
                                        <span className="text-ink">
                                          {address.address2 || "-"}
                        </span>
                      </div>
                                      {address.address_memo && (
                                        <div className="col-span-2">
                                          <span className="text-muted">
                                            배송 특이사항:
                                          </span>{" "}
                                          <span className="text-ink">
                                            {address.address_memo}
                                          </span>
                      </div>
                                      )}
                      </div>
                                  ) : (
                                    <p className="text-sm text-muted">
                                      배송지 정보를 찾을 수 없습니다.
                                    </p>
                                  )}
                    </div>
                              ))}
                  </div>
                          )}
                </div>
              )}
                    </div>
                  );
                })()}

              {detailTab === "memos" && (
                <div className="space-y-4">
                  <div className="p-4 bg-info-50 border border-info-200 rounded-lg">
                  <Textarea
                      placeholder="관리자 메모를 입력하세요..."
                      value={newMemo}
                      onChange={(e) => setNewMemo(e.target.value)}
                      rows={3}
                    />
                    <div className="flex justify-end mt-3">
                      <Button
                        size="sm"
                        onClick={() => {
                          if (!selectedOrder || !newMemo.trim()) return;
                          setSelectedOrder({
                            ...selectedOrder,
                            admin_memo: newMemo,
                          });
                          setNewMemo("");
                        }}
                        disabled={!newMemo.trim()}
                        icon={Save}
                      >
                      메모 저장
                    </Button>
                    </div>
                  </div>

                  <div className="p-4 bg-white border border-line rounded-lg">
                    <div>
                      <label className="text-xs text-muted uppercase tracking-wide mb-2 block">
                        현재 관리자 메모
                      </label>
                      <p className="text-ink whitespace-pre-wrap">
                        {selectedOrder.admin_memo || "메모가 없습니다."}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </Modal>

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
              address1: "",
              address2: "",
              address_memo: "",
            });
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
                {(() => {
                  const currentAddress = getAddressById(
                    selectedOrderItemForAddressChange.address_id
                  );
                  return currentAddress ? (
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
                            {currentAddress.nation}
                          </p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs text-muted uppercase tracking-wide block mb-1">
                            주소
                          </label>
                          <p className="text-sm text-ink font-medium">
                            {currentAddress.address1}
                          </p>
                        </div>
                        <div>
                          <label className="text-xs text-muted uppercase tracking-wide block mb-1">
                            상세주소
                          </label>
                          <p className="text-sm text-ink font-medium">
                            {currentAddress.address2 || "-"}
                          </p>
                        </div>
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
                  );
                })()}
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
                    value={newAddress.address1}
              onChange={(e) =>
                      setNewAddress({ ...newAddress, address1: e.target.value })
                    }
                    placeholder="주소를 입력하세요"
                    required
                    readOnly
                  />
                  <Input
                    label="배송지 상세주소"
                    value={newAddress.address2}
                    onChange={(e) =>
                      setNewAddress({ ...newAddress, address2: e.target.value })
                    }
                    placeholder="상세주소를 입력하세요"
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
                      address1: "",
                      address2: "",
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
                    !newAddress.address1
                  }
                >
                  변경 적용
              </Button>
              </div>
            </div>
          )}
        </SlidePanel>

        {/* 주문 상세 패널 */}
        <SlidePanel
          isOpen={isDetailPanelOpen}
          onClose={() => {
            setIsDetailPanelOpen(false);
            setSelectedOrderForPanel(null);
          }}
          title={`주문 상세 - ${
            selectedOrderForPanel?.external_order_id ||
            `#${selectedOrderForPanel?.order_id}`
          }`}
          size="lg"
        >
          {selectedOrderForPanel && (
          <div className="space-y-4">
              {/* 기본 정보 */}
              <div className="p-4 bg-paper rounded-lg border border-line">
                <h3 className="text-sm font-semibold text-ink mb-4 uppercase tracking-wide">
                  기본 정보
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-muted uppercase tracking-wide block mb-1">
                      외부 주문 번호
                    </label>
                    <p className="text-sm text-ink font-medium">
                      {selectedOrderForPanel.external_order_id || "-"}
                    </p>
                  </div>
                  <div>
                    <label className="text-xs text-muted uppercase tracking-wide block mb-1">
                      주문 채널
                    </label>
                    <p className="text-sm text-ink font-medium">
                      {ORDER_CHANNEL_LABELS[
                        selectedOrderForPanel.order_channel as OrderChannel
                      ] || selectedOrderForPanel.order_channel}
                    </p>
                  </div>
                  <div>
                    <label className="text-xs text-muted uppercase tracking-wide block mb-1">
                      주문 상태
                    </label>
                    <p className="text-sm text-ink font-medium">
                      {getOrderStatusLabel(
                        selectedOrderForPanel.order_status as OrderStatus
                      )}
                    </p>
                  </div>
                  <div>
                    <label className="text-xs text-muted uppercase tracking-wide block mb-1">
                      주문 일시
                    </label>
                    <p className="text-sm text-ink font-medium">
                      {new Date(selectedOrderForPanel.order_at).toLocaleString(
                        "ko-KR"
                      )}
                    </p>
                  </div>
                </div>
              </div>

              {/* 주문 품목 */}
              {selectedOrderForPanel.order_items &&
                selectedOrderForPanel.order_items.length > 0 && (
                  <div className="p-4 bg-paper rounded-lg border border-line">
                    <h3 className="text-sm font-semibold text-ink mb-4 uppercase tracking-wide">
                      주문 품목
                    </h3>
                    <div className="space-y-3">
                      {selectedOrderForPanel.order_items.map((item) => (
                        <div
                          key={item.order_item_id}
                          className="p-3 border border-line rounded-lg"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
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
                              <p className="font-medium text-ink text-sm">
                                {item.product_name}
              </p>
            </div>
                            <p className="font-semibold text-ink">
                              {item.price.toLocaleString()}원
                            </p>
                          </div>
                          <div className="text-xs text-muted space-y-1">
                            <p>상품 코드: {item.product_code}</p>
                            <p>수량: {item.order_num}개</p>
                            {item.subscribe_start_issue && (
                              <p>
                                구독기간:{" "}
                                {formatIssue(item.subscribe_start_issue)} ~{" "}
                                {formatIssue(item.subscribe_end_issue)}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              {/* 금액 정보 */}
              <div className="p-4 bg-paper rounded-lg border border-line">
                <h3 className="text-sm font-semibold text-ink mb-4 uppercase tracking-wide">
                  금액 정보
                </h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted">주문금액</span>
                    <span className="text-sm text-ink font-medium">
                      {selectedOrderForPanel.total_amount.toLocaleString()}원
                    </span>
            </div>
                  {selectedOrderForPanel.discount_amount > 0 && (
                    <div className="flex justify-between">
                      <span className="text-sm text-muted">할인금액</span>
                      <span className="text-sm text-muted">
                        -
                        {selectedOrderForPanel.discount_amount.toLocaleString()}
                        원
                      </span>
          </div>
                  )}
                  {selectedOrderForPanel.send_fee > 0 && (
                    <div className="flex justify-between">
                      <span className="text-sm text-muted">배송비</span>
                      <span className="text-sm text-muted">
                        +{selectedOrderForPanel.send_fee.toLocaleString()}원
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between pt-2 border-t border-line">
                    <span className="font-semibold text-ink">
                      최종 결제금액
                    </span>
                    <span className="font-bold text-accent text-lg">
                      {selectedOrderForPanel.payment_amount.toLocaleString()}원
                    </span>
                  </div>
                </div>
              </div>

              {/* 결제 정보 */}
              <div className="p-4 bg-paper rounded-lg border border-line">
                <h3 className="text-sm font-semibold text-ink mb-4 uppercase tracking-wide">
                  결제 정보
                </h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-xs text-muted uppercase tracking-wide">
                      결제방식
                    </span>
                    <span className="text-sm text-ink font-medium">
                      {selectedOrderForPanel.payment_method || "-"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs text-muted uppercase tracking-wide">
                      결제상태
                    </span>
                    <Badge
                      variant={
                        selectedOrderForPanel.payment_at ? "success" : "danger"
                      }
                      size="sm"
                    >
                      {selectedOrderForPanel.payment_at ? "결제완료" : "미결제"}
                    </Badge>
            </div>
                  <div className="flex justify-between">
                    <span className="text-xs text-muted uppercase tracking-wide">
                      결제일시
                    </span>
                    <span className="text-sm text-ink font-medium">
                      {selectedOrderForPanel.payment_at
                        ? new Date(
                            selectedOrderForPanel.payment_at
                          ).toLocaleString("ko-KR")
                        : "-"}
                    </span>
                  </div>
                </div>
              </div>

              {/* 배송지 정보 */}
              {selectedOrderForPanel.address_id && (
                <div className="p-4 bg-paper rounded-lg border border-line">
                  <h3 className="text-sm font-semibold text-ink mb-4 uppercase tracking-wide">
                    배송지 정보
                  </h3>
                  {(() => {
                    const address = addresses.find(
                      (a) => a.address_id === selectedOrderForPanel.address_id
                    );
                    return address ? (
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-xs text-muted uppercase tracking-wide">
                            수령인
                          </span>
                          <span className="text-sm text-ink font-medium">
                            {address.address_name}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-xs text-muted uppercase tracking-wide">
                            연락처
                          </span>
                          <span className="text-sm text-ink font-medium">
                            {address.phone}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-xs text-muted uppercase tracking-wide">
                            우편번호
                          </span>
                          <span className="text-sm text-ink font-medium">
                            {address.postal_code}
                          </span>
                        </div>
              <div>
                          <span className="text-xs text-muted uppercase tracking-wide block mb-1">
                            주소
                          </span>
                          <p className="text-sm text-ink font-medium">
                            {address.address1} {address.address2}
                          </p>
              </div>
                        {address.address_memo && (
              <div>
                            <span className="text-xs text-muted uppercase tracking-wide block mb-1">
                              배송 메시지
                            </span>
                            <p className="text-sm text-ink font-medium">
                              {address.address_memo}
                            </p>
              </div>
                        )}
            </div>
                    ) : (
                      <p className="text-sm text-muted">
                        배송지 정보를 찾을 수 없습니다.
                      </p>
                    );
                  })()}
          </div>
              )}

              {/* 고객 요청사항 */}
              {selectedOrderForPanel.request_memo && (
                <div className="p-4 bg-paper rounded-lg border border-line">
                  <h3 className="text-sm font-semibold text-ink mb-4 uppercase tracking-wide">
                    고객 요청사항
                  </h3>
                  <p className="text-sm text-ink whitespace-pre-wrap">
                    {selectedOrderForPanel.request_memo}
                  </p>
                </div>
              )}

              {/* 관리자 메모 */}
              <div className="p-4 bg-paper rounded-lg border border-line">
                <h3 className="text-sm font-semibold text-ink mb-4 uppercase tracking-wide">
                  관리자 메모
                </h3>
                <p className="text-sm text-ink whitespace-pre-wrap">
                  {selectedOrderForPanel.admin_memo || "메모가 없습니다."}
                </p>
              </div>
            </div>
          )}
        </SlidePanel>
      </div>
    </div>
  );
};

export default OrderListPage;
