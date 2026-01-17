import React, { useState, useRef, useEffect } from "react";
import { useLocation } from "react-router-dom";
import * as XLSX from "xlsx";
import {
  Download,
  RefreshCw,
  Search,
  Filter,
  ChevronDown,
  ArrowUpDown,
  RotateCcw,
  X,
} from "lucide-react";
import Card from "../components/common/Card";
import Button from "../components/common/Button";
import Table, { Column } from "../components/common/Table";
import Pagination from "../components/common/Pagination";
import Breadcrumb from "../components/common/Breadcrumb";

// 오늘 택배 데이터 인터페이스
interface TodayCourierItem {
  id: number;
  date: string;
  name: string;
  phone: string;
  postalCode: string;
  address: string;
  말씀함께: number;
  큰글자: number;
  꿀땅: number;
  저학년: number;
  고학년: number;
  청소년: number;
  합계: number;
  비고: string | null;
}

// 택배 발송현황 데이터 인터페이스
interface CourierStatusItem {
  id: number;
  date: string;
  name: string;
  phone: string;
  postalCode: string;
  address: string;
  말씀함께: number;
  큰글자: number;
  꿀땅: number;
  저학년: number;
  고학년: number;
  청소년: number;
  합계: number;
  비고: string | null;
  구분?: string;
  박스수?: number;
  안전봉투?: number;
  trackingNumber?: string;
}

// 오늘 택배 목업 데이터
const mockTodayCourierData: TodayCourierItem[] = [
  {
    id: 1,
    date: "2025-01-02",
    name: "김민수",
    phone: "",
    postalCode: "",
    address: "서울특별시 강남구 테헤란로 123",
    말씀함께: 0,
    큰글자: 0,
    꿀땅: 0,
    저학년: 0,
    고학년: 0,
    청소년: 0,
    합계: 0,
    비고: null,
  },
  {
    id: 2,
    date: "2025-01-02",
    name: "김민수",
    phone: "",
    postalCode: "",
    address: "",
    말씀함께: 0,
    큰글자: 0,
    꿀땅: 0,
    저학년: 0,
    고학년: 0,
    청소년: 0,
    합계: 0,
    비고: "2월호",
  },
];

const ShippingPage: React.FC = () => {
  const location = useLocation();
  const isTodayCourier = location.pathname.includes("today-courier");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<TodayCourierItem[] | CourierStatusItem[]>([]);

  // 필터 상태
  const [searchTerm, setSearchTerm] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [showSortMenu, setShowSortMenu] = useState(false);
  const sortButtonRef = useRef<HTMLDivElement>(null);
  const [sortMenuPosition, setSortMenuPosition] = useState({ top: 0, left: 0 });

  // 페이지네이션
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);
  const [sortKey, setSortKey] = useState("date");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  // 선택된 항목
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchData();
  }, []);

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

  const fetchData = async () => {
    setLoading(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 500));
      setData(isTodayCourier ? mockTodayCourierData : mockCourierStatusData);
    } catch (err: any) {
      console.error("데이터를 불러오는데 실패했습니다.", err);
      setData([]);
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
      setSelectedItems(
        new Set(
          filteredData.map((item: TodayCourierItem | CourierStatusItem) =>
            String(item.id)
          )
        )
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
    let dataToExport: (TodayCourierItem | CourierStatusItem)[];

    if (selectedOnly && selectedItems.size > 0) {
      // 선택된 항목만 다운로드
      dataToExport = filteredData.filter((item) =>
        selectedItems.has(String(item.id))
      );
    } else {
      // 필터링된 모든 항목 다운로드
      dataToExport = filteredData;
    }

    if (dataToExport.length === 0) {
      alert("다운로드할 데이터가 없습니다.");
      return;
    }

    // 엑셀 형식으로 변환
    const excelData = dataToExport.map((item) => {
      if (isTodayCourier) {
        const todayItem = item as TodayCourierItem;
        return {
          날짜: todayItem.date,
          이름: todayItem.name,
          연락처: todayItem.phone,
          우편번호: todayItem.postalCode,
          주소: todayItem.address,
          말씀함께: todayItem.말씀함께 || 0,
          큰글자: todayItem.큰글자 || 0,
          꿀땅: todayItem.꿀땅 || 0,
          저학년: todayItem.저학년 || 0,
          고학년: todayItem.고학년 || 0,
          청소년: todayItem.청소년 || 0,
          합계: todayItem.합계,
          비고: todayItem.비고 || "",
        };
      } else {
        const statusItem = item as CourierStatusItem;
        return {
          날짜: statusItem.date,
          이름: statusItem.name,
          연락처: statusItem.phone,
          우편번호: statusItem.postalCode,
          주소: statusItem.address,
          말씀함께: statusItem.말씀함께 || 0,
          큰글자: statusItem.큰글자 || 0,
          꿀땅: statusItem.꿀땅 || 0,
          저학년: statusItem.저학년 || 0,
          고학년: statusItem.고학년 || 0,
          청소년: statusItem.청소년 || 0,
          합계: statusItem.합계,
          비고: statusItem.비고 || "",
          구분: statusItem.구분 || "",
          박스수: statusItem.박스수 || 0,
          안전봉투: statusItem.안전봉투 || 0,
          송장번호: statusItem.trackingNumber || "",
        };
      }
    });

    // 워크시트 생성
    const ws = XLSX.utils.json_to_sheet(excelData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, pageTitle);

    // 파일명 생성
    const fileName = `${pageTitle}_${new Date().toISOString().split("T")[0]}.xlsx`;

    // 다운로드
    XLSX.writeFile(wb, fileName);
  };

  // 필터링 및 정렬
  const filteredData = data
    .filter((item) => {
      if (
        searchTerm &&
        !item.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !item.phone.includes(searchTerm) &&
        !item.address.toLowerCase().includes(searchTerm.toLowerCase())
      )
        return false;
      return true;
    })
    .sort((a, b) => {
      const aVal = a[sortKey as keyof (TodayCourierItem | CourierStatusItem)];
      const bVal = b[sortKey as keyof (TodayCourierItem | CourierStatusItem)];
      if (aVal === null && bVal === null) return 0;
      if (aVal === null) return 1;
      if (bVal === null) return -1;
      const aStr = String(aVal);
      const bStr = String(bVal);
      if (sortDirection === "asc") return aStr > bStr ? 1 : -1;
      return aStr < bStr ? 1 : -1;
    });

  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const paginatedData = filteredData.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // 테이블 컬럼 정의
  const columns: Column<TodayCourierItem | CourierStatusItem>[] = isTodayCourier
    ? [
        // 오늘 택배 컬럼
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
          key: "date",
          label: "날짜",
          sortable: true,
          align: "center",
          render: (_value, row) => (
            <span className="text-sm">{row.date}</span>
          ),
        },
        {
          key: "name",
          label: "이름",
          sortable: true,
          align: "center",
          render: (_value, row) => (
            <span className="text-sm font-medium text-ink">
              {row.name}
            </span>
          ),
        },
        {
          key: "phone",
          label: "연락처",
          align: "center",
          render: (_value, row) => (
            <span className="text-sm">{row.phone || "-"}</span>
          ),
        },
        {
          key: "postalCode",
          label: "우편번호",
          align: "center",
          render: (_value, row) => (
            <span className="text-sm">{row.postalCode || "-"}</span>
          ),
        },
        {
          key: "address",
          label: "주소",
          align: "center",
          render: (_value, row) => (
            <span className="text-sm">{row.address || "-"}</span>
          ),
        },
        {
          key: "말씀함께",
          label: "말씀함께",
          align: "center",
          render: (_value, row) => {
            const item = row as TodayCourierItem;
            return (
              <span className="text-sm">{item.말씀함께 || 0}</span>
            );
          },
        },
        {
          key: "큰글자",
          label: "큰글자",
          align: "center",
          render: (_value, row) => {
            const item = row as TodayCourierItem;
            return (
              <span className="text-sm">{item.큰글자 || 0}</span>
            );
          },
        },
        {
          key: "꿀땅",
          label: "꿀땅",
          align: "center",
          render: (_value, row) => (
            <span className="text-sm">{row.꿀땅 || 0}</span>
          ),
        },
        {
          key: "저학년",
          label: "저학년",
          align: "center",
          render: (_value, row) => (
            <span className="text-sm">{row.저학년 || 0}</span>
          ),
        },
        {
          key: "고학년",
          label: "고학년",
          align: "center",
          render: (_value, row) => (
            <span className="text-sm">{row.고학년 || 0}</span>
          ),
        },
        {
          key: "청소년",
          label: "청소년",
          align: "center",
          render: (_value, row) => (
            <span className="text-sm">{row.청소년 || 0}</span>
          ),
        },
        {
          key: "합계",
          label: "합계",
          align: "center",
          render: (_value, row) => (
            <span className="text-sm font-semibold">{row.합계}</span>
          ),
        },
        {
          key: "비고",
          label: "비고",
          align: "center",
          render: (_value, row) => (
            <span className="text-sm text-muted">
              {row.비고 || "-"}
            </span>
          ),
        },
      ]
    : [
        // 택배 발송현황 컬럼
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
          key: "date",
          label: "날짜",
          sortable: true,
          align: "center",
          render: (_value, row) => (
            <span className="text-sm">{row.date}</span>
          ),
        },
        {
          key: "name",
          label: "이름",
          sortable: true,
          align: "center",
          render: (_value, row) => (
            <span className="text-sm font-medium text-ink">
              {row.name}
            </span>
          ),
        },
        {
          key: "phone",
          label: "연락처",
          align: "center",
          render: (_value, row) => (
            <span className="text-sm">{row.phone}</span>
          ),
        },
        {
          key: "postalCode",
          label: "우편번호",
          align: "center",
          render: (_value, row) => (
            <span className="text-sm">{row.postalCode}</span>
          ),
        },
        {
          key: "address",
          label: "주소",
          align: "center",
          render: (_value, row) => (
            <span className="text-sm">{row.address}</span>
          ),
        },
        {
          key: "말씀함께",
          label: "말씀함께",
          align: "center",
          render: (_value, row) => {
            const item = row as CourierStatusItem;
            return (
              <span className="text-sm">{item.말씀함께 || 0}</span>
            );
          },
        },
        {
          key: "큰글자",
          label: "큰글자",
          align: "center",
          render: (_value, row) => {
            const item = row as CourierStatusItem;
            return (
              <span className="text-sm">{item.큰글자 || 0}</span>
            );
          },
        },
        {
          key: "꿀땅",
          label: "꿀땅",
          align: "center",
          render: (_value, row) => (
            <span className="text-sm">{row.꿀땅 || 0}</span>
          ),
        },
        {
          key: "저학년",
          label: "저학년",
          align: "center",
          render: (_value, row) => (
            <span className="text-sm">{row.저학년 || 0}</span>
          ),
        },
        {
          key: "고학년",
          label: "고학년",
          align: "center",
          render: (_value, row) => (
            <span className="text-sm">{row.고학년 || 0}</span>
          ),
        },
        {
          key: "청소년",
          label: "청소년",
          align: "center",
          render: (_value, row) => (
            <span className="text-sm">{row.청소년 || 0}</span>
          ),
        },
        {
          key: "합계",
          label: "합계",
          align: "center",
          render: (_value, row) => (
            <span className="text-sm font-semibold">{row.합계}</span>
          ),
        },
        {
          key: "비고",
          label: "비고",
          align: "center",
          render: (_value, row) => (
            <span className="text-sm text-muted">{row.비고 || "-"}</span>
          ),
        },
        {
          key: "구분",
          label: "구분",
          align: "center",
          render: (_value, row) => {
            const item = row as CourierStatusItem;
            return (
              <span className="text-sm">{item.구분 || "-"}</span>
            );
          },
        },
        {
          key: "박스수",
          label: "박스수",
          align: "center",
          render: (_value, row) => {
            const item = row as CourierStatusItem;
            return (
              <span className="text-sm">{item.박스수 || 0}</span>
            );
          },
        },
        {
          key: "안전봉투",
          label: "안전봉투",
          align: "center",
          render: (_value, row) => {
            const item = row as CourierStatusItem;
            return (
              <span className="text-sm">{item.안전봉투 || 0}</span>
            );
          },
        },
        {
          key: "trackingNumber",
          label: "송장 번호",
          align: "center",
          render: (_value, row) => {
            const item = row as CourierStatusItem;
            return (
              <span className="text-sm font-mono">
                {item.trackingNumber || "-"}
              </span>
            );
          },
        },
      ];

  const pageTitle = isTodayCourier ? "오늘택배" : "택배발송현황";

  return (
    <div className="min-h-screen">
      <div className="max-w-[1600px] mx-auto px-6 py-6">
        <Breadcrumb
          items={[
            { label: "발송 관리", path: "/shipping/today-courier" },
            { label: pageTitle },
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
                onClick={fetchData}
                loading={loading}
              >
                새로고침
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
                    placeholder="이름, 연락처, 주소 검색"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="unified-input pl-10 w-full"
                  />
                </div>
                {searchTerm && (
                  <button
                    onClick={() => {
                      setSearchTerm("");
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-md font-medium text-sm bg-accent text-white hover:bg-accent/90 transition-all"
                  >
                    <RotateCcw className="w-4 h-4" />
                    필터&정렬 초기화
                  </button>
                )}
              </div>
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
                  handleSort("date", "desc");
                  setShowSortMenu(false);
                }}
                className="w-full text-left px-4 py-2 hover:bg-paper text-sm"
              >
                날짜 최신순
              </button>
              <button
                onClick={() => {
                  handleSort("date", "asc");
                  setShowSortMenu(false);
                }}
                className="w-full text-left px-4 py-2 hover:bg-paper text-sm"
              >
                날짜 오래된순
              </button>
              <div className="border-t border-line my-1"></div>
              <button
                onClick={() => {
                  handleSort("name", "asc");
                  setShowSortMenu(false);
                }}
                className="w-full text-left px-4 py-2 hover:bg-paper text-sm"
              >
                이름 가나다순
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
                  filteredData.length > 0 &&
                  selectedItems.size === filteredData.length
                }
                onChange={(e) => handleSelectAll(e.target.checked)}
                className="w-4 h-4 rounded border-line text-accent focus:ring-accent"
              />
              <span className="text-sm text-muted">
                전체 {filteredData.length}건
              </span>
            </div>
            <span className="text-sm text-muted">
              {(currentPage - 1) * itemsPerPage + 1} -{" "}
              {Math.min(currentPage * itemsPerPage, filteredData.length)} /{" "}
              {filteredData.length}
            </span>
          </div>

          <Table
            columns={columns}
            data={paginatedData}
            keyExtractor={(item) => String(item.id)}
            onSort={handleSort}
            sortKey={sortKey}
            sortDirection={sortDirection}
            emptyMessage="데이터가 없습니다"
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
      </div>
    </div>
  );
};

export default ShippingPage;
