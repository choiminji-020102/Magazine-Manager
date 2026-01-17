import React, { useState, useRef, useEffect } from "react";
import * as XLSX from "xlsx";
import {
  Download,
  Send,
  User,
  Clock,
  AlertCircle,
  MessageSquare,
  Phone,
  Mail,
  Package,
  Link2,
  FileText,
  CheckCircle,
  Plus,
  Filter,
  Search,
  ChevronDown,
  ArrowUpDown,
  RotateCcw,
  X,
  RefreshCw,
  ExternalLink,
} from "lucide-react";
import Table, { Column } from "../components/common/Table";
import Pagination from "../components/common/Pagination";
import Card from "../components/common/Card";
import Button from "../components/common/Button";
import Badge from "../components/common/Badge";
import Modal from "../components/common/Modal";
import Tabs from "../components/common/Tabs";
import Select from "../components/common/Select";
import Input from "../components/common/Input";
import Textarea from "../components/common/Textarea";
import Breadcrumb from "../components/common/Breadcrumb";

// 목업 데이터
const mockInquiries: Inquiry[] = [
  {
    id: 1,
    createdAt: "2024-12-10 15:30",
    inquiryType: "채널톡",
    customerName: "김민수",
    customerPhone: "010-1234-5678",
    customerEmail: "minsu.kim@example.com",
    title: "배송이 언제 되나요?",
    status: "미처리",
    assignee: null,
    relatedOrder: "ORD-2024-12001",
  },
  {
    id: 2,
    createdAt: "2024-12-09 14:20",
    inquiryType: "Cafe24",
    customerName: "이영희",
    customerPhone: "010-2345-6789",
    customerEmail: "younghee.lee@example.com",
    title: "주문 취소 가능한가요?",
    status: "처리중",
    assignee: "관리자",
    relatedOrder: "ORD-2024-12002",
  },
  {
    id: 3,
    createdAt: "2024-12-08 10:15",
    inquiryType: "전화",
    customerName: "박철수",
    customerPhone: "010-3456-7890",
    customerEmail: "chulsoo.park@example.com",
    title: "구독 기간 변경 요청",
    status: "완료",
    assignee: "매니저",
    relatedOrder: null,
  },
];

const mockInquiryDetail = {
  inquiry_id: 1,
  customer_id: 1001,
  inquiry_type: "채널톡",
  inquiry_category: "배송문의",
  title: "배송이 언제 되나요?",
  content:
    "안녕하세요. 12월 10일에 주문한 상품인데 아직 배송 시작이 안 된 것 같아서 문의드립니다. 언제쯤 받아볼 수 있을까요? 급하게 필요해서요.",
  answer: null,
  inquiry_status: "RECEIVED",
  order_id: 20241201001,
  order_item_id: 20241201001001,
  handled_by: null,
  handled_at: null,
  created_at: "2024-12-10 15:30:00",
  updated_at: "2024-12-10 15:30:00",
  customer: {
    customer_id: 1001,
    customer_name: "김민수",
    customer_phone: "010-1234-5678",
    customer_email: "minsu.kim@example.com",
  },
  handledByAdmin: null,
  history: [
    {
      id: 1,
      type: "customer",
      content:
        "안녕하세요. 12월 10일에 주문한 상품인데 아직 배송 시작이 안 된 것 같아서 문의드립니다.",
      created_at: "2024-12-10 15:30:00",
      author: "김민수",
    },
  ],
  attachments: [],
};

const answerTemplates = [
  {
    id: 1,
    title: "배송 일정 안내",
    content:
      "안녕하세요, 고객님. 주문해 주셔서 감사합니다. 현재 상품은 발송 준비 중이며, 영업일 기준 2-3일 내에 발송될 예정입니다. 발송 시 문자로 송장번호를 안내해 드리겠습니다. 감사합니다.",
  },
  {
    id: 2,
    title: "구독 해지 안내",
    content:
      "안녕하세요, 고객님. 구독 해지를 원하시면 고객센터(02-1234-5678)로 연락 주시거나, 마이페이지에서 직접 해지 신청을 하실 수 있습니다. 추가 문의사항이 있으시면 말씀해 주세요.",
  },
  {
    id: 3,
    title: "교환/반품 안내",
    content:
      "안녕하세요, 고객님. 상품 수령 후 7일 이내에 교환/반품이 가능합니다. 단, 상품이 훼손되지 않은 상태여야 하며, 반품 배송비는 고객 부담입니다. 교환을 원하시면 상품을 보내주시기 바랍니다.",
  },
];

interface Inquiry {
  id: number;
  createdAt: string;
  inquiryType: string; // 채널 정보와 동일 (inquiry_type)
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  title: string;
  status: string;
  assignee: string | null;
  relatedOrder: string | null;
}

const SupportListPage: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});
  const [showFilters, setShowFilters] = useState(false);
  const [showSortMenu, setShowSortMenu] = useState(false);
  const sortButtonRef = useRef<HTMLDivElement>(null);
  const [sortMenuPosition, setSortMenuPosition] = useState({ top: 0, left: 0 });
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);
  const [sortKey, setSortKey] = useState("createdAt");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedInquiry, setSelectedInquiry] = useState<Inquiry | null>(null);
  const [activeTab, setActiveTab] = useState("detail");
  const [replyContent, setReplyContent] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<number | null>(null);
  const [replyChannels, setReplyChannels] = useState<Set<string>>(new Set());
  const [templates] = useState(answerTemplates);
  const [inquiries] = useState<Inquiry[]>(mockInquiries);

  // 문의 채널에 맞춰 기본 전송 채널 설정
  useEffect(() => {
    if (mockInquiryDetail.inquiry_type) {
      const channelMap: Record<string, string> = {
        채널톡: "channeltalk",
        Cafe24: "cafe24",
        갓피플몰: "godpeople",
        전화: "sms",
        이메일: "email",
      };
      const defaultChannel = channelMap[mockInquiryDetail.inquiry_type] || "sms";
      setReplyChannels(new Set([defaultChannel]));
    }
  }, [mockInquiryDetail.inquiry_type]);

  // 외부 클릭 시 정렬 메뉴 닫기
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
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showSortMenu]);

  const handleSort = (key: string, direction: "asc" | "desc") => {
    setSortKey(key);
    setSortDirection(direction);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedItems(new Set(filteredInquiries.map((item) => String(item.id))));
    } else {
      setSelectedItems(new Set());
    }
  };

  const handleSelectItem = (id: string, checked: boolean) => {
    const newSelected = new Set(selectedItems);
    if (checked) {
      newSelected.add(id);
    } else {
      newSelected.delete(id);
    }
    setSelectedItems(newSelected);
  };

  // 엑셀 다운로드 함수
  const handleExportExcel = (selectedOnly: boolean = false) => {
    let dataToExport: Inquiry[];

    if (selectedOnly && selectedItems.size > 0) {
      dataToExport = filteredInquiries.filter((item) =>
        selectedItems.has(String(item.id))
      );
    } else {
      dataToExport = filteredInquiries;
    }

    if (dataToExport.length === 0) {
      alert("다운로드할 데이터가 없습니다.");
      return;
    }

    const excelData = dataToExport.map((item) => ({
      접수일시: item.createdAt,
      채널: item.channel,
      고객명: item.customerName,
      연락처: item.customerPhone,
      이메일: item.customerEmail,
      문의유형: item.inquiryType,
      제목: item.title,
      처리상태: item.status,
      담당자: item.assignee || "",
      관련주문: item.relatedOrder || "",
    }));

    const ws = XLSX.utils.json_to_sheet(excelData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "문의 목록");

    const fileName = `문의목록_${new Date().toISOString().split("T")[0]}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  const handleFilterChange = (key: string, value: string) => {
    setFilterValues((prev) => ({ ...prev, [key]: value }));
  };

  const handleReset = () => {
    setFilterValues({});
    setSearchTerm("");
  };

  const handleViewDetail = (inquiry: Inquiry) => {
    setSelectedInquiry(inquiry);
    setIsDetailModalOpen(true);
    setActiveTab("detail");
    setReplyContent("");
    setSelectedTemplate(null);
  };

  const handleSelectTemplate = (templateId: number) => {
    setSelectedTemplate(templateId);
    const template = templates.find((t) => t.id === templateId);
    if (template) {
      setReplyContent(template.content);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<
      string,
      { variant: "danger" | "warning" | "success"; label: string }
    > = {
      RECEIVED: { variant: "danger", label: "미처리" },
      PROCESSING: { variant: "warning", label: "처리중" },
      COMPLETED: { variant: "success", label: "완료" },
      미처리: { variant: "danger", label: "미처리" },
      처리중: { variant: "warning", label: "처리중" },
      완료: { variant: "success", label: "완료" },
    };
    const config = statusMap[status] || { variant: "success", label: status };
    return (
      <Badge variant={config.variant} dot>
        {config.label}
      </Badge>
    );
  };

  const getChannelBadge = (channel: string) => {
    const channelMap: Record<
      string,
      {
        variant: "info" | "success" | "default" | "gray";
        icon: React.ReactNode;
      }
    > = {
      채널톡: { variant: "info", icon: <MessageSquare className="w-3 h-3" /> },
      Cafe24: { variant: "success", icon: null },
      갓피플몰: { variant: "default", icon: null },
      전화: { variant: "gray", icon: <Phone className="w-3 h-3" /> },
      이메일: { variant: "gray", icon: <Mail className="w-3 h-3" /> },
    };
    const config = channelMap[channel] || { variant: "gray", icon: null };
    return (
      <Badge variant={config.variant}>
        <span className="flex items-center gap-1">
          {config.icon}
          {channel}
        </span>
      </Badge>
    );
  };

  // 필터링 및 정렬
  const filteredInquiries = inquiries
    .filter((item) => {
      if (
        searchTerm &&
        !item.customerName.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !item.title.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !item.customerPhone.includes(searchTerm)
      )
        return false;
      if (filterValues.status) {
        const statusMap: Record<string, string> = {
          pending: "미처리",
          processing: "처리중",
          completed: "완료",
        };
        if (item.status !== statusMap[filterValues.status]) return false;
      }
      if (filterValues.channel) {
        const channelMap: Record<string, string> = {
          channeltalk: "채널톡",
          cafe24: "Cafe24",
          godpeople: "갓피플몰",
          phone: "전화",
          email: "이메일",
        };
        if (item.inquiryType !== channelMap[filterValues.channel]) return false;
      }
      return true;
    })
    .sort((a, b) => {
      const aVal = a[sortKey as keyof Inquiry];
      const bVal = b[sortKey as keyof Inquiry];
      if (aVal === null && bVal === null) return 0;
      if (aVal === null) return 1;
      if (bVal === null) return -1;
      const aStr = String(aVal);
      const bStr = String(bVal);
      if (sortDirection === "asc") return aStr > bStr ? 1 : -1;
      return aStr < bStr ? 1 : -1;
    });

  const totalPages = Math.ceil(filteredInquiries.length / itemsPerPage);
  const paginatedInquiries = filteredInquiries.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const columns: Column<Inquiry>[] = [
    {
      key: "checkbox",
      label: "선택",
      width: "50px",
      align: "center",
      render: (_, row) => (
        <div className="flex justify-center">
          <input
            type="checkbox"
            checked={selectedItems.has(String(row.id))}
            onChange={(e) =>
              handleSelectItem(String(row.id), e.target.checked)
            }
            className="w-4 h-4 rounded border-line text-accent focus:ring-accent"
          />
        </div>
      ),
    },
    {
      key: "createdAt",
      label: "접수일시",
      sortable: true,
      align: "center",
      render: (value) => (
        <span className="text-sm">{value}</span>
      ),
    },
    {
      key: "inquiryType",
      label: "채널",
      align: "center",
      render: (_, row) => (
        <div className="flex justify-center">
          {getChannelBadge(row.inquiryType)}
        </div>
      ),
    },
    {
      key: "customerName",
      label: "고객명",
      sortable: true,
      align: "center",
      render: (value) => <span className="font-medium">{value}</span>,
    },
    {
      key: "title",
      label: "제목",
      align: "center",
      render: (value) => <span className="text-ink">{value}</span>,
    },
    {
      key: "status",
      label: "처리상태",
      sortable: true,
      align: "center",
      render: (_, row) => (
        <div className="flex justify-center">
          {getStatusBadge(row.status)}
        </div>
      ),
    },
    {
      key: "assignee",
      label: "담당자",
      align: "center",
      render: (value) => (
        <span className="text-ink">{value || "미지정"}</span>
      ),
    },
  ];

  const filters = [
    {
      key: "status",
      label: "처리 상태",
      type: "select" as const,
      options: [
        { value: "pending", label: "미처리" },
        { value: "processing", label: "처리중" },
        { value: "completed", label: "완료" },
      ],
    },
    {
      key: "channel",
      label: "채널별",
      type: "select" as const,
      options: [
        { value: "channeltalk", label: "채널톡" },
        { value: "cafe24", label: "Cafe24" },
        { value: "godpeople", label: "갓피플몰" },
        { value: "phone", label: "전화" },
        { value: "email", label: "이메일" },
      ],
    },
    {
      key: "type",
      label: "문의 유형",
      type: "select" as const,
      options: [
        { value: "order", label: "주문문의" },
        { value: "shipping", label: "배송문의" },
        { value: "subscription", label: "구독문의" },
        { value: "product", label: "상품문의" },
        { value: "refund", label: "환불/취소" },
        { value: "etc", label: "기타" },
      ],
    },
    {
      key: "createdAt",
      label: "접수일",
      type: "dateRange" as const,
    },
    {
      key: "assignee",
      label: "담당자별",
      type: "select" as const,
      options: [
        { value: "admin", label: "관리자" },
        { value: "manager", label: "매니저" },
        { value: "unassigned", label: "미지정" },
      ],
    },
  ];

  const detailTabs = [
    { key: "detail", label: "문의 상세" },
    { key: "reply", label: "답변 작성" },
    { key: "history", label: "처리 이력" },
  ];

  return (
    <div className="min-h-screen">
      <div className="max-w-[1600px] mx-auto px-6 py-6">
        <Breadcrumb
          items={[
            { label: "고객 지원", path: "/support/list" },
            { label: "문의 목록" },
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
                icon={RefreshCw}
                onClick={() => {}}
              >
                새로고침
              </Button>
              <Button
                size="sm"
                icon={Plus}
                onClick={() => setIsAddModalOpen(true)}
              >
                문의 등록
              </Button>
            </div>
          </div>
        </div>

        {/* 통계 카드 */}
        <div
          className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6 anim-rise"
          style={{ animationDelay: "0.1s" }}
        >
          <Card
            padding="none"
            className="unified-card p-5 unified-card-hover cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted mb-1">미처리</p>
                <p className="text-2xl font-bold text-danger-600">8</p>
                <p className="text-xs text-muted mt-0.5">즉시 처리 필요</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-danger-100 flex items-center justify-center">
                <AlertCircle className="w-6 h-6 text-danger-600" />
              </div>
            </div>
          </Card>
          <Card
            padding="none"
            className="unified-card p-5 unified-card-hover cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted mb-1">처리중</p>
                <p className="text-2xl font-bold text-warning-600">5</p>
                <p className="text-xs text-muted mt-0.5">답변 작성 중</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-warning-100 flex items-center justify-center">
                <Clock className="w-6 h-6 text-warning-600" />
              </div>
            </div>
          </Card>
          <Card
            padding="none"
            className="unified-card p-5 unified-card-hover cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted mb-1">오늘 완료</p>
                <p className="text-2xl font-bold text-success-600">12</p>
                <p className="text-xs text-muted mt-0.5">잘하고 있어요!</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-success-100 flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-success-600" />
              </div>
            </div>
          </Card>
          <Card
            padding="none"
            className="unified-card p-5 unified-card-hover cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted mb-1">24시간+ 미처리</p>
                <p className="text-2xl font-bold text-danger-600">3</p>
                <p className="text-xs text-danger-600 mt-0.5 font-medium">
                  ⚠ 긴급 확인
                </p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-danger-100 flex items-center justify-center">
                <AlertCircle className="w-6 h-6 text-danger-600" />
              </div>
            </div>
          </Card>
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
                    placeholder="제목, 내용, 고객명으로 검색..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="unified-input pl-10 w-full"
                  />
                </div>
                {(searchTerm ||
                  filterValues.status ||
                  filterValues.channel ||
                  filterValues.createdAtStart ||
                  filterValues.createdAtEnd) && (
                  <button
                    onClick={handleReset}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-md font-medium text-sm bg-accent text-white hover:bg-accent/90 transition-all"
                  >
                    <RotateCcw className="w-4 h-4" />
                    필터&정렬 초기화
                  </button>
                )}
              </div>

              {/* 선택된 필터 태그들 */}
              {(filterValues.status ||
                filterValues.channel ||
                filterValues.type ||
                filterValues.createdAtStart ||
                filterValues.createdAtEnd) && (
                <div className="flex items-center gap-2 flex-wrap mb-4">
                  {filterValues.status && (
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-md text-sm font-medium">
                      처리상태:{" "}
                      {filters
                        .find((f) => f.key === "status")
                        ?.options?.find((o) => o.value === filterValues.status)
                        ?.label || filterValues.status}
                      <button
                        onClick={() => handleFilterChange("status", "")}
                        className="hover:text-blue-900"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                  {filterValues.channel && (
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-md text-sm font-medium">
                      채널:{" "}
                      {filters
                        .find((f) => f.key === "channel")
                        ?.options?.find((o) => o.value === filterValues.channel)
                        ?.label || filterValues.channel}
                      <button
                        onClick={() => handleFilterChange("channel", "")}
                        className="hover:text-blue-900"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                  {(filterValues.createdAtStart || filterValues.createdAtEnd) && (
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-md text-sm font-medium">
                      접수일: {filterValues.createdAtStart || "이전"} ~{" "}
                      {filterValues.createdAtEnd || "이후"}
                      <button
                        onClick={() => {
                          handleFilterChange("createdAtStart", "");
                          handleFilterChange("createdAtEnd", "");
                        }}
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
                      <label className="unified-label">처리상태</label>
                      <select
                        value={filterValues.status || ""}
                        onChange={(e) =>
                          handleFilterChange("status", e.target.value)
                        }
                        className="unified-input w-full"
                      >
                        <option value="">전체</option>
                        {filters
                          .find((f) => f.key === "status")
                          ?.options?.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                      </select>
                    </div>
                    <div>
                      <label className="unified-label">채널별</label>
                      <select
                        value={filterValues.channel || ""}
                        onChange={(e) =>
                          handleFilterChange("channel", e.target.value)
                        }
                        className="unified-input w-full"
                      >
                        <option value="">전체</option>
                        {filters
                          .find((f) => f.key === "channel")
                          ?.options?.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                      </select>
                    </div>
                    <div>
                      <label className="unified-label">문의 유형</label>
                      <select
                        value={filterValues.type || ""}
                        onChange={(e) =>
                          handleFilterChange("type", e.target.value)
                        }
                        className="unified-input w-full"
                      >
                        <option value="">전체</option>
                        {filters
                          .find((f) => f.key === "type")
                          ?.options?.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                      </select>
                    </div>
                    <div>
                      <label className="unified-label">접수일 (시작)</label>
                      <input
                        type="date"
                        value={filterValues.createdAtStart || ""}
                        onChange={(e) =>
                          handleFilterChange("createdAtStart", e.target.value)
                        }
                        className="unified-input w-full"
                      />
                    </div>
                    <div>
                      <label className="unified-label">접수일 (종료)</label>
                      <input
                        type="date"
                        value={filterValues.createdAtEnd || ""}
                        onChange={(e) =>
                          handleFilterChange("createdAtEnd", e.target.value)
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
                  handleSort("createdAt", "desc");
                  setShowSortMenu(false);
                }}
                className="w-full text-left px-4 py-2 hover:bg-paper text-sm"
              >
                접수일시 최신순
              </button>
              <button
                onClick={() => {
                  handleSort("createdAt", "asc");
                  setShowSortMenu(false);
                }}
                className="w-full text-left px-4 py-2 hover:bg-paper text-sm"
              >
                접수일시 오래된순
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
                  handleSort("status", "asc");
                  setShowSortMenu(false);
                }}
                className="w-full text-left px-4 py-2 hover:bg-paper text-sm"
              >
                처리상태순
              </button>
            </div>
          )}
        </div>

        {/* 일괄 작업 */}
        <Card className="unified-card mb-6 p-4 bg-neutral-50 border-neutral-200">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-ink">
              {selectedItems.size}건 선택됨
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                icon={Download}
                onClick={() => handleExportExcel(false)}
              >
                엑셀 다운로드
              </Button>
              {selectedItems.size > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedItems(new Set())}
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
                  filteredInquiries.length > 0 &&
                  selectedItems.size === filteredInquiries.length
                }
                onChange={(e) => handleSelectAll(e.target.checked)}
                className="w-4 h-4 rounded border-line text-accent focus:ring-accent"
              />
              <span className="text-sm text-muted">
                전체 {filteredInquiries.length}건
              </span>
            </div>
            <span className="text-sm text-muted">
              {(currentPage - 1) * itemsPerPage + 1} -{" "}
              {Math.min(currentPage * itemsPerPage, filteredInquiries.length)} /{" "}
              {filteredInquiries.length}
            </span>
          </div>

          <Table
            columns={columns}
            data={paginatedInquiries}
            keyExtractor={(row) => String(row.id)}
            onSort={handleSort}
            sortKey={sortKey}
            sortDirection={sortDirection}
            emptyMessage="문의 내역이 없습니다"
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
        </Card>

        {/* 문의 상세 모달 */}
        <Modal
          isOpen={isDetailModalOpen}
          onClose={() => setIsDetailModalOpen(false)}
          title={`문의 상세 - #${selectedInquiry?.id || mockInquiryDetail.inquiry_id}`}
          size="xl"
          footer={
            <div className="flex justify-between w-full">
              <div className="flex gap-2">
                <Select
                  options={[
                    { value: "admin", label: "관리자" },
                    { value: "manager", label: "매니저" },
                  ]}
                  placeholder="담당자 지정"
                  className="w-32"
                />
                <Select
                  options={[
                    { value: "pending", label: "미처리" },
                    { value: "processing", label: "처리중" },
                    { value: "completed", label: "완료" },
                  ]}
                  placeholder="상태 변경"
                  className="w-32"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  onClick={() => setIsDetailModalOpen(false)}
                >
                  닫기
                </Button>
                <Button icon={Send}>답변 전송</Button>
              </div>
            </div>
          }
        >
          <div>
            <Tabs
              tabs={detailTabs}
              activeTab={activeTab}
              onChange={setActiveTab}
              className="mb-6"
            />

            {activeTab === "detail" && (
              <div className="space-y-6">
                {/* 상단 핵심 정보 카드 */}
                <div className="bg-gradient-to-br from-paper to-white rounded-xl border border-line p-6 shadow-sm">
                  <div className="flex items-start justify-between mb-6">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-3">
                        {getStatusBadge(
                          mockInquiryDetail.inquiry_status === "RECEIVED"
                            ? "미처리"
                            : mockInquiryDetail.inquiry_status === "PROCESSING"
                            ? "처리중"
                            : "완료"
                        )}
                        {getChannelBadge(mockInquiryDetail.inquiry_type)}
                        {mockInquiryDetail.inquiry_category && (
                          <Badge variant="gray" size="sm">
                            {mockInquiryDetail.inquiry_category}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted mb-1">접수일시</p>
                      <p className="text-sm font-medium text-ink">
                        {new Date(mockInquiryDetail.created_at).toLocaleString(
                          "ko-KR"
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="border-t border-line pt-6">
                    <h2 className="text-xl font-bold text-ink mb-2">
                      {mockInquiryDetail.title || "제목 없음"}
                    </h2>
                  </div>
                </div>

                {/* 메인 콘텐츠 영역 - 좌우 분할 */}
                <div className="grid grid-cols-3 gap-6">
                  {/* 왼쪽: 문의 내용 및 답변 */}
                  <div className="col-span-2 space-y-6">
                    {/* 문의 내용 */}
                    <Card className="border border-line">
                      <div className="flex items-center gap-2 mb-4 pb-4 border-b border-line">
                        <MessageSquare className="w-5 h-5 text-accent" />
                        <h3 className="text-lg font-semibold text-ink">
                          문의 내용
                        </h3>
                        <span className="ml-auto text-xs text-muted">
                          {new Date(mockInquiryDetail.created_at).toLocaleString(
                            "ko-KR"
                          )}
                        </span>
                      </div>
                      <div className="prose max-w-none">
                        <p className="text-base text-ink leading-relaxed whitespace-pre-wrap">
                          {mockInquiryDetail.content || "-"}
                        </p>
                      </div>
                    </Card>

                    {/* 답변 내용 */}
                    {mockInquiryDetail.answer ? (
                      <Card className="border border-line bg-success-50/30">
                        <div className="flex items-center gap-2 mb-4 pb-4 border-b border-line">
                          <CheckCircle className="w-5 h-5 text-success-600" />
                          <h3 className="text-lg font-semibold text-ink">
                            답변 내용
                          </h3>
                          {mockInquiryDetail.handled_at && (
                            <span className="ml-auto text-xs text-muted">
                              {new Date(
                                mockInquiryDetail.handled_at
                              ).toLocaleString("ko-KR")}
                            </span>
                          )}
                        </div>
                        <div className="prose max-w-none">
                          <p className="text-base text-ink leading-relaxed whitespace-pre-wrap">
                            {mockInquiryDetail.answer}
                          </p>
                        </div>
                      </Card>
                    ) : (
                      <Card className="border-2 border-dashed border-line bg-gray-50/50">
                        <div className="text-center py-8">
                          <MessageSquare className="w-12 h-12 text-muted mx-auto mb-3 opacity-50" />
                          <p className="text-sm text-muted">
                            아직 답변이 등록되지 않았습니다.
                          </p>
                          <p className="text-xs text-muted mt-1">
                            "답변 작성" 탭에서 답변을 작성하세요.
                          </p>
                        </div>
                      </Card>
                    )}
                  </div>

                  {/* 오른쪽: 사이드바 정보 */}
                  <div className="space-y-4">
                    {/* 고객 정보 카드 */}
                    <Card className="border border-line sticky top-4">
                      <div className="flex items-center gap-2 mb-4 pb-4 border-b border-line">
                        <User className="w-5 h-5 text-accent" />
                        <h3 className="font-semibold text-ink">고객 정보</h3>
                      </div>
                      <div className="space-y-3">
                        <div>
                          <p className="text-xs text-muted mb-1">이름</p>
                          <p className="text-base font-medium text-ink">
                            {mockInquiryDetail.customer.customer_name}
                          </p>
                        </div>
                        {mockInquiryDetail.customer.customer_phone && (
                          <div>
                            <p className="text-xs text-muted mb-1">연락처</p>
                            <div className="flex items-center gap-2">
                              <Phone className="w-4 h-4 text-muted" />
                              <p className="text-sm text-ink">
                                {mockInquiryDetail.customer.customer_phone}
                              </p>
                            </div>
                          </div>
                        )}
                        {mockInquiryDetail.customer.customer_email && (
                          <div>
                            <p className="text-xs text-muted mb-1">이메일</p>
                            <div className="flex items-center gap-2">
                              <Mail className="w-4 h-4 text-muted" />
                              <p className="text-sm text-ink break-all">
                                {mockInquiryDetail.customer.customer_email}
                              </p>
                            </div>
                          </div>
                        )}
                        <div>
                          <p className="text-xs text-muted mb-1">고객 ID</p>
                          <p className="text-sm font-mono text-ink">
                            #{mockInquiryDetail.customer.customer_id}
                          </p>
                        </div>
                        <div className="pt-2 border-t border-line">
                          <Button
                            variant="outline"
                            size="sm"
                            icon={Link2}
                            className="w-full"
                          >
                            고객 상세보기
                          </Button>
                        </div>
                      </div>
                    </Card>

                    {/* 관련 주문 정보 */}
                    {(mockInquiryDetail.order_id ||
                      mockInquiryDetail.order_item_id) && (
                      <Card className="border border-line">
                        <div className="flex items-center gap-2 mb-4 pb-4 border-b border-line">
                          <Package className="w-5 h-5 text-accent" />
                          <h3 className="font-semibold text-ink">관련 정보</h3>
                        </div>
                        <div className="space-y-3">
                          {mockInquiryDetail.order_id && (
                            <div>
                              <p className="text-xs text-muted mb-1">
                                관련 주문
                              </p>
                              <p className="text-sm font-mono text-ink font-medium">
                                #{mockInquiryDetail.order_id}
                              </p>
                              <Button
                                variant="ghost"
                                size="sm"
                                icon={ExternalLink}
                                className="mt-2 text-xs"
                              >
                                주문 상세보기
                              </Button>
                            </div>
                          )}
                          {mockInquiryDetail.order_item_id && (
                            <div className={mockInquiryDetail.order_id ? "pt-3 border-t border-line" : ""}>
                              <p className="text-xs text-muted mb-1">
                                관련 구독
                              </p>
                              <p className="text-sm font-mono text-ink font-medium">
                                #{mockInquiryDetail.order_item_id}
                              </p>
                              <Button
                                variant="ghost"
                                size="sm"
                                icon={ExternalLink}
                                className="mt-2 text-xs"
                              >
                                구독 상세보기
                              </Button>
                            </div>
                          )}
                        </div>
                      </Card>
                    )}

                    {/* 상세 정보 */}
                    <Card className="border border-line">
                      <div className="flex items-center gap-2 mb-4 pb-4 border-b border-line">
                        <Clock className="w-5 h-5 text-muted" />
                        <h3 className="font-semibold text-ink text-sm">
                          상세 정보
                        </h3>
                      </div>
                      <div className="space-y-3 text-sm">
                        <div>
                          <p className="text-xs text-muted mb-1">수정일시</p>
                          <p className="text-ink">
                            {new Date(
                              mockInquiryDetail.updated_at
                            ).toLocaleString("ko-KR")}
                          </p>
                        </div>
                        {mockInquiryDetail.handled_at && (
                          <div>
                            <p className="text-xs text-muted mb-1">
                              처리 완료 일시
                            </p>
                            <p className="text-ink">
                              {new Date(
                                mockInquiryDetail.handled_at
                              ).toLocaleString("ko-KR")}
                            </p>
                          </div>
                        )}
                        {mockInquiryDetail.handled_by && (
                          <div>
                            <p className="text-xs text-muted mb-1">담당자 ID</p>
                            <p className="text-ink font-mono">
                              #{mockInquiryDetail.handled_by}
                            </p>
                          </div>
                        )}
                      </div>
                    </Card>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "history" && (
              <div className="space-y-4">
                {mockInquiryDetail.history.map((item) => (
                  <div
                    key={item.id}
                    className={`p-4 rounded-lg ${
                      item.type === "customer"
                        ? "bg-gray-100 mr-12"
                        : "bg-blue-100 ml-12"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-sm">{item.author}</span>
                      <span className="text-xs text-gray-500">
                        {item.createdAt}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700">{item.content}</p>
                  </div>
                ))}
              </div>
            )}

            {activeTab === "reply" && (
              <div className="grid grid-cols-3 gap-6">
                {/* 왼쪽: 문의 내용 (고정) */}
                <div className="col-span-1 space-y-4">
                  <Card className="border border-line sticky top-4">
                    <div className="flex items-center gap-2 mb-4 pb-4 border-b border-line">
                      <MessageSquare className="w-5 h-5 text-accent" />
                      <h3 className="font-semibold text-ink">문의 내용</h3>
                    </div>
                    <div className="space-y-4">
                      {/* 문의 기본 정보 */}
                      <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          {getStatusBadge(
                            mockInquiryDetail.inquiry_status === "RECEIVED"
                              ? "미처리"
                              : mockInquiryDetail.inquiry_status === "PROCESSING"
                              ? "처리중"
                              : "완료"
                          )}
                          {getChannelBadge(mockInquiryDetail.inquiry_type)}
                        </div>
                        <div>
                          <p className="text-xs text-muted mb-1">제목</p>
                          <p className="text-sm font-medium text-ink">
                            {mockInquiryDetail.title || "-"}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted mb-1">접수일시</p>
                          <p className="text-xs text-ink">
                            {new Date(
                              mockInquiryDetail.created_at
                            ).toLocaleString("ko-KR")}
                          </p>
                        </div>
                      </div>

                      {/* 고객 정보 요약 */}
                      <div className="border-t border-line pt-4">
                        <p className="text-xs text-muted mb-2">고객 정보</p>
                        <div className="space-y-1.5 text-sm">
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4 text-muted" />
                            <span className="text-ink">
                              {mockInquiryDetail.customer.customer_name}
                            </span>
                          </div>
                          {mockInquiryDetail.customer.customer_phone && (
                            <div className="flex items-center gap-2">
                              <Phone className="w-4 h-4 text-muted" />
                              <span className="text-ink">
                                {mockInquiryDetail.customer.customer_phone}
                              </span>
                            </div>
                          )}
                          {mockInquiryDetail.customer.customer_email && (
                            <div className="flex items-center gap-2">
                              <Mail className="w-4 h-4 text-muted" />
                              <span className="text-ink text-xs break-all">
                                {mockInquiryDetail.customer.customer_email}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* 관련 정보 */}
                      {(mockInquiryDetail.order_id ||
                        mockInquiryDetail.order_item_id) && (
                        <div className="border-t border-line pt-4">
                          <p className="text-xs text-muted mb-2">관련 정보</p>
                          <div className="space-y-1.5 text-sm">
                            {mockInquiryDetail.order_id && (
                              <div className="flex items-center gap-2">
                                <Package className="w-4 h-4 text-muted" />
                                <span className="text-ink font-mono">
                                  주문 #{mockInquiryDetail.order_id}
                                </span>
                              </div>
                            )}
                            {mockInquiryDetail.order_item_id && (
                              <div className="flex items-center gap-2">
                                <Package className="w-4 h-4 text-muted" />
                                <span className="text-ink font-mono">
                                  구독 #{mockInquiryDetail.order_item_id}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* 문의 내용 */}
                      <div className="border-t border-line pt-4">
                        <p className="text-xs text-muted mb-2">문의 내용</p>
                        <div className="bg-paper rounded-lg p-3 max-h-64 overflow-y-auto">
                          <p className="text-sm text-ink whitespace-pre-wrap leading-relaxed">
                            {mockInquiryDetail.content || "-"}
                          </p>
                        </div>
                      </div>

                      {/* 기존 답변 (있는 경우) */}
                      {mockInquiryDetail.answer && (
                        <div className="border-t border-line pt-4">
                          <div className="flex items-center gap-2 mb-2">
                            <CheckCircle className="w-4 h-4 text-success-600" />
                            <p className="text-xs text-muted">기존 답변</p>
                          </div>
                          <div className="bg-success-50/30 rounded-lg p-3 max-h-48 overflow-y-auto">
                            <p className="text-sm text-ink whitespace-pre-wrap leading-relaxed">
                              {mockInquiryDetail.answer}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </Card>
                </div>

                {/* 오른쪽: 답변 작성 영역 */}
                <div className="col-span-2 space-y-4">
                  {/* 답변 전송 채널 선택 */}
                  <Card className="border border-line bg-accent-50/30">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Send className="w-4 h-4 text-accent" />
                        <label className="block text-sm font-semibold text-ink">
                          답변 전송 채널
                        </label>
                      </div>
                      <span className="text-xs text-muted">
                        {replyChannels.size}개 채널 선택됨
                      </span>
                    </div>
                    <div className="grid grid-cols-4 gap-3">
                      {/* 문자 (SMS) */}
                      <button
                        onClick={() => {
                          const newChannels = new Set(replyChannels);
                          if (newChannels.has("sms")) {
                            newChannels.delete("sms");
                          } else {
                            newChannels.add("sms");
                          }
                          setReplyChannels(newChannels);
                        }}
                        className={`p-3 text-left border rounded-lg text-sm transition-all ${
                          replyChannels.has("sms")
                            ? "border-accent bg-white shadow-sm"
                            : "border-line hover:border-accent/50 hover:bg-white"
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <input
                            type="checkbox"
                            checked={replyChannels.has("sms")}
                            onChange={() => {}}
                            className="w-4 h-4 text-accent border-line rounded focus:ring-accent"
                          />
                          <Phone className="w-4 h-4 text-muted" />
                          <span className="font-medium text-ink">문자 (SMS)</span>
                        </div>
                        <p className="text-xs text-muted mt-1">
                          {mockInquiryDetail.customer.customer_phone || "연락처 없음"}
                        </p>
                      </button>

                      {/* 이메일 */}
                      <button
                        onClick={() => {
                          const newChannels = new Set(replyChannels);
                          if (newChannels.has("email")) {
                            newChannels.delete("email");
                          } else {
                            newChannels.add("email");
                          }
                          setReplyChannels(newChannels);
                        }}
                        className={`p-3 text-left border rounded-lg text-sm transition-all ${
                          replyChannels.has("email")
                            ? "border-accent bg-white shadow-sm"
                            : "border-line hover:border-accent/50 hover:bg-white"
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <input
                            type="checkbox"
                            checked={replyChannels.has("email")}
                            onChange={() => {}}
                            className="w-4 h-4 text-accent border-line rounded focus:ring-accent"
                          />
                          <Mail className="w-4 h-4 text-muted" />
                          <span className="font-medium text-ink">이메일</span>
                        </div>
                        <p className="text-xs text-muted mt-1 break-all">
                          {mockInquiryDetail.customer.customer_email || "이메일 없음"}
                        </p>
                      </button>

                      {/* 채널톡 (문의 채널이 채널톡인 경우만 표시) */}
                      {mockInquiryDetail.inquiry_type === "채널톡" && (
                        <button
                          onClick={() => {
                            const newChannels = new Set(replyChannels);
                            if (newChannels.has("channeltalk")) {
                              newChannels.delete("channeltalk");
                            } else {
                              newChannels.add("channeltalk");
                            }
                            setReplyChannels(newChannels);
                          }}
                          className={`p-3 text-left border rounded-lg text-sm transition-all ${
                            replyChannels.has("channeltalk")
                              ? "border-accent bg-white shadow-sm"
                              : "border-line hover:border-accent/50 hover:bg-white"
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <input
                              type="checkbox"
                              checked={replyChannels.has("channeltalk")}
                              onChange={() => {}}
                              className="w-4 h-4 text-accent border-line rounded focus:ring-accent"
                            />
                            <MessageSquare className="w-4 h-4 text-muted" />
                            <span className="font-medium text-ink">채널톡</span>
                          </div>
                          <p className="text-xs text-muted mt-1">
                            동일 채널로 답변
                          </p>
                        </button>
                      )}

                      {/* Cafe24 (문의 채널이 Cafe24인 경우만 표시) */}
                      {mockInquiryDetail.inquiry_type === "Cafe24" && (
                        <button
                          onClick={() => {
                            const newChannels = new Set(replyChannels);
                            if (newChannels.has("cafe24")) {
                              newChannels.delete("cafe24");
                            } else {
                              newChannels.add("cafe24");
                            }
                            setReplyChannels(newChannels);
                          }}
                          className={`p-3 text-left border rounded-lg text-sm transition-all ${
                            replyChannels.has("cafe24")
                              ? "border-accent bg-white shadow-sm"
                              : "border-line hover:border-accent/50 hover:bg-white"
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <input
                              type="checkbox"
                              checked={replyChannels.has("cafe24")}
                              onChange={() => {}}
                              className="w-4 h-4 text-accent border-line rounded focus:ring-accent"
                            />
                            <Package className="w-4 h-4 text-muted" />
                            <span className="font-medium text-ink">Cafe24</span>
                          </div>
                          <p className="text-xs text-muted mt-1">
                            동일 채널로 답변
                          </p>
                        </button>
                      )}
                    </div>
                    {replyChannels.size === 0 && (
                      <p className="text-xs text-error mt-2">
                        ⚠️ 최소 1개 이상의 채널을 선택해주세요.
                      </p>
                    )}
                  </Card>

                  {/* 답변 템플릿 */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <label className="block text-sm font-semibold text-ink">
                        답변 템플릿
                      </label>
                      <span className="text-xs text-muted">
                        {templates.length}개 템플릿
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      {templates.map((template) => (
                        <button
                          key={template.id}
                          onClick={() => handleSelectTemplate(template.id)}
                          className={`p-3 text-left border rounded-lg text-sm transition-all ${
                            selectedTemplate === template.id
                              ? "border-accent bg-accent-50 shadow-sm"
                              : "border-line hover:border-accent/50 hover:bg-paper"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <FileText
                              className={`w-4 h-4 ${
                                selectedTemplate === template.id
                                  ? "text-accent"
                                  : "text-muted"
                              }`}
                            />
                            <span
                              className={`font-medium ${
                                selectedTemplate === template.id
                                  ? "text-accent"
                                  : "text-ink"
                              }`}
                            >
                              {template.title}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 답변 내용 입력 */}
                  <div>
                    <Textarea
                      label="답변 내용"
                      value={replyContent}
                      onChange={(e) => setReplyContent(e.target.value)}
                      placeholder="문의 내용을 참고하여 답변을 작성하세요..."
                      rows={12}
                      className="font-mono text-sm"
                    />
                    <div className="flex items-center justify-between mt-2">
                      <p className="text-xs text-muted">
                        {replyContent.length}자 작성됨
                      </p>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          onClick={() => setReplyContent("")}
                          disabled={!replyContent}
                        >
                          초기화
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* 액션 버튼 */}
                  <div className="flex justify-end gap-3 pt-4 border-t border-line">
                    <Button
                      variant="ghost"
                      onClick={() => {
                        // 임시저장 로직
                        console.log("임시저장", replyContent);
                      }}
                      disabled={!replyContent}
                    >
                      임시저장
                    </Button>
                    <Button
                      variant="primary"
                      icon={Send}
                      onClick={() => {
                        // 답변 전송 로직
                        console.log("답변 전송", {
                          content: replyContent,
                          channels: Array.from(replyChannels),
                        });
                      }}
                      disabled={!replyContent.trim() || replyChannels.size === 0}
                    >
                      답변 전송 ({replyChannels.size}개 채널)
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </Modal>

        {/* 문의 등록 모달 */}
        <Modal
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          title="문의 등록"
          size="lg"
          footer={
            <>
              <Button variant="ghost" onClick={() => setIsAddModalOpen(false)}>
                취소
              </Button>
              <Button onClick={() => setIsAddModalOpen(false)}>등록</Button>
            </>
          }
        >
          <div className="space-y-4">
            {/* 고객 정보 */}
            <div className="grid grid-cols-2 gap-4">
              <Input label="고객명" placeholder="고객 이름" required />
              <Input label="연락처" placeholder="010-0000-0000" />
            </div>
            <Input
              label="이메일"
              type="email"
              placeholder="example@email.com"
            />

            {/* 문의 정보 */}
            <div className="grid grid-cols-2 gap-4">
              <Select
                label="접수 채널"
                options={[
                  { value: "channeltalk", label: "채널톡" },
                  { value: "cafe24", label: "Cafe24" },
                  { value: "godpeople", label: "갓피플몰" },
                  { value: "phone", label: "전화" },
                  { value: "email", label: "이메일" },
                ]}
                placeholder="채널 선택"
                required
              />
              <Select
                label="문의 유형"
                options={[
                  { value: "order", label: "주문문의" },
                  { value: "shipping", label: "배송문의" },
                  { value: "subscription", label: "구독문의" },
                  { value: "product", label: "상품문의" },
                  { value: "refund", label: "환불/취소" },
                  { value: "etc", label: "기타" },
                ]}
                placeholder="유형 선택"
                required
              />
            </div>

            <Input
              label="문의 제목"
              placeholder="문의 제목을 입력하세요"
              required
            />

            <Textarea
              label="문의 내용"
              placeholder="문의 내용을 입력하세요"
              rows={5}
              required
            />

            <Input label="관련 주문번호" placeholder="ORD-XXXX-XXXXX (선택)" />

            <Select
              label="담당자 지정"
              options={[
                { value: "admin", label: "관리자" },
                { value: "manager", label: "매니저" },
              ]}
              placeholder="담당자 선택 (선택)"
            />
          </div>
        </Modal>
      </div>
    </div>
  );
};

export default SupportListPage;
