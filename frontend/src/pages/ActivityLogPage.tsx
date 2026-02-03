import React, { useState, useEffect, useRef } from "react";
import {
  RefreshCw,
  Search,
  Filter,
  ChevronDown,
  RotateCcw,
  X,
  Calendar,
  User,
  Zap,
  Folder,
} from "lucide-react";
import Button from "../components/common/Button";
import Alert from "../components/common/Alert";
import LoadingSpinner from "../components/common/LoadingSpinner";
import Breadcrumb from "../components/common/Breadcrumb";
import Card from "../components/common/Card";
import Table, { Column } from "../components/common/Table";
import Pagination from "../components/common/Pagination";
import Modal from "../components/common/Modal";
import { activityLogsApi } from "../api/activityLogsApi";
import { ActivityLogResponse, ActivityLogListQuery } from "../types/activityLog";
import { PaginationMeta } from "../types/api";
import { getErrorMessage } from "../utils/errorHandler";

const ActivityLogPage: React.FC = () => {
  const [logs, setLogs] = useState<ActivityLogResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pagination, setPagination] = useState<PaginationMeta>({
    total: 0,
    page: 1,
    limit: 20,
    total_pages: 0,
  });

  // 필터 상태
  const [searchTerm, setSearchTerm] = useState("");
  const [adminIdFilter, setAdminIdFilter] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [targetTypeFilter, setTargetTypeFilter] = useState("");
  const [dateFilter, setDateFilter] = useState({ start: "", end: "" });
  const [showFilters, setShowFilters] = useState(false);

  // 정렬 상태
  const [sortKey, setSortKey] = useState("created_at");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  // 상세보기 모달
  const [selectedLog, setSelectedLog] = useState<ActivityLogResponse | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  // Race condition 방지를 위한 ref
  const requestIdRef = useRef(0);

  // 초기 pagination 값
  const initialPagination: PaginationMeta = {
    total: 0,
    page: 1,
    limit: 20,
    total_pages: 0,
  };

  // 필터 변경 시 페이지 리셋
  useEffect(() => {
    setPagination((prev) => ({ ...prev, page: 1 }));
  }, [searchTerm, adminIdFilter, actionFilter, targetTypeFilter, dateFilter.start, dateFilter.end]);

  // 페이지 또는 필터 변경 시 로그 불러오기
  // 검색어가 있어도 서버 요청을 보내서 서버 사이드 페이지네이션 활용
  useEffect(() => {
    loadLogs();
  }, [pagination.page, adminIdFilter, actionFilter, targetTypeFilter, dateFilter]);

  const loadLogs = async () => {
    const requestId = ++requestIdRef.current;

    try {
      setLoading(true);
      setError("");

      // ActivityLogListQuery 타입에 맞게 파라미터 생성
      const params: ActivityLogListQuery = {
        page: pagination.page,
        limit: pagination.limit,
        admin_id: adminIdFilter ? (isNaN(parseInt(adminIdFilter, 10)) ? null : parseInt(adminIdFilter, 10)) : null,
        action: actionFilter || null,
        target_type: targetTypeFilter || null,
        start_date: dateFilter.start || null,
        end_date: dateFilter.end || null,
      };

      const response = await activityLogsApi.getActivityLogs(params);

      // Race condition 체크
      if (requestId !== requestIdRef.current) return;

      // 응답 검증
      if (!response?.data?.data || !Array.isArray(response.data.data)) {
        throw new Error("올바르지 않은 응답 형식입니다.");
      }

      if (!response.data.pagination) {
        throw new Error("페이지네이션 정보가 없습니다.");
      }

      setLogs(response.data.data);
      setPagination(response.data.pagination);
    } catch (err) {
      // Race condition 체크
      if (requestId !== requestIdRef.current) return;

      const errorMessage =
        getErrorMessage(err) || "활동 로그를 불러오는데 실패했습니다.";

      setError(errorMessage);
      setLogs([]);
      setPagination(initialPagination);
    } finally {
      // Race condition 체크
      if (requestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  };

  const handleViewDetail = (log: ActivityLogResponse) => {
    setSelectedLog(log);
    setIsDetailModalOpen(true);
  };

  const handleSort = (key: string, direction: "asc" | "desc") => {
    setSortKey(key);
    setSortDirection(direction);
  };

  // 필터링된 로그 (검색어로 클라이언트 사이드 필터링)
  // 검색어는 클라이언트에서만 필터링 (서버에 search 파라미터가 없음)
  const filteredLogs = logs
    .filter((log) => {
      if (!searchTerm) return true;
      const searchLower = searchTerm.toLowerCase();
      return (
        (log.admin_name?.toLowerCase().includes(searchLower) || false) ||
        (log.target_name?.toLowerCase().includes(searchLower) || false) ||
        log.action.toLowerCase().includes(searchLower) ||
        log.target_type.toLowerCase().includes(searchLower)
      );
    })
    .sort((a, b) => {
      if (sortKey === "created_at") {
        const aVal = new Date(a.created_at).getTime();
        const bVal = new Date(b.created_at).getTime();
        if (sortDirection === "asc") {
          return aVal - bVal;
        }
        return bVal - aVal;
      }
      return 0;
    });

  // 로그에서 고유한 값들 추출 (필터 옵션용)
  const uniqueActions = Array.from(new Set(logs.map((log) => log.action))).sort();
  const uniqueTargetTypes = Array.from(new Set(logs.map((log) => log.target_type))).sort();
  
  // 관리자 중복 제거: admin_id를 키로 사용하여 Map으로 중복 제거
  const adminMap = new Map<number, { id: number; name: string }>();
  logs
    .filter((log) => log.admin_id && log.admin_name)
    .forEach((log) => {
      if (!adminMap.has(log.admin_id!)) {
        adminMap.set(log.admin_id!, {
          id: log.admin_id!,
          name: log.admin_name!,
        });
      }
    });
  
  const uniqueAdmins = Array.from(adminMap.values())
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((admin) => ({
      value: String(admin.id),
      label: admin.name,
    }));

  // 테이블 컬럼 정의
  const columns: Column<ActivityLogResponse>[] = [
    {
      key: "created_at",
      label: "시간",
      align: "center",
      sortable: true,
      render: (value) =>
        new Date(value).toLocaleString("ko-KR", {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
    },
    {
      key: "admin_name",
      label: "관리자",
      align: "center",
      render: (value) => value || "SYSTEM",
    },
    {
      key: "action",
      label: "액션",
      align: "center",
    },
    {
      key: "target_type",
      label: "대상 타입",
      align: "center",
    },
    {
      key: "target_name",
      label: "대상",
      align: "center",
      render: (value, row) => value || `ID: ${row.target_id || "-"}`,
    },
    {
      key: "ip_address",
      label: "IP 주소",
      align: "center",
      render: (value) => (
        <span className="font-mono text-muted">{value || "-"}</span>
      ),
    },
  ];

  const hasActiveFilters =
    !!(
      searchTerm ||
      adminIdFilter ||
      actionFilter ||
      targetTypeFilter ||
      dateFilter.start ||
      dateFilter.end
    );

  // 활성 필터 개수 계산
  const activeFilterCount = [
    adminIdFilter,
    actionFilter,
    targetTypeFilter,
    dateFilter.start,
    dateFilter.end,
  ].filter(Boolean).length;

  // 날짜 빠른 선택 함수
  const setQuickDateRange = (range: "today" | "yesterday" | "last7days" | "last30days" | "thisMonth") => {
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    const endDate = today.toISOString().split("T")[0];

    let startDate = "";
    switch (range) {
      case "today":
        startDate = endDate;
        break;
      case "yesterday":
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        startDate = yesterday.toISOString().split("T")[0];
        setDateFilter({ start: startDate, end: startDate });
        return;
      case "last7days":
        const last7days = new Date(today);
        last7days.setDate(last7days.getDate() - 6);
        startDate = last7days.toISOString().split("T")[0];
        break;
      case "last30days":
        const last30days = new Date(today);
        last30days.setDate(last30days.getDate() - 29);
        startDate = last30days.toISOString().split("T")[0];
        break;
      case "thisMonth":
        const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
        startDate = firstDay.toISOString().split("T")[0];
        break;
    }
    setDateFilter({ start: startDate, end: endDate });
  };

  if (loading && logs.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="max-w-[1600px] mx-auto px-6 py-6">
        <Breadcrumb
          items={[
            { label: "시스템", path: "/system" },
            { label: "활동 로그" },
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
                onClick={loadLogs}
                loading={loading}
              >
                새로고침
              </Button>
            </div>
          </div>
        </div>

        {/* 에러 메시지 */}
        {error && <Alert type="error" className="mb-6">{error}</Alert>}

        {/* 검색 및 필터 */}
        <div className="relative">
          <Card className="unified-card mb-6 overflow-hidden" padding="none">
            <div className="p-4 bg-gradient-to-r from-paper to-white">
              {/* 상단: 필터 버튼, 검색 바 */}
              <div className="flex items-center gap-3 mb-4">
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={`relative inline-flex items-center gap-2 px-4 py-2.5 rounded-md font-medium text-sm transition-all ${
                    showFilters
                      ? "bg-accent text-white"
                      : "bg-white text-ink border border-line hover:border-accent/30"
                  }`}
                >
                  <Filter className="w-4 h-4" />
                  필터
                  {activeFilterCount > 0 && (
                    <span className="absolute -top-1 -right-1 flex items-center justify-center w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full">
                      {activeFilterCount}
                    </span>
                  )}
                  <ChevronDown
                    className={`w-4 h-4 transition-transform ${
                      showFilters ? "rotate-180" : ""
                    }`}
                  />
                </button>
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted" />
                  <input
                    type="text"
                    placeholder="관리자 이름, 대상 이름, 액션으로 검색..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="unified-input pl-10 w-full"
                  />
                </div>
                {hasActiveFilters && (
                  <button
                    onClick={() => {
                      setSearchTerm("");
                      setAdminIdFilter("");
                      setActionFilter("");
                      setTargetTypeFilter("");
                      setDateFilter({ start: "", end: "" });
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-md font-medium text-sm bg-accent text-white hover:bg-accent/90 transition-all"
                  >
                    <RotateCcw className="w-4 h-4" />
                    필터 초기화
                  </button>
                )}
              </div>

              {/* 선택된 필터 태그들 - 개선된 시각화 */}
              {(adminIdFilter ||
                actionFilter ||
                targetTypeFilter ||
                dateFilter.start ||
                dateFilter.end) && (
                <div className="flex items-center gap-2 flex-wrap mb-4">
                  {adminIdFilter && (
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-accent/10 text-accent border border-accent/20 rounded-md text-sm font-medium">
                      <User className="w-3.5 h-3.5" />
                      <span>
                        {uniqueAdmins.find((a) => a.value === adminIdFilter)?.label ||
                          adminIdFilter}
                      </span>
                      <button
                        onClick={() => setAdminIdFilter("")}
                        className="hover:text-accent/70 transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                  {actionFilter && (
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-purple-50 text-purple-700 border border-purple-200 rounded-md text-sm font-medium">
                      <Zap className="w-3.5 h-3.5" />
                      <span>{actionFilter}</span>
                      <button
                        onClick={() => setActionFilter("")}
                        className="hover:text-purple-900 transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                  {targetTypeFilter && (
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-md text-sm font-medium">
                      <Folder className="w-3.5 h-3.5" />
                      <span>{targetTypeFilter}</span>
                      <button
                        onClick={() => setTargetTypeFilter("")}
                        className="hover:text-blue-900 transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                  {(dateFilter.start || dateFilter.end) && (
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-green-50 text-green-700 border border-green-200 rounded-md text-sm font-medium">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>
                        {dateFilter.start || "이전"} ~ {dateFilter.end || "이후"}
                      </span>
                      <button
                        onClick={() => setDateFilter({ start: "", end: "" })}
                        className="hover:text-green-900 transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* 필터 옵션 - 항상 보이게 개선 및 그룹화 */}
              {showFilters && (
              <div className="pt-4 border-t border-line">
                <div className="space-y-6">
                  {/* 날짜 필터 그룹 */}
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Calendar className="w-4 h-4 text-muted" />
                      <label className="unified-label text-base font-semibold">날짜 범위</label>
                    </div>
                    <div className="space-y-3">
                      {/* 빠른 선택 버튼 */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          onClick={() => setQuickDateRange("today")}
                          className="px-3 py-1.5 text-xs font-medium bg-white border border-line rounded-md hover:bg-paper transition-colors"
                        >
                          오늘
                        </button>
                        <button
                          onClick={() => setQuickDateRange("yesterday")}
                          className="px-3 py-1.5 text-xs font-medium bg-white border border-line rounded-md hover:bg-paper transition-colors"
                        >
                          어제
                        </button>
                        <button
                          onClick={() => setQuickDateRange("last7days")}
                          className="px-3 py-1.5 text-xs font-medium bg-white border border-line rounded-md hover:bg-paper transition-colors"
                        >
                          최근 7일
                        </button>
                        <button
                          onClick={() => setQuickDateRange("last30days")}
                          className="px-3 py-1.5 text-xs font-medium bg-white border border-line rounded-md hover:bg-paper transition-colors"
                        >
                          최근 30일
                        </button>
                        <button
                          onClick={() => setQuickDateRange("thisMonth")}
                          className="px-3 py-1.5 text-xs font-medium bg-white border border-line rounded-md hover:bg-paper transition-colors"
                        >
                          이번 달
                        </button>
                      </div>
                      {/* 날짜 범위 입력 */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="unified-label">시작일</label>
                          <div className="relative">
                            <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted" />
                            <input
                              type="date"
                              value={dateFilter.start}
                              onChange={(e) =>
                                setDateFilter({ ...dateFilter, start: e.target.value })
                              }
                              className="unified-input w-full pl-10"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="unified-label">종료일</label>
                          <div className="relative">
                            <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted" />
                            <input
                              type="date"
                              value={dateFilter.end}
                              onChange={(e) =>
                                setDateFilter({ ...dateFilter, end: e.target.value })
                              }
                              className="unified-input w-full pl-10"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 활동 필터 그룹 */}
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Zap className="w-4 h-4 text-muted" />
                      <label className="unified-label text-base font-semibold">활동 정보</label>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="unified-label flex items-center gap-2">
                          <User className="w-4 h-4" />
                          관리자
                        </label>
                        <select
                          value={adminIdFilter}
                          onChange={(e) => setAdminIdFilter(e.target.value)}
                          className="unified-input w-full"
                        >
                          <option value="">전체</option>
                          {uniqueAdmins.map((admin) => (
                            <option key={admin.value} value={admin.value}>
                              {admin.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="unified-label flex items-center gap-2">
                          <Zap className="w-4 h-4" />
                          액션
                        </label>
                        <select
                          value={actionFilter}
                          onChange={(e) => setActionFilter(e.target.value)}
                          className="unified-input w-full"
                        >
                          <option value="">전체</option>
                          {uniqueActions.map((action) => (
                            <option key={action} value={action}>
                              {action}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="unified-label flex items-center gap-2">
                          <Folder className="w-4 h-4" />
                          대상 타입
                        </label>
                        <select
                          value={targetTypeFilter}
                          onChange={(e) => setTargetTypeFilter(e.target.value)}
                          className="unified-input w-full"
                        >
                          <option value="">전체</option>
                          {uniqueTargetTypes.map((type) => (
                            <option key={type} value={type}>
                              {type}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              )}
            </div>
          </Card>
        </div>

        {/* 테이블 */}
        <Card className="unified-card">
          <div className="px-4 py-3 border-b border-line flex items-center justify-between">
            <span className="text-sm text-muted">
              {searchTerm ? (
                <>검색 결과 {filteredLogs.length}건</>
              ) : (
                <>전체 {pagination.total}건</>
              )}
            </span>
            <span className="text-sm text-muted">
              {searchTerm ? (
                <>
                  {filteredLogs.length > 0 ? (
                    <>
                      {(pagination.page - 1) * pagination.limit + 1} -{" "}
                      {Math.min(pagination.page * pagination.limit, filteredLogs.length)} /{" "}
                      {filteredLogs.length}
                    </>
                  ) : (
                    <>0 / 0</>
                  )}
                </>
              ) : (
                <>
                  {(pagination.page - 1) * pagination.limit + 1} -{" "}
                  {Math.min(pagination.page * pagination.limit, pagination.total)} /{" "}
                  {pagination.total}
                </>
              )}
            </span>
          </div>

          <Table
            columns={columns}
            data={filteredLogs}
            keyExtractor={(item) => String(item.log_id)}
            onSort={handleSort}
            sortKey={sortKey}
            sortDirection={sortDirection}
            emptyMessage={
              searchTerm
                ? "검색 결과가 없습니다."
                : "활동 로그가 없습니다."
            }
            hoverable
            onRowClick={handleViewDetail}
          />

          {/* 페이지네이션: 서버 사이드 페이지네이션 활용 */}
          {pagination.total_pages > 1 && (
            <div className="p-4 border-t border-line">
              <Pagination
                currentPage={pagination.page}
                totalPages={pagination.total_pages}
                onPageChange={(page) => {
                  setPagination((prev) => ({ ...prev, page }));
                }}
              />
            </div>
          )}
        </Card>

        {/* 상세보기 모달 */}
        <Modal
          isOpen={isDetailModalOpen}
          onClose={() => {
            setIsDetailModalOpen(false);
            setSelectedLog(null);
          }}
          title=""
          size="lg"
          showCloseButton={false}
        >
          {selectedLog && (
            <div>
              {/* 커스텀 헤더 */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-line bg-gradient-to-r from-paper to-white -mx-6 -mt-4 mb-6 rounded-t-xl">
                <div className="flex items-center gap-3">
                  <h3 className="text-lg font-semibold text-ink">활동 로그 상세</h3>
                  <span className="px-2.5 py-1 text-xs font-medium text-muted bg-chip rounded-md">
                    ID: {selectedLog.log_id}
                  </span>
                </div>
                <button
                  onClick={() => {
                    setIsDetailModalOpen(false);
                    setSelectedLog(null);
                  }}
                  className="p-2 rounded-lg hover:bg-chip transition-colors"
                  aria-label="닫기"
                >
                  <X className="w-5 h-5 text-muted" />
                </button>
              </div>

              {/* 섹션 목록 */}
              <div className="space-y-6">
                {/* 액션 및 관리자 정보 (Highlight) */}
                <div>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-3 h-3 bg-accent rounded-full border-2 border-panel flex-shrink-0"></div>
                    <h4 className="text-sm font-semibold text-ink">
                      <span className="px-2.5 py-1 text-xs font-semibold text-white bg-accent rounded-md mr-2">
                        {selectedLog.action}
                      </span>
                      {selectedLog.details?.reason && (
                        <span className="text-sm font-medium text-ink">
                          {selectedLog.details.reason as string}
                        </span>
                      )}
                    </h4>
                  </div>
                  <div className="bg-accent/5 border border-accent/20 rounded-lg p-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-4">
                        <div className="w-20 text-xs text-muted font-medium">관리자</div>
                        <div className="flex-1 text-sm text-ink">
                          {selectedLog.admin_name || "SYSTEM"}
                          {selectedLog.admin_id && ` (ID: ${selectedLog.admin_id})`}
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="w-20 text-xs text-muted font-medium">시간</div>
                        <div className="flex-1 text-sm text-ink">
                          {new Date(selectedLog.created_at).toLocaleString("ko-KR", {
                            year: "numeric",
                            month: "2-digit",
                            day: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit",
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 대상 정보 */}
                <div>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-3 h-3 bg-line rounded-full border-2 border-panel flex-shrink-0"></div>
                    <h4 className="text-sm font-semibold text-ink">대상 정보</h4>
                  </div>
                  <div className="bg-paper border border-line rounded-lg p-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-4">
                        <div className="w-20 text-xs text-muted font-medium">대상 타입</div>
                        <div className="flex-1 text-sm text-ink">{selectedLog.target_type}</div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="w-20 text-xs text-muted font-medium">대상 ID</div>
                        <div className="flex-1 text-sm text-ink">{selectedLog.target_id || "-"}</div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="w-20 text-xs text-muted font-medium">대상 이름</div>
                        <div className="flex-1 text-sm text-ink">{selectedLog.target_name || "-"}</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 상세 정보 */}
                {selectedLog.details && Object.keys(selectedLog.details).length > 0 && (
                  <div>
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-3 h-3 bg-line rounded-full border-2 border-panel flex-shrink-0"></div>
                      <h4 className="text-sm font-semibold text-ink">상세 정보</h4>
                    </div>
                    <div className="bg-paper border border-line rounded-lg p-4">
                      <div className="space-y-2">
                        {Object.entries(selectedLog.details).map(([key, value]) => (
                          <div key={key} className="flex items-center gap-4">
                            <div className="w-20 text-xs text-muted font-medium capitalize">
                              {key}
                            </div>
                            <div className="flex-1 text-sm text-ink break-words">
                              {typeof value === "object" ? JSON.stringify(value, null, 2) : String(value)}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* 접속 환경 */}
                {(selectedLog.ip_address || selectedLog.user_agent) && (
                  <div>
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-3 h-3 bg-line rounded-full border-2 border-panel flex-shrink-0"></div>
                      <h4 className="text-sm font-semibold text-ink">접속 환경</h4>
                    </div>
                    <div className="bg-paper border border-line rounded-lg p-4">
                      <div className="space-y-2">
                        {selectedLog.ip_address && (
                          <div className="flex items-center gap-4">
                            <div className="w-20 text-xs text-muted font-medium">IP 주소</div>
                            <div className="flex-1 text-sm text-ink font-mono">{selectedLog.ip_address}</div>
                          </div>
                        )}
                        {selectedLog.user_agent && (
                          <div className="flex items-center gap-4">
                            <div className="w-20 text-xs text-muted font-medium">User Agent</div>
                            <div className="flex-1 text-sm text-ink font-mono break-all">
                              {selectedLog.user_agent}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </Modal>
      </div>
    </div>
  );
};

export default ActivityLogPage;
