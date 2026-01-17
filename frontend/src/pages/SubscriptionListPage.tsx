import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Download,
  PauseCircle,
  RefreshCw,
  XCircle,
  MapPin,
  Package,
  Calendar,
  User,
  CheckCircle,
  Clock,
  Plus,
  Minus,
  AlertTriangle,
  History,
  Filter,
  Search,
  ChevronDown,
  ChevronRight,
  ArrowUpDown,
  RotateCcw,
  X,
} from "lucide-react";
import Table, { Column } from "../components/common/Table";
import Pagination from "../components/common/Pagination";
import Card from "../components/common/Card";
import Button from "../components/common/Button";
import Badge from "../components/common/Badge";
import Modal from "../components/common/Modal";
import SlidePanel from "../components/common/SlidePanel";
import Tabs from "../components/common/Tabs";
import Input from "../components/common/Input";
import Textarea from "../components/common/Textarea";
import Select from "../components/common/Select";
import Breadcrumb from "../components/common/Breadcrumb";
import StatCard from "../components/common/StatCard";

interface Subscription {
  id: number;
  order_item_id?: number;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  product: string;
  startIssue: string;
  endIssue: string;
  finalEndIssue: string;
  status: string;
  remainingMonths: number;
  pauseMonths: string[];
  pauseDetails?: {
    order_item_id: number;
    pause_issue: string;
    reason: string;
    admin_id?: number;
    created_at: string;
  }[];
  orderItemDetails?: {
    external_order_item_id?: string;
    product_code: string;
    product_kind: string;
    product_name: string;
    price: number;
    sale: number;
    order_num: number;
    subscribe_start_issue: string;
    subscribe_end_issue: string;
    last_send_issue?: string;
    final_subscribe_end_issue: string;
    subscribe_period: number; // 1년, 2년, 3년 구독 기간
    refund?: number;
    cancelled_at?: string;
    memo?: string;
    updated_at: string;
  };
  address: string;
  orderId: string;
  orderDate: string;
  paymentAmount: number;
  hasDuplicate?: boolean;
  duplicateInfo?: string;
  addressDetails?: {
    address_name: string;
    phone: string;
    postal_code: string;
    address1: string;
    address2: string;
    address_memo: string;
  };
  customerDetails?: {
    customer_id: number;
    customer_name: string;
    customer_phone: string;
    customer_email: string;
    create_channel: string;
    admin_memo?: string;
    last_order_at?: string;
    created_at: string;
  };
  orderDetails?: {
    external_order_id?: string;
    order_channel: string;
    order_status: string;
    payment_method?: string;
    request_memo?: string;
    admin_memo?: string;
    order_at: string;
    payment_at?: string;
    cancelled_at?: string;
  };
}

interface PauseRecord {
  id: number;
  issue: string;
  reason: string;
  createdAt: string;
  createdBy: string;
}

interface ShipmentRecord {
  issue: string;
  status: string;
  date: string;
  trackingNumber?: string;
}

// 목업 데이터
const mockSubscriptions: Subscription[] = [
  {
    id: 1,
    order_item_id: 1,
    customerName: "김민수",
    customerPhone: "010-1234-5678",
    customerEmail: "minsu.kim@example.com",
    product: "말씀함께",
    startIssue: "2024년 1월호",
    endIssue: "2024년 12월호",
    finalEndIssue: "2024년 12월호",
    status: "활성",
    remainingMonths: 1,
    pauseMonths: [],
    pauseDetails: [],
    address: "서울특별시 강남구 테헤란로 123",
    orderId: "ORD-2023-12001",
    orderDate: "2023-12-15",
    paymentAmount: 144000,
    addressDetails: {
      address_name: "김민수",
      phone: "010-1234-5678",
      postal_code: "06234",
      address1: "서울특별시 강남구 테헤란로 123",
      address2: "아크플레이스 1504호",
      address_memo: "경비실에 맡겨주세요",
    },
    customerDetails: {
      customer_id: 1,
      customer_name: "김민수",
      customer_phone: "010-1234-5678",
      customer_email: "minsu.kim@example.com",
      create_channel: "CAFE24",
      admin_memo: "우수 고객, 정기 구독자",
      last_order_at: "2024-11-15",
      created_at: "2023-12-15",
    },
    orderDetails: {
      external_order_id: "CAFE24-20231215-001",
      order_channel: "CAFE24",
      order_status: "결제완료",
      payment_method: "신용카드",
      request_memo: "부재시 경비실에 맡겨주세요",
      admin_memo: "",
      order_at: "2023-12-15 14:30:00",
      payment_at: "2023-12-15 14:32:00",
      cancelled_at: undefined,
    },
    orderItemDetails: {
      external_order_item_id: "CAFE24-ITEM-20231215-001",
      product_code: "PROD-MALSEM-001",
      product_kind: "구독",
      product_name: "말씀함께",
      price: 144000,
      sale: 0,
      order_num: 1,
      subscribe_start_issue: "2401",
      subscribe_end_issue: "2412",
      last_send_issue: "2411",
      final_subscribe_end_issue: "2412",
      subscribe_period: 1, // 1년 구독
      refund: 0,
      cancelled_at: undefined,
      memo: undefined,
      updated_at: "2024-11-15 10:30:00",
    },
  },
  {
    id: 2,
    order_item_id: 2,
    customerName: "이영희",
    customerPhone: "010-2345-6789",
    customerEmail: "younghee.lee@example.com",
    product: "말씀함께",
    startIssue: "2024년 6월호",
    endIssue: "2025년 5월호",
    finalEndIssue: "2025년 7월호",
    status: "활성",
    remainingMonths: 6,
    pauseMonths: ["2024년 8월호", "2024년 9월호"],
    pauseDetails: [
      {
        order_item_id: 2,
        pause_issue: "2408",
        reason: "해외 출장으로 인한 휴지",
        admin_id: 1,
        created_at: "2024-07-15 14:30:00",
      },
      {
        order_item_id: 2,
        pause_issue: "2409",
        reason: "해외 출장으로 인한 휴지",
        admin_id: 1,
        created_at: "2024-07-15 14:30:00",
      },
    ],
    address: "경기도 성남시 분당구 판교로 456",
    orderId: "ORD-2024-06050",
    orderDate: "2024-05-20",
    paymentAmount: 144000,
    hasDuplicate: true,
    duplicateInfo: "2025년 1월호부터 12개월 추가 구독 존재",
    addressDetails: {
      address_name: "이영희",
      phone: "010-2345-6789",
      postal_code: "13494",
      address1: "경기도 성남시 분당구 판교로 456",
      address2: "판교아파트 101동 202호",
      address_memo: "부재 시 문앞에 놓아주세요",
    },
    customerDetails: {
      customer_id: 2,
      customer_name: "이영희",
      customer_phone: "010-2345-6789",
      customer_email: "younghee.lee@example.com",
      create_channel: "CAFE24",
      admin_memo: "VIP 고객, 중복 구독 주의",
      last_order_at: "2024-12-01",
      created_at: "2024-05-20",
    },
    orderDetails: {
      external_order_id: "CAFE24-20240520-050",
      order_channel: "CAFE24",
      order_status: "결제완료",
      payment_method: "무통장입금",
      request_memo: "부재 시 문앞에 놓아주세요",
      admin_memo: "VIP 고객 - 빠른 배송 요청",
      order_at: "2024-05-20 10:15:00",
      payment_at: "2024-05-20 11:00:00",
      cancelled_at: undefined,
    },
    orderItemDetails: {
      external_order_item_id: "CAFE24-ITEM-20240520-050",
      product_code: "PROD-MALSEM-002",
      product_kind: "구독",
      product_name: "말씀함께",
      price: 144000,
      sale: 0,
      order_num: 1,
      subscribe_start_issue: "2406",
      subscribe_end_issue: "2505",
      last_send_issue: "2410",
      final_subscribe_end_issue: "2507",
      subscribe_period: 1, // 1년 구독
      updated_at: "2024-10-20 10:15:00",
    },
  },
  {
    id: 3,
    order_item_id: 3,
    customerName: "박철수",
    customerPhone: "010-3456-7890",
    customerEmail: "chulsoo.park@example.com",
    product: "꿀땅",
    startIssue: "2024년 7월호",
    endIssue: "2024년 12월호",
    finalEndIssue: "2024년 12월호",
    status: "휴지중",
    remainingMonths: 2,
    pauseMonths: ["2024년 11월호"],
    pauseDetails: [
      {
        order_item_id: 3,
        pause_issue: "2411",
        reason: "개인 사정으로 인한 휴지",
        admin_id: 2,
        created_at: "2024-10-20 10:15:00",
      },
    ],
    address: "부산광역시 해운대구 마린시티로 789",
    orderId: "ORD-2024-07032",
    orderDate: "2024-06-28",
    paymentAmount: 72000,
    addressDetails: {
      address_name: "박철수",
      phone: "010-3456-7890",
      postal_code: "48058",
      address1: "부산광역시 해운대구 마린시티로 789",
      address2: "센텀시티 타워 2305호",
      address_memo: "",
    },
    customerDetails: {
      customer_id: 3,
      customer_name: "박철수",
      customer_phone: "010-3456-7890",
      customer_email: "chulsoo.park@example.com",
      create_channel: "NAVER",
      admin_memo: "",
      last_order_at: "2024-06-28",
      created_at: "2024-06-20",
    },
    orderDetails: {
      external_order_id: "NAVER-20240628-032",
      order_channel: "NAVER",
      order_status: "결제완료",
      payment_method: "카카오페이",
      request_memo: "",
      admin_memo: "",
      order_at: "2024-06-28 09:45:00",
      payment_at: "2024-06-28 09:46:00",
      cancelled_at: undefined,
    },
    orderItemDetails: {
      external_order_item_id: "NAVER-ITEM-20240628-032",
      product_code: "PROD-GGULDDANG-001",
      product_kind: "구독",
      product_name: "꿀땅",
      price: 72000,
      sale: 0,
      order_num: 1,
      subscribe_start_issue: "2407",
      subscribe_end_issue: "2412",
      last_send_issue: "2410",
      final_subscribe_end_issue: "2412",
      subscribe_period: 1, // 1년 구독
      refund: 0,
      cancelled_at: undefined,
      memo: undefined,
      updated_at: "2024-10-20 10:15:00",
    },
  },
];

const mockPauseHistory: PauseRecord[] = [
  {
    id: 1,
    issue: "2024년 8월호",
    reason: "해외 출장",
    createdAt: "2024-07-15",
    createdBy: "관리자",
  },
  {
    id: 2,
    issue: "2024년 9월호",
    reason: "해외 출장",
    createdAt: "2024-07-15",
    createdBy: "관리자",
  },
];

const mockShipments: ShipmentRecord[] = [
  {
    issue: "2024년 1월호",
    status: "발송완료",
    date: "2023-12-28",
    trackingNumber: "123456789012",
  },
  {
    issue: "2024년 2월호",
    status: "발송완료",
    date: "2024-01-26",
    trackingNumber: "123456789013",
  },
  {
    issue: "2024년 3월호",
    status: "발송완료",
    date: "2024-02-27",
    trackingNumber: "123456789014",
  },
  {
    issue: "2024년 4월호",
    status: "발송완료",
    date: "2024-03-27",
    trackingNumber: "123456789015",
  },
  {
    issue: "2024년 5월호",
    status: "발송완료",
    date: "2024-04-26",
    trackingNumber: "123456789016",
  },
  {
    issue: "2024년 6월호",
    status: "발송완료",
    date: "2024-05-28",
    trackingNumber: "123456789017",
  },
  {
    issue: "2024년 7월호",
    status: "발송완료",
    date: "2024-06-27",
    trackingNumber: "123456789018",
  },
  {
    issue: "2024년 10월호",
    status: "발송완료",
    date: "2024-09-27",
    trackingNumber: "123456789019",
  },
  {
    issue: "2024년 11월호",
    status: "발송완료",
    date: "2024-10-28",
    trackingNumber: "123456789020",
  },
  { issue: "2024년 12월호", status: "발송예정", date: "" },
];

const PRODUCTS = ["말씀함께", "꿀땅"];
const STATUS_OPTIONS = ["활성", "휴지중", "종료"];

// 호수 형식 변환 함수 (2601 -> 26년 1월호, 2024년 1월호 -> 24년 1월호)
const formatIssue = (issue: string): string => {
  if (!issue) return issue;

  // "2024년 1월호" 형식인 경우
  const fullYearMatch = issue.match(/(\d{4})년\s*(\d+)월호/);
  if (fullYearMatch) {
    const year = fullYearMatch[1].substring(2, 4); // 마지막 2자리만
    const month = parseInt(fullYearMatch[2]);
    return `${year}년 ${month}월호`;
  }

  // "2601" 형식인 경우
  if (issue.length === 4 && /^\d{4}$/.test(issue)) {
    const year = issue.substring(0, 2);
    const month = issue.substring(2, 4);
    return `${year}년 ${parseInt(month)}월호`;
  }

  return issue;
};

// 이슈 월 생성 헬퍼
const generateIssueMonths = (
  startYear: number,
  startMonth: number,
  count: number
) => {
  const months = [];
  let year = startYear;
  let month = startMonth;
  for (let i = 0; i < count; i++) {
    months.push(`${year}년 ${month}월호`);
    month++;
    if (month > 12) {
      month = 1;
      year++;
    }
  }
  return months;
};

const SubscriptionListPage: React.FC = () => {
  const [subscriptions] = useState<Subscription[]>(mockSubscriptions);
  const [searchValue, setSearchValue] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [productFilter, setProductFilter] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [showSortMenu, setShowSortMenu] = useState(false);
  const sortButtonRef = useRef<HTMLDivElement>(null);
  const [sortMenuPosition, setSortMenuPosition] = useState({ top: 0, left: 0 });
  const [sortKey, setSortKey] = useState("orderDate");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10);
  const [selectedRows, setSelectedRows] = useState<number[]>([]);

  // 모달 상태
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isBulkExtendModalOpen, setIsBulkExtendModalOpen] = useState(false);
  const [isExtendModalOpen, setIsExtendModalOpen] = useState(false);
  const [isPauseModalOpen, setIsPauseModalOpen] = useState(false);
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
  const [isShortenModalOpen, setIsShortenModalOpen] = useState(false);
  const [selectedSubscription, setSelectedSubscription] =
    useState<Subscription | null>(null);
  const [activeTab, setActiveTab] = useState("dashboard");

  // 연장 폼
  const [extendMonths, setExtendMonths] = useState(1);
  const [extendReason, setExtendReason] = useState("");
  const [isFreeExtend, setIsFreeExtend] = useState(false);

  // 휴지 폼
  const [pauseIssues, setPauseIssues] = useState<string[]>([]);
  const [pauseReason, setPauseReason] = useState("");

  // 배송지 변경 폼
  const [newAddress, setNewAddress] = useState({
    address_name: "",
    phone: "",
    postal_code: "",
    address1: "",
    address2: "",
    address_memo: "",
  });

  // 구독 기간 단축 폼
  const [shortenMonths, setShortenMonths] = useState(1);
  const [refundAmount, setRefundAmount] = useState(0);
  const [refundConfirmed, setRefundConfirmed] = useState(false);
  const [customerInquired, setCustomerInquired] = useState(false);
  const [isRefundConfirmModalOpen, setIsRefundConfirmModalOpen] =
    useState(false);

  // 일괄 연장
  const [bulkExtendMonths, setBulkExtendMonths] = useState(1);

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
      // 위치 계산을 다음 프레임으로 지연시켜 DOM이 완전히 렌더링된 후 계산
      requestAnimationFrame(() => {
        if (sortButtonRef.current) {
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
        }
      });
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    } else {
      setSortMenuPosition({ top: 0, left: 0 });
    }
  }, [showSortMenu]);

  const handleSort = (key: string, direction: "asc" | "desc") => {
    setSortKey(key);
    setSortDirection(direction);
  };

  const handleViewDetail = (subscription: Subscription) => {
    setSelectedSubscription(subscription);
    setIsDetailModalOpen(true);
    setActiveTab("dashboard");
  };

  const handleSelectRow = (id: number) => {
    setSelectedRows((prev) =>
      prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedRows.length === filteredSubscriptions.length) {
      setSelectedRows([]);
    } else {
      setSelectedRows(filteredSubscriptions.map((s) => s.id));
    }
  };

  const handleBulkExtend = () => {
    // 실제로는 API 호출
    setIsBulkExtendModalOpen(false);
    setSelectedRows([]);
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<
      string,
      {
        variant: "subscription-active" | "subscription-pause" | "default";
        label: string;
      }
    > = {
      활성: { variant: "subscription-active", label: "활성" },
      휴지중: { variant: "subscription-pause", label: "휴지중" },
      종료: { variant: "default", label: "종료" },
    };
    const config = statusMap[status] || {
      variant: "default" as const,
      label: status,
    };
    return (
      <Badge variant={config.variant} dot>
        {config.label}
      </Badge>
    );
  };

  // 필터링 및 정렬
  const filteredSubscriptions = subscriptions
    .filter((sub) => {
      if (searchValue) {
        const search = searchValue.toLowerCase();
        if (
          !sub.customerName.toLowerCase().includes(search) &&
          !sub.customerPhone.includes(search) &&
          !sub.product.toLowerCase().includes(search)
        ) {
          return false;
        }
      }
      if (statusFilter && sub.status !== statusFilter) return false;
      if (productFilter && sub.product !== productFilter) return false;
      return true;
    })
    .sort((a, b) => {
      let aVal: any;
      let bVal: any;

      if (sortKey === "customerName") {
        aVal = a.customerName;
        bVal = b.customerName;
      } else if (sortKey === "orderDate") {
        aVal = a.orderDate ? new Date(a.orderDate).getTime() : 0;
        bVal = b.orderDate ? new Date(b.orderDate).getTime() : 0;
      } else if (sortKey === "remainingMonths") {
        aVal = a.remainingMonths;
        bVal = b.remainingMonths;
      } else if (sortKey === "status") {
        aVal = a.status;
        bVal = b.status;
      } else {
        return 0;
      }

      if (aVal === null || aVal === undefined) {
        return sortDirection === "asc" ? 1 : -1;
      }
      if (bVal === null || bVal === undefined) {
        return sortDirection === "asc" ? -1 : 1;
      }

      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortDirection === "asc" ? aVal - bVal : bVal - aVal;
      }

      const aStr = String(aVal).toLowerCase();
      const bStr = String(bVal).toLowerCase();
      if (sortDirection === "asc") {
        return aStr > bStr ? 1 : -1;
      }
      return aStr < bStr ? 1 : -1;
    });

  const totalPages = Math.ceil(filteredSubscriptions.length / pageSize);
  const paginatedData = filteredSubscriptions.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const columns: Column<Subscription>[] = [
    {
      key: "checkbox",
      label: "선택",
      width: "50px",
      align: "center",
      render: (_, row) => (
        <div className="flex justify-center">
          <input
            type="checkbox"
            checked={selectedRows.includes(row.id)}
            onChange={() => handleSelectRow(row.id)}
            onClick={(e) => e.stopPropagation()}
            className="w-4 h-4 rounded border-line text-accent focus:ring-accent"
          />
        </div>
      ),
    },
    {
      key: "customerName",
      label: "고객명",
      align: "center",
      render: (_, row) => (
        <div className="flex items-center justify-center gap-2">
          <span className="font-medium text-ink">{row.customerName}</span>
          {row.hasDuplicate && (
            <Badge variant="subscription-duplicate" size="sm">
              중복
            </Badge>
          )}
        </div>
      ),
    },
    {
      key: "customerPhone",
      label: "연락처",
      align: "center",
      render: (value) => (
        <span className="text-sm">{value}</span>
      ),
    },
    {
      key: "product",
      label: "상품명",
      align: "center",
      render: (value) => (
        <div className="flex justify-center">
          <Badge variant="info" size="sm">
            {value}
          </Badge>
        </div>
      ),
    },
    {
      key: "period",
      label: "구독기간",
      align: "center",
      render: (_, row) => (
        <div className="text-center text-sm">
          <span className="text-ink">{formatIssue(row.startIssue)}</span>
          <span className="text-muted mx-1">~</span>
          <span className="text-ink">{formatIssue(row.finalEndIssue)}</span>
          {row.endIssue !== row.finalEndIssue && (
            <span className="text-xs text-muted ml-1">
              (원: {formatIssue(row.endIssue)})
            </span>
          )}
        </div>
      ),
    },
    {
      key: "status",
      label: "상태",
      align: "center",
      render: (_, row) => (
        <div className="flex justify-center">{getStatusBadge(row.status)}</div>
      ),
    },
    {
      key: "pauseMonths",
      label: "휴지 이력",
      align: "center",
      render: (_, row) => (
        <div className="text-sm">
          {row.pauseMonths.length > 0 ? (
            <div className="flex flex-wrap justify-center gap-1">
              {row.pauseMonths.map((month, idx) => (
                <Badge key={idx} variant="warning" size="sm">
                  {formatIssue(month)}
                </Badge>
              ))}
            </div>
          ) : (
            <span className="text-muted">없음</span>
          )}
        </div>
      ),
    },
  ];

  const availablePauseMonths = generateIssueMonths(2025, 1, 12);

  // 통계 계산
  const stats = {
    active: mockSubscriptions.filter((s) => s.status === "활성").length,
    paused: mockSubscriptions.filter((s) => s.status === "휴지중").length,
    duplicate: mockSubscriptions.filter((s) => s.hasDuplicate).length,
  };

  return (
    <div className="min-h-screen">
      <div className="max-w-[1600px] mx-auto px-6 py-6">
        <Breadcrumb
          items={[
            { label: "구독 관리", path: "/subscription/list" },
            { label: "구독 목록" },
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
                className="unified-btn-outline"
              >
                엑셀 다운로드
              </Button>
              <Button
                variant="outline"
                size="sm"
                icon={RefreshCw}
                className="unified-btn-outline"
              >
                새로고침
              </Button>
            </div>
          </div>
        </div>

        {/* 통계 카드 */}
        <div
          className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 anim-rise"
          style={{ animationDelay: "0.1s" }}
        >
          <div
            className="unified-card p-5 unified-card-hover cursor-pointer"
            onClick={() => setStatusFilter("활성")}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted mb-1">활성 구독</p>
                <p className="text-2xl font-bold text-subscription-active-600">
                  {stats.active}
                </p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-subscription-active-100 flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-subscription-active-600" />
              </div>
            </div>
          </div>
          <div
            className="unified-card p-5 unified-card-hover cursor-pointer"
            onClick={() => setStatusFilter("휴지중")}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted mb-1">휴지 중</p>
                <p className="text-2xl font-bold text-subscription-pause-600">
                  {stats.paused}
                </p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-subscription-pause-100 flex items-center justify-center">
                <PauseCircle className="w-6 h-6 text-subscription-pause-600" />
              </div>
            </div>
          </div>
          <div className="unified-card p-5 unified-card-hover cursor-pointer">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted mb-1">중복 구독</p>
                <p className="text-2xl font-bold text-subscription-duplicate-600">
                  {stats.duplicate}
                </p>
                <p className="text-xs text-muted mt-0.5">확인 필요</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-subscription-duplicate-100 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-subscription-duplicate-600" />
              </div>
            </div>
          </div>
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
                    placeholder="고객명, 연락처, 상품명으로 검색..."
                    value={searchValue}
                    onChange={(e) => setSearchValue(e.target.value)}
                    className="unified-input pl-10 w-full"
                  />
                </div>
                {(searchValue || statusFilter || productFilter) && (
                  <button
                    onClick={() => {
                      setSearchValue("");
                      setStatusFilter("");
                      setProductFilter("");
                      setSortKey("orderDate");
                      setSortDirection("desc");
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-md font-medium text-sm bg-accent text-white hover:bg-accent/90 transition-all"
                  >
                    <RotateCcw className="w-4 h-4" />
                    필터&정렬 초기화
                  </button>
                )}
              </div>

              {/* 선택된 필터 태그들 */}
              {(statusFilter || productFilter) && (
                <div className="flex items-center gap-2 flex-wrap mb-4">
                  {statusFilter && (
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-md text-sm font-medium">
                      구독 상태: {statusFilter}
                      <button
                        onClick={() => setStatusFilter("")}
                        className="hover:text-blue-900"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                  {productFilter && (
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-md text-sm font-medium">
                      상품별: {productFilter}
                      <button
                        onClick={() => setProductFilter("")}
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
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="unified-label">구독 상태</label>
                      <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="unified-input w-full"
                      >
                        <option value="">전체</option>
                        {STATUS_OPTIONS.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="unified-label">상품별</label>
                      <select
                        value={productFilter}
                        onChange={(e) => setProductFilter(e.target.value)}
                        className="unified-input w-full"
                      >
                        <option value="">전체</option>
                        {PRODUCTS.map((product) => (
                          <option key={product} value={product}>
                            {product}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* 정렬 메뉴 - Card 밖으로 분리 */}
          {showSortMenu && sortMenuPosition.top > 0 && (
            <div
              className="absolute sort-menu-dropdown bg-white border border-line rounded-md shadow-lg z-[1000] min-w-[200px]"
              style={{
                top: `${sortMenuPosition.top}px`,
                left: `${sortMenuPosition.left}px`,
              }}
            >
              <button
                onClick={() => {
                  handleSort("orderDate", "desc");
                  setShowSortMenu(false);
                }}
                className="w-full text-left px-4 py-2 hover:bg-paper text-sm"
              >
                주문일 최신순
              </button>
              <button
                onClick={() => {
                  handleSort("orderDate", "asc");
                  setShowSortMenu(false);
                }}
                className="w-full text-left px-4 py-2 hover:bg-paper text-sm"
              >
                주문일 오래된순
              </button>
              <div className="border-t border-line my-1"></div>
              <button
                onClick={() => {
                  handleSort("customerName", "asc");
                  setShowSortMenu(false);
                }}
                className="w-full text-left px-4 py-2 hover:bg-paper text-sm"
              >
                고객명 가나다순
              </button>
              <button
                onClick={() => {
                  handleSort("customerName", "desc");
                  setShowSortMenu(false);
                }}
                className="w-full text-left px-4 py-2 hover:bg-paper text-sm"
              >
                고객명 역순
              </button>
              <div className="border-t border-line my-1"></div>
              <button
                onClick={() => {
                  handleSort("remainingMonths", "asc");
                  setShowSortMenu(false);
                }}
                className="w-full text-left px-4 py-2 hover:bg-paper text-sm"
              >
                남은개월 적은순
              </button>
              <button
                onClick={() => {
                  handleSort("remainingMonths", "desc");
                  setShowSortMenu(false);
                }}
                className="w-full text-left px-4 py-2 hover:bg-paper text-sm"
              >
                남은개월 많은순
              </button>
            </div>
          )}
        </div>

        {/* 일괄 작업 */}
        <Card className="unified-card mb-6 p-4 bg-neutral-50 border-neutral-200">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-ink">
              {selectedRows.length}개 선택됨
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                icon={Plus}
                onClick={() => setIsBulkExtendModalOpen(true)}
                disabled={selectedRows.length === 0}
              >
                일괄 연장
              </Button>
              {selectedRows.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedRows([])}
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
                  filteredSubscriptions.length > 0 &&
                  selectedRows.length === filteredSubscriptions.length
                }
                onChange={handleSelectAll}
                className="w-4 h-4 rounded border-line text-accent focus:ring-accent"
              />
              <span className="text-sm text-muted">
                전체 {filteredSubscriptions.length}건
              </span>
            </div>
            <span className="text-sm text-muted">
              {(currentPage - 1) * pageSize + 1} -{" "}
              {Math.min(currentPage * pageSize, filteredSubscriptions.length)} /{" "}
              {filteredSubscriptions.length}
            </span>
          </div>

          <Table
            columns={columns}
            data={paginatedData}
            keyExtractor={(item) => String(item.id)}
            onRowClick={handleViewDetail}
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

        {/* 구독 상세 모달 */}
        <Modal
          isOpen={isDetailModalOpen}
          onClose={() => setIsDetailModalOpen(false)}
          title="구독 상세"
          size="xl"
        >
          {selectedSubscription && (
            <SubscriptionDetailModal
              subscription={selectedSubscription}
              onClose={() => setIsDetailModalOpen(false)}
              onOpenExtend={() => {
                setIsPauseModalOpen(false);
                setIsAddressModalOpen(false);
                setIsShortenModalOpen(false);
                setExtendMonths(1);
                setExtendReason("");
                setIsFreeExtend(false);
                setIsExtendModalOpen(true);
              }}
              onOpenPause={() => {
                setIsExtendModalOpen(false);
                setIsAddressModalOpen(false);
                setIsShortenModalOpen(false);
                setPauseIssues([]);
                setPauseReason("");
                setIsPauseModalOpen(true);
              }}
              onOpenAddress={() => {
                setIsExtendModalOpen(false);
                setIsPauseModalOpen(false);
                setIsShortenModalOpen(false);
                if (selectedSubscription?.addressDetails) {
                  setNewAddress(selectedSubscription.addressDetails);
                } else {
                  setNewAddress({
                    address_name: selectedSubscription?.customerName || "",
                    phone: selectedSubscription?.customerPhone || "",
                    postal_code: "",
                    address1: selectedSubscription?.address || "",
                    address2: "",
                    address_memo: "",
                  });
                }
                setIsAddressModalOpen(true);
              }}
              onOpenShorten={() => {
                setIsExtendModalOpen(false);
                setIsPauseModalOpen(false);
                setIsAddressModalOpen(false);
                setShortenMonths(1);
                setRefundAmount(0);
                setRefundConfirmed(false);
                setCustomerInquired(false);
                setIsRefundConfirmModalOpen(false);
                setIsShortenModalOpen(true);
              }}
              activeTab={activeTab}
              onTabChange={setActiveTab}
            />
          )}
        </Modal>

        {/* 구독 기간 연장 패널 */}
        <SlidePanel
          isOpen={isExtendModalOpen}
          onClose={() => setIsExtendModalOpen(false)}
          title="구독 기간 연장"
          size="md"
          footer={
            <div className="flex gap-3 justify-end">
              <Button
                variant="ghost"
                onClick={() => setIsExtendModalOpen(false)}
              >
                취소
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  // TODO: API 호출
                  setIsExtendModalOpen(false);
                  setIsDetailModalOpen(false);
                }}
              >
                연장 적용
              </Button>
            </div>
          }
        >
          <SubscriptionExtendModal
            extendMonths={extendMonths}
            onExtendMonthsChange={setExtendMonths}
            extendReason={extendReason}
            isFreeExtend={isFreeExtend}
            onExtendReasonChange={setExtendReason}
            onIsFreeExtendChange={setIsFreeExtend}
            startIssue={
              selectedSubscription?.orderItemDetails?.subscribe_start_issue ||
              selectedSubscription?.startIssue
            }
            finalEndIssue={
              selectedSubscription?.orderItemDetails
                ?.final_subscribe_end_issue ||
              selectedSubscription?.finalEndIssue
            }
          />
        </SlidePanel>

        {/* 휴지 신청 패널 */}
        <SlidePanel
          isOpen={isPauseModalOpen}
          onClose={() => setIsPauseModalOpen(false)}
          title="휴지 신청"
          size="md"
          footer={
            <div className="flex gap-3 justify-end">
              <Button
                variant="ghost"
                onClick={() => setIsPauseModalOpen(false)}
              >
                취소
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  // TODO: API 호출
                  setIsPauseModalOpen(false);
                  setIsDetailModalOpen(false);
                }}
                disabled={pauseIssues.length === 0}
              >
                휴지 신청
              </Button>
            </div>
          }
        >
          <SubscriptionPauseModal
            pauseIssues={pauseIssues}
            pauseReason={pauseReason}
            onPauseIssuesChange={setPauseIssues}
            onPauseReasonChange={setPauseReason}
            finalEndIssue={
              selectedSubscription?.orderItemDetails
                ?.final_subscribe_end_issue ||
              selectedSubscription?.finalEndIssue ||
              ""
            }
            startIssue={
              selectedSubscription?.orderItemDetails?.subscribe_start_issue ||
              selectedSubscription?.startIssue ||
              ""
            }
            lastSendIssue={
              selectedSubscription?.orderItemDetails?.last_send_issue
            }
            subscribePeriod={
              selectedSubscription?.orderItemDetails?.subscribe_period || 1
            }
          />
        </SlidePanel>

        {/* 배송지 변경 패널 */}
        <SlidePanel
          isOpen={isAddressModalOpen}
          onClose={() => setIsAddressModalOpen(false)}
          title="배송지 변경"
          size="lg"
          footer={
            <div className="flex gap-3 justify-end">
              <Button
                variant="ghost"
                onClick={() => setIsAddressModalOpen(false)}
              >
                취소
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  // TODO: API 호출
                  console.log("새 배송지:", newAddress);
                  setIsAddressModalOpen(false);
                  setIsDetailModalOpen(false);
                }}
              >
                변경 적용
              </Button>
            </div>
          }
        >
          {selectedSubscription && (
            <SubscriptionAddressModal
              address={newAddress}
              onAddressChange={setNewAddress}
            />
          )}
        </SlidePanel>

        {/* 구독 기간 단축 패널 */}
        <SlidePanel
          isOpen={isShortenModalOpen}
          onClose={() => setIsShortenModalOpen(false)}
          title="구독 기간 단축"
          size="md"
          footer={
            <div className="flex gap-3 justify-end">
              <Button
                variant="ghost"
                onClick={() => setIsShortenModalOpen(false)}
              >
                취소
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  setIsRefundConfirmModalOpen(true);
                }}
                disabled={shortenMonths <= 0 || refundAmount <= 0}
              >
                환불 확인 후 저장
              </Button>
            </div>
          }
        >
          <SubscriptionShortenModal
            shortenMonths={shortenMonths}
            refundAmount={refundAmount}
            currentStartIssue={
              selectedSubscription?.orderItemDetails?.subscribe_start_issue ||
              selectedSubscription?.startIssue ||
              ""
            }
            currentEndIssue={
              selectedSubscription?.orderItemDetails
                ?.final_subscribe_end_issue ||
              selectedSubscription?.finalEndIssue ||
              ""
            }
            onShortenMonthsChange={setShortenMonths}
            onRefundAmountChange={setRefundAmount}
          />
        </SlidePanel>

        {/* 환불 완료 확인 모달 */}
        <Modal
          isOpen={isRefundConfirmModalOpen}
          onClose={() => setIsRefundConfirmModalOpen(false)}
          title="환불 완료 확인"
          size="sm"
          footer={
            <div className="flex gap-3 justify-end">
              <Button
                variant="ghost"
                onClick={() => {
                  setIsRefundConfirmModalOpen(false);
                }}
              >
                취소
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  setRefundConfirmed(true);
                  setIsRefundConfirmModalOpen(false);
                  // TODO: API 호출 - order_item.final_subscription_end_issue와 환불액 UPDATE
                  // TODO: history에 단축·환불 완료 기록 저장
                  setIsShortenModalOpen(false);
                  setIsDetailModalOpen(false);
                }}
                disabled={!customerInquired}
              >
                저장
              </Button>
            </div>
          }
        >
          <div className="space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <p className="text-sm font-semibold text-amber-900 mb-2">
                환불 예정 금액: ₩{refundAmount.toLocaleString()}
              </p>
              <p className="text-sm text-amber-700">
                단축 개월수: {shortenMonths}개월
              </p>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={customerInquired}
                  onChange={(e) => setCustomerInquired(e.target.checked)}
                  className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 mt-0.5"
                />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-blue-900 mb-1">
                    고객에게 문의했습니다
                  </p>
                  <p className="text-xs text-blue-700">
                    고객에게 환불 관련 문의를 완료한 경우 체크해주세요.
                  </p>
                </div>
              </label>
            </div>
          </div>
        </Modal>

        {/* 일괄 연장 모달 */}
        <Modal
          isOpen={isBulkExtendModalOpen}
          onClose={() => setIsBulkExtendModalOpen(false)}
          title="일괄 구독 연장"
          size="lg"
          footer={
            <>
              <Button
                variant="ghost"
                onClick={() => setIsBulkExtendModalOpen(false)}
              >
                취소
              </Button>
              <Button onClick={handleBulkExtend}>일괄 연장 적용</Button>
            </>
          }
        >
          <div className="space-y-4">
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-900 font-medium mb-1">
                선택된 구독: <strong>{selectedRows.length}건</strong>
              </p>
              <p className="text-xs text-blue-700">
                각 구독의 실제 종료일(final_subscribe_end_issue)이 개별적으로
                연장됩니다.
              </p>
            </div>

            <div className="flex items-center gap-4 p-4 bg-white border border-gray-200 rounded-lg">
              <label className="text-sm font-medium text-gray-700">
                연장 개월:
              </label>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setBulkExtendMonths(Math.max(1, bulkExtendMonths - 1))
                  }
                >
                  <Minus className="w-4 h-4" />
                </Button>
                <span className="w-12 text-center font-semibold text-lg text-gray-900">
                  {bulkExtendMonths}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setBulkExtendMonths(bulkExtendMonths + 1)}
                >
                  <Plus className="w-4 h-4" />
                </Button>
                <span className="text-sm text-gray-500 ml-2">개월</span>
              </div>
            </div>

            {/* 각 구독의 변경 내역 리스트 */}
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                <p className="text-sm font-semibold text-gray-900">
                  적용 전 확인 - 각 구독별 변경 내역
                </p>
              </div>
              <div className="max-h-96 overflow-y-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase">
                        고객명
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase">
                        상품
                      </th>
                      <th className="px-4 py-2 text-center text-xs font-semibold text-gray-600 uppercase">
                        기존 실제 종료
                      </th>
                      <th className="px-4 py-2 text-center text-xs font-semibold text-gray-600 uppercase">
                        변경 후 실제 종료
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {selectedRows.map((rowId) => {
                      const subscription = subscriptions.find(
                        (s) => s.id === rowId
                      );
                      if (!subscription) return null;

                      const currentEndIssue =
                        subscription.orderItemDetails
                          ?.final_subscribe_end_issue ||
                        subscription.finalEndIssue;

                      // 연장 후 종료 호 계산
                      const calculateExtendedIssue = (
                        issue: string,
                        months: number
                      ) => {
                        const cleanIssue = issue.replace(/[년월호\s]/g, "");
                        if (cleanIssue.length === 4) {
                          const year = parseInt(cleanIssue.substring(0, 2));
                          const month = parseInt(cleanIssue.substring(2, 4));
                          const totalMonths = month + months;
                          const newYear =
                            year + Math.floor((totalMonths - 1) / 12);
                          const newMonth = ((totalMonths - 1) % 12) + 1;
                          return `${String(newYear).padStart(2, "0")}${String(
                            newMonth
                          ).padStart(2, "0")}`;
                        }
                        return issue;
                      };

                      const newEndIssue = calculateExtendedIssue(
                        currentEndIssue,
                        bulkExtendMonths
                      );

                      return (
                        <tr key={rowId} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {subscription.customerName}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {subscription.product}
                          </td>
                          <td className="px-4 py-3 text-sm text-center text-gray-700">
                            {formatIssue(currentEndIssue)}
                          </td>
                          <td className="px-4 py-3 text-sm text-center">
                            <div className="flex items-center justify-center gap-2">
                              <span className="text-gray-400 line-through">
                                {formatIssue(currentEndIssue)}
                              </span>
                              <ChevronRight
                                size={14}
                                className="text-gray-400"
                              />
                              <span className="text-blue-600 font-semibold">
                                {formatIssue(newEndIssue)}
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </Modal>
      </div>
    </div>
  );
};

// 구독 상세 모달 컴포넌트
interface SubscriptionDetailModalProps {
  subscription: Subscription;
  onClose: () => void;
  onOpenExtend: () => void;
  onOpenPause: () => void;
  onOpenAddress: () => void;
  onOpenShorten: () => void;
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const SubscriptionDetailModal: React.FC<SubscriptionDetailModalProps> = ({
  subscription,
  onClose,
  onOpenExtend,
  onOpenPause,
  onOpenAddress,
  onOpenShorten,
  activeTab,
  onTabChange,
}) => {
  const tabs = [
    { key: "dashboard", label: "대시보드" },
    { key: "info", label: "구독 정보" },
    { key: "customer", label: "고객 정보" },
    { key: "address", label: "배송지 정보" },
    { key: "pause", label: "휴지" },
    { key: "shipments", label: "발송 내역" },
    { key: "order", label: "주문 정보" },
    { key: "memo", label: "관리자 메모" },
  ];

  // 구독 통계 계산
  const calculateSubscriptionStats = () => {
    const startIssue =
      subscription.orderItemDetails?.subscribe_start_issue ||
      subscription.startIssue;
    const endIssue =
      subscription.orderItemDetails?.final_subscribe_end_issue ||
      subscription.finalEndIssue;

    // 호수 파싱 (예: "2401" -> 2024년 1월)
    const parseIssue = (issue: string) => {
      const cleanIssue = issue.replace(/[년월호\s]/g, "");
      if (cleanIssue.length === 4) {
        const year = parseInt(cleanIssue.substring(0, 2));
        const month = parseInt(cleanIssue.substring(2, 4));
        return { year: 2000 + year, month };
      }
      return null;
    };

    const start = parseIssue(startIssue);
    const end = parseIssue(endIssue);

    if (!start || !end)
      return { total: 0, sent: 0, remaining: 0, paused: 0, progress: 0 };

    // 총 호수 계산
    let total = 0;
    let currentYear = start.year;
    let currentMonth = start.month;

    while (
      currentYear < end.year ||
      (currentYear === end.year && currentMonth <= end.month)
    ) {
      total++;
      currentMonth++;
      if (currentMonth > 12) {
        currentMonth = 1;
        currentYear++;
      }
    }

    const paused = subscription.pauseDetails?.length || 0;
    const lastSent = subscription.orderItemDetails?.last_send_issue;
    const lastSentParsed = lastSent ? parseIssue(lastSent) : null;

    let sent = 0;
    if (lastSentParsed) {
      currentYear = start.year;
      currentMonth = start.month;
      while (
        currentYear < lastSentParsed.year ||
        (currentYear === lastSentParsed.year &&
          currentMonth <= lastSentParsed.month)
      ) {
        sent++;
        currentMonth++;
        if (currentMonth > 12) {
          currentMonth = 1;
          currentYear++;
        }
      }
    }

    const remaining = total - sent;
    const progress = total > 0 ? Math.round((sent / total) * 100) : 0;

    return { total, sent, remaining, paused, progress };
  };

  const stats = calculateSubscriptionStats();

  // 달력 뷰 컴포넌트
  const DashboardCalendarView = ({
    subscription,
    stats,
  }: {
    subscription: Subscription;
    stats: ReturnType<typeof calculateSubscriptionStats>;
  }) => {
    const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
    const [expandedMonths, setExpandedMonths] = useState<Set<string>>(
      new Set()
    );

    const subscribePeriod =
      subscription.orderItemDetails?.subscribe_period || 1;
    const startIssue =
      subscription.orderItemDetails?.subscribe_start_issue ||
      subscription.startIssue;

    // 호수 파싱
    const parseIssue = (issue: string) => {
      const cleanIssue = issue.replace(/[년월호\s]/g, "");
      if (cleanIssue.length === 4) {
        const year = parseInt(cleanIssue.substring(0, 2));
        const month = parseInt(cleanIssue.substring(2, 4));
        return { year: 2000 + year, month };
      }
      return null;
    };

    const start = parseIssue(startIssue);
    if (!start) return null;

    // subscribe_period만큼 달력 카드 생성
    const calendarMonths: Array<{
      issue: string;
      year: number;
      month: number;
      displayText: string;
      isSent: boolean;
      isPaused: boolean;
      entryCount: number;
    }> = [];

    for (let i = 0; i < subscribePeriod * 12; i++) {
      const currentYear = start.year + Math.floor((start.month + i - 1) / 12);
      const currentMonth = ((start.month + i - 1) % 12) + 1;
      const issue = `${String(currentYear % 100).padStart(2, "0")}${String(
        currentMonth
      ).padStart(2, "0")}`;

      const lastSent = subscription.orderItemDetails?.last_send_issue
        ? parseIssue(subscription.orderItemDetails.last_send_issue)
        : null;
      const isSent =
        lastSent !== null &&
        (currentYear < lastSent.year ||
          (currentYear === lastSent.year && currentMonth <= lastSent.month));

      const isPaused =
        subscription.pauseDetails?.some((p) => {
          const pauseClean = p.pause_issue.replace(/[년월호\s]/g, "");
          return pauseClean === issue;
        }) || false;

      // 엔트리 카운트 계산 (발송, 휴지, 기간 연장, 배송지 변경 등)
      let entryCount = 0;
      if (isSent) entryCount++;
      if (isPaused) entryCount++;
      // TODO: 기간 연장, 배송지 변경 등 추가

      calendarMonths.push({
        issue,
        year: currentYear,
        month: currentMonth,
        displayText: formatIssue(issue),
        isSent,
        isPaused,
        entryCount,
      });
    }

    const toggleMonth = (issue: string) => {
      const newExpanded = new Set(expandedMonths);
      if (newExpanded.has(issue)) {
        newExpanded.delete(issue);
        if (selectedMonth === issue) setSelectedMonth(null);
      } else {
        newExpanded.add(issue);
        setSelectedMonth(issue);
      }
      setExpandedMonths(newExpanded);
    };

    const getMonthDetails = (issue: string) => {
      const monthData = calendarMonths.find((m) => m.issue === issue);
      if (!monthData) return null;

      const details: Array<{
        type: "발송" | "휴지" | "기간연장" | "배송지변경" | "발송예정";
        label: string;
        value: string;
        icon: React.ReactNode;
      }> = [];

      if (monthData.isSent) {
        // 발송 완료 날짜 찾기
        const issueText = formatIssue(issue);
        const shipment = mockShipments.find((s) => s.issue === issueText);
        const sentDate = shipment?.date
          ? new Date(shipment.date).toLocaleDateString("ko-KR", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })
          : `${monthData.year}년 ${monthData.month}월 10일`;

        details.push({
          type: "발송",
          label: "발송 완료",
          value: `${sentDate} 발송 완료`,
          icon: <CheckCircle className="w-4 h-4 text-green-600" />,
        });
      } else if (!monthData.isPaused) {
        // 발송 안 된 건에 대해 발송 예정일 표시 (매달 10일 기준)
        const scheduledDate = `${monthData.year}년 ${monthData.month}월 10일`;
        details.push({
          type: "발송예정",
          label: "발송 예정",
          value: `${scheduledDate} 발송 예정`,
          icon: <Clock className="w-4 h-4 text-blue-600" />,
        });
      }

      if (monthData.isPaused) {
        const pauseDetail = subscription.pauseDetails?.find(
          (p) => p.pause_issue.replace(/[년월호\s]/g, "") === issue
        );
        details.push({
          type: "휴지",
          label: "휴지",
          value: pauseDetail?.reason || "휴지",
          icon: <PauseCircle className="w-4 h-4 text-orange-600" />,
        });
      }

      // TODO: 기간 연장, 배송지 변경 등 추가

      return details;
    };

    return (
      <div className="space-y-4">
        {/* 달력 */}
        <div className="bg-[#F8F8F8] rounded-3xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-bold text-gray-800">구독 현황</h3>
            </div>
          </div>

          {/* 달력 그리드 - 한 줄에 12개씩 배치 */}
          <div className="grid grid-cols-12 gap-2">
            {calendarMonths.map((monthData) => {
              const isSelected = selectedMonth === monthData.issue;
              const issueText = formatIssue(monthData.issue);
              const yearMatch = issueText.match(/(\d+)년/);
              const monthMatch = issueText.match(/(\d+)월호/);
              const year = yearMatch ? yearMatch[1] : "";
              const month = monthMatch ? monthMatch[1] : "";

              return (
                <div key={monthData.issue} className="relative">
                  <button
                    onClick={() => toggleMonth(monthData.issue)}
                    className={`relative w-16 h-[72px] rounded-xl p-1 shadow-sm transition-all flex flex-col items-center justify-center ${
                      isSelected
                        ? "bg-white text-gray-800 border-2 border-red-500"
                        : "bg-white text-gray-800 hover:bg-gray-50 border-2 border-transparent"
                    }`}
                  >
                    {/* 발송/휴지 아이콘 - 위쪽에 배치 (네모 안에) */}
                    <div className="absolute top-1 right-1 flex gap-0.5">
                      {monthData.isSent && (
                        <CheckCircle className="w-3 h-3 text-green-500" />
                      )}
                      {monthData.isPaused && (
                        <PauseCircle className="w-3 h-3 text-orange-500" />
                      )}
                    </div>
                    {/* 년도 표시 */}
                    <div
                      className={`text-xs leading-none mb-1 ${
                        isSelected ? "text-gray-800" : "text-gray-500"
                      }`}
                    >
                      {year}년
                    </div>
                    {/* 월호 표시 (더 크게) */}
                    <div
                      className={`text-lg font-bold leading-none ${
                        isSelected ? "text-gray-800" : "text-gray-800"
                      }`}
                    >
                      {month}월
                    </div>
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* 확장된 월별 상세 정보 */}
        {selectedMonth && expandedMonths.has(selectedMonth) && (
          <div className="bg-[#F8F8F8] rounded-3xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-800">
                {formatIssue(selectedMonth)} 상세 정보
              </h3>
              <button
                onClick={() => toggleMonth(selectedMonth)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              {getMonthDetails(selectedMonth)?.map((detail, idx) => (
                <div key={idx} className="bg-white rounded-2xl p-4 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                        detail.type === "발송"
                          ? "bg-green-100"
                          : detail.type === "휴지"
                          ? "bg-orange-100"
                          : detail.type === "발송예정"
                          ? "bg-blue-100"
                          : detail.type === "기간연장" ||
                            detail.type === "배송지변경"
                          ? "bg-gray-100"
                          : "bg-gray-100"
                      }`}
                    >
                      {detail.icon}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-gray-800">
                        {detail.label}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {detail.value}
                      </p>
                    </div>
                  </div>
                </div>
              )) || (
                <div className="bg-white rounded-2xl p-4 shadow-sm text-center text-gray-500">
                  해당 월에 변경 사항이 없습니다.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-start justify-between pb-4 border-b border-line">
        <div>
          <h2 className="text-xl font-bold text-ink">
            {subscription.customerName}
          </h2>
          <p className="text-sm text-muted mt-1">
            {subscription.customerPhone}
          </p>
        </div>
        <Badge
          variant={
            subscription.status === "활성"
              ? "subscription-active"
              : subscription.status === "휴지중"
              ? "subscription-pause"
              : "default"
          }
          dot
        >
          {subscription.status}
        </Badge>
      </div>

      {/* 빠른 액션 버튼 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <Button variant="outline" size="sm" icon={Plus} onClick={onOpenExtend}>
          구독 기간 연장
        </Button>
        <Button
          variant="outline"
          size="sm"
          icon={Minus}
          onClick={onOpenShorten}
        >
          구독 기간 단축
        </Button>
        <Button variant="outline" size="sm" icon={Clock} onClick={onOpenPause}>
          휴지 신청
        </Button>
        <Button
          variant="outline"
          size="sm"
          icon={MapPin}
          onClick={onOpenAddress}
        >
          배송지 변경
        </Button>
      </div>

      {/* 탭 */}
      <Tabs tabs={tabs} activeTab={activeTab} onChange={onTabChange} />

      {/* 탭 콘텐츠 */}
      {activeTab === "dashboard" && (
        <DashboardCalendarView subscription={subscription} stats={stats} />
      )}

      {activeTab === "info" && (
        <div className="space-y-10">
          {/* 상품 정보 */}
          <div className="grid grid-cols-2 gap-4 pt-6">
            <div className="relative p-4 bg-paper rounded-tr rounded-br rounded-bl border border-line">
              <div className="absolute -top-6 left-0">
                <span className="bg-paper px-3 py-1 text-sm font-semibold text-ink uppercase tracking-wide border-t border-l border-r border-line rounded-t">
                  상품 정보
                </span>
              </div>
              <div className="space-y-4 pt-2">
                <div>
                  <label className="text-xs text-muted uppercase tracking-wide">
                    외부 주문 상품 ID
                  </label>
                  <p className="text-base font-medium text-ink mt-1 font-mono">
                    {subscription.orderItemDetails?.external_order_item_id ||
                      "-"}
                  </p>
                </div>
                <div>
                  <label className="text-xs text-muted uppercase tracking-wide">
                    상품 코드
                  </label>
                  <p className="text-base font-medium text-ink mt-1 font-mono">
                    {subscription.orderItemDetails?.product_code ||
                      subscription.product ||
                      "-"}
                  </p>
                </div>
                <div>
                  <label className="text-xs text-muted uppercase tracking-wide">
                    상품 유형
                  </label>
                  <p className="text-base text-ink mt-1">
                    <Badge variant="info" size="sm">
                      {subscription.orderItemDetails?.product_kind || "-"}
                    </Badge>
                  </p>
                </div>
                <div>
                  <label className="text-xs text-muted uppercase tracking-wide">
                    상품명
                  </label>
                  <p className="text-base font-medium text-ink mt-1">
                    {subscription.orderItemDetails?.product_name ||
                      subscription.product ||
                      "-"}
                  </p>
                </div>
              </div>
            </div>

            {/* 상품 설정 */}
            <div className="relative p-4 bg-paper rounded-tr rounded-br rounded-bl border border-line">
              <div className="absolute -top-6 left-0">
                <span className="bg-paper px-3 py-1 text-sm font-semibold text-ink uppercase tracking-wide border-t border-l border-r border-line rounded-t">
                  상품 설정
                </span>
              </div>
              <div className="space-y-4 pt-2">
                <div>
                  <label className="text-xs text-muted uppercase tracking-wide">
                    수량
                  </label>
                  <p className="text-base font-medium text-ink mt-1">
                    {subscription.orderItemDetails?.order_num || 1}개
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* 가격 정보 */}
          <div className="relative p-4 bg-paper rounded-tr rounded-br rounded-bl border border-line">
            <div className="absolute -top-6 left-0">
              <span className="bg-paper px-3 py-1 text-sm font-semibold text-ink uppercase tracking-wide border-t border-l border-r border-line rounded-t">
                가격 정보
              </span>
            </div>
            <div className="grid grid-cols-4 gap-4 pt-2">
              <div>
                <label className="text-xs text-muted uppercase tracking-wide">
                  판매가
                </label>
                <p className="text-base font-medium text-ink mt-1">
                  ₩
                  {subscription.orderItemDetails?.price.toLocaleString() ||
                    subscription.paymentAmount.toLocaleString()}
                </p>
              </div>
              <div>
                <label className="text-xs text-muted uppercase tracking-wide">
                  할인
                </label>
                <p className="text-base font-medium text-ink mt-1">
                  ₩
                  {subscription.orderItemDetails?.sale?.toLocaleString() || "0"}
                </p>
              </div>
              <div>
                <label className="text-xs text-muted uppercase tracking-wide">
                  환불액
                </label>
                <p className="text-base font-medium text-ink mt-1">
                  {subscription.orderItemDetails?.refund
                    ? `₩${subscription.orderItemDetails.refund.toLocaleString()}`
                    : "₩0"}
                </p>
              </div>
            </div>
          </div>

          {/* 구독 기간 정보 */}
          <div className="relative p-4 bg-paper rounded-tr rounded-br rounded-bl border border-line">
            <div className="absolute -top-6 left-0">
              <span className="bg-paper px-3 py-1 text-sm font-semibold text-ink uppercase tracking-wide border-t border-l border-r border-line rounded-t">
                구독 기간 정보
              </span>
            </div>
            <div className="grid grid-cols-2 gap-4 pt-2">
              <div>
                <label className="text-xs text-muted uppercase tracking-wide">
                  구독 시작 호
                </label>
                <p className="text-base font-medium text-ink mt-1">
                  {subscription.orderItemDetails?.subscribe_start_issue
                    ? formatIssue(
                        subscription.orderItemDetails.subscribe_start_issue
                      )
                    : formatIssue(subscription.startIssue)}
                </p>
              </div>
              <div>
                <label className="text-xs text-muted uppercase tracking-wide">
                  구독 종료 호
                </label>
                <p className="text-base font-medium text-ink mt-1">
                  {subscription.orderItemDetails?.subscribe_end_issue
                    ? formatIssue(
                        subscription.orderItemDetails.subscribe_end_issue
                      )
                    : formatIssue(subscription.endIssue)}
                </p>
              </div>
              <div>
                <label className="text-xs text-muted uppercase tracking-wide">
                  최종 구독 종료 호
                </label>
                <p className="text-base font-semibold text-accent mt-1">
                  {subscription.orderItemDetails?.final_subscribe_end_issue
                    ? formatIssue(
                        subscription.orderItemDetails.final_subscribe_end_issue
                      )
                    : formatIssue(subscription.finalEndIssue)}
                </p>
              </div>
              <div>
                <label className="text-xs text-muted uppercase tracking-wide">
                  구독 기간
                </label>
                <p className="text-base font-medium text-ink mt-1">
                  {subscription.orderItemDetails?.subscribe_period
                    ? `${subscription.orderItemDetails.subscribe_period}개월`
                    : "-"}
                </p>
              </div>
              <div>
                <label className="text-xs text-muted uppercase tracking-wide">
                  마지막 발송 호
                </label>
                <p className="text-base font-medium text-ink mt-1">
                  {subscription.orderItemDetails?.last_send_issue
                    ? formatIssue(subscription.orderItemDetails.last_send_issue)
                    : "-"}
                </p>
              </div>
            </div>
          </div>

          {/* 등록 정보 */}
          <div className="relative p-4 bg-paper rounded-tr rounded-br rounded-bl border border-line">
            <div className="absolute -top-6 left-0">
              <span className="bg-paper px-3 py-1 text-sm font-semibold text-ink uppercase tracking-wide border-t border-l border-r border-line rounded-t">
                등록 정보
              </span>
            </div>
            <div className="grid grid-cols-2 gap-4 pt-2">
              <div>
                <label className="text-xs text-muted uppercase tracking-wide">
                  수정일시
                </label>
                <p className="text-base text-ink mt-1">
                  {subscription.orderItemDetails?.updated_at
                    ? new Date(
                        subscription.orderItemDetails.updated_at
                      ).toLocaleString("ko-KR")
                    : "-"}
                </p>
              </div>
              {subscription.orderItemDetails?.cancelled_at && (
                <div>
                  <label className="text-xs text-muted uppercase tracking-wide">
                    취소일시
                  </label>
                  <p className="text-base text-danger-600 mt-1">
                    {new Date(
                      subscription.orderItemDetails.cancelled_at
                    ).toLocaleString("ko-KR")}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === "customer" && (
        <div className="space-y-10">
          {/* 고객 기본 정보 */}
          <div className="grid grid-cols-2 gap-4 pt-6">
            <div className="relative p-4 bg-paper rounded-tr rounded-br rounded-bl border border-line">
              <div className="absolute -top-6 left-0">
                <span className="bg-paper px-3 py-1 text-sm font-semibold text-ink uppercase tracking-wide border-t border-l border-r border-line rounded-t">
                  고객 정보
                </span>
              </div>
              <div className="space-y-4 pt-2">
                <div>
                  <label className="text-xs text-muted uppercase tracking-wide">
                    고객명
                  </label>
                  <p className="text-base font-medium text-ink mt-1">
                    {subscription.customerDetails?.customer_name ||
                      subscription.customerName}
                  </p>
                </div>
                <div>
                  <label className="text-xs text-muted uppercase tracking-wide">
                    연락처
                  </label>
                  <p className="text-base text-ink mt-1">
                    {subscription.customerDetails?.customer_phone ||
                      subscription.customerPhone}
                  </p>
                </div>
                <div>
                  <label className="text-xs text-muted uppercase tracking-wide">
                    이메일
                  </label>
                  <p className="text-base text-ink mt-1">
                    {subscription.customerDetails?.customer_email ||
                      subscription.customerEmail ||
                      "-"}
                  </p>
                </div>
              </div>
            </div>

            {/* 고객 설정 */}
            <div className="relative p-4 bg-paper rounded-tr rounded-br rounded-bl border border-line">
              <div className="absolute -top-6 left-0">
                <span className="bg-paper px-3 py-1 text-sm font-semibold text-ink uppercase tracking-wide border-t border-l border-r border-line rounded-t">
                  가입 정보
                </span>
              </div>
              <div className="space-y-4 pt-2">
                <div>
                  <label className="text-xs text-muted uppercase tracking-wide">
                    가입 경로
                  </label>
                  <p className="text-base text-ink mt-1">
                    <Badge variant="info" size="sm">
                      {subscription.customerDetails?.create_channel || "CAFE24"}
                    </Badge>
                  </p>
                </div>
                <div>
                  <label className="text-xs text-muted uppercase tracking-wide">
                    가입일
                  </label>
                  <p className="text-base text-ink mt-1">
                    {subscription.customerDetails?.created_at
                      ? new Date(
                          subscription.customerDetails.created_at
                        ).toLocaleString("ko-KR")
                      : subscription.orderDate
                      ? new Date(subscription.orderDate).toLocaleString("ko-KR")
                      : "-"}
                  </p>
                </div>
                <div>
                  <label className="text-xs text-muted uppercase tracking-wide">
                    최근 주문일
                  </label>
                  <p className="text-base text-ink mt-1">
                    {subscription.customerDetails?.last_order_at
                      ? new Date(
                          subscription.customerDetails.last_order_at
                        ).toLocaleString("ko-KR")
                      : subscription.orderDate
                      ? new Date(subscription.orderDate).toLocaleString("ko-KR")
                      : "-"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "memo" && (
        <div className="space-y-6">
          <div className="p-4 bg-paper rounded-lg">
            <div>
              <label className="text-xs text-muted uppercase tracking-wide">
                관리자 메모
              </label>
              <p className="text-base text-ink mt-1 whitespace-pre-wrap">
                {subscription.orderItemDetails?.memo || "-"}
              </p>
            </div>
          </div>
        </div>
      )}

      {activeTab === "address" && (
        <div className="space-y-10">
          {/* 수령인 정보 */}
          <div className="grid grid-cols-2 gap-4 pt-6">
            <div className="relative p-4 bg-paper rounded-tr rounded-br rounded-bl border border-line">
              <div className="absolute -top-6 left-0">
                <span className="bg-paper px-3 py-1 text-sm font-semibold text-ink uppercase tracking-wide border-t border-l border-r border-line rounded-t">
                  수령인 정보
                </span>
              </div>
              <div className="space-y-4 pt-2">
                <div>
                  <label className="text-xs text-muted uppercase tracking-wide">
                    수령인
                  </label>
                  <p className="text-base font-medium text-ink mt-1">
                    {subscription.addressDetails?.address_name ||
                      subscription.customerName}
                  </p>
                </div>
                <div>
                  <label className="text-xs text-muted uppercase tracking-wide">
                    수령인 연락처
                  </label>
                  <p className="text-base text-ink mt-1">
                    {subscription.addressDetails?.phone ||
                      subscription.customerPhone}
                  </p>
                </div>
              </div>
            </div>

            {/* 주소 정보 */}
            <div className="relative p-4 bg-paper rounded-tr rounded-br rounded-bl border border-line">
              <div className="absolute -top-6 left-0">
                <span className="bg-paper px-3 py-1 text-sm font-semibold text-ink uppercase tracking-wide border-t border-l border-r border-line rounded-t">
                  주소 정보
                </span>
              </div>
              <div className="space-y-4 pt-2">
                <div>
                  <label className="text-xs text-muted uppercase tracking-wide">
                    국가
                  </label>
                  <p className="text-base text-ink mt-1">대한민국</p>
                </div>
                <div>
                  <label className="text-xs text-muted uppercase tracking-wide">
                    우편번호
                  </label>
                  <p className="text-base text-ink mt-1">
                    {subscription.addressDetails?.postal_code || "-"}
                  </p>
                </div>
                <div>
                  <label className="text-xs text-muted uppercase tracking-wide">
                    주소
                  </label>
                  <p className="text-base text-ink mt-1">
                    {subscription.addressDetails?.address1 ||
                      subscription.address}
                    {subscription.addressDetails?.address2 &&
                      ` ${subscription.addressDetails.address2}`}
                  </p>
                </div>
                <div>
                  <label className="text-xs text-muted uppercase tracking-wide">
                    배송 메모
                  </label>
                  <p className="text-base text-ink mt-1 whitespace-pre-wrap">
                    {subscription.addressDetails?.address_memo || "-"}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* 배송지 변경 안내 */}
          <div className="p-4 bg-info-50 border border-info-200 rounded-lg">
            <p className="text-sm text-info-700">
              💡 배송지를 변경하려면 상단의 "배송지 변경" 버튼을 클릭하세요.
              변경된 배송지는 미발송분부터 적용됩니다.
            </p>
          </div>
        </div>
      )}

      {activeTab === "pause" && (
        <div className="space-y-10">
          {subscription?.pauseDetails &&
          subscription.pauseDetails.length > 0 ? (
            <div className={`space-y-6 ${subscription.pauseDetails.length > 0 ? "pt-6" : ""}`}>
              {subscription.pauseDetails.map((pause, index) => (
                <div
                  key={index}
                  className="relative p-4 bg-paper rounded-tr rounded-br rounded-bl border border-line"
                >
                  <div className="absolute -top-6 left-0">
                    <span className="bg-paper px-3 py-1 text-sm font-semibold text-ink uppercase tracking-wide border-t border-l border-r border-line rounded-t">
                      휴지 정보
                    </span>
                  </div>
                  <div className="space-y-4 pt-2">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs text-muted uppercase tracking-wide">
                          휴지 호
                        </label>
                        <p className="text-base font-medium text-ink mt-1">
                          <Badge variant="warning" size="sm">
                            {formatIssue(pause.pause_issue)}
                          </Badge>
                        </p>
                      </div>
                      <div>
                        <label className="text-xs text-muted uppercase tracking-wide">
                          처리 관리자
                        </label>
                        <p className="text-base text-ink mt-1">
                          {pause.admin_id ? `관리자 #${pause.admin_id}` : "-"}
                        </p>
                      </div>
                      <div>
                        <label className="text-xs text-muted uppercase tracking-wide">
                          신청일
                        </label>
                        <p className="text-base text-ink mt-1">
                          {pause.created_at
                            ? new Date(pause.created_at).toLocaleString("ko-KR")
                            : "-"}
                        </p>
                      </div>
                      <div>
                        <label className="text-xs text-muted uppercase tracking-wide">
                          휴지 사유
                        </label>
                        <p className="text-base text-ink mt-1 whitespace-pre-wrap">
                          {pause.reason || "-"}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted pt-6">
              휴지 이력이 없습니다.
            </div>
          )}
        </div>
      )}

      {activeTab === "shipments" && (
        <div className="space-y-6">
          <div className="space-y-3">
            <div className="p-4 bg-paper rounded-lg border border-line">
              <div className="grid grid-cols-4 gap-4">
                <div>
                  <label className="text-xs text-muted uppercase tracking-wide">
                    발송 호
                  </label>
                  <p className="text-base font-medium text-ink mt-1">
                    {formatIssue("2601")}
                  </p>
                </div>
                <div>
                  <label className="text-xs text-muted uppercase tracking-wide">
                    발송일
                  </label>
                  <p className="text-base text-ink mt-1">2026.01.05</p>
                </div>
                <div>
                  <label className="text-xs text-muted uppercase tracking-wide">
                    운송장
                  </label>
                  <p className="text-base text-ink mt-1">
                    <button className="text-accent hover:underline font-medium">
                      123456789012
                    </button>
                  </p>
                </div>
                <div>
                  <label className="text-xs text-muted uppercase tracking-wide">
                    배송 상태
                  </label>
                  <p className="text-base text-ink mt-1">
                    <Badge variant="success" size="sm">
                      배송완료
                    </Badge>
                  </p>
                </div>
              </div>
            </div>
            <div className="p-4 bg-paper rounded-lg border border-line">
              <div className="grid grid-cols-4 gap-4">
                <div>
                  <label className="text-xs text-muted uppercase tracking-wide">
                    발송 호
                  </label>
                  <p className="text-base font-medium text-ink mt-1">
                    {formatIssue("2512")}
                  </p>
                </div>
                <div>
                  <label className="text-xs text-muted uppercase tracking-wide">
                    발송일
                  </label>
                  <p className="text-base text-ink mt-1">2025.12.03</p>
                </div>
                <div>
                  <label className="text-xs text-muted uppercase tracking-wide">
                    운송장
                  </label>
                  <p className="text-base text-ink mt-1">
                    <button className="text-accent hover:underline font-medium">
                      123456789011
                    </button>
                  </p>
                </div>
                <div>
                  <label className="text-xs text-muted uppercase tracking-wide">
                    배송 상태
                  </label>
                  <p className="text-base text-ink mt-1">
                    <Badge variant="success" size="sm">
                      배송완료
                    </Badge>
                  </p>
                </div>
              </div>
            </div>
            <div className="p-4 bg-paper rounded-lg border border-line">
              <div className="grid grid-cols-4 gap-4">
                <div>
                  <label className="text-xs text-muted uppercase tracking-wide">
                    발송 호
                  </label>
                  <p className="text-base font-medium text-ink mt-1">
                    {formatIssue("2511")}
                  </p>
                </div>
                <div>
                  <label className="text-xs text-muted uppercase tracking-wide">
                    발송일
                  </label>
                  <p className="text-base text-ink mt-1">2025.11.05</p>
                </div>
                <div>
                  <label className="text-xs text-muted uppercase tracking-wide">
                    운송장
                  </label>
                  <p className="text-base text-ink mt-1">
                    <button className="text-accent hover:underline font-medium">
                      123456789010
                    </button>
                  </p>
                </div>
                <div>
                  <label className="text-xs text-muted uppercase tracking-wide">
                    배송 상태
                  </label>
                  <p className="text-base text-ink mt-1">
                    <Badge variant="success" size="sm">
                      배송완료
                    </Badge>
                  </p>
                </div>
              </div>
            </div>
            <div className="p-4 bg-paper rounded-lg border border-line">
              <div className="grid grid-cols-4 gap-4">
                <div>
                  <label className="text-xs text-muted uppercase tracking-wide">
                    발송 호
                  </label>
                  <p className="text-base font-medium text-ink mt-1">
                    {formatIssue("2510")}
                  </p>
                </div>
                <div>
                  <label className="text-xs text-muted uppercase tracking-wide">
                    발송일
                  </label>
                  <p className="text-base text-ink mt-1">2025.10.08</p>
                </div>
                <div>
                  <label className="text-xs text-muted uppercase tracking-wide">
                    운송장
                  </label>
                  <p className="text-base text-ink mt-1">
                    <button className="text-accent hover:underline font-medium">
                      123456789009
                    </button>
                  </p>
                </div>
                <div>
                  <label className="text-xs text-muted uppercase tracking-wide">
                    배송 상태
                  </label>
                  <p className="text-base text-ink mt-1">
                    <Badge variant="success" size="sm">
                      배송완료
                    </Badge>
                  </p>
                </div>
              </div>
            </div>
            <div className="p-4 bg-paper rounded-lg border border-line">
              <div className="grid grid-cols-4 gap-4">
                <div>
                  <label className="text-xs text-muted uppercase tracking-wide">
                    발송 호
                  </label>
                  <p className="text-base font-medium text-ink mt-1">
                    {formatIssue("2509")}
                  </p>
                </div>
                <div>
                  <label className="text-xs text-muted uppercase tracking-wide">
                    발송일
                  </label>
                  <p className="text-base text-ink mt-1">2025.09.05</p>
                </div>
                <div>
                  <label className="text-xs text-muted uppercase tracking-wide">
                    운송장
                  </label>
                  <p className="text-base text-ink mt-1">
                    <button className="text-accent hover:underline font-medium">
                      123456789008
                    </button>
                  </p>
                </div>
                <div>
                  <label className="text-xs text-muted uppercase tracking-wide">
                    배송 상태
                  </label>
                  <p className="text-base text-ink mt-1">
                    <Badge variant="success" size="sm">
                      배송완료
                    </Badge>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "order" && (
        <div className="space-y-10">
          {/* 주문 기본 정보 */}
          <div className="grid grid-cols-2 gap-4 pt-6">
            <div className="relative p-4 bg-paper rounded-tr rounded-br rounded-bl border border-line">
              <div className="absolute -top-6 left-0">
                <span className="bg-paper px-3 py-1 text-sm font-semibold text-ink uppercase tracking-wide border-t border-l border-r border-line rounded-t">
                  주문 정보
                </span>
              </div>
              <div className="space-y-4 pt-2">
                <div>
                  <label className="text-xs text-muted uppercase tracking-wide">
                    외부 주문 ID
                  </label>
                  <p className="text-base font-medium text-ink mt-1">
                    {subscription.orderDetails?.external_order_id || "-"}
                  </p>
                </div>
                <div>
                  <label className="text-xs text-muted uppercase tracking-wide">
                    주문 채널
                  </label>
                  <p className="text-base text-ink mt-1">
                    {subscription.orderDetails?.order_channel === "CAFE24"
                      ? "Cafe24"
                      : subscription.orderDetails?.order_channel === "GPMALL"
                      ? "갓피플몰"
                      : subscription.orderDetails?.order_channel || "CAFE24"}
                  </p>
                </div>
                <div>
                  <label className="text-xs text-muted uppercase tracking-wide">
                    주문 상태
                  </label>
                  <p className="text-base text-ink mt-1">
                    <Badge
                      variant={
                        subscription.orderDetails?.order_status === "결제완료"
                          ? "success"
                          : subscription.orderDetails?.order_status === "취소"
                          ? "danger"
                          : "default"
                      }
                      size="sm"
                    >
                      {subscription.orderDetails?.order_status || "결제완료"}
                    </Badge>
                  </p>
                </div>
                <div>
                  <label className="text-xs text-muted uppercase tracking-wide">
                    결제 수단
                  </label>
                  <p className="text-base text-ink mt-1">
                    {subscription.orderDetails?.payment_method || "-"}
                  </p>
                </div>
                <div>
                  <label className="text-xs text-muted uppercase tracking-wide">
                    주문일
                  </label>
                  <p className="text-base text-ink mt-1">
                    {subscription.orderDetails?.order_at
                      ? new Date(
                          subscription.orderDetails.order_at
                        ).toLocaleString("ko-KR")
                      : subscription.orderDate
                      ? new Date(subscription.orderDate).toLocaleString("ko-KR")
                      : "-"}
                  </p>
                </div>
                <div>
                  <label className="text-xs text-muted uppercase tracking-wide">
                    결제일
                  </label>
                  <p className="text-base text-ink mt-1">
                    {subscription.orderDetails?.payment_at
                      ? new Date(
                          subscription.orderDetails.payment_at
                        ).toLocaleString("ko-KR")
                      : "-"}
                  </p>
                </div>
                {subscription.orderDetails?.cancelled_at && (
                  <div>
                    <label className="text-xs text-muted uppercase tracking-wide">
                      취소일
                    </label>
                    <p className="text-base text-danger-600 mt-1">
                      {new Date(
                        subscription.orderDetails.cancelled_at
                      ).toLocaleString("ko-KR")}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* 메모 정보 */}
            <div className="relative p-4 bg-paper rounded-tr rounded-br rounded-bl border border-line">
              <div className="absolute -top-6 left-0">
                <span className="bg-paper px-3 py-1 text-sm font-semibold text-ink uppercase tracking-wide border-t border-l border-r border-line rounded-t">
                  메모 정보
                </span>
              </div>
              <div className="space-y-4 pt-2">
                <div>
                  <label className="text-xs text-muted uppercase tracking-wide">
                    고객 요청사항
                  </label>
                  <p className="text-base text-ink mt-1 whitespace-pre-wrap">
                    {subscription.orderDetails?.request_memo || "-"}
                  </p>
                </div>
                <div>
                  <label className="text-xs text-muted uppercase tracking-wide">
                    관리자 메모
                  </label>
                  <p className="text-base text-ink mt-1 whitespace-pre-wrap">
                    {subscription.orderDetails?.admin_memo || "-"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// 구독 연장 모달
interface SubscriptionExtendModalProps {
  extendMonths: number;
  onExtendMonthsChange: (months: number) => void;
  extendReason: string;
  isFreeExtend: boolean;
  onExtendReasonChange: (reason: string) => void;
  onIsFreeExtendChange: (isFree: boolean) => void;
  startIssue?: string;
  finalEndIssue?: string;
}

const SubscriptionExtendModal: React.FC<SubscriptionExtendModalProps> = ({
  extendMonths,
  onExtendMonthsChange,
  extendReason,
  isFreeExtend,
  onExtendReasonChange,
  onIsFreeExtendChange,
  startIssue,
  finalEndIssue,
}) => {
  // 호수 파싱
  const parseIssue = (issue: string) => {
    const cleanIssue = issue.replace(/[년월호\s]/g, "");
    if (cleanIssue.length === 4) {
      const year = parseInt(cleanIssue.substring(0, 2));
      const month = parseInt(cleanIssue.substring(2, 4));
      return { year: 2000 + year, month };
    }
    return null;
  };

  // 기간 계산 (개월 수)
  const calculatePeriodMonths = (start: string, end: string) => {
    const startParsed = parseIssue(start);
    const endParsed = parseIssue(end);
    if (!startParsed || !endParsed) return null;
    const startTotal = startParsed.year * 12 + startParsed.month;
    const endTotal = endParsed.year * 12 + endParsed.month;
    return endTotal - startTotal + 1;
  };

  // 연장 후 종료 호 계산
  const calculateNewEndIssue = () => {
    if (!finalEndIssue) return null;
    const cleanIssue = finalEndIssue.replace(/[년월호\s]/g, "");
    if (cleanIssue.length === 4) {
      const year = parseInt(cleanIssue.substring(0, 2));
      const month = parseInt(cleanIssue.substring(2, 4));
      const totalMonths = month + extendMonths;
      const newYear = year + Math.floor((totalMonths - 1) / 12);
      const newMonth = ((totalMonths - 1) % 12) + 1;
      return `${String(newYear).padStart(2, "0")}${String(newMonth).padStart(
        2,
        "0"
      )}`;
    }
    return null;
  };

  const newEndIssue = calculateNewEndIssue();
  const currentPeriodMonths =
    startIssue && finalEndIssue
      ? calculatePeriodMonths(startIssue, finalEndIssue)
      : null;
  const newPeriodMonths =
    startIssue && newEndIssue
      ? calculatePeriodMonths(startIssue, newEndIssue)
      : null;

  return (
    <div className="space-y-4">
      {/* 연장 개월 선택 */}
      <div className="bg-white rounded-xl overflow-hidden">
        <div className="px-5 py-4 flex items-center justify-between">
          <span className="text-base text-gray-900">연장 개월</span>
          <div className="flex items-center gap-4">
            <button
              onClick={() =>
                onExtendMonthsChange(Math.max(1, extendMonths - 1))
              }
              className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
            >
              <Minus size={18} className="text-gray-600" />
            </button>
            <span className="text-2xl font-semibold w-12 text-center">
              {extendMonths}
            </span>
            <button
              onClick={() => onExtendMonthsChange(extendMonths + 1)}
              className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
            >
              <Plus size={18} className="text-gray-600" />
            </button>
          </div>
          <span className="text-base text-gray-500">개월</span>
        </div>
      </div>

      {/* 구독 기간 정보 */}
      {startIssue &&
        finalEndIssue &&
        newEndIssue &&
        currentPeriodMonths &&
        newPeriodMonths && (
          <div className="bg-white rounded-xl overflow-hidden divide-y divide-gray-100">
            {/* 시작일 */}
            <div className="px-5 py-3.5 flex items-center justify-between">
              <span className="text-base text-gray-600">시작</span>
              <span className="text-base text-gray-900">
                {formatIssue(startIssue)}
              </span>
            </div>

            {/* 종료일 */}
            <div className="px-5 py-3.5 flex items-center justify-between">
              <span className="text-base text-gray-600">종료</span>
              <div className="flex items-center gap-3">
                <span className="text-base text-gray-400 line-through">
                  {formatIssue(finalEndIssue)}
                </span>
                <ChevronRight size={16} className="text-gray-300" />
                <span className="text-base text-gray-900">
                  {formatIssue(newEndIssue)}
                </span>
              </div>
            </div>

            {/* 기간 */}
            <div className="px-5 py-3.5 flex items-center justify-between">
              <span className="text-base text-gray-600">기간</span>
              <div className="flex items-center gap-3">
                <span className="text-base text-gray-400 line-through">
                  {currentPeriodMonths}개월
                </span>
                <ChevronRight size={16} className="text-gray-300" />
                <span className="text-base text-gray-900">
                  {newPeriodMonths}개월
                </span>
              </div>
            </div>
          </div>
        )}

      {/* 유료 연장 안내 및 무상 연장 옵션 */}
      {extendMonths > 0 && (
        <div className="space-y-4">
          {/* 유료 연장 안내 */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-amber-900 mb-1">
                  유료 연장 안내
                </p>
                <p className="text-xs text-amber-700 leading-relaxed">
                  구독 기간이 {extendMonths}개월 연장됩니다. 유료로 연장하시려면
                  서점에서 따로 구매하시거나 단품으로 구매해주세요. 이
                  시스템에서는 유료 연장을 처리하지 않습니다.
                </p>
              </div>
            </div>
          </div>

          {/* 무상 연장 옵션 */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={isFreeExtend}
                onChange={(e) => onIsFreeExtendChange(e.target.checked)}
                className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 mt-0.5"
              />
              <div className="flex-1">
                <span className="text-sm font-medium text-gray-900 block mb-1">
                  무상 연장 처리
                </span>
                <span className="text-xs text-gray-500">
                  특별한 사유로 무상 연장이 필요한 경우에만 선택하세요.
                </span>
              </div>
            </label>
            {isFreeExtend && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <Textarea
                  label="연장 사유"
                  value={extendReason}
                  onChange={(e) => onExtendReasonChange(e.target.value)}
                  placeholder="무상 연장 사유를 입력해주세요"
                  rows={3}
                  required
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// 휴지 신청 모달
interface SubscriptionPauseModalProps {
  pauseIssues: string[];
  pauseReason: string;
  onPauseIssuesChange: (issues: string[]) => void;
  onPauseReasonChange: (reason: string) => void;
  finalEndIssue?: string;
  startIssue?: string;
  lastSendIssue?: string;
  subscribePeriod?: number;
}

const SubscriptionPauseModal: React.FC<SubscriptionPauseModalProps> = ({
  pauseIssues,
  pauseReason,
  onPauseIssuesChange,
  onPauseReasonChange,
  finalEndIssue,
  startIssue,
  lastSendIssue,
  subscribePeriod = 1,
}) => {
  const parseIssue = (issue: string) => {
    const cleanIssue = issue.replace(/[년월호\s]/g, "");
    if (cleanIssue.length === 4) {
      const year = parseInt(cleanIssue.substring(0, 2));
      const month = parseInt(cleanIssue.substring(2, 4));
      return { year: 2000 + year, month };
    }
    return null;
  };

  // 달력 월 생성 (현재 구독 기간만 표시)
  const generateCalendarMonths = () => {
    if (!startIssue || !finalEndIssue) return [];

    const start = parseIssue(startIssue);
    const end = parseIssue(finalEndIssue);
    if (!start || !end) return [];

    const calendarMonths: Array<{
      issue: string;
      year: number;
      month: number;
      displayText: string;
      isSent: boolean;
    }> = [];

    // 시작일부터 종료일까지의 모든 월 생성
    let currentYear = start.year;
    let currentMonth = start.month;
    const endTotal = end.year * 12 + end.month;
    const startTotal = start.year * 12 + start.month;

    while (currentYear * 12 + currentMonth <= endTotal) {
      const yearStr = String(currentYear).substring(2, 4);
      const monthStr = String(currentMonth).padStart(2, "0");
      const issue = `${yearStr}${monthStr}`;

      const issueText = formatIssue(issue);
      const yearMatch = issueText.match(/(\d+)년/);
      const monthMatch = issueText.match(/(\d+)월호/);
      const year = yearMatch ? yearMatch[1] : "";
      const month = monthMatch ? monthMatch[1] : "";

      // 이미 발송된 호인지 확인
      const lastSent = lastSendIssue ? parseIssue(lastSendIssue) : null;
      const isSent =
        lastSent !== null &&
        (currentYear < lastSent.year ||
          (currentYear === lastSent.year && currentMonth <= lastSent.month));

      calendarMonths.push({
        issue,
        year: currentYear,
        month: currentMonth,
        displayText: `${year}년 ${month}월`,
        isSent,
      });

      // 다음 월로 이동
      currentMonth++;
      if (currentMonth > 12) {
        currentMonth = 1;
        currentYear++;
      }
    }

    return calendarMonths;
  };

  const calendarMonths = generateCalendarMonths();
  const availableMonths = calendarMonths.filter((m) => !m.isSent);

  const handleIssueToggle = (issue: string) => {
    if (pauseIssues.includes(issue)) {
      onPauseIssuesChange(pauseIssues.filter((i) => i !== issue));
    } else {
      onPauseIssuesChange([...pauseIssues, issue]);
    }
  };

  // 연장 후 종료 호 계산 (휴지 월 수만큼 연장)
  const calculateNewEndIssue = () => {
    if (!finalEndIssue || pauseIssues.length === 0) return null;
    const endParsed = parseIssue(finalEndIssue);
    if (!endParsed) return null;

    // 휴지 월 수만큼 연장
    const totalMonths = endParsed.month + pauseIssues.length;
    const newYear = endParsed.year + Math.floor((totalMonths - 1) / 12);
    const newMonth = ((totalMonths - 1) % 12) + 1;

    // 2자리 연도로 변환
    const yearStr = String(newYear % 100).padStart(2, "0");
    const monthStr = String(newMonth).padStart(2, "0");
    return `${yearStr}${monthStr}`;
  };

  // 구독 기간 계산 (개월 수)
  const calculatePeriodMonths = (start: string, end: string) => {
    const startParsed = parseIssue(start);
    const endParsed = parseIssue(end);
    if (!startParsed || !endParsed) return null;
    const startTotal = startParsed.year * 12 + startParsed.month;
    const endTotal = endParsed.year * 12 + endParsed.month;
    return endTotal - startTotal + 1;
  };

  const newEndIssue = calculateNewEndIssue();
  const currentPeriodMonths =
    startIssue && finalEndIssue
      ? calculatePeriodMonths(startIssue, finalEndIssue)
      : null;
  const newPeriodMonths =
    startIssue && newEndIssue
      ? calculatePeriodMonths(startIssue, newEndIssue)
      : null;

  return (
    <div className="space-y-4">
      {/* 안내 카드 */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0 mt-0.5">
            <PauseCircle className="w-4 h-4 text-amber-600" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-900 mb-1">
              구독 휴지 신청
            </p>
            <p className="text-xs text-amber-700 leading-relaxed">
              휴지할 호를 선택하면 발송되지 않으며, 선택한 월 수만큼 구독
              종료일이 자동으로 연장됩니다.
            </p>
          </div>
        </div>
      </div>

      {/* 달력 형태의 호수 선택 */}
      <div className="bg-[#F8F8F8] rounded-3xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-800">휴지할 호 선택</h3>
          {pauseIssues.length > 0 && (
            <span className="text-sm text-amber-600 font-medium">
              {pauseIssues.length}개월 선택됨
            </span>
          )}
        </div>
        <div className="grid grid-cols-6 gap-2">
          {calendarMonths.map((monthData) => {
            const isSelected = pauseIssues.includes(monthData.issue);
            const isAvailable = !monthData.isSent;
            const issueText = formatIssue(monthData.issue);
            const yearMatch = issueText.match(/(\d+)년/);
            const monthMatch = issueText.match(/(\d+)월호/);
            const year = yearMatch ? yearMatch[1] : "";
            const month = monthMatch ? monthMatch[1] : "";

            return (
              <button
                key={monthData.issue}
                onClick={() =>
                  isAvailable && handleIssueToggle(monthData.issue)
                }
                disabled={!isAvailable}
                className={`relative w-full h-[72px] rounded-xl p-1 shadow-sm transition-all flex flex-col items-center justify-center ${
                  !isAvailable
                    ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                    : isSelected
                    ? "bg-amber-100 text-gray-800 border-2 border-amber-500"
                    : "bg-white text-gray-800 hover:bg-gray-50 border-2 border-transparent"
                }`}
              >
                {monthData.isSent && (
                  <CheckCircle className="absolute top-1 right-1 w-3 h-3 text-green-500" />
                )}
                <div className="text-xs leading-none mb-1 text-gray-500">
                  {year}년
                </div>
                <div className="text-lg font-bold leading-none text-gray-800">
                  {month}월
                </div>
                {isSelected && (
                  <PauseCircle className="absolute top-1 right-1 w-3 h-3 text-amber-600" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 휴지 사유 */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <Textarea
          label="휴지 사유"
          value={pauseReason}
          onChange={(e) => onPauseReasonChange(e.target.value)}
          placeholder="휴지 사유를 입력하세요 (선택사항)"
          rows={2}
        />
      </div>

      {/* 구독 기간 정보 */}
      {startIssue && finalEndIssue && (
        <div className="bg-white rounded-xl overflow-hidden divide-y divide-gray-100">
          <div className="px-5 py-3.5 flex items-center justify-between">
            <span className="text-base text-gray-600">시작</span>
            <span className="text-base text-gray-900">
              {formatIssue(startIssue)}
            </span>
          </div>
          <div className="px-5 py-3.5 flex items-center justify-between">
            <span className="text-base text-gray-600">종료</span>
            <div className="flex items-center gap-3">
              <span className="text-base text-gray-400 line-through">
                {formatIssue(finalEndIssue)}
              </span>
              {newEndIssue && (
                <>
                  <ChevronRight size={16} className="text-gray-300" />
                  <span className="text-base text-gray-900">
                    {formatIssue(newEndIssue)}
                  </span>
                </>
              )}
            </div>
          </div>
          <div className="px-5 py-3.5 flex items-center justify-between">
            <span className="text-base text-gray-600">기간</span>
            <div className="flex items-center gap-3">
              {currentPeriodMonths && (
                <span className="text-base text-gray-400 line-through">
                  {currentPeriodMonths}개월
                </span>
              )}
              {newPeriodMonths && (
                <>
                  <ChevronRight size={16} className="text-gray-300" />
                  <span className="text-base text-gray-900">
                    {newPeriodMonths}개월
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// 배송지 변경 모달
interface SubscriptionAddressModalProps {
  address: {
    address_name: string;
    phone: string;
    postal_code: string;
    address1: string;
    address2: string;
    address_memo: string;
  };
  onAddressChange: (address: any) => void;
}

const SubscriptionAddressModal: React.FC<SubscriptionAddressModalProps> = ({
  address,
  onAddressChange,
}) => {
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
          onAddressChange({
            ...address,
            postal_code: data.zonecode,
            address1: addr,
            address2: "",
          });
        },
      }).open();
    }
  };

  return (
    <div className="space-y-4">
      {/* 안내 카드 */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0 mt-0.5">
            <MapPin className="w-4 h-4 text-blue-600" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-blue-900 mb-1">
              배송지 변경
            </p>
            <p className="text-xs text-blue-700 leading-relaxed">
              배송지 변경은 미발송분부터 적용됩니다. 이미 발송된 호수는 변경 전
              배송지로 발송됩니다.
            </p>
          </div>
        </div>
      </div>

      {/* 현재 배송지 정보 */}
      <div className="bg-gray-50 rounded-xl border border-gray-200 p-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
          현재 배송지
        </p>
        <div className="space-y-2.5 text-sm">
          <div className="flex gap-2">
            <span className="text-gray-500 min-w-[70px]">수령인</span>
            <span className="text-gray-900 font-medium">
              {address.address_name}
            </span>
          </div>
          <div className="flex gap-2">
            <span className="text-gray-500 min-w-[70px]">연락처</span>
            <span className="text-gray-900 font-medium">{address.phone}</span>
          </div>
          <div className="flex gap-2">
            <span className="text-gray-500 min-w-[70px]">주소</span>
            <span className="text-gray-900 font-medium">
              [{address.postal_code}] {address.address1}
              {address.address2 ? ` ${address.address2}` : ""}
            </span>
          </div>
          {address.address_memo && (
            <div className="flex gap-2">
              <span className="text-gray-500 min-w-[70px]">메모</span>
              <span className="text-gray-700">{address.address_memo}</span>
            </div>
          )}
        </div>
      </div>
      {/* 새 배송지 입력 */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">
          새 배송지 정보
        </p>
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="수령인"
            value={address.address_name}
            onChange={(e) =>
              onAddressChange({ ...address, address_name: e.target.value })
            }
            required
          />
          <Input
            label="연락처"
            value={address.phone}
            onChange={(e) =>
              onAddressChange({ ...address, phone: e.target.value })
            }
            required
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              우편번호 <span className="text-red-500 ml-1">*</span>
            </label>
            <div className="flex gap-2">
              <Input
                value={address.postal_code}
                onChange={(e) =>
                  onAddressChange({ ...address, postal_code: e.target.value })
                }
                readOnly
                className="flex-1"
              />
              <Button
                type="button"
                variant="secondary"
                onClick={handlePostcodeSearch}
              >
                검색
              </Button>
            </div>
          </div>
          <Input
            label="주소"
            value={address.address1}
            onChange={(e) =>
              onAddressChange({ ...address, address1: e.target.value })
            }
            readOnly
            required
          />
          <Input
            label="상세주소"
            value={address.address2}
            onChange={(e) =>
              onAddressChange({ ...address, address2: e.target.value })
            }
          />
          <div className="col-span-2">
            <Textarea
              label="배송 메모"
              value={address.address_memo}
              onChange={(e) =>
                onAddressChange({ ...address, address_memo: e.target.value })
              }
              rows={2}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

// 구독 기간 단축 모달
interface SubscriptionShortenModalProps {
  shortenMonths: number;
  refundAmount: number;
  currentStartIssue: string;
  currentEndIssue: string;
  onShortenMonthsChange: (months: number) => void;
  onRefundAmountChange: (amount: number) => void;
}

const SubscriptionShortenModal: React.FC<SubscriptionShortenModalProps> = ({
  shortenMonths,
  refundAmount,
  currentStartIssue,
  currentEndIssue,
  onShortenMonthsChange,
  onRefundAmountChange,
}) => {
  // 호수 파싱
  const parseIssue = (issue: string) => {
    const cleanIssue = issue.replace(/[년월호\s]/g, "");
    if (cleanIssue.length === 4) {
      const year = parseInt(cleanIssue.substring(0, 2));
      const month = parseInt(cleanIssue.substring(2, 4));
      return { year: 2000 + year, month };
    }
    return null;
  };

  // 기간 계산 (개월 수)
  const calculatePeriodMonths = (start: string, end: string) => {
    const startParsed = parseIssue(start);
    const endParsed = parseIssue(end);
    if (!startParsed || !endParsed) return null;
    const startTotal = startParsed.year * 12 + startParsed.month;
    const endTotal = endParsed.year * 12 + endParsed.month;
    return endTotal - startTotal + 1;
  };

  // 단축 후 종료 호 계산
  const calculateNewEndIssue = () => {
    if (!currentEndIssue) return null;
    const cleanIssue = currentEndIssue.replace(/[년월호\s]/g, "");
    if (cleanIssue.length === 4) {
      const year = parseInt(cleanIssue.substring(0, 2));
      const month = parseInt(cleanIssue.substring(2, 4));
      const totalMonths = month - shortenMonths;
      let newYear = year;
      let newMonth = totalMonths;
      while (newMonth <= 0) {
        newMonth += 12;
        newYear--;
      }
      return `${String(newYear).padStart(2, "0")}${String(newMonth).padStart(
        2,
        "0"
      )}`;
    }
    return null;
  };

  const newEndIssue = calculateNewEndIssue();
  const currentPeriodMonths =
    currentStartIssue && currentEndIssue
      ? calculatePeriodMonths(currentStartIssue, currentEndIssue)
      : null;
  const newPeriodMonths =
    currentStartIssue && newEndIssue
      ? calculatePeriodMonths(currentStartIssue, newEndIssue)
      : null;

  // 환불액 계산 (단축 시)
  useEffect(() => {
    if (shortenMonths > 0 && currentEndIssue) {
      // 단축된 개월수만큼 환불액 계산
      const monthlyPrice = 12000; // 실제로는 구독 정보에서 가져와야 함
      onRefundAmountChange(monthlyPrice * shortenMonths);
    } else {
      onRefundAmountChange(0);
    }
  }, [shortenMonths, currentEndIssue, onRefundAmountChange]);

  return (
    <div className="space-y-4">
      {/* 안내 카드 */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0 mt-0.5">
            <Calendar className="w-4 h-4 text-blue-600" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-blue-900 mb-1">
              구독 기간 단축
            </p>
            <p className="text-xs text-blue-700 leading-relaxed">
              단축할 개월수를 입력하면 환불액이 자동으로 계산됩니다.
            </p>
          </div>
        </div>
      </div>

      {/* 단축 개월 선택 */}
      <div className="bg-white rounded-xl overflow-hidden">
        <div className="px-5 py-4 flex items-center justify-between">
          <span className="text-base text-gray-900">단축 개월</span>
          <div className="flex items-center gap-4">
            <button
              onClick={() =>
                onShortenMonthsChange(Math.max(1, shortenMonths - 1))
              }
              className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
            >
              <Minus size={18} className="text-gray-600" />
            </button>
            <span className="text-2xl font-semibold w-12 text-center">
              {shortenMonths}
            </span>
            <button
              onClick={() => onShortenMonthsChange(shortenMonths + 1)}
              className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
            >
              <Plus size={18} className="text-gray-600" />
            </button>
          </div>
          <span className="text-base text-gray-500">개월</span>
        </div>
      </div>

      {/* 구독 기간 정보 */}
      {currentStartIssue &&
        currentEndIssue &&
        newEndIssue &&
        currentPeriodMonths &&
        newPeriodMonths && (
          <div className="bg-white rounded-xl overflow-hidden divide-y divide-gray-100">
            {/* 시작일 */}
            <div className="px-5 py-3.5 flex items-center justify-between">
              <span className="text-base text-gray-600">시작</span>
              <span className="text-base text-gray-900">
                {formatIssue(currentStartIssue)}
              </span>
            </div>

            {/* 종료일 */}
            <div className="px-5 py-3.5 flex items-center justify-between">
              <span className="text-base text-gray-600">종료</span>
              <div className="flex items-center gap-3">
                <span className="text-base text-gray-400 line-through">
                  {formatIssue(currentEndIssue)}
                </span>
                <ChevronRight size={16} className="text-gray-300" />
                <span className="text-base text-gray-900">
                  {formatIssue(newEndIssue)}
                </span>
              </div>
            </div>

            {/* 기간 */}
            <div className="px-5 py-3.5 flex items-center justify-between">
              <span className="text-base text-gray-600">기간</span>
              <div className="flex items-center gap-3">
                <span className="text-base text-gray-400 line-through">
                  {currentPeriodMonths}개월
                </span>
                <ChevronRight size={16} className="text-gray-300" />
                <span className="text-base text-gray-900">
                  {newPeriodMonths}개월
                </span>
              </div>
            </div>
          </div>
        )}

      {/* 환불 예정 금액 미리보기 */}
      {refundAmount > 0 && newEndIssue && (
        <div className="bg-white rounded-xl overflow-hidden divide-y divide-gray-100">
          <div className="px-5 py-3.5 flex items-center justify-between">
            <span className="text-base text-gray-600">환불 예정 금액</span>
            <span className="text-base font-semibold text-gray-900">
              ₩{refundAmount.toLocaleString()}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

// 구독 기간 선택 달력 컴포넌트
interface PeriodCalendarSelectorProps {
  currentStartIssue: string;
  currentEndIssue: string;
  selectedStartIssue: string;
  selectedEndIssue: string;
  onStartIssueChange: (issue: string) => void;
  onEndIssueChange: (issue: string) => void;
  allowStartChange?: boolean;
  readOnly?: boolean;
}

const PeriodCalendarSelector: React.FC<PeriodCalendarSelectorProps> = ({
  currentStartIssue,
  currentEndIssue,
  selectedStartIssue,
  selectedEndIssue,
  onStartIssueChange,
  onEndIssueChange,
  allowStartChange = true,
  readOnly = false,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<string | null>(null);
  const [hoveredIssue, setHoveredIssue] = useState<string | null>(null);

  // 호수 파싱
  const parseIssue = (issue: string) => {
    const cleanIssue = issue.replace(/[년월호\s]/g, "");
    if (cleanIssue.length === 4) {
      const year = parseInt(cleanIssue.substring(0, 2));
      const month = parseInt(cleanIssue.substring(2, 4));
      return { year: 2000 + year, month };
    }
    return null;
  };

  // 호수 생성
  const formatIssueString = (year: number, month: number) => {
    const yearStr = String(year % 100).padStart(2, "0");
    const monthStr = String(month).padStart(2, "0");
    return `${yearStr}${monthStr}`;
  };

  // 호수 비교 (정렬용)
  const compareIssues = (issue1: string, issue2: string) => {
    const parsed1 = parseIssue(issue1);
    const parsed2 = parseIssue(issue2);
    if (!parsed1 || !parsed2) return 0;
    if (parsed1.year !== parsed2.year) return parsed1.year - parsed2.year;
    return parsed1.month - parsed2.month;
  };

  // 현재 구독 기간 기반으로 달력 생성
  const currentStart = parseIssue(currentStartIssue);
  const currentEnd = parseIssue(currentEndIssue);

  // 달력 범위 설정
  const calendarMonths: Array<{
    issue: string;
    year: number;
    month: number;
    displayText: string;
  }> = [];

  if (currentStart && currentEnd) {
    const startYear = currentStart.year;
    const startMonth = currentStart.month;
    const endYear = currentEnd.year;
    const endMonth = currentEnd.month;

    if (readOnly) {
      // 읽기 전용일 때는 현재 구독 기간만 표시
      let currentYear = startYear;
      let currentMonth = startMonth;
      const endTotal = endYear * 12 + endMonth;

      while (currentYear * 12 + currentMonth <= endTotal) {
        const issue = formatIssueString(currentYear, currentMonth);
        calendarMonths.push({
          issue,
          year: currentYear,
          month: currentMonth,
          displayText: formatIssue(issue),
        });

        currentMonth++;
        if (currentMonth > 12) {
          currentMonth = 1;
          currentYear++;
        }
      }
    } else {
      // 편집 가능할 때는 현재 기간 앞으로 12개월, 뒤로 12개월 추가
      // 시작점 계산 (현재 시작 - 12개월)
      let calendarStartYear = startYear;
      let calendarStartMonth = startMonth - 12;
      while (calendarStartMonth <= 0) {
        calendarStartMonth += 12;
        calendarStartYear--;
      }

      // 끝점 계산 (현재 끝 + 12개월)
      let calendarEndYear = endYear;
      let calendarEndMonth = endMonth + 12;
      while (calendarEndMonth > 12) {
        calendarEndMonth -= 12;
        calendarEndYear++;
      }

      // 달력 생성
      let currentYear = calendarStartYear;
      let currentMonth = calendarStartMonth;
      const endTotal = calendarEndYear * 12 + calendarEndMonth;

      while (currentYear * 12 + currentMonth <= endTotal) {
        const issue = formatIssueString(currentYear, currentMonth);
        calendarMonths.push({
          issue,
          year: currentYear,
          month: currentMonth,
          displayText: formatIssue(issue),
        });

        currentMonth++;
        if (currentMonth > 12) {
          currentMonth = 1;
          currentYear++;
        }
      }
    }
  }

  // 선택된 범위 확인
  const isInSelectedRange = (issue: string) => {
    if (!selectedStartIssue || !selectedEndIssue) return false;
    const start = selectedStartIssue;
    const end = selectedEndIssue;
    const issueParsed = parseIssue(issue);
    const startParsed = parseIssue(start);
    const endParsed = parseIssue(end);

    if (!issueParsed || !startParsed || !endParsed) return false;

    const issueTotal = issueParsed.year * 12 + issueParsed.month;
    const startTotal = startParsed.year * 12 + startParsed.month;
    const endTotal = endParsed.year * 12 + endParsed.month;

    return issueTotal >= startTotal && issueTotal <= endTotal;
  };

  // 현재 구독 기간 내인지 확인
  const isInCurrentRange = (issue: string) => {
    if (!currentStart || !currentEnd) return false;
    const issueParsed = parseIssue(issue);
    if (!issueParsed) return false;

    const issueTotal = issueParsed.year * 12 + issueParsed.month;
    const startTotal = currentStart.year * 12 + currentStart.month;
    const endTotal = currentEnd.year * 12 + currentEnd.month;

    return issueTotal >= startTotal && issueTotal <= endTotal;
  };

  // 마우스 다운 (드래그 시작)
  const handleMouseDown = (issue: string) => {
    if (readOnly) return; // 읽기 전용일 때는 드래그 불가

    if (!allowStartChange) {
      // 시작 호 변경 불가 시 끝 호만 선택
      setIsDragging(true);
      setDragStart(issue);
      onEndIssueChange(issue);
    } else {
      setIsDragging(true);
      setDragStart(issue);
      onStartIssueChange(issue);
      onEndIssueChange(issue);
    }
  };

  // 마우스 이동 (드래그 중)
  const handleMouseMove = (issue: string) => {
    if (readOnly || !isDragging || !dragStart) return;

    if (!allowStartChange) {
      // 시작 호 변경 불가 시 끝 호만 업데이트
      onEndIssueChange(issue);
    } else {
      const startParsed = parseIssue(dragStart);
      const currentParsed = parseIssue(issue);

      if (!startParsed || !currentParsed) return;

      const startTotal = startParsed.year * 12 + startParsed.month;
      const currentTotal = currentParsed.year * 12 + currentParsed.month;

      if (currentTotal < startTotal) {
        onStartIssueChange(issue);
        onEndIssueChange(dragStart);
      } else {
        onStartIssueChange(dragStart);
        onEndIssueChange(issue);
      }
    }
  };

  // 마우스 업 (드래그 종료)
  const handleMouseUp = () => {
    setIsDragging(false);
    setDragStart(null);
  };

  // 전역 마우스 이벤트
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isDragging) {
        setIsDragging(false);
        setDragStart(null);
      }
    };

    if (isDragging) {
      document.addEventListener("mouseup", handleGlobalMouseUp);
      return () => {
        document.removeEventListener("mouseup", handleGlobalMouseUp);
      };
    }
  }, [isDragging]);

  return (
    <div className="space-y-4">
      {/* 선택된 기간 표시 (읽기 전용일 때는 숨김) */}
      {!readOnly && (selectedStartIssue || selectedEndIssue) && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <div className="flex items-center gap-2 text-sm">
            {allowStartChange ? (
              <>
                <span className="text-gray-600">선택된 기간:</span>
                <span className="font-semibold text-blue-900">
                  {selectedStartIssue
                    ? formatIssue(selectedStartIssue)
                    : "미선택"}
                </span>
                <span className="text-gray-400">~</span>
                <span className="font-semibold text-blue-900">
                  {selectedEndIssue ? formatIssue(selectedEndIssue) : "미선택"}
                </span>
              </>
            ) : (
              <span className="font-semibold text-blue-900">
                {selectedEndIssue ? formatIssue(selectedEndIssue) : "미선택"}
              </span>
            )}
          </div>
        </div>
      )}

      {/* 달력 그리드 */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <p className="text-sm font-medium text-gray-700 mb-4 select-none">
          {readOnly
            ? "변경 결과 미리보기"
            : allowStartChange
            ? "달력을 드래그하여 기간을 선택하세요"
            : "단축할 종료 호를 드래그하여 선택하세요"}
        </p>
        <div
          className={`grid grid-cols-12 gap-2 select-none ${
            readOnly ? "pointer-events-none opacity-75" : ""
          }`}
        >
          {calendarMonths.map((month) => {
            const isSelected = isInSelectedRange(month.issue);
            const isCurrent = isInCurrentRange(month.issue);
            const isStart =
              selectedStartIssue &&
              compareIssues(month.issue, selectedStartIssue) === 0;
            const isEnd =
              selectedEndIssue &&
              compareIssues(month.issue, selectedEndIssue) === 0;
            const isHovered = hoveredIssue === month.issue;

            return (
              <div
                key={month.issue}
                className={`
                  relative h-16 rounded-lg border-2 transition-all cursor-pointer
                  flex flex-col items-center justify-center text-xs select-none
                  ${
                    isSelected
                      ? "bg-blue-100 border-blue-500 text-blue-900 font-semibold"
                      : isCurrent
                      ? "bg-gray-50 border-gray-300 text-gray-700"
                      : "bg-white border-gray-200 text-gray-500 hover:border-gray-300"
                  }
                  ${
                    isStart || isEnd ? "ring-2 ring-blue-400 ring-offset-1" : ""
                  }
                  ${isHovered && !isSelected ? "bg-gray-100" : ""}
                `}
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleMouseDown(month.issue);
                }}
                onMouseMove={() => {
                  handleMouseMove(month.issue);
                  setHoveredIssue(month.issue);
                }}
                onMouseUp={handleMouseUp}
                onMouseLeave={() => setHoveredIssue(null)}
                onDragStart={(e) => e.preventDefault()}
                style={{ userSelect: "none", WebkitUserSelect: "none" }}
              >
                <div className="text-[10px] text-gray-400 mb-0.5">
                  {String(month.year % 100).padStart(2, "0")}년
                </div>
                <div className="font-medium">{month.month}월</div>
                {(isStart || isEnd) && (
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full border-2 border-white"></div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default SubscriptionListPage;
