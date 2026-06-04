import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DataTable, type ColumnDef } from "@/components/common/DataTable";
import { FilterBar } from "@/components/common/FilterBar";
import { PageHeader } from "@/components/common/PageHeader";
import { Pagination } from "@/components/common/Pagination";
import { activityLogsApi } from "@/api/activityLogsApi";
import { adminsApi } from "@/api/adminsApi";
import { formatDateTime } from "@/utils/format";
import { ACTIVITY_ACTION_LABEL, ACTIVITY_TARGET_LABEL } from "@/utils/constants";
import type { ActivityLogResponse } from "@/types/activityLog";

const ACTION_OPTIONS = Object.entries(ACTIVITY_ACTION_LABEL).map(([value, label]) => ({ value, label }));
const TARGET_OPTIONS = Object.entries(ACTIVITY_TARGET_LABEL).map(([value, label]) => ({ value, label }));

export default function ActivityLogPage() {
  const [page, setPage] = useState(1);
  const [action, setAction] = useState("");
  const [targetType, setTargetType] = useState("");
  const [adminId, setAdminId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [detailLog, setDetailLog] = useState<ActivityLogResponse | null>(null);

  const limit = 30;

  // 관리자 목록 조회 (Select 옵션용)
  const { data: adminsData } = useQuery({
    queryKey: ["admins-for-filter"],
    queryFn: () => adminsApi.getAdmins({ page: 1, limit: 100 }).then((r) => r.data.items ?? []),
  });

  const { data, isLoading } = useQuery({
    queryKey: ["activity-logs", page, limit, action, targetType, adminId, startDate, endDate],
    queryFn: () =>
      activityLogsApi
        .getActivityLogs({
          page,
          limit,
          action: action || null,
          target_type: targetType || null,
          admin_id: adminId ? parseInt(adminId) : null,
          start_date: startDate || null,
          end_date: endDate || null,
        })
        .then((r) => r.data),
  });

  const hasFilters = !!(action || targetType || adminId || startDate || endDate);

  const resetFilters = () => {
    setAction("");
    setTargetType("");
    setAdminId("");
    setStartDate("");
    setEndDate("");
    setPage(1);
  };

  const chips = [
    ...(action ? [{ label: `액션: ${ACTIVITY_ACTION_LABEL[action]}`, onRemove: () => { setAction(""); setPage(1); } }] : []),
    ...(targetType ? [{ label: `대상: ${ACTIVITY_TARGET_LABEL[targetType]}`, onRemove: () => { setTargetType(""); setPage(1); } }] : []),
    ...(adminId && adminsData ? [{ label: `관리자: ${adminsData.find((a) => a.admin_id === parseInt(adminId))?.admin_name ?? adminId}`, onRemove: () => { setAdminId(""); setPage(1); } }] : []),
    ...(startDate ? [{ label: `시작: ${startDate}`, onRemove: () => { setStartDate(""); setPage(1); } }] : []),
    ...(endDate ? [{ label: `종료: ${endDate}`, onRemove: () => { setEndDate(""); setPage(1); } }] : []),
  ];

  const columns: ColumnDef<ActivityLogResponse>[] = [
    {
      key: "admin",
      header: "관리자",
      cell: (row) => (
        <span className="text-[13px] text-gray-700">{row.admin_name ?? "-"}</span>
      ),
      width: "w-28",
    },
    {
      key: "action",
      header: "액션",
      cell: (row) => (
        <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
          {ACTIVITY_ACTION_LABEL[row.action] ?? row.action}
        </span>
      ),
      width: "w-20",
    },
    {
      key: "target",
      header: "대상",
      cell: (row) => (
        <div>
          <span className="text-xs text-gray-500">
            {ACTIVITY_TARGET_LABEL?.[row.target_type] ?? row.target_type}
          </span>
          {row.target_name && (
            <span className="ml-1.5 text-[13px] text-gray-700">{row.target_name}</span>
          )}
          {row.target_id && (
            <span className="ml-1 text-xs text-gray-400 font-mono">#{row.target_id}</span>
          )}
        </div>
      ),
    },
    {
      key: "details",
      header: "상세",
      cell: (row) =>
        row.details ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setDetailLog(row);
            }}
            className="text-xs text-blue-600 hover:underline"
          >
            보기
          </button>
        ) : (
          <span className="text-xs text-gray-300">-</span>
        ),
      width: "w-16",
    },
    {
      key: "ip",
      header: "IP",
      cell: (row) => (
        <span className="text-xs text-gray-400 font-mono">{row.ip_address ?? "-"}</span>
      ),
      width: "w-28",
    },
    {
      key: "created_at",
      header: "일시",
      cell: (row) => (
        <span className="text-xs text-gray-400">{formatDateTime(row.created_at)}</span>
      ),
      width: "w-36",
    },
  ];

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <PageHeader left={<span className="text-sm text-gray-500">총 {data?.total ?? 0}건</span>} />
      <FilterBar
        basic={
          <>
            <Select value={action || "_all"} onValueChange={(v) => { setAction(v === "_all" ? "" : v); setPage(1); }}>
              <SelectTrigger className="w-28">
                <SelectValue placeholder="전체 액션" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">전체 액션</SelectItem>
                {ACTION_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={targetType || "_all"} onValueChange={(v) => { setTargetType(v === "_all" ? "" : v); setPage(1); }}>
              <SelectTrigger className="w-28">
                <SelectValue placeholder="전체 대상" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">전체 대상</SelectItem>
                {TARGET_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={adminId || "_all"} onValueChange={(v) => { setAdminId(v === "_all" ? "" : v); setPage(1); }}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="전체 관리자" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">전체 관리자</SelectItem>
                {(adminsData ?? []).map((admin) => (
                  <SelectItem key={admin.admin_id} value={String(admin.admin_id)}>
                    {admin.admin_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        }
        advanced={
          <>
            <Input
              type="date"
              className="w-36"
              value={startDate}
              onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
            />
            <span className="text-xs text-gray-400">~</span>
            <Input
              type="date"
              className="w-36"
              value={endDate}
              onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
            />
          </>
        }
        advancedActiveCount={(startDate ? 1 : 0) + (endDate ? 1 : 0)}
        hasActiveFilters={hasFilters}
        onReset={resetFilters}
        chips={chips}
      />

      {/* 테이블 */}
      <div className="flex-1 overflow-hidden bg-white">
        <div className="h-full overflow-y-auto">
          <DataTable
            columns={columns}
            data={data?.items ?? []}
            getRowId={(row) => row.log_id}
            isLoading={isLoading}
            emptyMessage="활동 로그가 없습니다."
          />
        </div>
      </div>

      {data && (
        <div className="bg-white border-t border-gray-200">
          <Pagination
            page={page}
            totalPages={data.total_pages}
            total={data.total}
            limit={limit}
            onPageChange={setPage}
          />
        </div>
      )}

      {/* 상세 정보 모달 */}
      <Dialog open={!!detailLog} onOpenChange={(open) => !open && setDetailLog(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>활동 로그 상세</DialogTitle>
          </DialogHeader>
          {detailLog && (
            <div className="space-y-3">
              <div className="text-xs text-gray-500 space-y-1">
                <div>관리자: {detailLog.admin_name ?? "-"}</div>
                <div>액션: {ACTIVITY_ACTION_LABEL[detailLog.action] ?? detailLog.action}</div>
                <div>
                  대상: {ACTIVITY_TARGET_LABEL?.[detailLog.target_type] ?? detailLog.target_type}
                  {detailLog.target_name && ` · ${detailLog.target_name}`}
                </div>
                <div>IP: {detailLog.ip_address ?? "-"}</div>
                <div>일시: {formatDateTime(detailLog.created_at)}</div>
              </div>
              {detailLog.details && (
                <pre className="bg-gray-50 border border-gray-200 rounded-md p-3 text-xs text-gray-700 overflow-x-auto max-h-64 overflow-y-auto">
                  {JSON.stringify(detailLog.details, null, 2)}
                </pre>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
