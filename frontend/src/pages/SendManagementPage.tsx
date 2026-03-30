import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Download, Upload, RefreshCw, MoreHorizontal, Edit2, X } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DataTable, type ColumnDef } from "@/components/common/DataTable";
import { Pagination } from "@/components/common/Pagination";
import { StatusBadge } from "@/components/common/StatusBadge";
import { ConfirmModal } from "@/components/common/ConfirmModal";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { FilterBar } from "@/components/common/FilterBar";
import { PageHeader } from "@/components/common/PageHeader";
import { SlidingPanel } from "@/components/common/SlidingPanel";
import { useDebounce } from "@/hooks/useDebounce";
import { dispatchApi } from "@/api/dispatchApi";
import { sendsApi } from "@/api/sendsApi";
import { sendItemsApi } from "@/api/sendItemsApi";
import { toast } from "@/hooks/use-toast";
import { formatDate, formatDateTime, formatIssue, formatPhone, formatAmount } from "@/utils/format";
import type { DispatchTarget, DispatchGenerateResponse, DispatchSummaryResponse } from "@/types/dispatch";
import type { SendResponse, SendDetailResponse, SendUpdate } from "@/types/send";
import type { SendItemResponse } from "@/types/sendItem";

function currentIssue() {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// ─────────────────────────────────────────────
// 루트
// ─────────────────────────────────────────────
export default function SendManagementPage() {
  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <Tabs defaultValue="dispatch" className="flex-1 overflow-hidden flex flex-col">
        <div className="px-5 py-3 bg-white border-b border-gray-200">
          <TabsList>
            <TabsTrigger value="dispatch">발송 처리</TabsTrigger>
            <TabsTrigger value="status">발송 현황</TabsTrigger>
            <TabsTrigger value="monthly-excel">기출유 연동</TabsTrigger>
          </TabsList>
        </div>

        <div className="flex-1 overflow-hidden">
          <TabsContent value="dispatch" className="h-full m-0">
            <DispatchTab />
          </TabsContent>
          <TabsContent value="status" className="h-full m-0 overflow-y-auto">
            <SendStatusTab />
          </TabsContent>
          <TabsContent value="monthly-excel" className="h-full m-0 overflow-y-auto">
            <MonthlyExcelTab />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}

// ─────────────────────────────────────────────
// 탭 1: 발송 처리 (서브 뷰: 발송 생성 | 파주(13113))
// ─────────────────────────────────────────────
function DispatchTab() {
  const queryClient = useQueryClient();
  const [view, setView] = useState<"dispatch" | "postal13113">("dispatch");

  // 발송 생성 뷰 상태 (컨트롤 바를 DispatchTab 레벨에서 관리해 서브 바 제거)
  const [issue, setIssue] = useState(currentIssue());
  const [productKind, setProductKind] = useState<"YEARLY" | "MONTHLY">("YEARLY");
  const [officialSendDate, setOfficialSendDate] = useState("");
  const [recipientSearch, setRecipientSearch] = useState("");
  const [productCodeFilter, setProductCodeFilter] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string | number>>(new Set());
  const [resultModal, setResultModal] = useState<DispatchGenerateResponse | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const debouncedRecipientSearch = useDebounce(recipientSearch, 300);
  const debouncedProductCodeFilter = useDebounce(productCodeFilter, 300);

  const { data: summaryRes } = useQuery<DispatchSummaryResponse | null>({
    queryKey: ["dispatch-summary", issue],
    queryFn: () => dispatchApi.getDispatchSummary(issue).then((r) => r.data.data ?? null),
    enabled: issue.length === 6 && view === "dispatch",
  });

  const { data: targetsRes, isLoading, refetch } = useQuery({
    queryKey: ["dispatch-targets", issue, productKind, debouncedRecipientSearch, debouncedProductCodeFilter],
    queryFn: () => {
      const fn = productKind === "YEARLY" ? dispatchApi.getYearlyTargets : dispatchApi.getMonthlyTargets;
      return fn({
        issue,
        limit: 200,
        recipient_search: debouncedRecipientSearch || null,
        product_code: debouncedProductCodeFilter || null,
      }).then((r) => r.data);
    },
    enabled: issue.length === 6 && view === "dispatch",
  });

  const targets = targetsRes?.data?.targets ?? [];
  const productSummary = targetsRes?.data?.product_summary ?? {};

  const generateMutation = useMutation({
    mutationFn: () => {
      const fn = productKind === "YEARLY" ? dispatchApi.generateYearlyDispatch : dispatchApi.generateMonthlyDispatch;
      return fn({
        issue,
        official_send_date: officialSendDate || null,
        order_item_ids: Array.from(selectedIds) as number[],
      });
    },
    onSuccess: (res) => {
      const result = res.data?.data;
      if (result) setResultModal(result);
      toast.success(`${result?.success_count ?? 0}건 발송 생성 완료`);
      queryClient.invalidateQueries({ queryKey: ["dispatch-targets"] });
      queryClient.invalidateQueries({ queryKey: ["dispatch-summary"] });
      setSelectedIds(new Set());
      setConfirmOpen(false);
    },
    onError: () => toast.error("발송 생성 실패"),
  });

  const columns: ColumnDef<DispatchTarget>[] = [
    {
      key: "product",
      header: "상품",
      cell: (row) => (
        <div>
          <div className="text-[13px] font-medium text-gray-900">{row.product_name}</div>
          <div className="text-xs text-gray-400 font-mono">{row.product_code}</div>
        </div>
      ),
    },
    {
      key: "recipient",
      header: "수령인",
      cell: (row) => (
        <div>
          <div className="text-[13px] text-gray-700">{row.recipient_name ?? "-"}</div>
          <div className="text-xs text-gray-400 font-mono">
            {row.recipient_phone ? formatPhone(row.recipient_phone) : ""}
          </div>
        </div>
      ),
    },
    {
      key: "address",
      header: "주소",
      cell: (row) => (
        <span className="text-xs text-gray-600">
          {row.postal_code ? `(${row.postal_code})` : ""} {row.recipient_address ?? "-"}
        </span>
      ),
    },
    {
      key: "subscribe",
      header: "구독 기간",
      cell: (row) => (
        <span className="text-xs text-gray-500">
          {row.final_subscribe_end_issue ? `~ ${formatIssue(row.final_subscribe_end_issue)}` : "-"}
        </span>
      ),
      width: "w-28",
    },
    {
      key: "last_send",
      header: "마지막 발송",
      cell: (row) => (
        <span className="text-xs text-gray-400">
          {row.last_send_issue ? formatIssue(row.last_send_issue) : "-"}
        </span>
      ),
      width: "w-24",
    },
  ];

  return (
    <div className="flex-1 min-h-0 flex flex-col">

      {/* ── 통합 컨트롤 바 ── */}
      <div className="px-5 py-2.5 bg-white border-b border-gray-200 flex items-center gap-3 flex-wrap">

        {/* 서브 뷰 selector */}
        <div className="flex rounded-md overflow-hidden border border-gray-200 flex-shrink-0">
          {(["dispatch", "postal13113"] as const).map((v, i) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                view === v ? "bg-blue-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"
              } ${i > 0 ? "border-l border-gray-200" : ""}`}
            >
              {v === "dispatch" ? "발송 생성" : "파주(13113)"}
            </button>
          ))}
        </div>

        {/* 발송 생성 전용 컨트롤 */}
        {view === "dispatch" && (
          <>
            <div className="h-4 w-px bg-gray-200 flex-shrink-0" />

            {/* 발송 호 */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400 whitespace-nowrap">발송 호</span>
              <Input
                className="w-24 h-8 text-sm"
                placeholder="YYYYMM"
                maxLength={6}
                value={issue}
                onChange={(e) => setIssue(e.target.value.replace(/\D/g, ""))}
              />
              {issue.length === 6 && (
                <span className="text-xs font-medium text-blue-600 whitespace-nowrap">
                  {formatIssue(issue)}
                </span>
              )}
            </div>

            {/* YEARLY / MONTHLY */}
            <div className="flex rounded-md overflow-hidden border border-gray-200 flex-shrink-0">
              {(["YEARLY", "MONTHLY"] as const).map((kind, i) => (
                <button
                  key={kind}
                  className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                    productKind === kind ? "bg-gray-800 text-white" : "bg-white text-gray-600 hover:bg-gray-50"
                  } ${i > 0 ? "border-l border-gray-200" : ""}`}
                  onClick={() => { setProductKind(kind); setSelectedIds(new Set()); }}
                >
                  {kind}
                </button>
              ))}
            </div>

            {/* 발송예정일 */}
            <Input
              type="date"
              className="w-36 h-8 text-sm"
              value={officialSendDate}
              onChange={(e) => setOfficialSendDate(e.target.value)}
              title="공식 발송일"
            />

            {/* 검색 */}
            <Input
              className="w-36 h-8 text-sm"
              placeholder="수령인 검색"
              value={recipientSearch}
              onChange={(e) => setRecipientSearch(e.target.value)}
            />
            <Input
              className="w-28 h-8 text-sm"
              placeholder="상품 코드"
              value={productCodeFilter}
              onChange={(e) => setProductCodeFilter(e.target.value)}
            />

            <Button variant="ghost" size="sm" className="h-8 px-2 text-gray-400 hover:text-gray-600" onClick={() => refetch()}>
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </>
        )}

        {/* 오른쪽: 선택 카운트 + 발송 생성 */}
        {view === "dispatch" && (
          <div className="ml-auto flex items-center gap-2 flex-shrink-0">
            {selectedIds.size > 0 && (
              <span className="text-xs font-medium text-blue-600">{selectedIds.size}건 선택</span>
            )}
            <Button
              size="sm"
              className="h-8"
              onClick={() => setConfirmOpen(true)}
              disabled={selectedIds.size === 0 || generateMutation.isPending}
            >
              {generateMutation.isPending && <LoadingSpinner size="sm" className="mr-1" />}
              발송 생성
            </Button>
          </div>
        )}
      </div>

      {/* ── 요약 + 상품 집계 (발송 생성 뷰만) ── */}
      {view === "dispatch" && (summaryRes || Object.keys(productSummary).length > 0) && (
        <div className="px-5 py-2 bg-gray-50 border-b border-gray-200 flex items-center gap-3 flex-wrap min-h-0">
          {summaryRes && (
            <>
              <StatPill label="전체" value={summaryRes.total_target_count} />
              <StatPill label="완료" value={summaryRes.dispatched_count} color="green" />
              <StatPill label="미발송" value={summaryRes.pending_count} color="amber" />
              {Object.entries(summaryRes.by_status).length > 0 && (
                <div className="h-3.5 w-px bg-gray-300" />
              )}
              {Object.entries(summaryRes.by_status).map(([status, count]) => (
                <div key={status} className="flex items-center gap-1">
                  <StatusBadge type="send_status" value={status} />
                  <span className="text-xs text-gray-600 font-medium">{count}</span>
                </div>
              ))}
            </>
          )}
          {Object.keys(productSummary).length > 0 && summaryRes && (
            <div className="h-3.5 w-px bg-gray-300" />
          )}
          {Object.keys(productSummary).length > 0 && (
            <>
              {Object.entries(productSummary).map(([code, count]) => (
                <span key={code} className="text-xs text-gray-500">
                  <span className="font-mono text-gray-400">{code}</span> {count as number}건
                </span>
              ))}
              <span className="text-xs text-gray-400 ml-auto">총 {targets.length}건</span>
            </>
          )}
        </div>
      )}

      {/* ── 발송 생성 테이블 ── */}
      {view === "dispatch" && (
        <div className="flex-1 overflow-y-auto bg-white">
          <DataTable
            columns={columns}
            data={targets}
            getRowId={(row) => row.order_item_id}
            isLoading={isLoading}
            emptyMessage={issue.length === 6 ? "발송 대상이 없습니다." : "발송 호를 입력하세요."}
            selectedIds={selectedIds}
            onSelectionChange={setSelectedIds}
          />
        </div>
      )}

      {/* ── 파주(13113) 뷰 ── */}
      {view === "postal13113" && <Postal13113View />}

      {/* 발송 생성 확인 */}
      <ConfirmModal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => generateMutation.mutate()}
        title="발송 생성"
        description={`${issue.length === 6 ? formatIssue(issue) : issue} ${selectedIds.size}건의 발송을 생성합니다.`}
        confirmLabel="발송 생성"
        isLoading={generateMutation.isPending}
      />

      {/* 결과 모달 */}
      <Dialog open={!!resultModal} onOpenChange={(open) => !open && setResultModal(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>발송 생성 결과</DialogTitle></DialogHeader>
          {resultModal && (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <div className="text-lg font-semibold text-gray-900">{resultModal.total_requested}</div>
                  <div className="text-xs text-gray-500">요청</div>
                </div>
                <div className="bg-green-50 rounded-lg p-3 text-center">
                  <div className="text-lg font-semibold text-green-700">{resultModal.success_count}</div>
                  <div className="text-xs text-green-600">성공</div>
                </div>
                <div className="bg-red-50 rounded-lg p-3 text-center">
                  <div className="text-lg font-semibold text-red-600">{resultModal.fail_count}</div>
                  <div className="text-xs text-red-500">실패</div>
                </div>
              </div>
              {resultModal.fail_count > 0 && (
                <div className="text-xs max-h-32 overflow-y-auto space-y-1">
                  {resultModal.results.filter((r) => !r.success).map((r) => (
                    <div key={r.order_item_id} className="text-red-500">
                      품목 #{r.order_item_id}: {r.message}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─────────────────────────────────────────────
// 파주(13113) 직접 발송 처리 뷰
// ─────────────────────────────────────────────
const POSTAL13113_STATUS_OPTIONS = [
  { value: "", label: "전체 상태" },
  { value: "PREPARING", label: "준비중" },
  { value: "WAITING", label: "대기" },
  { value: "SHIPPING", label: "배송중" },
  { value: "DELIVERED", label: "배송완료" },
];

function Postal13113View() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [sendStatus, setSendStatus] = useState("");
  const limit = 20;

  const { data, isLoading } = useQuery({
    queryKey: ["sends-13113", page, limit, sendStatus],
    queryFn: () =>
      sendsApi
        .getSendsPostalCode13113({ page, limit, send_status: sendStatus || null })
        .then((r) => r.data),
  });

  const waitingMutation = useMutation({
    mutationFn: (sendId: number) => sendsApi.waitingSend(sendId),
    onSuccess: () => {
      toast.success("대기 상태로 변경되었습니다. (자체배송)");
      queryClient.invalidateQueries({ queryKey: ["sends-13113"] });
    },
    onError: () => toast.error("상태 변경 실패"),
  });

  const columns: ColumnDef<SendResponse>[] = [
    {
      key: "send_id",
      header: "발송번호",
      cell: (row) => <span className="font-mono text-xs text-gray-400">#{row.send_id}</span>,
      width: "w-20",
    },
    {
      key: "recipient",
      header: "수령인",
      cell: (row) => (
        <div>
          <div className="text-[13px] font-medium text-gray-900">{row.recipient_name}</div>
          <div className="text-xs text-gray-400 font-mono">{formatPhone(row.recipient_phone)}</div>
        </div>
      ),
    },
    {
      key: "address",
      header: "주소",
      cell: (row) => (
        <span className="text-xs text-gray-600">{row.recipient_address}</span>
      ),
    },
    {
      key: "status",
      header: "상태",
      cell: (row) => <StatusBadge type="send_status" value={row.send_status} />,
      width: "w-24",
    },
    {
      key: "official_send_date",
      header: "발송예정일",
      cell: (row) => (
        <span className="text-xs text-gray-400">
          {row.official_send_date ? formatDate(row.official_send_date) : "-"}
        </span>
      ),
      width: "w-24",
    },
    {
      key: "actions",
      header: "",
      cell: (row) => {
        if (row.send_status !== "PREPARING") return null;
        return (
          <Button
            variant="outline"
            size="sm"
            className="text-xs"
            onClick={(e) => { e.stopPropagation(); waitingMutation.mutate(row.send_id); }}
            disabled={waitingMutation.isPending}
          >
            대기 전환
          </Button>
        );
      },
      width: "w-28",
      className: "text-right",
    },
  ];

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* 서브 컨트롤 바 */}
      <div className="px-5 py-2.5 bg-amber-50 border-b border-amber-100 flex items-center gap-3">
        <span className="text-xs text-amber-700">우편번호 13113 — 관리자 자체배송 처리 대상</span>
        <div className="ml-auto flex items-center gap-2">
          <Select value={sendStatus} onValueChange={(v) => { setSendStatus(v === "_all" ? "" : v); setPage(1); }}>
            <SelectTrigger className="w-28 h-7 text-xs bg-white">
              <SelectValue placeholder="전체 상태" />
            </SelectTrigger>
            <SelectContent>
              {POSTAL13113_STATUS_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value || "_all"}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-xs text-amber-600">총 {data?.total ?? 0}건</span>
        </div>
      </div>

      <div className="flex-1 overflow-hidden bg-white">
        <div className="h-full overflow-y-auto">
          <DataTable
            columns={columns}
            data={data?.items ?? []}
            getRowId={(row) => row.send_id}
            isLoading={isLoading}
            emptyMessage="파주(13113) 발송 대상이 없습니다."
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
    </div>
  );
}

/** 요약 수치 pill */
function StatPill({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color?: "green" | "amber";
}) {
  const bg = color === "green"
    ? "bg-green-50 border-green-200"
    : color === "amber"
    ? "bg-amber-50 border-amber-200"
    : "bg-white border-gray-200";
  const textLabel = color === "green"
    ? "text-green-600"
    : color === "amber"
    ? "text-amber-600"
    : "text-gray-500";
  const textValue = color === "green"
    ? "text-green-700"
    : color === "amber"
    ? "text-amber-700"
    : "text-gray-900";

  return (
    <div className={`flex items-center gap-1.5 border rounded-md px-2.5 py-1 ${bg}`}>
      <span className={`text-xs ${textLabel}`}>{label}</span>
      <span className={`text-sm font-semibold ${textValue}`}>{value}</span>
    </div>
  );
}

// ─────────────────────────────────────────────
// 탭 2: 발송 현황
// ─────────────────────────────────────────────
const STATUS_OPTIONS = [
  { value: "", label: "전체 상태" },
  { value: "PREPARING", label: "준비중" },
  { value: "WAITING", label: "대기" },
  { value: "SHIPPING", label: "배송중" },
  { value: "DELIVERED", label: "배송완료" },
  { value: "CANCELLED", label: "취소" },
];

const COURIER_OPTIONS = [
  { value: "", label: "전체 택배사" },
  { value: "CJ대한통운", label: "CJ대한통운" },
  { value: "자체배송", label: "자체배송" },
];

function SendStatusTab() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [sendStatus, setSendStatus] = useState("");
  const [recipientSearch, setRecipientSearch] = useState("");
  const [trackingSearch, setTrackingSearch] = useState("");
  const [courierCompany, setCourierCompany] = useState("");
  const [officialSendDate, setOfficialSendDate] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isCancelled, setIsCancelled] = useState("");
  const [postalCode, setPostalCode] = useState("");

  const debouncedRecipientSearch = useDebounce(recipientSearch, 300);
  const debouncedTrackingSearch = useDebounce(trackingSearch, 300);

  const [panelOpen, setPanelOpen] = useState(false);
  const [selectedSendId, setSelectedSendId] = useState<number | null>(null);
  const [cancelTarget, setCancelTarget] = useState<number | null>(null);
  const [trackingTarget, setTrackingTarget] = useState<SendResponse | null>(null);
  const [trackingForm, setTrackingForm] = useState({ tracking_no: "", courier_company: "CJ대한통운" });
  const [excelLoading, setExcelLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string | number>>(new Set());
  const [batchStatusOpen, setBatchStatusOpen] = useState(false);
  const [batchStatus, setBatchStatus] = useState("WAITING");
  const limit = 20;

  const handleRowClick = useCallback((row: SendResponse) => {
    setSelectedSendId(row.send_id);
    setPanelOpen(true);
  }, []);

  const handlePanelClose = useCallback(() => {
    setPanelOpen(false);
    setTimeout(() => setSelectedSendId(null), 250);
  }, []);

  const handleExcelDownload = async () => {
    setExcelLoading(true);
    try {
      const res = await sendsApi.exportSendsToExcel({
        official_send_date: officialSendDate || null,
        send_status: sendStatus || null,
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      link.download = `sends_${today}.xlsx`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error("엑셀 다운로드 실패");
    } finally {
      setExcelLoading(false);
    }
  };

  const waitingMutation = useMutation({
    mutationFn: (sendId: number) => sendsApi.waitingSend(sendId),
    onSuccess: () => {
      toast.success("대기 상태로 변경되었습니다.");
      queryClient.invalidateQueries({ queryKey: ["sends"] });
    },
    onError: () => toast.error("상태 변경 실패"),
  });

  const trackingMutation = useMutation({
    mutationFn: ({ sendId, data }: { sendId: number; data: { tracking_no: string; courier_company: string } }) =>
      sendsApi.updateTracking(sendId, data),
    onSuccess: () => {
      toast.success("운송장이 등록되었습니다.");
      queryClient.invalidateQueries({ queryKey: ["sends"] });
      setTrackingTarget(null);
    },
    onError: () => toast.error("운송장 등록 실패"),
  });

  const cancelMutation = useMutation({
    mutationFn: (sendId: number) => sendsApi.cancelSend(sendId),
    onSuccess: () => {
      toast.success("발송이 취소되었습니다.");
      queryClient.invalidateQueries({ queryKey: ["sends"] });
      setCancelTarget(null);
    },
    onError: () => toast.error("발송 취소 실패"),
  });

  const batchStatusMutation = useMutation({
    mutationFn: async (targetStatus: string) => {
      const ids = Array.from(selectedIds) as number[];
      await Promise.all(ids.map((id) => sendsApi.updateSendStatus(id, { send_status: targetStatus })));
    },
    onSuccess: () => {
      toast.success(`${selectedIds.size}건 상태가 변경되었습니다.`);
      queryClient.invalidateQueries({ queryKey: ["sends"] });
      setSelectedIds(new Set());
      setBatchStatusOpen(false);
    },
    onError: () => toast.error("일괄 상태 변경 실패"),
  });

  const { data, isLoading } = useQuery({
    queryKey: [
      "sends", page, limit, sendStatus,
      debouncedRecipientSearch, debouncedTrackingSearch,
      courierCompany, officialSendDate, startDate, endDate, isCancelled, postalCode,
    ],
    queryFn: () =>
      sendsApi
        .getSends({
          page,
          limit,
          send_status: sendStatus || null,
          recipient_search: debouncedRecipientSearch || null,
          tracking_no: debouncedTrackingSearch || null,
          courier_company: courierCompany || null,
          official_send_date: officialSendDate || null,
          start_date: startDate || null,
          end_date: endDate || null,
          is_cancelled: isCancelled === "" ? null : isCancelled === "true",
          postal_code: postalCode || null,
        })
        .then((r) => r.data),
  });

  const columns: ColumnDef<SendResponse>[] = [
    {
      key: "send_id",
      header: "발송번호",
      cell: (row) => (
        <span className="font-mono text-xs text-gray-400">#{row.send_id}</span>
      ),
      width: "w-20",
    },
    {
      key: "recipient",
      header: "수령인",
      cell: (row) => (
        <div>
          <div className="text-[13px] font-medium text-gray-900">{row.recipient_name}</div>
          <div className="text-xs text-gray-400 font-mono">{formatPhone(row.recipient_phone)}</div>
        </div>
      ),
    },
    {
      key: "address",
      header: "주소",
      cell: (row) => (
        <span className="text-xs text-gray-600">
          ({row.postal_code}) {row.recipient_address}
        </span>
      ),
    },
    {
      key: "status",
      header: "상태",
      cell: (row) => <StatusBadge type="send_status" value={row.send_status} />,
      width: "w-24",
    },
    {
      key: "tracking",
      header: "운송장",
      cell: (row) => (
        <span className="text-xs text-gray-600 font-mono">
          {row.courier_company ? `${row.courier_company} ` : ""}
          {row.tracking_no ?? "-"}
        </span>
      ),
      width: "w-36",
    },
    {
      key: "official_send_date",
      header: "발송예정일",
      cell: (row) => (
        <span className="text-xs text-gray-400">
          {row.official_send_date ? formatDate(row.official_send_date) : "-"}
        </span>
      ),
      width: "w-24",
    },
    {
      key: "shipped_at",
      header: "배송시작",
      cell: (row) => (
        <span className="text-xs text-gray-400">
          {row.shipped_at ? formatDate(row.shipped_at) : "-"}
        </span>
      ),
      width: "w-24",
    },
    {
      key: "actions",
      header: "",
      cell: (row) => {
        if (row.send_status === "CANCELLED") return null;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="icon-sm">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {row.send_status === "PREPARING" && (
                <DropdownMenuItem
                  onClick={(e) => { e.stopPropagation(); waitingMutation.mutate(row.send_id); }}
                >
                  대기 전환
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  setTrackingTarget(row);
                  setTrackingForm({
                    tracking_no: row.tracking_no ?? "",
                    courier_company: row.courier_company ?? "CJ대한통운",
                  });
                }}
              >
                운송장 등록
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-red-600 focus:text-red-600 focus:bg-red-50"
                onClick={(e) => { e.stopPropagation(); setCancelTarget(row.send_id); }}
              >
                발송 취소
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
      width: "w-12",
      className: "text-right",
    },
  ];

  const resetAll = () => {
    setSendStatus(""); setCourierCompany(""); setRecipientSearch(""); setTrackingSearch("");
    setOfficialSendDate(""); setStartDate(""); setEndDate(""); setIsCancelled(""); setPostalCode("");
    setPage(1);
  };

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        left={
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500">총 {data?.total ?? 0}건</span>
            {selectedIds.size > 0 && (
              <span className="text-sm text-blue-600 font-medium">{selectedIds.size}건 선택됨</span>
            )}
          </div>
        }
        actions={
          <div className="flex items-center gap-2">
            {selectedIds.size > 0 && (
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 border-blue-200 text-blue-700 hover:bg-blue-50"
                onClick={() => setBatchStatusOpen(true)}
              >
                일괄 상태변경 ({selectedIds.size})
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={handleExcelDownload}
              disabled={excelLoading}
            >
              {excelLoading ? <LoadingSpinner size="sm" /> : <Download className="h-3.5 w-3.5" />}
              엑셀 다운로드
            </Button>
          </div>
        }
      />

      <FilterBar
        basic={
          <>
            <Select value={sendStatus} onValueChange={(v) => { setSendStatus(v === "_all" ? "" : v); setPage(1); }}>
              <SelectTrigger className="w-28">
                <SelectValue placeholder="전체 상태" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value || "_all"}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={courierCompany} onValueChange={(v) => { setCourierCompany(v === "_all" ? "" : v); setPage(1); }}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="전체 택배사" />
              </SelectTrigger>
              <SelectContent>
                {COURIER_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value || "_all"}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              className="w-40"
              placeholder="수령인 검색"
              value={recipientSearch}
              onChange={(e) => { setRecipientSearch(e.target.value); setPage(1); }}
            />
            <Input
              className="w-40"
              placeholder="운송장번호"
              value={trackingSearch}
              onChange={(e) => { setTrackingSearch(e.target.value); setPage(1); }}
            />
          </>
        }
        advanced={
          <>
            <Input
              type="date"
              className="w-36"
              value={officialSendDate}
              onChange={(e) => { setOfficialSendDate(e.target.value); setPage(1); }}
              title="공식 발송일"
            />
            <Input
              type="date"
              className="w-36"
              value={startDate}
              onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
              title="시작일"
            />
            <span className="text-xs text-gray-400">~</span>
            <Input
              type="date"
              className="w-36"
              value={endDate}
              onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
              title="종료일"
            />
            <Select value={isCancelled} onValueChange={(v) => { setIsCancelled(v === "_all" ? "" : v); setPage(1); }}>
              <SelectTrigger className="w-28">
                <SelectValue placeholder="취소 여부" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">전체</SelectItem>
                <SelectItem value="true">취소만</SelectItem>
                <SelectItem value="false">취소 제외</SelectItem>
              </SelectContent>
            </Select>
            <Input
              className="w-28"
              placeholder="우편번호"
              value={postalCode}
              onChange={(e) => { setPostalCode(e.target.value); setPage(1); }}
            />
          </>
        }
        advancedActiveCount={[officialSendDate, startDate, endDate, isCancelled, postalCode].filter(Boolean).length}
        hasActiveFilters={!!(sendStatus || courierCompany || recipientSearch || trackingSearch || officialSendDate || startDate || endDate || isCancelled || postalCode)}
        onReset={resetAll}
        chips={[
          ...(sendStatus ? [{ label: `상태: ${STATUS_OPTIONS.find(o => o.value === sendStatus)?.label}`, onRemove: () => { setSendStatus(""); setPage(1); } }] : []),
          ...(courierCompany ? [{ label: `택배사: ${courierCompany}`, onRemove: () => { setCourierCompany(""); setPage(1); } }] : []),
          ...(recipientSearch ? [{ label: `수령인: ${recipientSearch}`, onRemove: () => { setRecipientSearch(""); setPage(1); } }] : []),
          ...(trackingSearch ? [{ label: `운송장: ${trackingSearch}`, onRemove: () => { setTrackingSearch(""); setPage(1); } }] : []),
          ...(officialSendDate ? [{ label: `발송예정: ${officialSendDate}`, onRemove: () => { setOfficialSendDate(""); setPage(1); } }] : []),
          ...(startDate || endDate ? [{ label: `기간: ${startDate || ""}~${endDate || ""}`, onRemove: () => { setStartDate(""); setEndDate(""); setPage(1); } }] : []),
          ...(isCancelled ? [{ label: isCancelled === "true" ? "취소만" : "취소 제외", onRemove: () => { setIsCancelled(""); setPage(1); } }] : []),
          ...(postalCode ? [{ label: `우편번호: ${postalCode}`, onRemove: () => { setPostalCode(""); setPage(1); } }] : []),
        ]}
      />

      <div className="flex-1 overflow-hidden bg-white">
        <div className="h-full overflow-y-auto">
          <DataTable
            columns={columns}
            data={data?.items ?? []}
            getRowId={(row) => row.send_id}
            onRowClick={handleRowClick}
            activeRowId={selectedSendId}
            isLoading={isLoading}
            emptyMessage="발송 내역이 없습니다."
            selectedIds={selectedIds}
            onSelectionChange={setSelectedIds}
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

      <SlidingPanel open={panelOpen} onClose={handlePanelClose} width={520}>
        {selectedSendId && (
          <SendDetailPanel sendId={selectedSendId} onClose={handlePanelClose} />
        )}
      </SlidingPanel>

      <ConfirmModal
        open={cancelTarget !== null}
        onClose={() => setCancelTarget(null)}
        onConfirm={() => cancelTarget !== null && cancelMutation.mutate(cancelTarget)}
        title="발송 취소"
        description="이 발송을 취소합니다."
        confirmLabel="취소 처리"
        variant="destructive"
        isLoading={cancelMutation.isPending}
      />

      <Dialog open={!!trackingTarget} onOpenChange={(open) => !open && setTrackingTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>운송장 등록</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div>
              <Label>택배사</Label>
              <Select
                value={trackingForm.courier_company}
                onValueChange={(v) => setTrackingForm((f) => ({ ...f, courier_company: v }))}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CJ대한통운">CJ대한통운</SelectItem>
                  <SelectItem value="자체배송">자체배송</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>운송장번호</Label>
              <Input
                className="mt-1"
                placeholder="운송장번호 입력"
                value={trackingForm.tracking_no}
                onChange={(e) => setTrackingForm((f) => ({ ...f, tracking_no: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTrackingTarget(null)}>취소</Button>
            <Button
              onClick={() => trackingTarget && trackingMutation.mutate({ sendId: trackingTarget.send_id, data: trackingForm })}
              disabled={trackingMutation.isPending || !trackingForm.tracking_no.trim()}
            >
              등록
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 일괄 상태변경 다이얼로그 */}
      <Dialog open={batchStatusOpen} onOpenChange={(o) => !o && setBatchStatusOpen(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>일괄 상태변경</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <p className="text-sm text-gray-600">
              선택된 <span className="font-semibold">{selectedIds.size}건</span>의 발송 상태를 변경합니다.
            </p>
            <div>
              <Label className="text-xs font-medium text-gray-600">변경할 상태</Label>
              <Select value={batchStatus} onValueChange={setBatchStatus}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="WAITING">배송 대기</SelectItem>
                  <SelectItem value="SHIPPING">배송 중</SelectItem>
                  <SelectItem value="DELIVERED">배송 완료</SelectItem>
                  <SelectItem value="CANCELLED">취소</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setBatchStatusOpen(false)}>취소</Button>
            <Button
              size="sm"
              onClick={() => batchStatusMutation.mutate(batchStatus)}
              disabled={batchStatusMutation.isPending}
            >
              {batchStatusMutation.isPending && <LoadingSpinner size="sm" className="mr-1" />}
              변경
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─────────────────────────────────────────────
// 발송 상세 패널
// ─────────────────────────────────────────────
function SendDetailPanel({ sendId, onClose }: { sendId: number; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<SendUpdate>({});
  const [itemCancelId, setItemCancelId] = useState<number | null>(null);
  const [editingItem, setEditingItem] = useState<SendItemResponse | null>(null);
  const [itemEditForm, setItemEditForm] = useState({ send_num: 1, admin_memo: "" });

  const { data: sendData, isLoading } = useQuery({
    queryKey: ["send", sendId],
    queryFn: () => sendsApi.getSend(sendId).then((r) => r.data.data),
    enabled: sendId !== null,
  });

  useEffect(() => {
    if (sendData) {
      setEditForm({
        recipient_name: sendData.recipient_name,
        recipient_phone: sendData.recipient_phone,
        postal_code: sendData.postal_code,
        recipient_address: sendData.recipient_address,
        customer_memo: sendData.customer_memo ?? "",
        admin_memo: sendData.admin_memo ?? "",
      });
    }
  }, [sendData]);

  const editMutation = useMutation({
    mutationFn: () => sendsApi.updateSend(sendId, editForm),
    onSuccess: () => {
      toast.success("발송이 수정되었습니다.");
      queryClient.invalidateQueries({ queryKey: ["send", sendId] });
      queryClient.invalidateQueries({ queryKey: ["sends"] });
      setIsEditing(false);
    },
    onError: () => toast.error("발송 수정 실패"),
  });

  const itemCancelMutation = useMutation({
    mutationFn: (id: number) => sendItemsApi.cancelSendItem(id),
    onSuccess: () => {
      toast.success("품목이 취소되었습니다.");
      queryClient.invalidateQueries({ queryKey: ["send", sendId] });
      setItemCancelId(null);
    },
    onError: () => toast.error("품목 취소 실패"),
  });

  const itemEditMutation = useMutation({
    mutationFn: () =>
      sendItemsApi.updateSendItem(editingItem!.send_item_id, {
        send_num: itemEditForm.send_num,
        admin_memo: itemEditForm.admin_memo || null,
      }),
    onSuccess: () => {
      toast.success("품목이 수정되었습니다.");
      queryClient.invalidateQueries({ queryKey: ["send", sendId] });
      setEditingItem(null);
    },
    onError: () => toast.error("품목 수정 실패"),
  });

  const send = sendData as SendDetailResponse | undefined;

  const handleClose = () => {
    setIsEditing(false);
    onClose();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-5 py-4 border-b border-gray-200 bg-white flex-shrink-0">
        <div className="flex items-start justify-between mb-3">
          <div className="min-w-0">
            {send && (
              <div className="flex items-center gap-1.5 mb-1">
                <StatusBadge type="send_status" value={send.send_status} />
              </div>
            )}
            <div className="font-semibold text-gray-900 text-base leading-tight">
              발송 #{sendId}
            </div>
            {send && (
              <div className="text-xs text-gray-400 mt-0.5">
                주문 #{send.order_id}
              </div>
            )}
          </div>
          <div className="flex items-center gap-1 flex-shrink-0 ml-2">
            {send && send.send_status !== "CANCELLED" && !isEditing && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1"
                onClick={() => setIsEditing(true)}
              >
                <Edit2 className="h-3.5 w-3.5" />
                수정
              </Button>
            )}
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600 p-1 rounded-md hover:bg-gray-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {!send ? (
          <div className="flex items-center justify-center py-12 text-sm text-gray-400">
            발송 정보를 불러올 수 없습니다.
          </div>
        ) : (
          <>
            {isEditing && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3.5 space-y-3">
                <div className="text-xs font-semibold text-blue-700">배송지 수정</div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">수령인</Label>
                    <Input
                      className="mt-1"
                      value={editForm.recipient_name ?? ""}
                      onChange={(e) => setEditForm((f) => ({ ...f, recipient_name: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">연락처</Label>
                    <Input
                      className="mt-1"
                      value={editForm.recipient_phone ?? ""}
                      onChange={(e) => setEditForm((f) => ({ ...f, recipient_phone: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs">우편번호</Label>
                    <Input
                      className="mt-1"
                      value={editForm.postal_code ?? ""}
                      onChange={(e) => setEditForm((f) => ({ ...f, postal_code: e.target.value }))}
                    />
                  </div>
                  <div className="col-span-2">
                    <Label className="text-xs">주소</Label>
                    <Input
                      className="mt-1"
                      value={editForm.recipient_address ?? ""}
                      onChange={(e) => setEditForm((f) => ({ ...f, recipient_address: e.target.value }))}
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">배송 메모</Label>
                  <Input
                    className="mt-1"
                    value={editForm.customer_memo ?? ""}
                    onChange={(e) => setEditForm((f) => ({ ...f, customer_memo: e.target.value }))}
                    placeholder="(선택)"
                  />
                </div>
                <div>
                  <Label className="text-xs">관리자 메모</Label>
                  <Input
                    className="mt-1"
                    value={editForm.admin_memo ?? ""}
                    onChange={(e) => setEditForm((f) => ({ ...f, admin_memo: e.target.value }))}
                    placeholder="(선택)"
                  />
                </div>
                <div className="flex gap-2 pt-1">
                  <Button
                    size="sm"
                    onClick={() => editMutation.mutate()}
                    disabled={editMutation.isPending}
                  >
                    {editMutation.isPending && <LoadingSpinner size="sm" className="mr-1" />}
                    저장
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setIsEditing(false)}>
                    취소
                  </Button>
                </div>
              </div>
            )}

            <PanelSection title="배송지">
              <InfoRow label="수령인" value={send.recipient_name} />
              <InfoRow
                label="연락처"
                value={<span className="font-mono">{formatPhone(send.recipient_phone)}</span>}
              />
              <InfoRow
                label="주소"
                value={`(${send.postal_code}) ${send.recipient_address}`}
              />
              {send.customer_memo && (
                <InfoRow label="배송 메모" value={send.customer_memo} />
              )}
            </PanelSection>

            <PanelSection title="발송 정보">
              {send.tracking_no && (
                <InfoRow
                  label="운송장"
                  value={
                    <span className="font-mono">
                      {send.courier_company} {send.tracking_no}
                    </span>
                  }
                />
              )}
              {send.official_send_date && (
                <InfoRow label="발송예정일" value={formatDate(send.official_send_date)} />
              )}
              {send.prepared_at && (
                <InfoRow label="준비완료" value={formatDate(send.prepared_at)} />
              )}
              {send.shipped_at && (
                <InfoRow label="배송시작" value={formatDate(send.shipped_at)} />
              )}
              {send.delivered_at && (
                <InfoRow label="배송완료" value={formatDate(send.delivered_at)} />
              )}
              {send.admin_memo && (
                <InfoRow label="관리자 메모" value={send.admin_memo} />
              )}
            </PanelSection>

            <PanelSection title="발송 품목">
              {send.items.length === 0 ? (
                <p className="text-sm text-gray-400">품목이 없습니다.</p>
              ) : (
                <div className="-mx-3.5 -mb-3">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 border-b border-gray-100">
                      <tr>
                        <th className="px-3 py-2 text-left text-gray-500 font-medium">상품</th>
                        <th className="px-3 py-2 text-left text-gray-500 font-medium">호</th>
                        <th className="px-3 py-2 text-right text-gray-500 font-medium">수량</th>
                        <th className="px-3 py-2 text-right text-gray-500 font-medium">단가</th>
                        <th className="w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {send.items.map((item) => (
                        <tr
                          key={item.send_item_id}
                          className={item.cancelled_at ? "opacity-50 bg-gray-50" : ""}
                        >
                          <td className="px-3 py-2">
                            <div className="font-medium text-gray-900">{item.product_name}</div>
                            <div className="text-gray-400 font-mono">{item.product_code}</div>
                          </td>
                          <td className="px-3 py-2 text-gray-600">{formatIssue(item.issue)}</td>
                          <td className="px-3 py-2 text-right text-gray-700">{item.send_num}</td>
                          <td className="px-3 py-2 text-right text-gray-700">{formatAmount(item.cost_price)}</td>
                          <td className="px-3 py-2 text-right">
                            {item.cancelled_at ? (
                              <span className="text-xs text-red-400">취소됨</span>
                            ) : (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon-sm">
                                    <MoreHorizontal className="h-3.5 w-3.5" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem
                                    onClick={() => {
                                      setEditingItem(item);
                                      setItemEditForm({
                                        send_num: item.send_num,
                                        admin_memo: item.admin_memo ?? "",
                                      });
                                    }}
                                  >
                                    품목 수정
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    className="text-red-600 focus:text-red-600 focus:bg-red-50"
                                    onClick={() => setItemCancelId(item.send_item_id)}
                                  >
                                    품목 취소
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </PanelSection>

            <PanelSection title="시스템">
              <InfoRow label="생성일" value={formatDateTime(send.created_at)} />
              <InfoRow label="수정일" value={formatDateTime(send.updated_at)} />
              {send.cancelled_at && (
                <InfoRow label="취소일" value={formatDateTime(send.cancelled_at)} />
              )}
            </PanelSection>
          </>
        )}
      </div>

      <ConfirmModal
        open={itemCancelId !== null}
        onClose={() => setItemCancelId(null)}
        onConfirm={() => itemCancelId !== null && itemCancelMutation.mutate(itemCancelId)}
        title="품목 취소"
        description="이 발송 품목을 취소합니다. 취소 후 되돌릴 수 없습니다."
        confirmLabel="취소 처리"
        variant="destructive"
        isLoading={itemCancelMutation.isPending}
      />

      <Dialog open={editingItem !== null} onOpenChange={(open) => !open && setEditingItem(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>품목 수정</DialogTitle>
          </DialogHeader>
          {editingItem && (
            <div className="space-y-3 py-1">
              <div className="text-xs text-gray-500 bg-gray-50 rounded-md px-3 py-2">
                {editingItem.product_name}
                <span className="ml-2 font-mono text-gray-400">{editingItem.product_code}</span>
              </div>
              <div>
                <Label className="text-xs">수량</Label>
                <Input
                  type="number"
                  min={1}
                  className="mt-1"
                  value={itemEditForm.send_num}
                  onChange={(e) =>
                    setItemEditForm((f) => ({ ...f, send_num: parseInt(e.target.value) || 1 }))
                  }
                />
              </div>
              <div>
                <Label className="text-xs">관리자 메모</Label>
                <Input
                  className="mt-1"
                  value={itemEditForm.admin_memo}
                  onChange={(e) => setItemEditForm((f) => ({ ...f, admin_memo: e.target.value }))}
                  placeholder="(선택)"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingItem(null)}>취소</Button>
            <Button
              onClick={() => itemEditMutation.mutate()}
              disabled={itemEditMutation.isPending}
            >
              {itemEditMutation.isPending && <LoadingSpinner size="sm" className="mr-1" />}
              저장
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─────────────────────────────────────────────
// 탭 3: 기출유 연동
// ─────────────────────────────────────────────
function MonthlyExcelTab() {
  const [issue, setIssue] = useState(currentIssue());
  const [uploadResult, setUploadResult] = useState<{
    type: "monthly" | "yearly";
    data: { total: number; success_count: number; fail_count: number; results: { send_id: number; success: boolean; message?: string | null }[] };
  } | null>(null);
  const [monthlyDownloading, setMonthlyDownloading] = useState(false);
  const [yearlyDownloading, setYearlyDownloading] = useState(false);
  const [uploading, setUploading] = useState<"monthly" | "yearly" | null>(null);

  const isValidIssue = issue.length === 6;

  const handleDownload = async (type: "monthly" | "yearly") => {
    if (!isValidIssue) { toast.error("발송 호를 입력하세요. (YYYYMM)"); return; }
    type === "monthly" ? setMonthlyDownloading(true) : setYearlyDownloading(true);
    try {
      const res = type === "monthly"
        ? await dispatchApi.exportMonthlyDispatch(issue)
        : await dispatchApi.exportYearlyDispatch(issue);
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.download = `dispatch_${type}_${issue}.xlsx`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error("엑셀 다운로드 실패");
    } finally {
      type === "monthly" ? setMonthlyDownloading(false) : setYearlyDownloading(false);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: "monthly" | "yearly") => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!isValidIssue) { toast.error("발송 호를 먼저 입력하세요."); return; }
    setUploading(type);
    try {
      const fn = type === "monthly"
        ? dispatchApi.uploadMonthlyTracking
        : dispatchApi.uploadYearlyTracking;
      const res = await fn(issue, file);
      const data = res.data?.data!;
      setUploadResult({ type, data });
      toast.success(`${data?.success_count ?? 0}건 송장 업로드 완료`);
    } catch {
      toast.error("송장 업로드 실패");
    } finally {
      setUploading(null);
      e.target.value = "";
    }
  };

  return (
    <div className="p-6 max-w-xl space-y-5">

      {/* 발송 호 선택 */}
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-gray-700 whitespace-nowrap">발송 호</span>
        <Input
          className="w-28"
          placeholder="YYYYMM"
          maxLength={6}
          value={issue}
          onChange={(e) => { setIssue(e.target.value.replace(/\D/g, "")); setUploadResult(null); }}
        />
        {isValidIssue && (
          <span className="text-sm text-blue-600 font-medium">{formatIssue(issue)}</span>
        )}
      </div>

      {/* MONTHLY 단편 카드 */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-gray-800">MONTHLY 단편</div>
            <div className="text-xs text-gray-400 mt-0.5">기출유(기관출판유통) 엑셀 연동</div>
          </div>
          <span className="text-[11px] font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
            오후 3시 마감
          </span>
        </div>

        <div className="divide-y divide-gray-100">
          {/* Step 1 */}
          <div className="px-4 py-3.5 flex items-start gap-3">
            <StepNum num={1} />
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold text-gray-700">기출유 엑셀 다운로드</div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    배송 준비 중(PREPARING)인 단편 주문을 기출유 형식으로 다운로드합니다.
                    <br />오른쪽 끝에 기출유가 송장번호를 기입할 칸이 포함됩니다.
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 flex-shrink-0"
                  onClick={() => handleDownload("monthly")}
                  disabled={monthlyDownloading || !isValidIssue}
                >
                  {monthlyDownloading ? <LoadingSpinner size="sm" /> : <Download className="h-3.5 w-3.5" />}
                  다운로드
                </Button>
              </div>
            </div>
          </div>

          {/* Step 2 (수동) */}
          <div className="px-4 py-3.5 flex items-start gap-3 bg-gray-50/50">
            <StepNum num={2} />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <div className="text-xs font-semibold text-gray-700">기출유 전송</div>
                <span className="text-[11px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">수동</span>
              </div>
              <div className="text-xs text-gray-400 mt-0.5">
                다운받은 엑셀을 기출유 담당자에게 직접 전송합니다.
                기출유가 송장번호를 기입 후 회신합니다.
              </div>
            </div>
          </div>

          {/* Step 3 */}
          <div className="px-4 py-3.5 flex items-start gap-3">
            <StepNum num={3} />
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold text-gray-700">기출유 송장 업로드</div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    기출유 회신 엑셀을 업로드합니다.
                    <br />CJ대한통운 + 송장번호가 자동 적용되고 <span className="text-gray-600 font-medium">배송 중</span>으로 전환됩니다.
                  </div>
                </div>
                <label className={!isValidIssue ? "pointer-events-none" : ""}>
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    className="hidden"
                    onChange={(e) => handleUpload(e, "monthly")}
                    disabled={uploading === "monthly" || !isValidIssue}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 flex-shrink-0"
                    disabled={uploading === "monthly" || !isValidIssue}
                    onClick={(e) => {
                      if (!isValidIssue) { e.preventDefault(); return; }
                      (e.currentTarget.parentElement?.querySelector("input") as HTMLElement)?.click();
                    }}
                  >
                    {uploading === "monthly" ? <LoadingSpinner size="sm" /> : <Upload className="h-3.5 w-3.5" />}
                    업로드
                  </Button>
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* YEARLY 정기구독 카드 */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
          <div className="text-sm font-semibold text-gray-800">YEARLY 정기구독</div>
          <div className="text-xs text-gray-400 mt-0.5">자체배송 송장 처리</div>
        </div>

        <div className="divide-y divide-gray-100">
          {/* Step 1 */}
          <div className="px-4 py-3.5 flex items-start gap-3">
            <StepNum num={1} />
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold text-gray-700">YEARLY 엑셀 다운로드</div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    해당 호의 정기구독 발송 목록을 엑셀로 다운로드합니다.
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 flex-shrink-0"
                  onClick={() => handleDownload("yearly")}
                  disabled={yearlyDownloading || !isValidIssue}
                >
                  {yearlyDownloading ? <LoadingSpinner size="sm" /> : <Download className="h-3.5 w-3.5" />}
                  다운로드
                </Button>
              </div>
            </div>
          </div>

          {/* Step 2 */}
          <div className="px-4 py-3.5 flex items-start gap-3">
            <StepNum num={2} />
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold text-gray-700">송장 업로드</div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    자체배송 처리 후 <span className="text-gray-600 font-medium">배송 대기</span>로 전환됩니다.
                    <br />매월 5일에 자동으로 <span className="text-gray-600 font-medium">배송 중</span>으로 변경됩니다.
                  </div>
                </div>
                <label className={!isValidIssue ? "pointer-events-none" : ""}>
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    className="hidden"
                    onChange={(e) => handleUpload(e, "yearly")}
                    disabled={uploading === "yearly" || !isValidIssue}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 flex-shrink-0"
                    disabled={uploading === "yearly" || !isValidIssue}
                    onClick={(e) => {
                      if (!isValidIssue) { e.preventDefault(); return; }
                      (e.currentTarget.parentElement?.querySelector("input") as HTMLElement)?.click();
                    }}
                  >
                    {uploading === "yearly" ? <LoadingSpinner size="sm" /> : <Upload className="h-3.5 w-3.5" />}
                    업로드
                  </Button>
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 업로드 결과 */}
      {uploadResult && (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              업로드 결과 — {uploadResult.type === "monthly" ? "MONTHLY 단편" : "YEARLY 정기구독"}
            </span>
            <button onClick={() => setUploadResult(null)} className="text-gray-400 hover:text-gray-600">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-3 gap-3 mb-3">
              <div className="text-center bg-gray-50 rounded-lg py-2.5">
                <div className="text-lg font-semibold text-gray-900">{uploadResult.data?.total ?? 0}</div>
                <div className="text-xs text-gray-500">전체</div>
              </div>
              <div className="text-center bg-green-50 rounded-lg py-2.5">
                <div className="text-lg font-semibold text-green-700">{uploadResult.data?.success_count ?? 0}</div>
                <div className="text-xs text-green-600">성공</div>
              </div>
              <div className="text-center bg-red-50 rounded-lg py-2.5">
                <div className="text-lg font-semibold text-red-600">{uploadResult.data?.fail_count ?? 0}</div>
                <div className="text-xs text-red-500">실패</div>
              </div>
            </div>
            {(uploadResult.data?.fail_count ?? 0) > 0 && (
              <div className="text-xs text-red-500 space-y-0.5 max-h-28 overflow-y-auto bg-red-50 rounded-lg p-2.5">
                {uploadResult.data?.results
                  ?.filter((r) => !r.success)
                  .map((r) => (
                    <div key={r.send_id} className="flex gap-2">
                      <span className="font-mono text-gray-500 flex-shrink-0">#{r.send_id}</span>
                      <span>{r.message ?? "알 수 없는 오류"}</span>
                    </div>
                  ))}
              </div>
            )}
            {(uploadResult.data?.fail_count ?? 0) === 0 && (
              <p className="text-xs text-green-600 text-center py-0.5">모든 송장번호가 성공적으로 처리되었습니다.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function StepNum({ num }: { num: number }) {
  return (
    <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 text-[11px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
      {num}
    </span>
  );
}

// ─────────────────────────────────────────────
// 공통 UI 헬퍼
// ─────────────────────────────────────────────
function PanelSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border border-gray-100 rounded-lg overflow-hidden">
      <div className="px-3.5 py-2 bg-gray-50 border-b border-gray-100">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{title}</h3>
      </div>
      <div className="px-3.5 py-3 space-y-2.5">{children}</div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  if (!value && value !== 0) return null;
  return (
    <div className="flex items-start gap-3">
      <span className="text-xs text-gray-400 w-24 flex-shrink-0 pt-0.5">{label}</span>
      <span className="text-sm text-gray-700 flex-1">{value}</span>
    </div>
  );
}
