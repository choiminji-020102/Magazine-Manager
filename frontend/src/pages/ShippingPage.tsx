import React, { useState, useRef, useEffect } from "react";
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
import ListPage from "../components/common/ListPage";
import Breadcrumb from "../components/common/Breadcrumb";
import { sendsApi } from "../api/sendsApi";
import type { SendListResponse, SendDetailResponse } from "../types/send";
import type { SendItemResponse } from "../types/sendItem";

// 발송 데이터 인터페이스
interface SendItem {
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
  send_id: number;
  send_status?: string;
  courier_company?: string | null;
}

// 상품명에서 상품 종류 추출
const getProductType = (productName: string): string | null => {
  if (productName.includes("말씀함께[기본판]") || productName.includes("말씀함께[기본]")) {
    return "말씀함께";
  }
  if (productName.includes("말씀함께[큰글자판]") || productName.includes("큰글자판")) {
    return "큰글자";
  }
  if (productName.includes("꿀땅")) {
    return "꿀땅";
  }
  if (productName.includes("저학년") || productName.includes("1-3학년") || productName.includes("1~3학년")) {
    return "저학년";
  }
  if (productName.includes("고학년") || productName.includes("4-6학년") || productName.includes("4~6학년")) {
    return "고학년";
  }
  if (productName.includes("청소년")) {
    return "청소년";
  }
  return null;
};

// SendDetailResponse를 SendItem으로 변환
const convertSendToItem = (send: SendDetailResponse): SendItem => {
  const productCounts: Record<string, number> = {
    말씀함께: 0,
    큰글자: 0,
    꿀땅: 0,
    저학년: 0,
    고학년: 0,
    청소년: 0,
  };

  // items에서 상품별 수량 집계
  if (send.items) {
    send.items.forEach((item: SendItemResponse) => {
      const productType = getProductType(item.product_name);
      if (productType && productCounts.hasOwnProperty(productType)) {
        productCounts[productType] += item.send_num || 0;
      }
    });
  }

  const 합계 = Object.values(productCounts).reduce((sum, count) => sum + count, 0);

  return {
    id: send.send_id,
    send_id: send.send_id,
    date: send.send_date || "",
    name: send.address_name,
    phone: send.phone,
    postalCode: send.postal_code,
    address: send.address,
    말씀함께: productCounts.말씀함께,
    큰글자: productCounts.큰글자,
    꿀땅: productCounts.꿀땅,
    저학년: productCounts.저학년,
    고학년: productCounts.고학년,
    청소년: productCounts.청소년,
    합계,
    비고: send.send_memo || null,
    구분: send.courier_company || undefined,
    박스수: send.item_count || undefined,
    안전봉투: undefined,
    trackingNumber: send.tracking_no || undefined,
    send_status: send.send_status,
    courier_company: send.courier_company || undefined,
  };
};

const ShippingPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<SendItem[]>([]);
  const [totalItems, setTotalItems] = useState(0);

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

  // 검색어 변경 시 첫 페이지로 이동
  useEffect(() => {
    if (currentPage !== 1) {
      setCurrentPage(1);
    }
  }, [searchTerm]);

  // 페이지 또는 검색어 변경 시 데이터 로드
  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, searchTerm]);

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
      // API 파라미터 설정
      const params: {
        page?: number;
        limit?: number;
        send_status?: string | null;
        courier?: string | null;
        send_date?: string | null;
        search?: string | null;
      } = {
        page: currentPage,
        limit: itemsPerPage,
        search: searchTerm || null,
      };

      const response = await sendsApi.getSends(params);
      const sends: SendListResponse[] = response.data.data || [];
      
      // 각 발송의 상세 정보를 가져와서 상품별 수량 집계
      const sendItems: SendItem[] = [];
      for (const send of sends) {
        try {
          const detailResponse = await sendsApi.getSend(send.send_id);
          const sendDetail: SendDetailResponse = detailResponse.data.data!;
          sendItems.push(convertSendToItem(sendDetail));
        } catch (err) {
          console.error(`발송 ${send.send_id} 상세 정보 조회 실패:`, err);
          // 상세 정보를 가져오지 못한 경우 기본 정보만 사용
          sendItems.push(convertSendToItem({
            ...send,
            items: [],
            item_count: send.item_count,
          } as SendDetailResponse));
        }
      }

      setData(sendItems);
      setTotalItems(response.data.pagination?.total || 0);
    } catch (err: any) {
      console.error("데이터를 불러오는데 실패했습니다.", err);
      setData([]);
      setTotalItems(0);
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
          filteredData.map((item: SendItem) =>
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
    let dataToExport: SendItem[];

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
    const excelData = dataToExport.map((item) => ({
      날짜: item.date,
      이름: item.name,
      연락처: item.phone,
      우편번호: item.postalCode,
      주소: item.address,
      말씀함께: item.말씀함께 || 0,
      큰글자: item.큰글자 || 0,
      꿀땅: item.꿀땅 || 0,
      저학년: item.저학년 || 0,
      고학년: item.고학년 || 0,
      청소년: item.청소년 || 0,
      합계: item.합계,
      비고: item.비고 || "",
      구분: item.구분 || "",
      박스수: item.박스수 || 0,
      안전봉투: item.안전봉투 || 0,
      송장번호: item.trackingNumber || "",
    }));

    // 워크시트 생성
    const ws = XLSX.utils.json_to_sheet(excelData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, pageTitle);

    // 파일명 생성
    const fileName = `${pageTitle}_${new Date().toISOString().split("T")[0]}.xlsx`;

    // 다운로드
    XLSX.writeFile(wb, fileName);
  };

  // 필터링 및 정렬 (클라이언트 사이드 필터링은 검색어가 있을 때만)
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
      const aVal = a[sortKey as keyof SendItem];
      const bVal = b[sortKey as keyof SendItem];
      if (aVal === null && bVal === null) return 0;
      if (aVal === null) return 1;
      if (bVal === null) return -1;
      const aStr = String(aVal);
      const bStr = String(bVal);
      if (sortDirection === "asc") return aStr > bStr ? 1 : -1;
      return aStr < bStr ? 1 : -1;
    });

  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const paginatedData = filteredData;

  // 테이블 컬럼 정의
  const columns: Column<SendItem>[] = [
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
          render: (_value, row) => (
            <span className="text-sm">{row.말씀함께 || 0}</span>
          ),
        },
        {
          key: "큰글자",
          label: "큰글자",
          align: "center",
          render: (_value, row) => (
            <span className="text-sm">{row.큰글자 || 0}</span>
          ),
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
          render: (_value, row) => (
            <span className="text-sm">{row.구분 || "-"}</span>
          ),
        },
        {
          key: "박스수",
          label: "박스수",
          align: "center",
          render: (_value, row) => (
            <span className="text-sm">{row.박스수 || 0}</span>
          ),
        },
        {
          key: "안전봉투",
          label: "안전봉투",
          align: "center",
          render: (_value, row) => (
            <span className="text-sm">{row.안전봉투 || 0}</span>
          ),
        },
        {
          key: "trackingNumber",
          label: "송장 번호",
          align: "center",
          render: (_value, row) => (
            <span className="text-sm font-mono">
              {row.trackingNumber || "-"}
            </span>
          ),
        },
      ];

  const pageTitle = "발송현황";

  return (
    <div className="min-h-screen">
      <div className="max-w-[1600px] mx-auto px-6 py-6">
        <Breadcrumb
          items={[
            { label: "발송 관리", path: "/shipping/courier-status" },
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
        <ListPage
          data={paginatedData}
          columns={columns}
          keyExtractor={(item) => String(item.id)}
          onSort={handleSort}
          sortKey={sortKey}
          sortDirection={sortDirection}
          emptyMessage="데이터가 없습니다"
          hoverable
          selectable
          selectedItems={selectedItems}
          onSelectAll={handleSelectAll}
          onSelectItem={handleSelectItem}
          allSelected={
            filteredData.length > 0 &&
            selectedItems.size === filteredData.length
          }
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          totalItems={totalItems}
          itemsPerPage={itemsPerPage}
        />
      </div>
    </div>
  );
};

export default ShippingPage;
