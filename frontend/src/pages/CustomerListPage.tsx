import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import * as XLSX from "xlsx";
import {
  Download,
  RefreshCw,
  Mail,
  Phone,
  Plus,
  X,
  Filter,
  Search,
  ChevronDown,
  ArrowUpDown,
  RotateCcw,
  ArrowRight,
  MessageSquare,
  Edit,
  Save,
} from "lucide-react";
import Card from "../components/common/Card";
import Button from "../components/common/Button";
import Badge from "../components/common/Badge";
import Table, { Column } from "../components/common/Table";
import Pagination from "../components/common/Pagination";
import Modal from "../components/common/Modal";
import SlidePanel from "../components/common/SlidePanel";
import Tabs from "../components/common/Tabs";
import Input from "../components/common/Input";
import Textarea from "../components/common/Textarea";
import Breadcrumb from "../components/common/Breadcrumb";
import { Customer } from "../api/customerApi";

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

interface Send {
  send_id: number;
  order_id: number;
  address_id: number | null;
  send_date: string | null;
  courier_company:
    | "CJ대한통운"
    | "로젠택배"
    | "우체국택배"
    | "한진택배"
    | "롯데택배"
    | null;
  tracking_no: string | null;
  send_status: "PREPARING" | "SHIPPED" | "DELIVERED" | "CANCELLED";
  send_memo: string | null;
  address_name: string;
  phone: string;
  nation: string;
  postal_code: string;
  address: string;
  address_memo: string | null;
  created_at: string;
  updated_at: string;
  cancelled_at: string | null;
  send_items?: SendItem[];
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

interface SendItem {
  send_item_id: number;
  send_id: number;
  order_item_id: number;
  product_code: string;
  product_kind: "YEARLY" | "MONTHLY" | "SINGLE";
  send_num: number;
  purchase: number;
  product_name: string;
  unit_weight: number;
  unit_width: number;
  unit_length: number;
  unit_height: number;
  created_at: string;
  updated_at: string;
  cancelled_at: string | null;
}

interface CustomerInquiry {
  id: number;
  date: string;
  channel: string;
  title: string;
  status: string;
}

// 목업 데이터 (실제로는 API에서 가져옴)
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

// DB 스키마 기반 목업 데이터
const mockOrders: Order[] = [
  {
    order_id: 1,
    customer_id: 1,
    external_order_id: "CAFE24-20241208001",
    order_channel: "CAFE24",
    order_status: "COMPLETED",
    total_amount: 144000,
    discount_amount: 0,
    send_fee: 3000,
    payment_amount: 147000,
    payment_method: "카드결제",
    address_id: 1,
    request_memo: "부재 시 문 앞에 놓아주세요",
    admin_memo: null,
    order_at: "2024-12-08T10:30:00",
    payment_at: "2024-12-08T10:31:00",
    cancelled_at: null,
    created_at: "2024-12-08T10:30:00",
    updated_at: "2024-12-08T10:30:00",
  },
  {
    order_id: 2,
    customer_id: 1,
    external_order_id: "CAFE24-20241115001",
    order_channel: "CAFE24",
    order_status: "COMPLETED",
    total_amount: 72000,
    discount_amount: 5000,
    send_fee: 3000,
    payment_amount: 70000,
    payment_method: "계좌이체",
    address_id: 1,
    request_memo: null,
    admin_memo: null,
    order_at: "2024-11-15T14:20:00",
    payment_at: "2024-11-15T15:00:00",
    cancelled_at: null,
    created_at: "2024-11-15T14:20:00",
    updated_at: "2024-11-15T14:20:00",
  },
  {
    order_id: 3,
    customer_id: 2,
    external_order_id: "GPMALL-20241205001",
    order_channel: "GPMALL",
    order_status: "SHIPPING",
    total_amount: 96000,
    discount_amount: 10000,
    send_fee: 0,
    payment_amount: 86000,
    payment_method: "카드결제",
    address_id: 2,
    request_memo: "경비실에 맡겨주세요",
    admin_memo: "VIP 고객",
    order_at: "2024-12-05T09:15:00",
    payment_at: "2024-12-05T09:16:00",
    cancelled_at: null,
    created_at: "2024-12-05T09:15:00",
    updated_at: "2024-12-05T09:15:00",
  },
  {
    order_id: 4,
    customer_id: 3,
    external_order_id: null,
    order_channel: "OFFLINE",
    order_status: "PAID",
    total_amount: 24000,
    discount_amount: 0,
    send_fee: 3000,
    payment_amount: 27000,
    payment_method: "현금",
    address_id: 3,
    request_memo: null,
    admin_memo: "매장 방문 고객",
    order_at: "2024-11-28T15:00:00",
    payment_at: "2024-11-28T15:00:00",
    cancelled_at: null,
    created_at: "2024-11-28T15:00:00",
    updated_at: "2024-11-28T15:00:00",
  },
];

const mockOrderItems: OrderItem[] = [
  {
    order_item_id: 1,
    external_order_item_id: "CAFE24-ITEM-001",
    order_id: 1,
    product_code: "PROD-001",
    product_kind: "YEARLY",
    product_name: "말씀함께 12개월 구독",
    price: 144000,
    sale: 0,
    order_num: 1,
    subscribe_start_issue: "202401",
    subscribe_end_issue: "202412",
    last_send_issue: "202411",
    final_subscribe_end_issue: null,
    address_id: 1,
    created_at: "2024-12-08T10:30:00",
    sended_at: null,
    cancelled_at: null,
    updated_at: "2024-12-08T10:30:00",
  },
  {
    order_item_id: 2,
    external_order_item_id: "CAFE24-ITEM-002",
    order_id: 2,
    product_code: "PROD-002",
    product_kind: "MONTHLY",
    product_name: "꿀땅 6개월 구독",
    price: 72000,
    sale: 5000,
    order_num: 1,
    subscribe_start_issue: "202407",
    subscribe_end_issue: "202412",
    last_send_issue: "202411",
    final_subscribe_end_issue: null,
    address_id: 1,
    created_at: "2024-11-15T14:20:00",
    sended_at: null,
    cancelled_at: null,
    updated_at: "2024-11-15T14:20:00",
  },
  {
    order_item_id: 3,
    external_order_item_id: "GPMALL-ITEM-001",
    order_id: 3,
    product_code: "PROD-003",
    product_kind: "YEARLY",
    product_name: "말씀함께 연간 구독",
    price: 96000,
    sale: 10000,
    order_num: 1,
    subscribe_start_issue: "202501",
    subscribe_end_issue: "202512",
    last_send_issue: null,
    final_subscribe_end_issue: null,
    address_id: 2,
    created_at: "2024-12-05T09:15:00",
    sended_at: null,
    cancelled_at: null,
    updated_at: "2024-12-05T09:15:00",
  },
  {
    order_item_id: 4,
    external_order_item_id: null,
    order_id: 4,
    product_code: "PROD-004",
    product_kind: "SINGLE",
    product_name: "말씀함께 2024년 12월호",
    price: 12000,
    sale: 0,
    order_num: 2,
    subscribe_start_issue: null,
    subscribe_end_issue: null,
    last_send_issue: null,
    final_subscribe_end_issue: null,
    address_id: 3,
    created_at: "2024-11-28T15:00:00",
    sended_at: null,
    cancelled_at: null,
    updated_at: "2024-11-28T15:00:00",
  },
  {
    order_item_id: 5,
    external_order_item_id: null,
    order_id: 4,
    product_code: "PROD-005",
    product_kind: "MONTHLY",
    product_name: "꿀땅 3개월 구독",
    price: 36000,
    sale: 0,
    order_num: 1,
    subscribe_start_issue: "202501",
    subscribe_end_issue: "202503",
    last_send_issue: null,
    final_subscribe_end_issue: null,
    address_id: 3,
    created_at: "2024-11-28T15:00:00",
    sended_at: null,
    cancelled_at: null,
    updated_at: "2024-11-28T15:00:00",
  },
];

const mockSends: Send[] = [
  {
    send_id: 1,
    order_id: 1,
    address_id: 1,
    send_date: "2024-12-10",
    courier_company: "CJ대한통운",
    tracking_no: "1234567890123",
    send_status: "DELIVERED",
    send_memo: null,
    address_name: "김민수",
    phone: "010-1234-5678",
    nation: "대한민국",
    postal_code: "12345",
    address: "서울시 강남구 테헤란로 123 아파트 101동 1001호",
    address_memo: "부재 시 문 앞에 놓아주세요",
    created_at: "2024-12-10T09:00:00",
    updated_at: "2024-12-12T10:00:00",
    cancelled_at: null,
  },
  {
    send_id: 2,
    order_id: 2,
    address_id: 1,
    send_date: "2024-11-18",
    courier_company: "로젠택배",
    tracking_no: "9876543210987",
    send_status: "DELIVERED",
    send_memo: "11월호 발송",
    address_name: "김민수",
    phone: "010-1234-5678",
    nation: "대한민국",
    postal_code: "12345",
    address: "서울시 강남구 테헤란로 123 아파트 101동 1001호",
    address_memo: null,
    created_at: "2024-11-18T10:00:00",
    updated_at: "2024-11-20T14:00:00",
    cancelled_at: null,
  },
  {
    send_id: 3,
    order_id: 3,
    address_id: 2,
    send_date: "2024-12-06",
    courier_company: "한진택배",
    tracking_no: "5555666677778",
    send_status: "SHIPPED",
    send_memo: "배송 중",
    address_name: "이영희",
    phone: "010-2345-6789",
    nation: "대한민국",
    postal_code: "54321",
    address: "서울시 서초구 반포대로 456 오피스텔 2층",
    address_memo: "경비실에 맡겨주세요",
    created_at: "2024-12-06T08:00:00",
    updated_at: "2024-12-06T08:00:00",
    cancelled_at: null,
  },
  {
    send_id: 4,
    order_id: 4,
    address_id: 3,
    send_date: null,
    courier_company: null,
    tracking_no: null,
    send_status: "PREPARING",
    send_memo: "발송 준비 중",
    address_name: "박철수",
    phone: "010-3456-7890",
    nation: "대한민국",
    postal_code: "67890",
    address: "경기도 성남시 분당구 판교로 789",
    address_memo: null,
    created_at: "2024-11-28T15:30:00",
    updated_at: "2024-11-28T15:30:00",
    cancelled_at: null,
  },
];

const mockAddresses: Address[] = [
  {
    address_id: 1,
    address_name: "김민수",
    phone: "010-1234-5678",
    nation: "대한민국",
    postal_code: "12345",
    address1: "서울시 강남구 테헤란로 123",
    address2: "아파트 101동 1001호",
    address_memo: "부재 시 문 앞에 놓아주세요",
    created_at: "2024-01-15T10:00:00",
    updated_at: "2024-01-15T10:00:00",
  },
  {
    address_id: 2,
    address_name: "이영희",
    phone: "010-2345-6789",
    nation: "대한민국",
    postal_code: "54321",
    address1: "서울시 서초구 반포대로 456",
    address2: "오피스텔 2층",
    address_memo: "경비실에 맡겨주세요",
    created_at: "2024-02-20T11:00:00",
    updated_at: "2024-02-20T11:00:00",
  },
  {
    address_id: 3,
    address_name: "박철수",
    phone: "010-3456-7890",
    nation: "대한민국",
    postal_code: "67890",
    address1: "경기도 성남시 분당구 판교로 789",
    address2: "",
    address_memo: null,
    created_at: "2024-03-10T12:00:00",
    updated_at: "2024-03-10T12:00:00",
  },
];

const mockSendItems: SendItem[] = [
  {
    send_item_id: 1,
    send_id: 1,
    order_item_id: 1,
    product_code: "PROD-001",
    product_kind: "YEARLY",
    send_num: 1,
    purchase: 8000,
    product_name: "말씀함께 12개월 구독",
    unit_weight: 250.5,
    unit_width: 210.0,
    unit_length: 297.0,
    unit_height: 5.0,
    created_at: "2024-12-10T09:00:00",
    updated_at: "2024-12-10T09:00:00",
    cancelled_at: null,
  },
  {
    send_item_id: 2,
    send_id: 2,
    order_item_id: 2,
    product_code: "PROD-002",
    product_kind: "MONTHLY",
    send_num: 1,
    purchase: 6000,
    product_name: "꿀땅 6개월 구독",
    unit_weight: 200.0,
    unit_width: 180.0,
    unit_length: 250.0,
    unit_height: 4.5,
    created_at: "2024-11-18T10:00:00",
    updated_at: "2024-11-18T10:00:00",
    cancelled_at: null,
  },
  {
    send_item_id: 3,
    send_id: 3,
    order_item_id: 3,
    product_code: "PROD-003",
    product_kind: "SINGLE",
    send_num: 1,
    purchase: 5000,
    product_name: "단권 상품",
    unit_weight: 180.0,
    unit_width: 170.0,
    unit_length: 240.0,
    unit_height: 4.0,
    created_at: "2024-12-06T08:00:00",
    updated_at: "2024-12-06T08:00:00",
    cancelled_at: null,
  },
  {
    send_item_id: 4,
    send_id: 4,
    order_item_id: 4,
    product_code: "PROD-001",
    product_kind: "YEARLY",
    send_num: 2,
    purchase: 8000,
    product_name: "말씀함께 12개월 구독",
    unit_weight: 250.5,
    unit_width: 210.0,
    unit_length: 297.0,
    unit_height: 5.0,
    created_at: "2024-11-28T15:30:00",
    updated_at: "2024-11-28T15:30:00",
    cancelled_at: null,
  },
  {
    send_item_id: 5,
    send_id: 4,
    order_item_id: 5,
    product_code: "PROD-002",
    product_kind: "MONTHLY",
    send_num: 1,
    purchase: 6000,
    product_name: "꿀땅 6개월 구독",
    unit_weight: 200.0,
    unit_width: 180.0,
    unit_length: 250.0,
    unit_height: 4.5,
    created_at: "2024-11-28T15:30:00",
    updated_at: "2024-11-28T15:30:00",
    cancelled_at: null,
  },
];

const mockCustomerInquiries: CustomerInquiry[] = [];

const SOURCE_OPTIONS = ["CAFE24", "GPMALL", "OFFLINE", "기타"];

const CustomerListPage: React.FC = () => {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 필터 상태
  const [searchTerm, setSearchTerm] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [dateFilter, setDateFilter] = useState({ start: "", end: "" });
  const [showFilters, setShowFilters] = useState(false);
  const [showSortMenu, setShowSortMenu] = useState(false);
  const sortButtonRef = useRef<HTMLDivElement>(null);
  const [sortMenuPosition, setSortMenuPosition] = useState({ top: 0, left: 0 });

  // 페이지네이션
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);
  const [sortKey, setSortKey] = useState("created_at");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  // 선택된 고객
  const [selectedCustomers, setSelectedCustomers] = useState<Set<string>>(
    new Set()
  );

  // 모달 상태
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(
    null
  );
  const [detailTab, setDetailTab] = useState("info");
  const [newMemo, setNewMemo] = useState("");
  const [editForm, setEditForm] = useState<Partial<Customer>>({});
  const [isEditMode, setIsEditMode] = useState(false);

  // 상세보기 패널 상태
  const [isDetailPanelOpen, setIsDetailPanelOpen] = useState(false);
  const [detailPanelType, setDetailPanelType] = useState<
    "order" | "subscription" | "send" | null
  >(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [selectedOrderItem, setSelectedOrderItem] = useState<OrderItem | null>(
    null
  );
  const [selectedSend, setSelectedSend] = useState<Send | null>(null);

  // 데이터 상태
  const [orders] = useState<Order[]>(mockOrders);
  const [orderItems] = useState<OrderItem[]>(mockOrderItems);
  const [sends] = useState<Send[]>(mockSends);
  const [sendItems] = useState<SendItem[]>(mockSendItems);
  const [addresses] = useState<Address[]>(mockAddresses);

  // 신규 고객 등록 폼
  const [newCustomer, setNewCustomer] = useState<{
    customer_name: string;
    customer_phone: string;
    customer_email: string | null;
    create_channel: string;
    admin_memo: string | null;
  }>({
    customer_name: "",
    customer_phone: "",
    customer_email: null,
    create_channel: "CAFE24",
    admin_memo: null,
  });

  useEffect(() => {
    fetchCustomers();
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

  const fetchCustomers = async () => {
    setLoading(true);
    setError(null);
    try {
      await new Promise((resolve) => setTimeout(resolve, 500));
      setCustomers(mockCustomers);
    } catch (err: any) {
      setError(err?.message || "고객 목록을 불러오는데 실패했습니다.");
      setCustomers([]);
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
      setSelectedCustomers(
        new Set(customers.map((c) => String(c.customer_id)))
      );
    } else {
      setSelectedCustomers(new Set());
    }
  };

  const handleSelectCustomer = (customerId: string, checked: boolean) => {
    const newSelected = new Set(selectedCustomers);
    if (checked) {
      newSelected.add(customerId);
    } else {
      newSelected.delete(customerId);
    }
    setSelectedCustomers(newSelected);
  };

  const handleViewDetail = (customer: Customer) => {
    setSelectedCustomer(customer);
    setEditForm(customer);
    setIsEditMode(false);
    setIsDetailModalOpen(true);
    setDetailTab("info");
  };

  const handleAddCustomer = () => {
    // 실제로는 API 호출
    const customer: Customer = {
      customer_id: Date.now(),
      customer_name: newCustomer.customer_name,
      customer_phone: newCustomer.customer_phone,
      customer_phone_num4: newCustomer.customer_phone.slice(-4),
      customer_email: newCustomer.customer_email || null,
      create_channel: newCustomer.create_channel,
      admin_memo: newCustomer.admin_memo || null,
      last_order_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null,
    };
    setCustomers([customer, ...customers]);
    setIsAddModalOpen(false);
    setNewCustomer({
      customer_name: "",
      customer_phone: "",
      customer_email: null,
      create_channel: "CAFE24",
      admin_memo: null,
    });
  };

  // 수정 모드 전환
  const handleStartEdit = () => {
    setIsEditMode(true);
    setEditForm(selectedCustomer || {});
  };

  // 수정 취소
  const handleCancelEdit = () => {
    setIsEditMode(false);
    setEditForm(selectedCustomer || {});
  };

  // 고객 정보 수정 저장
  const handleSaveCustomerInfo = () => {
    if (
      !selectedCustomer ||
      !editForm.customer_name ||
      !editForm.customer_phone
    ) {
      alert("이름과 연락처는 필수입니다.");
      return;
    }

    // 실제로는 API 호출
    const updatedCustomer: Customer = {
      ...selectedCustomer,
      customer_name: editForm.customer_name || selectedCustomer.customer_name,
      customer_phone:
        editForm.customer_phone || selectedCustomer.customer_phone,
      customer_phone_num4: (
        editForm.customer_phone || selectedCustomer.customer_phone
      ).slice(-4),
      customer_email:
        editForm.customer_email !== undefined
          ? editForm.customer_email
          : selectedCustomer.customer_email,
      create_channel: (editForm.create_channel ||
        selectedCustomer.create_channel) as "CAFE24" | "GPMALL" | "OFFLINE",
      updated_at: new Date().toISOString(),
    };

    setCustomers(
      customers.map((c) =>
        c.customer_id === selectedCustomer.customer_id ? updatedCustomer : c
      )
    );
    setSelectedCustomer(updatedCustomer);
    setEditForm(updatedCustomer);
    setIsEditMode(false);
    alert("고객 정보가 수정되었습니다.");
  };

  // 엑셀 다운로드 함수
  const handleExportExcel = (selectedOnly: boolean = false) => {
    let dataToExport: Customer[];

    if (selectedOnly && selectedCustomers.size > 0) {
      // 선택된 고객만 다운로드
      dataToExport = filteredCustomers.filter((customer) =>
        selectedCustomers.has(String(customer.customer_id))
      );
    } else {
      // 필터링된 모든 고객 다운로드
      dataToExport = filteredCustomers;
    }

    if (dataToExport.length === 0) {
      alert("다운로드할 데이터가 없습니다.");
      return;
    }

    // 엑셀 형식으로 변환
    const excelData = dataToExport.map((customer) => ({
      이름: customer.customer_name,
      연락처: customer.customer_phone,
      이메일: customer.customer_email || "",
      유입경로:
        customer.create_channel === "CAFE24"
          ? "Cafe24"
          : customer.create_channel === "GPMALL"
          ? "갓피플몰"
          : customer.create_channel,
      최근주문일: customer.last_order_at
        ? new Date(customer.last_order_at).toLocaleDateString("ko-KR")
        : "",
      가입일: new Date(customer.created_at).toLocaleDateString("ko-KR"),
      관리자메모: customer.admin_memo || "",
    }));

    // 워크시트 생성
    const ws = XLSX.utils.json_to_sheet(excelData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "고객 목록");

    // 파일명 생성
    const fileName = `고객목록_${new Date().toISOString().split("T")[0]}.xlsx`;

    // 다운로드
    XLSX.writeFile(wb, fileName);
  };

  // 이메일 발송 함수
  const handleSendEmail = () => {
    if (selectedCustomers.size === 0) {
      alert("이메일을 발송할 고객을 선택해주세요.");
      return;
    }

    const selectedCustomerList = filteredCustomers.filter((customer) =>
      selectedCustomers.has(String(customer.customer_id))
    );

    // 이메일 주소가 있는 고객만 필터링
    const customersWithEmail = selectedCustomerList.filter(
      (customer) => customer.customer_email
    );

    if (customersWithEmail.length === 0) {
      alert("이메일 주소가 있는 고객이 없습니다.");
      return;
    }

    // 이메일 주소 수집
    const emailAddresses = customersWithEmail
      .map((customer) => customer.customer_email)
      .filter((email): email is string => email !== null)
      .join(";");

    // mailto 링크 생성
    const mailtoLink = `mailto:${emailAddresses}`;
    window.location.href = mailtoLink;
  };

  const columns: Column<Customer>[] = [
    {
      key: "checkbox",
      label: "선택",
      width: "50px",
      align: "center",
      render: (_, row) => (
        <div className="flex justify-center">
          <input
            type="checkbox"
            checked={selectedCustomers.has(String(row.customer_id))}
            onChange={(e) =>
              handleSelectCustomer(String(row.customer_id), e.target.checked)
            }
            className="w-4 h-4 rounded border-line text-accent focus:ring-accent"
          />
        </div>
      ),
    },
    {
      key: "customer_name",
      label: "이름",
      sortable: true,
      align: "center",
      render: (value) => (
        <span className="font-medium text-ink">{value}</span>
      ),
    },
    {
      key: "customer_phone",
      label: "연락처",
      align: "center",
      render: (value) => (
        <div className="flex items-center justify-center gap-2">
          <Phone className="w-4 h-4 text-muted" />
          <span className="text-sm">{value}</span>
        </div>
      ),
    },
    {
      key: "customer_email",
      label: "이메일",
      align: "center",
      render: (value) => (
        <div className="flex items-center justify-center gap-2">
          <Mail className="w-4 h-4 text-muted" />
          <span className="text-sm truncate">{value || "-"}</span>
        </div>
      ),
    },
    {
      key: "create_channel",
      label: "유입경로",
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
            {value === "CAFE24"
              ? "Cafe24"
              : value === "GPMALL"
              ? "갓피플몰"
              : value}
          </Badge>
        </div>
      ),
    },
    {
      key: "last_order_at",
      label: "최근 주문일",
      sortable: true,
      align: "center",
      render: (value) => (
        <span className="text-sm text-muted">
          {value ? new Date(value).toLocaleDateString("ko-KR") : "-"}
        </span>
      ),
    },
    {
      key: "created_at",
      label: "가입일",
      sortable: true,
      align: "center",
      render: (value) => (
        <span className="text-sm text-muted">
          {new Date(value).toLocaleDateString("ko-KR")}
        </span>
      ),
    },
  ];

  // 필터링 및 정렬
  const filteredCustomers = customers
    .filter((customer) => {
      if (
        searchTerm &&
        !customer.customer_name
          ?.toLowerCase()
          .includes(searchTerm.toLowerCase()) &&
        !customer.customer_email
          ?.toLowerCase()
          .includes(searchTerm.toLowerCase()) &&
        !customer.customer_phone?.includes(searchTerm)
      )
        return false;
      if (sourceFilter && customer.create_channel !== sourceFilter)
        return false;
      if (dateFilter.start) {
        const joinDate = new Date(customer.created_at);
        const startDate = new Date(dateFilter.start);
        if (joinDate < startDate) return false;
      }
      if (dateFilter.end) {
        const joinDate = new Date(customer.created_at);
        const endDate = new Date(dateFilter.end);
        if (joinDate > endDate) return false;
      }
      return true;
    })
    .sort((a, b) => {
      const aVal = a[sortKey as keyof Customer];
      const bVal = b[sortKey as keyof Customer];
      if (aVal === null && bVal === null) return 0;
      if (aVal === null) return 1;
      if (bVal === null) return -1;
      const aStr = String(aVal);
      const bStr = String(bVal);
      if (sortDirection === "asc") return aStr > bStr ? 1 : -1;
      return aStr < bStr ? 1 : -1;
    });

  const totalPages = Math.ceil(filteredCustomers.length / itemsPerPage);
  const paginatedCustomers = filteredCustomers.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const detailTabs = [
    { key: "info", label: "기본 정보" },
    { key: "orders", label: "주문" },
    { key: "subscriptions", label: "구독" },
    { key: "sends", label: "배송" },
    { key: "inquiries", label: "문의내역" },
    { key: "memos", label: "관리자 메모" },
  ];

  // 고객의 주문 목록 가져오기
  const getCustomerOrders = () => {
    if (!selectedCustomer) return [];
    return orders.filter((o) => o.customer_id === selectedCustomer.customer_id);
  };

  // 고객의 구독 목록 가져오기 (YEARLY, MONTHLY만)
  const getCustomerSubscriptions = () => {
    if (!selectedCustomer) return [];
    const customerOrders = getCustomerOrders();
    const orderIds = customerOrders.map((o) => o.order_id);
    return orderItems.filter(
      (item) =>
        orderIds.includes(item.order_id) &&
        (item.product_kind === "YEARLY" || item.product_kind === "MONTHLY")
    );
  };

  // 구독 호수를 "25년 03월호" 형식으로 변환
  const formatIssue = (issue: string | null): string => {
    if (!issue) return "-";
    // "202403" 형식을 "25년 03월호" 형식으로 변환
    if (issue.length === 6) {
      const year = issue.substring(0, 4);
      const month = issue.substring(4, 6);
      const yearShort = String(parseInt(year) % 100).padStart(2, "0");
      return `${yearShort}년 ${month}월호`;
    }
    return issue;
  };

  // 구독기간을 "25년 03월호~26년 02월호" 형식으로 변환
  const formatSubscriptionPeriod = (
    startIssue: string | null,
    endIssue: string | null
  ): string => {
    if (!startIssue || !endIssue) return "-";
    return `${formatIssue(startIssue)}~${formatIssue(endIssue)}`;
  };

  // 고객의 배송 목록 가져오기
  const getCustomerSends = () => {
    if (!selectedCustomer) return [];
    const customerOrders = getCustomerOrders();
    const orderIds = customerOrders.map((o) => o.order_id);
    return sends.filter((s) => orderIds.includes(s.order_id));
  };

  // 주문 상세보기 열기
  const handleViewOrderDetail = (order: Order) => {
    setSelectedOrder(order);
    setDetailPanelType("order");
    setIsDetailPanelOpen(true);
  };

  // 구독 상세보기 열기
  const handleViewSubscriptionDetail = (orderItem: OrderItem) => {
    setSelectedOrderItem(orderItem);
    setDetailPanelType("subscription");
    setIsDetailPanelOpen(true);
  };

  // 배송 상세보기 열기
  const handleViewSendDetail = (send: Send) => {
    setSelectedSend(send);
    setDetailPanelType("send");
    setIsDetailPanelOpen(true);
  };

  // 주문 상태 한글 변환
  const getOrderStatusLabel = (status: Order["order_status"]) => {
    const labels = {
      ORDERED: "주문완료",
      PAID: "결제완료",
      CANCELLED: "취소됨",
      SHIPPING: "배송중",
      COMPLETED: "배송완료",
    };
    return labels[status];
  };

  // 배송 상태 한글 변환
  const getSendStatusLabel = (status: Send["send_status"]) => {
    const labels = {
      PREPARING: "준비중",
      SHIPPED: "배송중",
      DELIVERED: "배송완료",
      CANCELLED: "취소됨",
    };
    return labels[status];
  };

  // 배송지 ID로 주소 정보 가져오기
  const getAddressById = (addressId: number | null) => {
    if (!addressId) return null;
    return addresses.find((addr) => addr.address_id === addressId);
  };

  // 주문 품목 ID로 품목 정보 가져오기
  const getOrderItemById = (orderItemId: number) => {
    return orderItems.find((item) => item.order_item_id === orderItemId);
  };

  // 배송에 포함된 배송 품목들 가져오기
  const getSendItemsBySendId = (sendId: number) => {
    return sendItems.filter((item) => item.send_id === sendId);
  };

  return (
    <div className="min-h-screen">
      <div className="max-w-[1600px] mx-auto px-6 py-6">
        <Breadcrumb
          items={[
            { label: "고객 관리", path: "/customer/list" },
            { label: "고객 목록" },
          ]}
        />
        {/* 헤더 */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div></div>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                icon={Download}
                onClick={() => handleExportExcel(false)}
              >
                엑셀 다운로드
              </Button>
              <Button
                variant="outline"
                size="sm"
                icon={RefreshCw}
                onClick={fetchCustomers}
                loading={loading}
              >
                새로고침
              </Button>
              <Button
                size="sm"
                icon={Plus}
                onClick={() => navigate("/customer/register")}
              >
                고객 등록
              </Button>
            </div>
          </div>
        </div>

        {/* 검색 및 필터 */}
        <div className="relative">
          <Card className="unified-card mb-6 overflow-hidden" padding="none">
            <div className="p-4 bg-gradient-to-r from-paper to-white">
              {/* 상단: 검색 바, 필터 버튼, 정렬 버튼 */}
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
                    placeholder="고객 이름을 검색해보세요"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="unified-input pl-10 w-full"
                  />
                </div>
                {(searchTerm ||
                  sourceFilter ||
                  dateFilter.start ||
                  dateFilter.end) && (
                  <button
                    onClick={() => {
                      setSearchTerm("");
                      setSourceFilter("");
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
              {(sourceFilter || dateFilter.start || dateFilter.end) && (
                <div className="flex items-center gap-2 flex-wrap mb-4">
                  {sourceFilter && (
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-md text-sm font-medium">
                      유입경로:{" "}
                      {sourceFilter === "CAFE24"
                        ? "Cafe24"
                        : sourceFilter === "GPMALL"
                        ? "갓피플몰"
                        : sourceFilter}
                      <button
                        onClick={() => setSourceFilter("")}
                        className="hover:text-blue-900"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                  {(dateFilter.start || dateFilter.end) && (
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-md text-sm font-medium">
                      가입일: {dateFilter.start || "이전"} ~{" "}
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
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="unified-label">유입경로</label>
                      <select
                        value={sourceFilter}
                        onChange={(e) => setSourceFilter(e.target.value)}
                        className="unified-input w-full"
                      >
                        <option value="">전체</option>
                        {SOURCE_OPTIONS.map((source) => (
                          <option key={source} value={source}>
                            {source === "CAFE24"
                              ? "Cafe24"
                              : source === "GPMALL"
                              ? "갓피플몰"
                              : source}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="unified-label">가입일 (시작)</label>
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
                      <label className="unified-label">가입일 (종료)</label>
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

          {/* 정렬 메뉴 - Card 밖으로 분리 */}
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
                  handleSort("last_order_at", "desc");
                  setShowSortMenu(false);
                }}
                className="w-full text-left px-4 py-2 hover:bg-paper text-sm"
              >
                최근 주문일 최신순
              </button>
              <button
                onClick={() => {
                  handleSort("last_order_at", "asc");
                  setShowSortMenu(false);
                }}
                className="w-full text-left px-4 py-2 hover:bg-paper text-sm"
              >
                최근 주문일 오래된순
              </button>
              <div className="border-t border-line my-1"></div>
              <button
                onClick={() => {
                  handleSort("created_at", "desc");
                  setShowSortMenu(false);
                }}
                className="w-full text-left px-4 py-2 hover:bg-paper text-sm"
              >
                가입일 최신순
              </button>
              <button
                onClick={() => {
                  handleSort("created_at", "asc");
                  setShowSortMenu(false);
                }}
                className="w-full text-left px-4 py-2 hover:bg-paper text-sm"
              >
                가입일 오래된순
              </button>
              <div className="border-t border-line my-1"></div>
              <button
                onClick={() => {
                  handleSort("customer_name", "asc");
                  setShowSortMenu(false);
                }}
                className="w-full text-left px-4 py-2 hover:bg-paper text-sm"
              >
                이름 가나다순
              </button>
              <button
                onClick={() => {
                  handleSort("customer_name", "desc");
                  setShowSortMenu(false);
                }}
                className="w-full text-left px-4 py-2 hover:bg-paper text-sm"
              >
                이름 역순
              </button>
            </div>
          )}
        </div>

        {/* 일괄 작업 */}
        <Card className="unified-card mb-6 p-4 bg-neutral-50 border-neutral-200">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-ink">
              {selectedCustomers.size}명 선택됨
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                icon={Mail}
                onClick={handleSendEmail}
                disabled={selectedCustomers.size === 0}
              >
                이메일 발송
              </Button>
              <Button
                variant="outline"
                size="sm"
                icon={Download}
                onClick={() => handleExportExcel(true)}
                disabled={selectedCustomers.size === 0}
              >
                엑셀 다운로드
              </Button>
              {selectedCustomers.size > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedCustomers(new Set())}
                >
                  선택 해제
                </Button>
              )}
            </div>
          </div>
        </Card>

        {/* 테이블 */}
        <Card className="unified-card">
          {error ? (
            <div className="p-8 text-center">
              <p className="text-danger-600 mb-4">{error}</p>
              <Button onClick={fetchCustomers}>다시 시도</Button>
            </div>
          ) : (
            <>
              <div className="px-4 py-3 border-b border-line flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={
                      customers.length > 0 &&
                      selectedCustomers.size === customers.length
                    }
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="w-4 h-4 rounded border-line text-accent focus:ring-accent"
                  />
                  <span className="text-sm text-muted">
                    전체 {filteredCustomers.length}명
                  </span>
                </div>
                <span className="text-sm text-muted">
                  {(currentPage - 1) * itemsPerPage + 1} -{" "}
                  {Math.min(
                    currentPage * itemsPerPage,
                    filteredCustomers.length
                  )}{" "}
                  / {filteredCustomers.length}
                </span>
              </div>

              <Table
                columns={columns}
                data={paginatedCustomers}
                keyExtractor={(row) => String(row.customer_id)}
                onSort={handleSort}
                sortKey={sortKey}
                sortDirection={sortDirection}
                emptyMessage="고객 정보가 없습니다"
                hoverable
                onRowClick={handleViewDetail}
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
            </>
          )}
        </Card>

        {/* 고객 상세 모달 */}
        <Modal
          isOpen={isDetailModalOpen}
          onClose={() => {
            setIsDetailModalOpen(false);
            setIsEditMode(false);
          }}
          title={`고객 상세 - ${selectedCustomer?.customer_name}`}
          size="xl"
          footer={
            detailTab === "info" ? (
              isEditMode ? (
                <>
                  <Button variant="ghost" onClick={handleCancelEdit}>
                    취소
                  </Button>
                  <Button onClick={handleSaveCustomerInfo} icon={Save}>
                    저장
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="ghost"
                    onClick={() => setIsDetailModalOpen(false)}
                  >
                    닫기
                  </Button>
                  <Button onClick={handleStartEdit} icon={Edit}>
                    수정
                  </Button>
                </>
              )
            ) : undefined
          }
        >
          {selectedCustomer && (
            <div>
              <Tabs
                tabs={detailTabs}
                activeTab={detailTab}
                onChange={setDetailTab}
                className="mb-6"
              />

              {detailTab === "info" && (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-paper rounded-lg">
                      <div className="space-y-4">
                        {isEditMode ? (
                          <>
                            <Input
                              label="이름"
                              value={
                                editForm.customer_name ||
                                selectedCustomer.customer_name
                              }
                              onChange={(e) =>
                                setEditForm({
                                  ...editForm,
                                  customer_name: e.target.value,
                                })
                              }
                              required
                            />
                            <Input
                              label="전화번호"
                              type="tel"
                              value={
                                editForm.customer_phone ||
                                selectedCustomer.customer_phone
                              }
                              onChange={(e) =>
                                setEditForm({
                                  ...editForm,
                                  customer_phone: e.target.value,
                                })
                              }
                              required
                            />
                            <Input
                              label="이메일"
                              type="email"
                              value={
                                editForm.customer_email !== undefined
                                  ? editForm.customer_email || ""
                                  : selectedCustomer.customer_email || ""
                              }
                              onChange={(e) =>
                                setEditForm({
                                  ...editForm,
                                  customer_email: e.target.value || null,
                                })
                              }
                            />
                          </>
                        ) : (
                          <>
                            <div>
                              <label className="text-xs text-muted uppercase tracking-wide">
                                이름
                              </label>
                              <p className="text-base font-medium text-ink mt-1">
                                {selectedCustomer.customer_name}
                              </p>
                            </div>
                            <div>
                              <label className="text-xs text-muted uppercase tracking-wide">
                                전화번호
                              </label>
                              <p className="text-base text-ink mt-1">
                                {selectedCustomer.customer_phone}
                              </p>
                            </div>
                            <div>
                              <label className="text-xs text-muted uppercase tracking-wide">
                                이메일
                              </label>
                              <p className="text-base text-ink mt-1">
                                {selectedCustomer.customer_email || "-"}
                              </p>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="p-4 bg-paper rounded-lg">
                      <div className="space-y-4">
                        {isEditMode ? (
                          <div>
                            <label className="unified-label mb-2 block">
                              유입 경로{" "}
                              <span className="text-red-500 ml-1">*</span>
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
                                const currentChannel =
                                  editForm.create_channel ||
                                  selectedCustomer.create_channel;
                                const isSelected = currentChannel === source;
                                return (
                                  <button
                                    key={source}
                                    type="button"
                                    onClick={() =>
                                      setEditForm({
                                        ...editForm,
                                        create_channel: source as
                                          | "CAFE24"
                                          | "GPMALL"
                                          | "OFFLINE",
                                      })
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
                        ) : (
                          <div>
                            <label className="text-xs text-muted uppercase tracking-wide">
                              유입채널
                            </label>
                            <p className="text-base text-ink mt-1">
                              {selectedCustomer.create_channel === "CAFE24"
                                ? "Cafe24"
                                : selectedCustomer.create_channel === "GPMALL"
                                ? "갓피플몰"
                                : selectedCustomer.create_channel}
                            </p>
                          </div>
                        )}
                        <div>
                          <label className="text-xs text-muted uppercase tracking-wide">
                            마지막 주문일
                          </label>
                          <p className="text-base text-ink mt-1">
                            {selectedCustomer.last_order_at
                              ? new Date(
                                  selectedCustomer.last_order_at
                                ).toLocaleDateString("ko-KR")
                              : "-"}
                          </p>
                        </div>
                        <div>
                          <label className="text-xs text-muted uppercase tracking-wide">
                            가입일
                          </label>
                          <p className="text-base text-ink mt-1">
                            {new Date(
                              selectedCustomer.created_at
                            ).toLocaleDateString("ko-KR")}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {detailTab === "orders" && (
                <div className="space-y-3">
                  {getCustomerOrders().length === 0 ? (
                    <div className="text-center py-8 text-muted">
                      주문 내역이 없습니다.
                    </div>
                  ) : (
                    getCustomerOrders().map((order) => (
                      <div
                        key={order.order_id}
                        className="p-4 border border-line rounded-lg hover:bg-paper transition-colors cursor-pointer"
                        onClick={() => handleViewOrderDetail(order)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <p className="font-mono text-sm text-accent">
                                {order.external_order_id ||
                                  `주문 #${order.order_id}`}
                              </p>
                              <Badge
                                variant={
                                  order.order_status === "COMPLETED"
                                    ? "success"
                                    : order.order_status === "CANCELLED"
                                    ? "default"
                                    : "info"
                                }
                                size="sm"
                              >
                                {getOrderStatusLabel(order.order_status)}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted mb-1">
                              {new Date(order.order_at).toLocaleString("ko-KR")}
                            </p>
                            <p className="text-sm text-ink">
                              {order.order_channel === "CAFE24"
                                ? "Cafe24"
                                : order.order_channel === "GPMALL"
                                ? "갓피플몰"
                                : order.order_channel}
                            </p>
                          </div>
                          <div className="text-right ml-4">
                            <p className="font-semibold text-ink text-lg">
                              {order.payment_amount.toLocaleString()}원
                            </p>
                            <p className="text-xs text-muted mt-1">
                              결제: {order.payment_method || "-"}
                            </p>
                            <ArrowRight className="w-4 h-4 text-muted mt-2 ml-auto" />
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {detailTab === "subscriptions" && (
                <div className="space-y-3">
                  {getCustomerSubscriptions().length === 0 ? (
                    <div className="text-center py-8 text-muted">
                      구독 내역이 없습니다.
                    </div>
                  ) : (
                    getCustomerSubscriptions().map((item) => (
                      <div
                        key={item.order_item_id}
                        className="p-4 border border-line rounded-lg hover:bg-paper transition-colors cursor-pointer"
                        onClick={() => handleViewSubscriptionDetail(item)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <Badge
                                variant={
                                  item.product_kind === "YEARLY"
                                    ? "info"
                                    : "success"
                                }
                                size="sm"
                              >
                                {item.product_kind === "YEARLY"
                                  ? "연간"
                                  : "월간"}
                              </Badge>
                              <p className="font-medium text-ink">
                                {item.product_name}
                              </p>
                            </div>
                            <p className="text-sm text-muted mb-1">
                              구독기간 :{" "}
                              {formatSubscriptionPeriod(
                                item.subscribe_start_issue,
                                item.subscribe_end_issue
                              )}
                            </p>
                            {item.last_send_issue && (
                              <p className="text-xs text-muted">
                                최근 발송: {item.last_send_issue}
                              </p>
                            )}
                          </div>
                          <div className="text-right ml-4">
                            <p className="font-semibold text-ink">
                              {item.price.toLocaleString()}원
                            </p>
                            {item.sale > 0 && (
                              <p className="text-xs text-muted line-through">
                                {(item.price + item.sale).toLocaleString()}원
                              </p>
                            )}
                            <ArrowRight className="w-4 h-4 text-muted mt-2 ml-auto" />
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {detailTab === "sends" && (
                <div className="space-y-3">
                  {getCustomerSends().length === 0 ? (
                    <div className="text-center py-8 text-muted">
                      배송 내역이 없습니다.
                    </div>
                  ) : (
                    getCustomerSends().map((send) => (
                      <div
                        key={send.send_id}
                        className="p-4 border border-line rounded-lg hover:bg-paper transition-colors cursor-pointer"
                        onClick={() => handleViewSendDetail(send)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
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
                                {getSendStatusLabel(send.send_status)}
                              </Badge>
                              {send.tracking_no && (
                                <p className="font-mono text-sm text-accent">
                                  {send.tracking_no}
                                </p>
                              )}
                            </div>
                            <p className="text-sm text-muted mb-1">
                              {send.send_date
                                ? new Date(send.send_date).toLocaleDateString(
                                    "ko-KR"
                                  )
                                : "-"}
                            </p>
                            <p className="text-sm text-ink">
                              {send.courier_company || "택배사 미지정"}
                            </p>
                          </div>
                          <div className="text-right ml-4">
                            <p className="text-sm text-ink font-medium">
                              {send.address_name}
                            </p>
                            <p className="text-xs text-muted mt-1">
                              {send.phone}
                            </p>
                            <ArrowRight className="w-4 h-4 text-muted mt-2 ml-auto" />
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {detailTab === "inquiries" && (
                <div className="space-y-4">
                  {mockCustomerInquiries.length === 0 ? (
                    <div className="text-center py-12 text-muted">
                      <MessageSquare className="w-12 h-12 mx-auto mb-3 text-muted/50" />
                      <p>문의 내역이 없습니다.</p>
                      <p className="text-xs mt-2">
                        문의 내역 기능은 준비 중입니다.
                      </p>
                    </div>
                  ) : (
                    mockCustomerInquiries.map((inquiry) => (
                      <div
                        key={inquiry.id}
                        className="p-4 border border-line rounded-lg hover:bg-paper transition-colors cursor-pointer"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Badge
                              variant={
                                inquiry.channel === "채널톡"
                                  ? "info"
                                  : "default"
                              }
                              size="sm"
                            >
                              {inquiry.channel}
                            </Badge>
                            <span className="font-medium text-ink">
                              {inquiry.title}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge
                              variant={
                                inquiry.status === "완료"
                                  ? "success"
                                  : "warning"
                              }
                              size="sm"
                            >
                              {inquiry.status}
                            </Badge>
                            <span className="text-sm text-muted">
                              {inquiry.date}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

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
                          if (!selectedCustomer || !newMemo.trim()) return;
                          setEditForm({
                            ...editForm,
                            admin_memo: newMemo,
                          });
                          setNewMemo("");
                        }}
                        disabled={!newMemo.trim()}
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
                        {selectedCustomer.admin_memo || "메모가 없습니다."}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </Modal>

        {/* 상세보기 패널 */}
        <SlidePanel
          isOpen={isDetailPanelOpen}
          onClose={() => {
            setIsDetailPanelOpen(false);
            setDetailPanelType(null);
            setSelectedOrder(null);
            setSelectedOrderItem(null);
            setSelectedSend(null);
          }}
          title={
            detailPanelType === "order"
              ? "주문 상세"
              : detailPanelType === "subscription"
              ? "구독 상세"
              : detailPanelType === "send"
              ? "배송 상세"
              : "상세보기"
          }
          size="lg"
        >
          {detailPanelType === "order" && selectedOrder && (
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
                      {selectedOrder.external_order_id || "-"}
                    </p>
                  </div>
                  <div>
                    <label className="text-xs text-muted uppercase tracking-wide block mb-1">
                      주문 채널
                    </label>
                    <p className="text-sm text-ink font-medium">
                      {selectedOrder.order_channel === "CAFE24"
                        ? "Cafe24"
                        : selectedOrder.order_channel === "GPMALL"
                        ? "갓피플몰"
                        : selectedOrder.order_channel}
                    </p>
                  </div>
                  <div>
                    <label className="text-xs text-muted uppercase tracking-wide block mb-1">
                      주문 상태
                    </label>
                    <p className="text-sm text-ink font-medium">
                      {getOrderStatusLabel(selectedOrder.order_status)}
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
                  <div>
                    <label className="text-xs text-muted uppercase tracking-wide block mb-1">
                      주문 일시
                    </label>
                    <p className="text-sm text-ink font-medium">
                      {new Date(selectedOrder.order_at).toLocaleString("ko-KR")}
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
                        ? new Date(selectedOrder.cancelled_at).toLocaleString(
                            "ko-KR"
                          )
                        : "-"}
                    </p>
                  </div>
                </div>
              </div>
              {/* 금액 정보 */}
              <div className="p-4 bg-paper rounded-lg border border-line">
                <h3 className="text-sm font-semibold text-ink mb-4 uppercase tracking-wide">
                  금액 정보
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-muted uppercase tracking-wide block mb-1">
                      상품 금액
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
                </div>
              </div>

              {/* 배송지 정보 */}
              <div className="p-4 bg-paper rounded-lg border border-line">
                <h3 className="text-sm font-semibold text-ink mb-4 uppercase tracking-wide">
                  배송지 정보
                </h3>
                {selectedOrder.address_id ? (
                  (() => {
                    const address = getAddressById(selectedOrder.address_id);
                    return address ? (
                      <div className="space-y-2">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="text-xs text-muted uppercase tracking-wide block mb-1">
                              수령인
                            </label>
                            <p className="text-sm text-ink font-medium">
                              {address.address_name}
                            </p>
                          </div>
                          <div>
                            <label className="text-xs text-muted uppercase tracking-wide block mb-1">
                              연락처
                            </label>
                            <p className="text-sm text-ink font-medium">
                              {address.phone}
                            </p>
                          </div>
                          <div>
                            <label className="text-xs text-muted uppercase tracking-wide block mb-1">
                              국가
                            </label>
                            <p className="text-sm text-ink font-medium">
                              {address.nation}
                            </p>
                          </div>
                          <div>
                            <label className="text-xs text-muted uppercase tracking-wide block mb-1">
                              우편번호
                            </label>
                            <p className="text-sm text-ink font-medium">
                              {address.postal_code}
                            </p>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="text-xs text-muted uppercase tracking-wide block mb-1">
                              주소
                            </label>
                            <p className="text-sm text-ink font-medium">
                              {address.address1}
                            </p>
                          </div>
                          <div>
                            <label className="text-xs text-muted uppercase tracking-wide block mb-1">
                              상세주소
                            </label>
                            <p className="text-sm text-ink font-medium">
                              {address.address2 || "-"}
                            </p>
                          </div>
                        </div>
                        <div>
                          <label className="text-xs text-muted uppercase tracking-wide block mb-1">
                            배송 특이사항
                          </label>
                          <p className="text-sm text-ink font-medium">
                            {address.address_memo || "-"}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-ink">
                        배송지 정보를 찾을 수 없습니다.
                      </p>
                    );
                  })()
                ) : (
                  <p className="text-sm text-ink">배송지 정보 없음</p>
                )}
              </div>

              {/* 고객 요청사항 - 배송 특이사항과 다른 경우에만 표시 */}
              {(() => {
                const address = selectedOrder.address_id
                  ? getAddressById(selectedOrder.address_id)
                  : null;
                const addressMemo = address?.address_memo || "";
                const requestMemo = selectedOrder.request_memo || "";
                // 배송 특이사항과 고객 요청사항이 다를 때만 표시
                if (addressMemo.trim() !== requestMemo.trim() && requestMemo) {
                  return (
                    <div className="p-4 bg-paper rounded-lg border border-line">
                      <h3 className="text-sm font-semibold text-ink mb-4 uppercase tracking-wide">
                        고객 요청사항
                      </h3>
                      <p className="text-sm text-ink whitespace-pre-wrap">
                        {selectedOrder.request_memo}
                      </p>
                    </div>
                  );
                }
                return null;
              })()}

              {/* 관리자 메모 */}
              <div className="p-4 bg-paper rounded-lg border border-line">
                <h3 className="text-sm font-semibold text-ink mb-4 uppercase tracking-wide">
                  관리자 메모
                </h3>
                <p className="text-sm text-ink whitespace-pre-wrap">
                  {selectedOrder.admin_memo || "-"}
                </p>
              </div>

              {/* 주문 품목 */}
              <div className="p-4 bg-paper rounded-lg border border-line">
                <h3 className="text-sm font-semibold text-ink mb-4 uppercase tracking-wide">
                  주문 품목
                </h3>
                {(() => {
                  // Order에 order_items가 있으면 우선 사용, 없으면 기존 방식으로 필터링
                  const items = selectedOrder.order_items
                    ? selectedOrder.order_items
                    : orderItems.filter(
                        (item) => item.order_id === selectedOrder.order_id
                      );
                  return items.length === 0 ? (
                    <p className="text-sm text-muted">주문 품목이 없습니다.</p>
                  ) : (
                    <div className="space-y-3">
                      {items.map((item) => (
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
                                  : "단권"}
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
                              <span className="text-muted">외부 품목 ID:</span>{" "}
                              <span className="text-ink">
                                {item.external_order_item_id || "-"}
                              </span>
                            </div>
                            <div>
                              <span className="text-muted">상품 코드:</span>{" "}
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
                            {(item.product_kind === "YEARLY" ||
                              item.product_kind === "MONTHLY") && (
                              <>
                                <div>
                                  <span className="text-muted">
                                    구독 시작 호:
                                  </span>{" "}
                                  <span className="text-ink">
                                    {item.subscribe_start_issue || "-"}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-muted">
                                    구독 종료 호:
                                  </span>{" "}
                                  <span className="text-ink">
                                    {item.subscribe_end_issue || "-"}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-muted">
                                    최근 발송 호:
                                  </span>{" "}
                                  <span className="text-ink">
                                    {item.last_send_issue || "-"}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-muted">
                                    실제 마지막 발송 호:
                                  </span>{" "}
                                  <span className="text-ink">
                                    {item.final_subscribe_end_issue || "-"}
                                  </span>
                                </div>
                              </>
                            )}
                            <div>
                              <span className="text-muted">발송 일시:</span>{" "}
                              <span className="text-ink">
                                {item.sended_at
                                  ? new Date(item.sended_at).toLocaleString(
                                      "ko-KR"
                                    )
                                  : "-"}
                              </span>
                            </div>
                            <div>
                              <span className="text-muted">취소 일시:</span>{" "}
                              <span className="text-ink">
                                {item.cancelled_at
                                  ? new Date(item.cancelled_at).toLocaleString(
                                      "ko-KR"
                                    )
                                  : "-"}
                              </span>
                            </div>
                          </div>
                          {item.address_id && (
                            <div className="pt-2 border-t border-line">
                              <p className="text-sm text-muted mb-1">배송지</p>
                              {(() => {
                                const addr = getAddressById(item.address_id);
                                return addr ? (
                                  <p className="text-sm text-ink">
                                    {addr.address_name} / {addr.phone} /{" "}
                                    {addr.postal_code} {addr.address1}{" "}
                                    {addr.address2}
                                  </p>
                                ) : (
                                  <p className="text-sm text-ink">-</p>
                                );
                              })()}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          {detailPanelType === "subscription" && selectedOrderItem && (
            <div className="space-y-4">
              {/* 기본 정보 */}
              <div className="p-4 bg-paper rounded-lg border border-line">
                <h3 className="text-sm font-semibold text-ink mb-4 uppercase tracking-wide">
                  기본 정보
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-muted uppercase tracking-wide block mb-1">
                      외부 주문 품목 ID
                    </label>
                    <p className="text-sm text-ink font-medium">
                      {selectedOrderItem.external_order_item_id || "-"}
                    </p>
                  </div>
                  <div>
                    <label className="text-xs text-muted uppercase tracking-wide block mb-1">
                      상품 코드
                    </label>
                    <p className="text-sm text-ink font-medium">
                      {selectedOrderItem.product_code}
                    </p>
                  </div>
                  <div>
                    <label className="text-xs text-muted uppercase tracking-wide block mb-1">
                      상품 종류
                    </label>
                    <p className="text-sm text-ink font-medium">
                      {selectedOrderItem.product_kind === "YEARLY"
                        ? "연간"
                        : selectedOrderItem.product_kind === "MONTHLY"
                        ? "월간"
                        : "단권"}
                    </p>
                  </div>
                  <div>
                    <label className="text-xs text-muted uppercase tracking-wide block mb-1">
                      상품명
                    </label>
                    <p className="text-sm text-ink font-medium">
                      {selectedOrderItem.product_name}
                    </p>
                  </div>
                  <div>
                    <label className="text-xs text-muted uppercase tracking-wide block mb-1">
                      단가
                    </label>
                    <p className="text-sm text-ink font-medium">
                      {selectedOrderItem.price.toLocaleString()}원
                    </p>
                  </div>
                  <div>
                    <label className="text-xs text-muted uppercase tracking-wide block mb-1">
                      할인 금액
                    </label>
                    <p className="text-sm text-ink font-medium">
                      {selectedOrderItem.sale.toLocaleString()}원
                    </p>
                  </div>
                  <div>
                    <label className="text-xs text-muted uppercase tracking-wide block mb-1">
                      주문 수량
                    </label>
                    <p className="text-sm text-ink font-medium">
                      {selectedOrderItem.order_num}
                    </p>
                  </div>
                </div>
              </div>

              {/* 배송지 정보 */}
              <div className="p-4 bg-paper rounded-lg border border-line">
                <h3 className="text-sm font-semibold text-ink mb-4 uppercase tracking-wide">
                  배송지 정보
                </h3>
                {selectedOrderItem.address_id ? (
                  (() => {
                    const address = getAddressById(
                      selectedOrderItem.address_id
                    );
                    return address ? (
                      <div className="space-y-2">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="text-xs text-muted uppercase tracking-wide block mb-1">
                              수령인
                            </label>
                            <p className="text-sm text-ink font-medium">
                              {address.address_name}
                            </p>
                          </div>
                          <div>
                            <label className="text-xs text-muted uppercase tracking-wide block mb-1">
                              연락처
                            </label>
                            <p className="text-sm text-ink font-medium">
                              {address.phone}
                            </p>
                          </div>
                          <div>
                            <label className="text-xs text-muted uppercase tracking-wide block mb-1">
                              국가
                            </label>
                            <p className="text-sm text-ink font-medium">
                              {address.nation}
                            </p>
                          </div>
                          <div>
                            <label className="text-xs text-muted uppercase tracking-wide block mb-1">
                              우편번호
                            </label>
                            <p className="text-sm text-ink font-medium">
                              {address.postal_code}
                            </p>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="text-xs text-muted uppercase tracking-wide block mb-1">
                              주소
                            </label>
                            <p className="text-sm text-ink font-medium">
                              {address.address1}
                            </p>
                          </div>
                          <div>
                            <label className="text-xs text-muted uppercase tracking-wide block mb-1">
                              상세주소
                            </label>
                            <p className="text-sm text-ink font-medium">
                              {address.address2 || "-"}
                            </p>
                          </div>
                        </div>
                        <div>
                          <label className="text-xs text-muted uppercase tracking-wide block mb-1">
                            배송 특이사항
                          </label>
                          <p className="text-sm text-ink font-medium">
                            {address.address_memo || "-"}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-ink">
                        배송지 정보를 찾을 수 없습니다.
                      </p>
                    );
                  })()
                ) : (
                  <p className="text-sm text-ink">배송지 정보 없음</p>
                )}
              </div>

              {/* 구독 호 정보 */}
              <div className="p-4 bg-paper rounded-lg border border-line">
                <h3 className="text-sm font-semibold text-ink mb-4 uppercase tracking-wide">
                  구독 호 정보
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-muted uppercase tracking-wide block mb-1">
                      구독 시작 호
                    </label>
                    <p className="text-sm text-ink font-medium">
                      {selectedOrderItem.subscribe_start_issue || "-"}
                    </p>
                  </div>
                  <div>
                    <label className="text-xs text-muted uppercase tracking-wide block mb-1">
                      구독 종료 호
                    </label>
                    <p className="text-sm text-ink font-medium">
                      {selectedOrderItem.subscribe_end_issue || "-"}
                    </p>
                  </div>
                  <div>
                    <label className="text-xs text-muted uppercase tracking-wide block mb-1">
                      최근 발송 호
                    </label>
                    <p className="text-sm text-ink font-medium">
                      {selectedOrderItem.last_send_issue || "-"}
                    </p>
                  </div>
                  <div>
                    <label className="text-xs text-muted uppercase tracking-wide block mb-1">
                      실제 마지막 발송 호
                    </label>
                    <p className="text-sm text-ink font-medium">
                      {selectedOrderItem.final_subscribe_end_issue || "-"}
                    </p>
                  </div>
                </div>
              </div>

              {/* 일시 정보 */}
              <div className="p-4 bg-paper rounded-lg border border-line">
                <h3 className="text-sm font-semibold text-ink mb-4 uppercase tracking-wide">
                  일시 정보
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-muted uppercase tracking-wide block mb-1">
                      발송 일시
                    </label>
                    <p className="text-sm text-ink font-medium">
                      {selectedOrderItem.sended_at
                        ? new Date(selectedOrderItem.sended_at).toLocaleString(
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
                      {selectedOrderItem.cancelled_at
                        ? new Date(
                            selectedOrderItem.cancelled_at
                          ).toLocaleString("ko-KR")
                        : "-"}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {detailPanelType === "send" && selectedSend && (
            <div className="space-y-4">
              {/* 기본 정보 */}
              <div className="p-4 bg-paper rounded-lg border border-line">
                <h3 className="text-sm font-semibold text-ink mb-4 uppercase tracking-wide">
                  기본 정보
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-muted uppercase tracking-wide block mb-1">
                      발송 상태
                    </label>
                    <p className="text-sm text-ink font-medium">
                      {getSendStatusLabel(selectedSend.send_status)}
                    </p>
                  </div>
                  <div>
                    <label className="text-xs text-muted uppercase tracking-wide block mb-1">
                      발송 날짜
                    </label>
                    <p className="text-sm text-ink font-medium">
                      {selectedSend.send_date
                        ? new Date(selectedSend.send_date).toLocaleDateString(
                            "ko-KR"
                          )
                        : "-"}
                    </p>
                  </div>
                  <div>
                    <label className="text-xs text-muted uppercase tracking-wide block mb-1">
                      택배사
                    </label>
                    <p className="text-sm text-ink font-medium">
                      {selectedSend.courier_company || "-"}
                    </p>
                  </div>
                  <div>
                    <label className="text-xs text-muted uppercase tracking-wide block mb-1">
                      운송장 번호
                    </label>
                    <p className="text-sm text-ink font-mono font-medium">
                      {selectedSend.tracking_no || "-"}
                    </p>
                  </div>
                  <div>
                    <label className="text-xs text-muted uppercase tracking-wide block mb-1">
                      취소 일시
                    </label>
                    <p className="text-sm text-ink font-medium">
                      {selectedSend.cancelled_at
                        ? new Date(selectedSend.cancelled_at).toLocaleString(
                            "ko-KR"
                          )
                        : "-"}
                    </p>
                  </div>
                </div>
              </div>

              {/* 배송지 정보 (스냅샷) */}
              <div className="p-4 bg-paper rounded-lg border border-line">
                <h3 className="text-sm font-semibold text-ink mb-4 uppercase tracking-wide">
                  배송지 정보 (스냅샷)
                </h3>
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-muted uppercase tracking-wide block mb-1">
                        수령인
                      </label>
                      <p className="text-sm text-ink font-medium">
                        {selectedSend.address_name}
                      </p>
                    </div>
                    <div>
                      <label className="text-xs text-muted uppercase tracking-wide block mb-1">
                        연락처
                      </label>
                      <p className="text-sm text-ink font-medium">
                        {selectedSend.phone}
                      </p>
                    </div>
                    <div>
                      <label className="text-xs text-muted uppercase tracking-wide block mb-1">
                        국가
                      </label>
                      <p className="text-sm text-ink font-medium">
                        {selectedSend.nation}
                      </p>
                    </div>
                    <div>
                      <label className="text-xs text-muted uppercase tracking-wide block mb-1">
                        우편번호
                      </label>
                      <p className="text-sm text-ink font-medium">
                        {selectedSend.postal_code}
                      </p>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-muted uppercase tracking-wide block mb-1">
                      주소
                    </label>
                    <p className="text-sm text-ink font-medium">
                      {selectedSend.address}
                    </p>
                  </div>
                  {selectedSend.address_memo && (
                    <div>
                      <label className="text-xs text-muted uppercase tracking-wide block mb-1">
                        배송 특이사항
                      </label>
                      <p className="text-sm text-ink font-medium">
                        {selectedSend.address_memo}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* 내부 배송 메모 */}
              {selectedSend.send_memo && (
                <div className="p-4 bg-paper rounded-lg border border-line">
                  <h3 className="text-sm font-semibold text-ink mb-4 uppercase tracking-wide">
                    내부 배송 메모
                  </h3>
                  <p className="text-sm text-ink whitespace-pre-wrap">
                    {selectedSend.send_memo}
                  </p>
                </div>
              )}

              {/* 배송 품목 */}
              <div className="p-4 bg-paper rounded-lg border border-line">
                <h3 className="text-sm font-semibold text-ink mb-4 uppercase tracking-wide">
                  배송 품목
                </h3>
                {(() => {
                  // Send에 send_items가 있으면 우선 사용, 없으면 기존 방식으로 필터링
                  const items = selectedSend.send_items
                    ? selectedSend.send_items
                    : getSendItemsBySendId(selectedSend.send_id);
                  return items.length === 0 ? (
                    <p className="text-sm text-muted">배송 품목이 없습니다.</p>
                  ) : (
                    <div className="space-y-3">
                      {items.map((sendItem) => {
                        const orderItem = getOrderItemById(
                          sendItem.order_item_id
                        );
                        return (
                          <div
                            key={sendItem.send_item_id}
                            className="p-3 bg-white rounded border border-line space-y-2"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                {(sendItem.product_kind ||
                                  orderItem?.product_kind) && (
                                  <Badge
                                    variant={
                                      (sendItem.product_kind ||
                                        orderItem?.product_kind) === "YEARLY"
                                        ? "info"
                                        : (sendItem.product_kind ||
                                            orderItem?.product_kind) ===
                                          "MONTHLY"
                                        ? "success"
                                        : "default"
                                    }
                                    size="sm"
                                  >
                                    {(sendItem.product_kind ||
                                      orderItem?.product_kind) === "YEARLY"
                                      ? "연간"
                                      : (sendItem.product_kind ||
                                          orderItem?.product_kind) === "MONTHLY"
                                      ? "월간"
                                      : "단권"}
                                  </Badge>
                                )}
                                <span className="font-medium text-ink">
                                  {sendItem.product_name ||
                                    orderItem?.product_name ||
                                    "-"}
                                </span>
                              </div>
                              <span className="font-semibold text-ink">
                                {sendItem.send_num}권
                              </span>
                            </div>
                            <div className="grid grid-cols-2 gap-3 text-sm">
                              <div>
                                <label className="text-xs text-muted uppercase tracking-wide block mb-1">
                                  상품 코드
                                </label>
                                <p className="text-sm text-ink font-medium">
                                  {sendItem.product_code ||
                                    orderItem?.product_code ||
                                    "-"}
                                </p>
                              </div>
                              <div>
                                <label className="text-xs text-muted uppercase tracking-wide block mb-1">
                                  제작단가
                                </label>
                                <p className="text-sm text-ink font-medium">
                                  {sendItem.purchase
                                    ? `${sendItem.purchase.toLocaleString()}원`
                                    : "-"}
                                </p>
                              </div>
                              <div>
                                <label className="text-xs text-muted uppercase tracking-wide block mb-1">
                                  무게
                                </label>
                                <p className="text-sm text-ink font-medium">
                                  {sendItem.unit_weight
                                    ? `${sendItem.unit_weight}g`
                                    : "-"}
                                </p>
                              </div>
                              <div>
                                <label className="text-xs text-muted uppercase tracking-wide block mb-1">
                                  크기
                                </label>
                                <p className="text-sm text-ink font-medium">
                                  {sendItem.unit_width &&
                                  sendItem.unit_length &&
                                  sendItem.unit_height
                                    ? `${sendItem.unit_width}×${sendItem.unit_length}×${sendItem.unit_height}mm`
                                    : "-"}
                                </p>
                              </div>
                              {sendItem.cancelled_at && (
                                <div className="col-span-2">
                                  <label className="text-xs text-muted uppercase tracking-wide block mb-1">
                                    취소 일시
                                  </label>
                                  <p className="text-sm text-ink font-medium">
                                    {new Date(
                                      sendItem.cancelled_at
                                    ).toLocaleString("ko-KR")}
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            </div>
          )}
        </SlidePanel>

        {/* 고객 등록 모달 */}
        <Modal
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          title="신규 고객 등록"
          footer={
            <>
              <Button variant="ghost" onClick={() => setIsAddModalOpen(false)}>
                취소
              </Button>
              <Button onClick={handleAddCustomer}>등록</Button>
            </>
          }
        >
          <div className="space-y-4">
            <Input
              label="이름"
              value={newCustomer.customer_name}
              onChange={(e) =>
                setNewCustomer({
                  ...newCustomer,
                  customer_name: e.target.value,
                })
              }
              required
              placeholder="홍길동"
            />
            <Input
              label="연락처"
              type="tel"
              value={newCustomer.customer_phone}
              onChange={(e) =>
                setNewCustomer({
                  ...newCustomer,
                  customer_phone: e.target.value,
                })
              }
              required
              placeholder="010-0000-0000"
            />
            <Input
              label="이메일"
              type="email"
              value={newCustomer.customer_email ?? ""}
              onChange={(e) =>
                setNewCustomer({
                  ...newCustomer,
                  customer_email: e.target.value || null,
                })
              }
              placeholder="email@example.com"
            />
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
                  const isSelected = newCustomer.create_channel === source;
                  return (
                    <button
                      key={source}
                      type="button"
                      onClick={() =>
                        setNewCustomer({
                          ...newCustomer,
                          create_channel: source,
                        })
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
            <Textarea
              label="관리자 메모"
              value={newCustomer.admin_memo ?? ""}
              onChange={(e) =>
                setNewCustomer({
                  ...newCustomer,
                  admin_memo: e.target.value || null,
                })
              }
              placeholder="관리자 메모를 입력하세요"
              rows={3}
            />
          </div>
        </Modal>
      </div>
    </div>
  );
};

export default CustomerListPage;
