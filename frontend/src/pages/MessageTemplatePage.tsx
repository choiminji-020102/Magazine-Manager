import React, { useState, useRef, useEffect } from "react";
import * as XLSX from "xlsx";
import {
  MessageSquare,
  Plus,
  Edit,
  Trash2,
  Download,
  Upload,
  Search,
  Filter,
  ChevronDown,
  ArrowUpDown,
  RotateCcw,
  X,
  RefreshCw,
  CheckCircle,
  XCircle,
  Copy,
} from "lucide-react";
import Card from "../components/common/Card";
import Button from "../components/common/Button";
import Badge from "../components/common/Badge";
import Table, { Column } from "../components/common/Table";
import Pagination from "../components/common/Pagination";
import Modal from "../components/common/Modal";
import Input from "../components/common/Input";
import Textarea from "../components/common/Textarea";
import Breadcrumb from "../components/common/Breadcrumb";

interface MessageTemplate {
  id: number;
  name: string;
  type: string;
  content: string;
  variables: string[];
  createdAt: string;
  updatedAt: string;
  isActive: boolean;
}

// 목업 데이터
const mockTemplates: MessageTemplate[] = [
  {
    id: 1,
    name: "주문 확인",
    type: "주문",
    content:
      "안녕하세요, {고객명}님. 주문번호 {주문번호}가 접수되었습니다. 감사합니다.",
    variables: ["고객명", "주문번호"],
    createdAt: "2024-01-15",
    updatedAt: "2024-12-10",
    isActive: true,
  },
  {
    id: 2,
    name: "배송 시작 알림",
    type: "배송",
    content: "{고객명}님, 주문하신 상품이 발송되었습니다. 송장번호: {송장번호}",
    variables: ["고객명", "송장번호"],
    createdAt: "2024-01-20",
    updatedAt: "2024-12-10",
    isActive: true,
  },
  {
    id: 3,
    name: "구독 연장 안내",
    type: "구독",
    content:
      "{고객명}님의 구독이 {개월수}개월 연장되었습니다. 종료일: {종료일}",
    variables: ["고객명", "개월수", "종료일"],
    createdAt: "2024-02-01",
    updatedAt: "2024-12-10",
    isActive: true,
  },
];

const MessageTemplatePage: React.FC = () => {
  const [templates, setTemplates] = useState<MessageTemplate[]>(mockTemplates);
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [showSortMenu, setShowSortMenu] = useState(false);
  const sortButtonRef = useRef<HTMLDivElement>(null);
  const [sortMenuPosition, setSortMenuPosition] = useState({ top: 0, left: 0 });
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);
  const [sortKey, setSortKey] = useState("updatedAt");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] =
    useState<MessageTemplate | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    type: "",
    content: "",
  });

  const handleAdd = () => {
    setFormData({ name: "", type: "", content: "" });
    setEditingTemplate(null);
    setIsAddModalOpen(true);
  };

  const handleEdit = (template: MessageTemplate) => {
    setEditingTemplate(template);
    setFormData({
      name: template.name,
      type: template.type,
      content: template.content,
    });
    setIsEditModalOpen(true);
  };

  const handleDelete = (id: number) => {
    if (!confirm("정말 이 템플릿을 삭제하시겠습니까?")) return;
    setTemplates(templates.filter((t) => t.id !== id));
  };

  // 일괄 삭제
  const handleBulkDelete = () => {
    if (selectedItems.size === 0) return;
    if (
      !confirm(
        `선택한 ${selectedItems.size}개의 템플릿을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`
      )
    )
      return;
    setTemplates(
      templates.filter((t) => !selectedItems.has(String(t.id)))
    );
    setSelectedItems(new Set());
  };

  // 일괄 활성화
  const handleBulkActivate = () => {
    if (selectedItems.size === 0) return;
    setTemplates(
      templates.map((t) =>
        selectedItems.has(String(t.id)) ? { ...t, isActive: true } : t
      )
    );
    setSelectedItems(new Set());
  };

  // 일괄 비활성화
  const handleBulkDeactivate = () => {
    if (selectedItems.size === 0) return;
    setTemplates(
      templates.map((t) =>
        selectedItems.has(String(t.id)) ? { ...t, isActive: false } : t
      )
    );
    setSelectedItems(new Set());
  };

  // 일괄 복사
  const handleBulkCopy = () => {
    if (selectedItems.size === 0) return;
    const selectedTemplates = templates.filter((t) =>
      selectedItems.has(String(t.id))
    );
    let maxId = Math.max(...templates.map((t) => t.id), 0);
    const newTemplates = selectedTemplates.map((template) => {
      maxId += 1;
      return {
        ...template,
        id: maxId,
        name: `${template.name} (복사)`,
        createdAt: new Date().toISOString().split("T")[0],
        updatedAt: new Date().toISOString().split("T")[0],
      };
    });
    setTemplates([...templates, ...newTemplates]);
    setSelectedItems(new Set());
  };

  const handleSave = () => {
    if (!formData.name.trim() || !formData.content.trim()) return;

    if (editingTemplate) {
      setTemplates(
        templates.map((t) =>
          t.id === editingTemplate.id
            ? {
                ...t,
                ...formData,
                updatedAt: new Date().toISOString().split("T")[0],
              }
            : t
        )
      );
      setIsEditModalOpen(false);
    } else {
      const newId = Math.max(...templates.map((t) => t.id), 0) + 1;
      const variables =
        formData.content
          .match(/\{([^}]+)\}/g)
          ?.map((v) => v.replace(/[{}]/g, "")) || [];
      setTemplates([
        ...templates,
        {
          id: newId,
          ...formData,
          variables,
          createdAt: new Date().toISOString().split("T")[0],
          updatedAt: new Date().toISOString().split("T")[0],
          isActive: true,
        },
      ]);
      setIsAddModalOpen(false);
    }
    setFormData({ name: "", type: "", content: "" });
    setEditingTemplate(null);
  };

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
      setSelectedItems(
        new Set(filteredTemplates.map((item) => String(item.id)))
      );
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
    let dataToExport: MessageTemplate[];

    if (selectedOnly && selectedItems.size > 0) {
      dataToExport = filteredTemplates.filter((item) =>
        selectedItems.has(String(item.id))
      );
    } else {
      dataToExport = filteredTemplates;
    }

    if (dataToExport.length === 0) {
      alert("다운로드할 데이터가 없습니다.");
      return;
    }

    const excelData = dataToExport.map((item) => ({
      템플릿명: item.name,
      유형: item.type,
      내용: item.content,
      변수: item.variables.join(", "),
      상태: item.isActive ? "활성" : "비활성",
      생성일: item.createdAt,
      수정일: item.updatedAt,
    }));

    const ws = XLSX.utils.json_to_sheet(excelData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "문자 템플릿");

    const fileName = `문자템플릿_${new Date().toISOString().split("T")[0]}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  const filteredTemplates = templates
    .filter((template) => {
      if (
        searchTerm &&
        !template.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !template.content.toLowerCase().includes(searchTerm.toLowerCase())
      ) {
        return false;
      }
      if (typeFilter && template.type !== typeFilter) {
        return false;
      }
      return true;
    })
    .sort((a, b) => {
      const aVal = a[sortKey as keyof MessageTemplate];
      const bVal = b[sortKey as keyof MessageTemplate];
      if (aVal === null && bVal === null) return 0;
      if (aVal === null) return 1;
      if (bVal === null) return -1;
      const aStr = String(aVal);
      const bStr = String(bVal);
      if (sortDirection === "asc") return aStr > bStr ? 1 : -1;
      return aStr < bStr ? 1 : -1;
    });

  const totalPages = Math.ceil(filteredTemplates.length / itemsPerPage);
  const paginatedData = filteredTemplates.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const columns: Column<MessageTemplate>[] = [
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
            onChange={(e) => handleSelectItem(String(row.id), e.target.checked)}
            className="w-4 h-4 rounded border-line text-accent focus:ring-accent"
          />
        </div>
      ),
    },
    {
      key: "name",
      label: "템플릿명",
      sortable: true,
      align: "center",
      render: (value) => <span className="font-medium text-ink">{value}</span>,
    },
    {
      key: "type",
      label: "유형",
      sortable: true,
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
      key: "content",
      label: "내용",
      align: "center",
      render: (value) => (
        <span className="text-sm text-muted line-clamp-2">
          {value}
        </span>
      ),
    },
    {
      key: "variables",
      label: "변수",
      align: "center",
      render: (_, row) => (
        <div className="flex flex-wrap gap-1 justify-center">
          {row.variables.map((v, idx) => (
            <span
              key={idx}
              className="px-2 py-0.5 text-xs bg-chip text-accent rounded"
            >
              {`{${v}}`}
            </span>
          ))}
        </div>
      ),
    },
    {
      key: "isActive",
      label: "상태",
      sortable: true,
      align: "center",
      render: (value) => (
        <div className="flex justify-center">
          <Badge variant={value ? "success" : "default"} size="sm">
            {value ? "활성" : "비활성"}
          </Badge>
        </div>
      ),
    },
    {
      key: "updatedAt",
      label: "수정일",
      sortable: true,
      align: "center",
      render: (value) => <span className="text-sm text-muted">{value}</span>,
    },
  ];

  const templateTypes = ["주문", "배송", "구독", "문의", "기타"];

  return (
    <div className="min-h-screen">
      <div className="max-w-[1600px] mx-auto px-6 py-6">
        <Breadcrumb
          items={[
            { label: "고객 지원", path: "/support/list" },
            { label: "문자 템플릿" },
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
                onClick={handleAdd}
              >
                템플릿 추가
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
                    placeholder="템플릿명, 내용으로 검색..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="unified-input pl-10 w-full"
                  />
                </div>
                {(searchTerm || typeFilter) && (
                  <button
                    onClick={() => {
                      setSearchTerm("");
                      setTypeFilter("");
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-md font-medium text-sm bg-accent text-white hover:bg-accent/90 transition-all"
                  >
                    <RotateCcw className="w-4 h-4" />
                    필터&정렬 초기화
                  </button>
                )}
              </div>

              {/* 선택된 필터 태그들 */}
              {typeFilter && (
                <div className="flex items-center gap-2 flex-wrap mb-4">
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-md text-sm font-medium">
                    템플릿 유형: {typeFilter}
                    <button
                      onClick={() => setTypeFilter("")}
                      className="hover:text-blue-900"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              )}

              {/* 필터 옵션 */}
              {showFilters && (
                <div className="pt-4 border-t border-line">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="unified-label">템플릿 유형</label>
                      <select
                        value={typeFilter}
                        onChange={(e) => setTypeFilter(e.target.value)}
                        className="unified-input w-full"
                      >
                        <option value="">전체</option>
                        {templateTypes.map((type) => (
                          <option key={type} value={type}>
                            {type}
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
                  handleSort("updatedAt", "desc");
                  setShowSortMenu(false);
                }}
                className="w-full text-left px-4 py-2 hover:bg-paper text-sm"
              >
                수정일 최신순
              </button>
              <button
                onClick={() => {
                  handleSort("updatedAt", "asc");
                  setShowSortMenu(false);
                }}
                className="w-full text-left px-4 py-2 hover:bg-paper text-sm"
              >
                수정일 오래된순
              </button>
              <div className="border-t border-line my-1"></div>
              <button
                onClick={() => {
                  handleSort("name", "asc");
                  setShowSortMenu(false);
                }}
                className="w-full text-left px-4 py-2 hover:bg-paper text-sm"
              >
                템플릿명 가나다순
              </button>
              <button
                onClick={() => {
                  handleSort("name", "desc");
                  setShowSortMenu(false);
                }}
                className="w-full text-left px-4 py-2 hover:bg-paper text-sm"
              >
                템플릿명 역순
              </button>
              <div className="border-t border-line my-1"></div>
              <button
                onClick={() => {
                  handleSort("type", "asc");
                  setShowSortMenu(false);
                }}
                className="w-full text-left px-4 py-2 hover:bg-paper text-sm"
              >
                유형순
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
              {selectedItems.size === 0 ? (
                <Button
                  variant="outline"
                  size="sm"
                  icon={Download}
                  onClick={() => handleExportExcel(false)}
                >
                  엑셀 다운로드
                </Button>
              ) : (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    icon={CheckCircle}
                    onClick={handleBulkActivate}
                  >
                    일괄 활성화
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    icon={XCircle}
                    onClick={handleBulkDeactivate}
                  >
                    일괄 비활성화
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    icon={Copy}
                    onClick={handleBulkCopy}
                  >
                    일괄 복사
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    icon={Trash2}
                    onClick={handleBulkDelete}
                    className="text-danger-600 hover:text-danger-700"
                  >
                    일괄 삭제
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedItems(new Set())}
                  >
                    선택 해제
                  </Button>
                </>
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
                  filteredTemplates.length > 0 &&
                  selectedItems.size === filteredTemplates.length
                }
                onChange={(e) => handleSelectAll(e.target.checked)}
                className="w-4 h-4 rounded border-line text-accent focus:ring-accent"
              />
              <span className="text-sm text-muted">
                전체 {filteredTemplates.length}건
              </span>
            </div>
            <span className="text-sm text-muted">
              {(currentPage - 1) * itemsPerPage + 1} -{" "}
              {Math.min(currentPage * itemsPerPage, filteredTemplates.length)} /{" "}
              {filteredTemplates.length}
            </span>
          </div>

          <Table
            columns={columns}
            data={paginatedData}
            keyExtractor={(row) => String(row.id)}
            onSort={handleSort}
            sortKey={sortKey}
            sortDirection={sortDirection}
            emptyMessage="템플릿이 없습니다"
            hoverable
            onRowClick={handleEdit}
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

        {/* 템플릿 추가 모달 */}
        <Modal
          isOpen={isAddModalOpen}
          onClose={() => {
            setIsAddModalOpen(false);
            setFormData({ name: "", type: "", content: "" });
          }}
          title="템플릿 추가"
          size="lg"
          footer={
            <>
              <Button
                variant="ghost"
                onClick={() => {
                  setIsAddModalOpen(false);
                  setFormData({ name: "", type: "", content: "" });
                }}
                className="unified-btn-outline"
              >
                취소
              </Button>
              <Button onClick={handleSave} className="unified-btn">
                저장
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            <Input
              label="템플릿명"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              placeholder="예: 주문 확인"
              className="unified-input"
              required
            />
            <div>
              <label className="unified-label">템플릿 유형</label>
              <select
                value={formData.type}
                onChange={(e) =>
                  setFormData({ ...formData, type: e.target.value })
                }
                className="unified-input w-full"
                required
              >
                <option value="">선택하세요</option>
                {templateTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>
            <Textarea
              label="템플릿 내용"
              value={formData.content}
              onChange={(e) =>
                setFormData({ ...formData, content: e.target.value })
              }
              placeholder="변수는 {변수명} 형식으로 입력하세요. 예: {고객명}님, 주문번호 {주문번호}"
              rows={8}
              className="unified-textarea"
              required
            />
            <div className="p-3 bg-info-50 border border-info-200 rounded-lg">
              <p className="text-xs text-info-700">
                <strong>변수 사용법:</strong> 텍스트 내에 {"{변수명}"} 형식으로
                입력하면 자동으로 변수로 인식됩니다.
              </p>
            </div>
          </div>
        </Modal>

        {/* 템플릿 수정 모달 */}
        <Modal
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false);
            setFormData({ name: "", type: "", content: "" });
            setEditingTemplate(null);
          }}
          title="템플릿 상세"
          size="lg"
          footer={
            <>
              <div className="flex items-center gap-2">
                {editingTemplate && (
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={Trash2}
                    onClick={() => {
                      if (
                        confirm(
                          `정말 "${editingTemplate.name}" 템플릿을 삭제하시겠습니까?`
                        )
                      ) {
                        handleDelete(editingTemplate.id);
                        setIsEditModalOpen(false);
                        setFormData({ name: "", type: "", content: "" });
                        setEditingTemplate(null);
                      }
                    }}
                    className="text-danger-600 hover:text-danger-700"
                  >
                    삭제
                  </Button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  onClick={() => {
                    setIsEditModalOpen(false);
                    setFormData({ name: "", type: "", content: "" });
                    setEditingTemplate(null);
                  }}
                  className="unified-btn-outline"
                >
                  취소
                </Button>
                <Button onClick={handleSave} className="unified-btn">
                  저장
                </Button>
              </div>
            </>
          }
        >
          <div className="space-y-4">
            <Input
              label="템플릿명"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              placeholder="예: 주문 확인"
              className="unified-input"
              required
            />
            <div>
              <label className="unified-label">템플릿 유형</label>
              <select
                value={formData.type}
                onChange={(e) =>
                  setFormData({ ...formData, type: e.target.value })
                }
                className="unified-input w-full"
                required
              >
                <option value="">선택하세요</option>
                {templateTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>
            <Textarea
              label="템플릿 내용"
              value={formData.content}
              onChange={(e) =>
                setFormData({ ...formData, content: e.target.value })
              }
              placeholder="변수는 {변수명} 형식으로 입력하세요. 예: {고객명}님, 주문번호 {주문번호}"
              rows={8}
              className="unified-textarea"
              required
            />
            <div className="p-3 bg-info-50 border border-info-200 rounded-lg">
              <p className="text-xs text-info-700">
                <strong>변수 사용법:</strong> 텍스트 내에 {"{변수명}"} 형식으로
                입력하면 자동으로 변수로 인식됩니다.
              </p>
            </div>
          </div>
        </Modal>
      </div>
    </div>
  );
};

export default MessageTemplatePage;
