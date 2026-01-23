import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import * as XLSX from "xlsx";
import {
  Download,
  RefreshCw,
  Mail,
  Plus,
} from "lucide-react";
import Button from "../components/common/Button";
import SlidePanel from "../components/common/SlidePanel";
import Input from "../components/common/Input";
import Textarea from "../components/common/Textarea";
import Breadcrumb from "../components/common/Breadcrumb";
import SearchFilterBar, {
  FilterField,
  SortOption,
  ActiveFilter,
} from "../components/common/SearchFilterBar";
import ListPage from "../components/common/ListPage";
import Modal from "../components/common/Modal";
import Tabs from "../components/common/Tabs";
import { Edit, Save } from "lucide-react";
import { Customer, customerAPI } from "../api/customersApi";
import { createCustomerColumns } from "../components/customer/CustomerColumns";
import CustomerInfoTab from "../components/customer/CustomerInfoTab";
import CustomerOrdersTab from "../components/customer/CustomerOrdersTab";
import CustomerSubscriptionsTab from "../components/customer/CustomerSubscriptionsTab";
import CustomerSendsTab from "../components/customer/CustomerSendsTab";
import CustomerMemosTab from "../components/customer/CustomerMemosTab";
import CustomerInquiriesTab from "../components/customer/CustomerInquiriesTab";
import OrderDetailPanel from "../components/customer/OrderDetailPanel";
import SubscriptionDetailPanel from "../components/customer/SubscriptionDetailPanel";
import SendDetailPanel from "../components/customer/SendDetailPanel";

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

  // 페이지네이션
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);
  const [sortKey, setSortKey] = useState("created_at");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [totalCustomers, setTotalCustomers] = useState(0);

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
  const [orders, setOrders] = useState<Order[]>([]);
  const [orderItems] = useState<OrderItem[]>([]);
  const [sends] = useState<Send[]>([]);
  const [sendItems] = useState<SendItem[]>([]);
  const [addresses] = useState<Address[]>([]);

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

  // 필터/검색어 변경 시 페이지를 1로 리셋
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, sourceFilter, dateFilter.start, dateFilter.end, sortKey, sortDirection]);

  useEffect(() => {
    fetchCustomers();
  }, [currentPage, sortKey, sortDirection, searchTerm, sourceFilter, dateFilter]);

  // 필터 필드 정의
  const filterFields: FilterField[] = [
    {
      key: "channel",
      label: "유입경로",
      type: "select",
      options: SOURCE_OPTIONS.map((source) => ({
        value: source,
        label:
          source === "CAFE24"
            ? "Cafe24"
            : source === "GPMALL"
            ? "갓피플몰"
            : source,
      })),
    },
    {
      key: "created_at",
      label: "가입일",
      type: "dateRange",
    },
  ];

  // 정렬 옵션 정의
  const sortOptions: SortOption[] = [
    { key: "last_order_at", direction: "desc", label: "최근 주문일 최신순" },
    { key: "last_order_at", direction: "asc", label: "최근 주문일 오래된순" },
    { key: "created_at", direction: "desc", label: "가입일 최신순" },
    { key: "created_at", direction: "asc", label: "가입일 오래된순" },
    { key: "customer_name", direction: "asc", label: "이름 가나다순" },
    { key: "customer_name", direction: "desc", label: "이름 역순" },
  ];

  // 활성 필터 태그
  const activeFilters: ActiveFilter[] = [
    ...(sourceFilter
      ? [
          {
            key: "channel",
            label: "유입경로",
            value:
              sourceFilter === "CAFE24"
                ? "Cafe24"
                : sourceFilter === "GPMALL"
                ? "갓피플몰"
                : sourceFilter,
            onRemove: () => setSourceFilter(""),
          },
        ]
      : []),
    ...(dateFilter.start || dateFilter.end
      ? [
          {
            key: "created_at",
            label: "가입일",
            value: `${dateFilter.start || "이전"} ~ ${dateFilter.end || "이후"}`,
            onRemove: () => setDateFilter({ start: "", end: "" }),
          },
        ]
      : []),
  ];

  const fetchCustomers = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {
        page: currentPage,
        limit: itemsPerPage,
        search: searchTerm || null,
        channel: sourceFilter || null,
        sort: sortKey,
        order: sortDirection.toUpperCase() as "ASC" | "DESC",
      };

      // 날짜 필터가 있으면 검색어에 포함 (백엔드에서 지원하는 경우)
      // 현재는 클라이언트 사이드 필터링으로 처리
      const response = await customerAPI.getAll(params);
      setCustomers(response.data);
      setTotalCustomers(response.pagination.total);
    } catch (err: any) {
      setError(err?.message || "고객 목록을 불러오는데 실패했습니다.");
      setCustomers([]);
      setTotalCustomers(0);
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
        new Set(paginatedCustomers.map((c) => String(c.customer_id)))
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

  const handleViewDetail = async (customer: Customer) => {
    setSelectedCustomer(customer);
    setEditForm(customer);
    setIsEditMode(false);
    setIsDetailModalOpen(true);
    setDetailTab("info");
    
    // 고객의 주문 목록 가져오기
    try {
      const customerOrders = await customerAPI.getOrders(customer.customer_id);
      setOrders(customerOrders as Order[]);
    } catch (err: any) {
      console.error("주문 목록을 불러오는데 실패했습니다:", err);
      setOrders([]);
    }
  };

  const handleAddCustomer = async () => {
    if (!newCustomer.customer_name || !newCustomer.customer_phone) {
      alert("이름과 연락처는 필수입니다.");
      return;
    }

    try {
      await customerAPI.create({
      customer_name: newCustomer.customer_name,
      customer_phone: newCustomer.customer_phone,
      customer_email: newCustomer.customer_email || null,
        create_channel: newCustomer.create_channel as "CAFE24" | "GPMALL" | "OFFLINE",
      admin_memo: newCustomer.admin_memo || null,
      });
    setIsAddModalOpen(false);
    setNewCustomer({
      customer_name: "",
      customer_phone: "",
      customer_email: null,
      create_channel: "CAFE24",
      admin_memo: null,
    });
      // 고객 목록 새로고침
      await fetchCustomers();
      alert("고객이 등록되었습니다.");
    } catch (err: any) {
      alert(err?.message || "고객 등록에 실패했습니다.");
    }
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
  const handleSaveCustomerInfo = async () => {
    if (
      !selectedCustomer ||
      !editForm.customer_name ||
      !editForm.customer_phone
    ) {
      alert("이름과 연락처는 필수입니다.");
      return;
    }

    try {
      const updatedCustomer = await customerAPI.update(
        selectedCustomer.customer_id,
        {
          customer_name: editForm.customer_name || null,
          customer_phone: editForm.customer_phone || null,
          customer_email: editForm.customer_email !== undefined ? editForm.customer_email : null,
          admin_memo: editForm.admin_memo !== undefined ? editForm.admin_memo : null,
        }
      );

    setCustomers(
      customers.map((c) =>
        c.customer_id === selectedCustomer.customer_id ? updatedCustomer : c
      )
    );
    setSelectedCustomer(updatedCustomer);
    setEditForm(updatedCustomer);
    setIsEditMode(false);
    alert("고객 정보가 수정되었습니다.");
    } catch (err: any) {
      alert(err?.message || "고객 정보 수정에 실패했습니다.");
    }
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

  const columns = createCustomerColumns({
    selectedCustomers,
    onSelectCustomer: handleSelectCustomer,
  });

  // 필터링 (날짜 필터만 클라이언트 사이드에서 처리)
  const filteredCustomers = customers.filter((customer) => {
      if (dateFilter.start) {
        const joinDate = new Date(customer.created_at);
        const startDate = new Date(dateFilter.start);
        if (joinDate < startDate) return false;
      }
      if (dateFilter.end) {
        const joinDate = new Date(customer.created_at);
        const endDate = new Date(dateFilter.end);
      endDate.setHours(23, 59, 59, 999); // 종료일의 끝까지 포함
        if (joinDate > endDate) return false;
      }
      return true;
  });

  const totalPages = Math.ceil(totalCustomers / itemsPerPage);
  const paginatedCustomers = filteredCustomers;

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
        <SearchFilterBar
          searchValue={searchTerm}
          onSearchChange={setSearchTerm}
          searchPlaceholder="고객 이름을 검색해보세요"
          showFilters={showFilters}
          onToggleFilters={() => setShowFilters(!showFilters)}
          filterFields={filterFields}
          filterValues={{
            channel: sourceFilter,
            created_at_start: dateFilter.start,
            created_at_end: dateFilter.end,
          }}
          onFilterChange={(key, value) => {
            if (key === "channel") {
              setSourceFilter(value);
            } else if (key === "created_at_start") {
              setDateFilter({ ...dateFilter, start: value });
            } else if (key === "created_at_end") {
              setDateFilter({ ...dateFilter, end: value });
            }
          }}
          activeFilters={activeFilters}
          sortOptions={sortOptions}
          currentSort={{ key: sortKey, direction: sortDirection }}
          onSortChange={handleSort}
          onReset={() => {
                      setSearchTerm("");
                      setSourceFilter("");
                      setDateFilter({ start: "", end: "" });
                    }}
          hasActiveFilters={
            !!(
              searchTerm ||
              sourceFilter ||
              dateFilter.start ||
              dateFilter.end
            )
          }
        />

        {/* 목록 */}
        <ListPage
                data={paginatedCustomers}
          columns={columns}
                keyExtractor={(row) => String(row.customer_id)}
          emptyMessage="고객 정보가 없습니다"
          selectable
          selectedItems={new Set(
            Array.from(selectedCustomers).map((id) => String(id))
          )}
          onSelectAll={handleSelectAll}
          onSelectItem={(id, checked) =>
            handleSelectCustomer(String(id), checked)
          }
          allSelected={
            paginatedCustomers.length > 0 &&
            paginatedCustomers.every((c) =>
              selectedCustomers.has(String(c.customer_id))
            )
          }
                onSort={handleSort}
                sortKey={sortKey}
                sortDirection={sortDirection}
                onRowClick={handleViewDetail}
          hoverable
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={setCurrentPage}
          totalItems={totalCustomers}
          itemsPerPage={itemsPerPage}
          batchActions={[
            {
              label: "이메일 발송",
              icon: Mail,
              onClick: handleSendEmail,
            },
            {
              label: "엑셀 다운로드",
              icon: Download,
              onClick: () => handleExportExcel(true),
            },
          ]}
          loading={loading}
          error={error}
          onRetry={fetchCustomers}
        />

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
                <CustomerInfoTab
                  customer={selectedCustomer}
                  isEditMode={isEditMode}
                  editForm={editForm}
                  onEditFormChange={setEditForm}
                />
              )}

              {detailTab === "orders" && (
                <CustomerOrdersTab
                  orders={getCustomerOrders()}
                  onOrderClick={handleViewOrderDetail}
                />
              )}

              {detailTab === "subscriptions" && (
                <CustomerSubscriptionsTab
                  subscriptions={getCustomerSubscriptions()}
                  onSubscriptionClick={handleViewSubscriptionDetail}
                />
              )}

              {detailTab === "sends" && (
                <CustomerSendsTab
                  sends={getCustomerSends()}
                  onSendClick={handleViewSendDetail}
                />
              )}

              {detailTab === "inquiries" && <CustomerInquiriesTab />}

              {detailTab === "memos" && (
                <CustomerMemosTab
                  customer={selectedCustomer}
                  newMemo={newMemo}
                  onNewMemoChange={setNewMemo}
                  onCustomerUpdate={(updated) => {
                    setSelectedCustomer(updated);
                    setEditForm(updated);
                  }}
                />
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
            <OrderDetailPanel
              order={selectedOrder}
              orderItems={orderItems}
              getAddressById={getAddressById}
            />
          )}

          {detailPanelType === "subscription" && selectedOrderItem && (
            <SubscriptionDetailPanel
              orderItem={selectedOrderItem}
              getAddressById={getAddressById}
            />
          )}

          {detailPanelType === "send" && selectedSend && (
            <SendDetailPanel
              send={selectedSend}
              sendItems={getSendItemsBySendId(selectedSend.send_id)}
              getOrderItemById={getOrderItemById}
            />
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
