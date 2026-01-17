import React, { useState } from "react";
import { Plus, Download, Edit, Trash2, PlayCircle } from "lucide-react";
import PageHeader from "../components/common/PageHeader";
import SearchFilter from "../components/common/SearchFilter";
import Table from "../components/common/Table";
import Pagination from "../components/common/Pagination";
import Card from "../components/common/Card";
import Button from "../components/common/Button";
import Badge from "../components/common/Badge";
import Modal from "../components/common/Modal";
import Select from "../components/common/Select";
import Input from "../components/common/Input";
import Breadcrumb from "../components/common/Breadcrumb";

// 목업 데이터
const mockPauses = [
  {
    id: 1,
    customerName: "이영희",
    customerPhone: "010-2345-6789",
    product: "꿀땅",
    startIssue: "2024년 11월호",
    endIssue: "2024년 12월호",
    status: "휴지중",
    reason: "해외 출장",
    requestDate: "2024-10-15",
    adminName: "관리자",
  },
];

interface Pause {
  id: number;
  customerName: string;
  customerPhone: string;
  product: string;
  startIssue: string;
  endIssue: string;
  status: string;
  reason: string;
  requestDate: string;
  adminName: string;
}

const PauseManagementPage: React.FC = () => {
  const [searchValue, setSearchValue] = useState("");
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedPause, setSelectedPause] = useState<Pause | null>(null);

  const handleFilterChange = (key: string, value: string) => {
    setFilterValues((prev) => ({ ...prev, [key]: value }));
  };

  const handleReset = () => {
    setFilterValues({});
    setSearchValue("");
  };

  const handleEdit = (pause: Pause) => {
    setSelectedPause(pause);
    setIsEditModalOpen(true);
  };

  const handleDelete = (pause: Pause) => {
    setSelectedPause(pause);
    setIsDeleteModalOpen(true);
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<
      string,
      { variant: "warning" | "info" | "gray"; label: string }
    > = {
      휴지예정: { variant: "info", label: "휴지예정" },
      휴지중: { variant: "warning", label: "휴지중" },
      휴지종료: { variant: "gray", label: "휴지종료" },
    };
    const config = statusMap[status] || { variant: "gray", label: status };
    return (
      <Badge variant={config.variant} dot>
        {config.label}
      </Badge>
    );
  };

  const columns = [
    {
      key: "customerName",
      header: "고객명",
      render: (_value: any, item: Pause) => (
        <span className="font-medium text-gray-900">{item.customerName}</span>
      ),
    },
    {
      key: "product",
      header: "상품명",
      render: (_value: any, item: Pause) => (
        <Badge variant="info">{item.product}</Badge>
      ),
    },
    {
      key: "period",
      header: "휴지기간",
      render: (_value: any, item: Pause) => (
        <span className="text-sm text-gray-600">
          {item.startIssue} ~ {item.endIssue}
        </span>
      ),
    },
    {
      key: "reason",
      header: "휴지사유",
    },
    {
      key: "requestDate",
      header: "신청일",
    },
    {
      key: "adminName",
      header: "처리관리자",
    },
    {
      key: "status",
      header: "상태",
      render: (_value: any, item: Pause) => getStatusBadge(item.status),
    },
    {
      key: "actions",
      header: "수정/삭제",
      render: (_value: any, item: Pause) => (
        <div className="flex gap-1">
          {item.status !== "휴지종료" && (
            <>
              <Button
                variant="ghost"
                size="sm"
                icon={Edit}
                onClick={(e) => {
                  e.stopPropagation();
                  handleEdit(item);
                }}
              >
                수정
              </Button>
              <Button
                variant="ghost"
                size="sm"
                icon={Trash2}
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(item);
                }}
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                취소
              </Button>
            </>
          )}
          {item.status === "휴지중" && (
            <Button
              variant="ghost"
              size="sm"
              icon={PlayCircle}
              onClick={(e) => {
                e.stopPropagation();
              }}
              className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
            >
              재개
            </Button>
          )}
        </div>
      ),
    },
  ];

  const filters = [
    {
      key: "status",
      label: "휴지 상태",
      type: "select" as const,
      options: [
        { value: "upcoming", label: "휴지 예정" },
        { value: "active", label: "휴지 중" },
        { value: "ended", label: "휴지 종료" },
      ],
    },
    {
      key: "product",
      label: "상품별",
      type: "select" as const,
      options: [
        { value: "malssum", label: "말씀함께" },
        { value: "kkultang", label: "꿀땅" },
      ],
    },
  ];

  return (
    <div className="min-h-screen">
      <div className="max-w-[1600px] mx-auto px-6 py-6">
        <Breadcrumb
          items={[
            { label: "구독 관리", path: "/subscription/list" },
            { label: "휴지 관리" },
          ]}
        />
      <PageHeader
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" icon={Download}>
              엑셀 다운로드
            </Button>
            <Button icon={Plus} onClick={() => setIsAddModalOpen(true)}>
              휴지 신청
            </Button>
          </div>
        }
        onRefresh={() => {}}
      />

      <SearchFilter
        searchPlaceholder="고객명, 연락처로 검색"
        searchValue={searchValue}
        onSearchChange={setSearchValue}
        filters={filters}
        filterValues={filterValues}
        onFilterChange={handleFilterChange}
        onReset={handleReset}
        onApply={() => {}}
      />

      <Card padding="none">
        <Table
          columns={columns}
          data={mockPauses}
          keyExtractor={(item) => item.id}
        />
        <div className="px-4 border-t border-gray-100">
          <Pagination
            currentPage={currentPage}
            totalPages={3}
            onPageChange={setCurrentPage}
            pageSize={pageSize}
            onPageSizeChange={setPageSize}
            totalItems={25}
          />
        </div>
      </Card>

      {/* 휴지 신청 모달 */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="휴지 신청"
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setIsAddModalOpen(false)}>
              취소
            </Button>
            <Button onClick={() => setIsAddModalOpen(false)}>휴지 신청</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="p-4 bg-blue-50 rounded-lg text-sm text-blue-700">
            휴지 기간 동안 발송이 중단되며, 구독 종료일이 휴지 기간만큼
            연장됩니다.
          </div>
          <Input
            label="고객 검색"
            placeholder="고객명 또는 연락처로 검색"
            required
          />
          <Select
            label="구독 상품 선택"
            options={[]}
            placeholder="고객 검색 후 선택 가능"
            disabled
          />
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="휴지 시작 호수"
              options={[
                { value: "2025-01", label: "2025년 1월호" },
                { value: "2025-02", label: "2025년 2월호" },
                { value: "2025-03", label: "2025년 3월호" },
              ]}
              placeholder="선택하세요"
              required
            />
            <Select
              label="휴지 종료 호수"
              options={[
                { value: "2025-01", label: "2025년 1월호" },
                { value: "2025-02", label: "2025년 2월호" },
                { value: "2025-03", label: "2025년 3월호" },
              ]}
              placeholder="선택하세요"
              required
            />
          </div>
          <Input label="휴지 사유" placeholder="휴지 사유를 입력하세요" />
        </div>
      </Modal>

      {/* 휴지 수정 모달 */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="휴지 수정"
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setIsEditModalOpen(false)}>
              취소
            </Button>
            <Button onClick={() => setIsEditModalOpen(false)}>저장</Button>
          </>
        }
      >
        {selectedPause && (
          <div className="space-y-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="text-sm">
                <span className="text-gray-500">고객:</span>{" "}
                <span className="font-medium">
                  {selectedPause.customerName}
                </span>
              </div>
              <div className="text-sm">
                <span className="text-gray-500">상품:</span>{" "}
                <span className="font-medium">{selectedPause.product}</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Select
                label="휴지 시작 호수"
                options={[
                  { value: "2024-11", label: "2024년 11월호" },
                  { value: "2024-12", label: "2024년 12월호" },
                  { value: "2025-01", label: "2025년 1월호" },
                  { value: "2025-02", label: "2025년 2월호" },
                ]}
                value="2024-11"
              />
              <Select
                label="휴지 종료 호수"
                options={[
                  { value: "2024-11", label: "2024년 11월호" },
                  { value: "2024-12", label: "2024년 12월호" },
                  { value: "2025-01", label: "2025년 1월호" },
                  { value: "2025-02", label: "2025년 2월호" },
                ]}
                value="2024-12"
              />
            </div>
            <Input label="휴지 사유" defaultValue={selectedPause.reason} />
          </div>
        )}
      </Modal>

      {/* 휴지 취소 확인 모달 */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="휴지 취소 확인"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setIsDeleteModalOpen(false)}>
              닫기
            </Button>
            <Button
              variant="danger"
              onClick={() => setIsDeleteModalOpen(false)}
            >
              휴지 취소
            </Button>
          </>
        }
      >
        <div className="text-center py-4">
          <p className="text-gray-600">
            정말로 이 휴지 신청을 취소하시겠습니까?
          </p>
          {selectedPause && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg text-sm text-left">
              <p>
                <span className="text-gray-500">고객:</span>{" "}
                {selectedPause.customerName}
              </p>
              <p>
                <span className="text-gray-500">상품:</span>{" "}
                {selectedPause.product}
              </p>
              <p>
                <span className="text-gray-500">기간:</span>{" "}
                {selectedPause.startIssue} ~ {selectedPause.endIssue}
              </p>
            </div>
          )}
        </div>
      </Modal>
      </div>
    </div>
  );
};

export default PauseManagementPage;
