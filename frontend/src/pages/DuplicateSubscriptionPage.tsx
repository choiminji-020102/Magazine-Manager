import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import Table from "../components/common/Table";
import Pagination from "../components/common/Pagination";
import Card from "../components/common/Card";
import Button from "../components/common/Button";
import Badge from "../components/common/Badge";
import Modal from "../components/common/Modal";
import SearchFilter from "../components/common/SearchFilter";
import Breadcrumb from "../components/common/Breadcrumb";

interface Subscription {
  id: number;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  product: string;
  startIssue: string;
  endIssue: string;
  status: string;
  remainingMonths: number;
  hasDuplicate?: boolean;
  duplicateInfo?: string;
}

// 목업 데이터 - 중복 구독만
const mockDuplicateSubscriptions: Subscription[] = [
  {
    id: 2,
    customerName: "이영희",
    customerPhone: "010-2345-6789",
    customerEmail: "younghee.lee@example.com",
    product: "말씀함께",
    startIssue: "2024년 6월호",
    endIssue: "2025년 5월호",
    status: "활성",
    remainingMonths: 6,
    hasDuplicate: true,
    duplicateInfo: "2025년 1월호부터 12개월 추가 구독 존재",
  },
];

const DuplicateSubscriptionPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchValue, setSearchValue] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10);
  const [selectedSubscription, setSelectedSubscription] = useState<Subscription | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  const handleViewDetail = (subscription: Subscription) => {
    setSelectedSubscription(subscription);
    setIsDetailModalOpen(true);
  };

  const columns = [
    {
      key: "customerName",
      header: "고객명",
      render: (_value: any, item: Subscription) => (
        <span className="font-medium">{item.customerName}</span>
      ),
    },
    {
      key: "customerPhone",
      header: "연락처",
    },
    {
      key: "product",
      header: "상품",
      render: (_value: any, item: Subscription) => (
        <Badge variant="info">{item.product}</Badge>
      ),
    },
    {
      key: "startIssue",
      header: "시작 호",
    },
    {
      key: "endIssue",
      header: "종료 호",
    },
    {
      key: "duplicateInfo",
      header: "중복 정보",
      render: (_value: any, item: Subscription) => (
        <span className="text-sm text-warning-600">{item.duplicateInfo}</span>
      ),
    },
    {
      key: "status",
      header: "상태",
      render: (_value: any, item: Subscription) => (
        <Badge variant={item.status === "활성" ? "success" : "default"} dot>
          {item.status}
        </Badge>
      ),
    },
  ];

  const filteredSubscriptions = mockDuplicateSubscriptions.filter((sub) => {
    if (searchValue) {
      const search = searchValue.toLowerCase();
      return (
        sub.customerName.toLowerCase().includes(search) ||
        sub.customerPhone.includes(search) ||
        sub.customerEmail.toLowerCase().includes(search) ||
        sub.product.toLowerCase().includes(search)
      );
    }
    return true;
  });

  const totalPages = Math.ceil(filteredSubscriptions.length / pageSize);
  const paginatedSubscriptions = filteredSubscriptions.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  return (
    <div className="min-h-screen">
      <div className="max-w-[1600px] mx-auto px-6 py-6">
        <Breadcrumb
          items={[
            { label: "구독 관리", path: "/subscription/list" },
            { label: "중복 구독" },
          ]}
        />
        {/* 헤더 */}
        <div className="mb-8 anim-rise">
          <div className="flex items-start justify-between">
            <div>
            </div>
            <div className="flex items-center gap-2">
            </div>
          </div>
        </div>

        {/* 검색 및 필터 */}
        <SearchFilter
          searchPlaceholder="고객명, 연락처, 상품명으로 검색"
          searchValue={searchValue}
          onSearchChange={setSearchValue}
          filters={[]}
          onReset={() => setSearchValue("")}
          collapsible={false}
          className="mb-6"
        />

        {/* 테이블 */}
        <Card className="unified-card" padding="none">
          <Table
            columns={columns}
            data={paginatedSubscriptions}
            keyExtractor={(item) => String(item.id)}
            onRowClick={handleViewDetail}
            hoverable
          />
          <div className="px-4 border-t border-line">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              pageSize={pageSize}
              onPageSizeChange={() => {}}
              totalItems={filteredSubscriptions.length}
            />
          </div>
        </Card>

        {/* 상세 모달 */}
        <Modal
          isOpen={isDetailModalOpen}
          onClose={() => setIsDetailModalOpen(false)}
          title={`중복 구독 상세 - ${selectedSubscription?.customerName}`}
          size="xl"
        >
          {selectedSubscription && (
            <div className="space-y-4">
              <div className="p-4 bg-warning-50 border border-warning-200 rounded-lg">
                <p className="font-semibold text-warning-800 mb-1">
                  중복 구독 감지됨
                </p>
                <p className="text-sm text-warning-700">
                  {selectedSubscription.duplicateInfo}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted">고객명</label>
                  <p className="text-ink">{selectedSubscription.customerName}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted">연락처</label>
                  <p className="text-ink">{selectedSubscription.customerPhone}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted">상품</label>
                  <p className="text-ink">{selectedSubscription.product}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted">구간</label>
                  <p className="text-ink">
                    {selectedSubscription.startIssue} ~ {selectedSubscription.endIssue}
                  </p>
                </div>
              </div>
            </div>
          )}
        </Modal>
      </div>
    </div>
  );
};

export default DuplicateSubscriptionPage;
