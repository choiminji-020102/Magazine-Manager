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
import { formatDateTime } from "@/utils/format";
import { ACTIVITY_ACTION_LABEL, ACTIVITY_TARGET_LABEL } from "@/utils/constants";
import type { ActivityLogResponse } from "@/types/activityLog";

const ACTION_OPTIONS = [
  { value: "", label: "전체 액션" },
  { value: "CREATE", label: "생성" },
  { value: "UPDATE", label: "수정" },
  { value: "DELETE", label: "삭제" },
  { value: "ACTIVATE", label: "활성화" },
  { value: "DEACTIVATE", label: "비활성화" },
  { value: "RESTORE", label: "복구" },
  { value: "CANCEL", label: "취소" },
  { value: "DISPATCH", label: "발송" },
  { value: "LOGIN", label: "로그인" },
  { value: "LOGOUT", label: "로그아웃" },
  { value: "SIGNUP", label: "가입" },
  { value: "ANSWER", label: "답변" },
];

export default function ActivityLogPage() {
  const [page, setPage] = useState(1);
  const [action, setAction] = useState("");
  const [adminSearch, setAdminSearch] = useState("");
  const [detailLog, setDetailLog] = useState<ActivityLogResponse | null>(null);

  const limit = 30;

  const { data, isLoading } = useQuery({
    queryKey: ["activity-logs", page, limit, action],
    queryFn: () =>
      activityLogsApi
        .getActivityLogs({
          page,
          limit,
          action: action || null,
        })
        .then((r) => r.data),
  });

  // 클라이언트 사이드 관리자명 필터 (API가 admin 검색 미지원 시)
  const filtered = adminSearch
    ? (data?.items ?? []).filter((log) =>
        log.admin_name?.toLowerCase().includes(adminSearch.toLowerCase())
      )
    : (data?.items ?? []);

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
            <Select value={action} onValueChange={(v) => { setAction(v === "_all" ? "" : v); setPage(1); }}>
              <SelectTrigger className="w-28">
                <SelectValue placeholder="전체 액션" />
              </SelectTrigger>
              <SelectContent>
                {ACTION_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value || "_all"}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              className="w-40"
              placeholder="관리자명 검색"
              value={adminSearch}
              onChange={(e) => { setAdminSearch(e.target.value); }}
            />
          </>
        }
        hasActiveFilters={!!(action || adminSearch)}
        onReset={() => { setAction(""); setAdminSearch(""); setPage(1); }}
        chips={[
          ...(action ? [{ label: `액션: ${ACTION_OPTIONS.find(o => o.value === action)?.label}`, onRemove: () => { setAction(""); setPage(1); } }] : []),
          ...(adminSearch ? [{ label: `관리자: ${adminSearch}`, onRemove: () => { setAdminSearch(""); } }] : []),
        ]}
      />

      {/* 테이블 */}
      <div className="flex-1 overflow-hidden bg-white">
        <div className="h-full overflow-y-auto">
          <DataTable
            columns={columns}
            data={filtered}
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
