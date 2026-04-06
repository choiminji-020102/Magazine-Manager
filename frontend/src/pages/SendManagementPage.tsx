import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Download, Upload, X, Edit2, MoreHorizontal } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import type { DispatchGenerateResponse, DispatchTrackingUploadResponse, DispatchTarget } from "@/types/dispatch";
import type { SendResponse, SendDetailResponse, SendUpdate, SendBatchStatusResponse } from "@/types/send";
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
      <Tabs defaultValue="yearly" className="flex-1 overflow-hidden flex flex-col">
        <div className="px-5 py-3 bg-white border-b border-gray-200">
          <TabsList>
            <TabsTrigger value="yearly">정기구독</TabsTrigger>
            <TabsTrigger value="monthly">단품</TabsTrigger>
            <TabsTrigger value="postal13113">13113</TabsTrigger>
          </TabsList>
        </div>
        <div className="flex-1 overflow-hidden">
          <TabsContent value="yearly" className="h-full m-0">
            <YearlyTab />
          </TabsContent>
          <TabsContent value="monthly" className="h-full m-0">
            <MonthlyTab />
          </TabsContent>
          <TabsContent value="postal13113" className="h-full m-0">
            <PostalCode13113Tab />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}

// ─────────────────────────────────────────────
// 미발송 대상 테이블 컬럼 (YEARLY/MONTHLY 공용)
// ─────────────────────────────────────────────
const targetColumns: ColumnDef<DispatchTarget>[] = [
  {
    key: "order_id",
    header: "주문번호",
    cell: (row) => <span className="font-mono text-xs text-gray-400">#{row.order_id}</span>,
    width: "w-20",
  },
  {
    key: "product_name",
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
        <div className="text-[13px] font-medium text-gray-900">{row.recipient_name ?? "-"}</div>
        <div className="text-xs text-gray-400 font-mono">{row.recipient_phone ? formatPhone(row.recipient_phone) : ""}</div>
      </div>
    ),
  },
  {
    key: "address",
    header: "주소",
    cell: (row) => (
      <span className="text-xs text-gray-600">
        {row.postal_code && row.recipient_address ? `(${row.postal_code}) ${row.recipient_address}` : "-"}
      </span>
    ),
  },
  {
    key: "order_num",
    header: "수량",
    cell: (row) => <span className="text-sm text-gray-700">{row.order_num}</span>,
    width: "w-16",
    className: "text-center",
  },
];

// ─────────────────────────────────────────────
// 발송 현황 테이블 컬럼 (공용)
// ─────────────────────────────────────────────
const SEND_STATUS_FLOW = [
  { value: "PREPARING", label: "준비중" },
  { value: "SHIPPING", label: "배송중" },
  { value: "DELIVERED", label: "배송완료" },
  { value: "CANCELLED", label: "취소" },
] as const;

function makeSendColumns(
  queryClient: ReturnType<typeof useQueryClient>,
  queryKey: string,
  setCancelTarget: (id: number | null) => void,
  showTracking: boolean,
): ColumnDef<SendResponse>[] {
  return [
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
    ...(showTracking
      ? [
          {
            key: "tracking" as const,
            header: "운송장",
            cell: (row: SendResponse) => (
              <span className="text-xs text-gray-600 font-mono">{row.tracking_no ?? "-"}</span>
            ),
            width: "w-32",
          },
        ]
      : []),
    {
      key: "actions",
      header: "",
      cell: (row) => {
        if (row.send_status === "CANCELLED" || row.send_status === "DELIVERED") return null;
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
                  onClick={(e) => {
                    e.stopPropagation();
                    sendsApi.batchShipping([row.send_id]).then(() => {
                      toast.success("배송중으로 전환되었습니다.");
                      queryClient.invalidateQueries({ queryKey: [queryKey] });
                    }).catch(() => toast.error("상태 전환 실패"));
                  }}
                >
                  배송중 전환
                </DropdownMenuItem>
              )}
              {row.send_status === "SHIPPING" && (
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    sendsApi.batchDelivered([row.send_id]).then(() => {
                      toast.success("배송완료로 전환되었습니다.");
                      queryClient.invalidateQueries({ queryKey: [queryKey] });
                    }).catch(() => toast.error("상태 전환 실패"));
                  }}
                >
                  배송완료 전환
                </DropdownMenuItem>
              )}
              {row.send_status === "PREPARING" && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-red-600 focus:text-red-600 focus:bg-red-50"
                    onClick={(e) => {
                      e.stopPropagation();
                      setCancelTarget(row.send_id);
                    }}
                  >
                    발송 취소
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
      width: "w-12",
      className: "text-right",
    },
  ];
}

// ─────────────────────────────────────────────
// 결과 다이얼로그 (발송 생성 / 일괄 전환 공용)
// ─────────────────────────────────────────────
function ResultDialog({
  title,
  result,
  onClose,
  labels = { total: "전체", success: "성공", fail: "실패" },
}: {
  title: string;
  result: { total: number; success_count: number; fail_count: number; results?: { success: boolean; message?: string | null }[] } | { total_requested: number; success_count: number; fail_count: number; results?: { success: boolean; message?: string | null; order_item_id?: number }[] } | null;
  onClose: () => void;
  labels?: { total: string; success: string; fail: string };
}) {
  if (!result) return null;
  const total = "total" in result ? result.total : result.total_requested;
  const failResults = result.results?.filter((r) => !r.success) ?? [];
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-3 gap-3 py-2">
          <div className="text-center bg-gray-50 rounded-lg py-2.5">
            <div className="text-lg font-semibold text-gray-900">{total}</div>
            <div className="text-xs text-gray-500">{labels.total}</div>
          </div>
          <div className="text-center bg-green-50 rounded-lg py-2.5">
            <div className="text-lg font-semibold text-green-700">{result.success_count}</div>
            <div className="text-xs text-green-600">{labels.success}</div>
          </div>
          <div className="text-center bg-red-50 rounded-lg py-2.5">
            <div className="text-lg font-semibold text-red-600">{result.fail_count}</div>
            <div className="text-xs text-red-500">{labels.fail}</div>
          </div>
        </div>
        {failResults.length > 0 && (
          <div className="text-xs text-red-500 space-y-0.5 max-h-28 overflow-y-auto bg-red-50 rounded-lg p-2.5">
            {failResults.map((r, i) => (
              <div key={i}>{r.message ?? "알 수 없는 오류"}</div>
            ))}
          </div>
        )}
        <DialogFooter>
          <Button onClick={onClose}>확인</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────
// 정기구독 탭
// PREPARING → SHIPPING (기출유 엑셀 업로드) → DELIVERED (2-3일 후)
// ─────────────────────────────────────────────
function YearlyTab() {
  const queryClient = useQueryClient();
  const [dispatchIssue, setDispatchIssue] = useState(currentIssue());
  const [sendStatus, setSendStatus] = useState("");
  const [sendPage, setSendPage] = useState(1);
  const [recipientSearch, setRecipientSearch] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [targetSelectedIds, setTargetSelectedIds] = useState<Set<string | number>>(new Set());
  const [sendSelectedIds, setSendSelectedIds] = useState<Set<string | number>>(new Set());
  const [panelOpen, setPanelOpen] = useState(false);
  const [selectedSendId, setSelectedSendId] = useState<number | null>(null);
  const [cancelTarget, setCancelTarget] = useState<number | null>(null);
  const [generateConfirmOpen, setGenerateConfirmOpen] = useState(false);
  const [generateResult, setGenerateResult] = useState<DispatchGenerateResponse | null>(null);
  const [batchResult, setBatchResult] = useState<SendBatchStatusResponse | null>(null);
  const [downloading, setDownloading] = useState(false);
  const limit = 20;

  const debouncedRecipientSearch = useDebounce(recipientSearch, 300);
  const isValidIssue = dispatchIssue.length === 6;

  // 미발송 대상 조회
  const { data: targetsRes, isLoading: targetsLoading } = useQuery({
    queryKey: ["yearly-dispatch-targets", dispatchIssue],
    queryFn: () => dispatchApi.getYearlyTargets({ issue: dispatchIssue, limit: 500 }).then((r) => r.data),
    enabled: isValidIssue,
  });
  const targets: DispatchTarget[] = targetsRes?.data?.targets ?? [];

  // 발송 현황 조회 (해당 호 기준)
  const { data: sendsData, isLoading: sendsLoading } = useQuery({
    queryKey: ["sends-yearly", dispatchIssue, sendPage, limit, sendStatus, debouncedRecipientSearch, postalCode],
    queryFn: () =>
      sendsApi.getSends({
        page: sendPage,
        limit,
        send_status: sendStatus || null,
        recipient_search: debouncedRecipientSearch || null,
        courier_company: "자체배송",
        postal_code: postalCode || null,
        issue: isValidIssue ? dispatchIssue : null,
      }).then((r) => r.data),
  });

  // 발송 생성
  const generateMutation = useMutation({
    mutationFn: () => {
      const ids = targetSelectedIds.size > 0
        ? Array.from(targetSelectedIds) as number[]
        : targets.map((t) => t.order_item_id);
      return dispatchApi.generateYearlyDispatch({
        issue: dispatchIssue,
        official_send_date: null,
        order_item_ids: ids,
      });
    },
    onSuccess: (res) => {
      const result = res.data?.data;
      if (result) setGenerateResult(result);
      toast.success(`${result?.success_count ?? 0}건 발송 생성 완료`);
      queryClient.invalidateQueries({ queryKey: ["yearly-dispatch-targets"] });
      queryClient.invalidateQueries({ queryKey: ["sends-yearly"] });
      setGenerateConfirmOpen(false);
      setTargetSelectedIds(new Set());
    },
    onError: () => toast.error("발송 생성 실패"),
  });

  // 기출유 엑셀 다운로드
  const handleDownload = async () => {
    if (!isValidIssue) { toast.error("발송 호를 입력하세요. (YYYYMM)"); return; }
    setDownloading(true);
    try {
      const res = await dispatchApi.exportYearlyDispatch(dispatchIssue);
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.download = `dispatch_yearly_${dispatchIssue}.xlsx`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error("엑셀 다운로드 실패");
    } finally {
      setDownloading(false);
    }
  };

  // 기출유 전송 완료 (PREPARING → SHIPPING)
  const batchShippingMutation = useMutation({
    mutationFn: () => sendsApi.batchShipping(Array.from(sendSelectedIds) as number[]),
    onSuccess: (res) => {
      const result = res.data?.data;
      if (result) setBatchResult(result);
      toast.success(`${result?.success_count ?? 0}건 배송중으로 전환`);
      queryClient.invalidateQueries({ queryKey: ["sends-yearly"] });
      setSendSelectedIds(new Set());
    },
    onError: () => toast.error("상태 전환 실패"),
  });

  // 일괄 배송완료 전환 (SHIPPING → DELIVERED)
  const batchDeliveredMutation = useMutation({
    mutationFn: () => sendsApi.batchDelivered(Array.from(sendSelectedIds) as number[]),
    onSuccess: (res) => {
      const result = res.data?.data;
      if (result) setBatchResult(result);
      toast.success(`${result?.success_count ?? 0}건 배송완료로 전환`);
      queryClient.invalidateQueries({ queryKey: ["sends-yearly"] });
      setSendSelectedIds(new Set());
    },
    onError: () => toast.error("상태 전환 실패"),
  });

  const cancelMutation = useMutation({
    mutationFn: (sendId: number) => sendsApi.cancelSend(sendId),
    onSuccess: () => {
      toast.success("발송이 취소되었습니다.");
      queryClient.invalidateQueries({ queryKey: ["sends-yearly"] });
      setCancelTarget(null);
    },
    onError: () => toast.error("발송 취소 실패"),
  });

  const sendColumns = makeSendColumns(queryClient, "sends-yearly", setCancelTarget, false);
  const generateCount = targetSelectedIds.size > 0 ? targetSelectedIds.size : targets.length;

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* 발송 호 입력 */}
      <div className="px-5 py-3 bg-white border-b border-gray-200 flex items-center gap-3 flex-shrink-0">
        <span className="text-xs font-medium text-gray-500 whitespace-nowrap">발송 호</span>
        <Input
          className="w-24 h-8 text-sm"
          placeholder="YYYYMM"
          maxLength={6}
          value={dispatchIssue}
          onChange={(e) => setDispatchIssue(e.target.value.replace(/\D/g, ""))}
        />
        {isValidIssue && (
          <span className="text-sm text-blue-600 font-medium">{formatIssue(dispatchIssue)}</span>
        )}
      </div>

      {/* ── 섹션 1: 미발송 대상 ── */}
      {isValidIssue && (
        <div className="flex-shrink-0 border-b border-gray-200">
          <div className="px-5 py-2.5 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-semibold text-gray-600 uppercase tracking-wide">미발송 대상</h3>
              <span className="text-xs text-gray-400">{targets.length}건</span>
              {targetSelectedIds.size > 0 && (
                <span className="text-xs text-blue-600 font-medium">{targetSelectedIds.size}건 선택됨</span>
              )}
            </div>
            {targets.length > 0 && (
              <Button
                size="sm"
                className="h-7 text-xs"
                onClick={() => setGenerateConfirmOpen(true)}
                disabled={generateMutation.isPending}
              >
                {generateMutation.isPending && <LoadingSpinner size="sm" className="mr-1" />}
                발송 생성 ({generateCount}건)
              </Button>
            )}
          </div>
          <div className="max-h-[280px] overflow-y-auto bg-white">
            <DataTable
              columns={targetColumns}
              data={targets}
              getRowId={(row) => row.order_item_id}
              isLoading={targetsLoading}
              emptyMessage={`${isValidIssue ? formatIssue(dispatchIssue) + " " : ""}미발송 대상이 없습니다.`}
              selectedIds={targetSelectedIds}
              onSelectionChange={setTargetSelectedIds}
            />
          </div>
        </div>
      )}

      {/* ── 섹션 2: 발송 현황 ── */}
      <div className="flex-shrink-0">
        <PageHeader
          left={
            <div className="flex items-center gap-3">
              <h3 className="text-xs font-semibold text-gray-600 uppercase tracking-wide">발송 현황</h3>
              <span className="text-sm text-gray-500">{sendsData?.total ?? 0}건</span>
              {sendSelectedIds.size > 0 && (
                <span className="text-sm text-blue-600 font-medium">{sendSelectedIds.size}건 선택됨</span>
              )}
            </div>
          }
          actions={
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="gap-1.5" onClick={handleDownload}
                disabled={downloading || !isValidIssue}>
                {downloading ? <LoadingSpinner size="sm" /> : <Download className="h-3.5 w-3.5" />}
                기출유 엑셀
              </Button>
              {sendSelectedIds.size > 0 && (
                <>
                  <Button
                    size="sm"
                    className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white"
                    onClick={() => batchShippingMutation.mutate()}
                    disabled={batchShippingMutation.isPending}
                  >
                    {batchShippingMutation.isPending && <LoadingSpinner size="sm" className="mr-1" />}
                    기출유 전송 완료 ({sendSelectedIds.size})
                  </Button>
                  <Button
                    size="sm"
                    className="gap-1.5 bg-green-600 hover:bg-green-700 text-white"
                    onClick={() => batchDeliveredMutation.mutate()}
                    disabled={batchDeliveredMutation.isPending}
                  >
                    {batchDeliveredMutation.isPending && <LoadingSpinner size="sm" className="mr-1" />}
                    배송완료 전환 ({sendSelectedIds.size})
                  </Button>
                </>
              )}
            </div>
          }
        />

        {/* 상태 필터 */}
        <div className="px-5 py-2 bg-white border-b border-gray-100 flex items-center gap-1.5">
          <span className="text-xs text-gray-400 mr-1">상태</span>
          {SEND_STATUS_FLOW.map((s, i) => (
            <span key={s.value} className="flex items-center gap-1.5">
              {i > 0 && i < 3 && <span className="text-gray-300 text-xs">→</span>}
              <button
                onClick={() => { setSendStatus(sendStatus === s.value ? "" : s.value); setSendPage(1); }}
                className={`text-xs px-2.5 py-1 rounded border transition-colors ${
                  sendStatus === s.value
                    ? "bg-blue-50 border-blue-300 text-blue-700 font-medium"
                    : "border-gray-200 text-gray-500 hover:bg-gray-50"
                }`}
              >
                {s.label}
              </button>
            </span>
          ))}
        </div>

        <FilterBar
          basic={
            <>
              <Input className="w-40" placeholder="수령인 검색" value={recipientSearch}
                onChange={(e) => { setRecipientSearch(e.target.value); setSendPage(1); }} />
              <Input className="w-28" placeholder="우편번호" value={postalCode}
                onChange={(e) => { setPostalCode(e.target.value); setSendPage(1); }} />
            </>
          }
          hasActiveFilters={!!(recipientSearch || postalCode)}
          onReset={() => { setRecipientSearch(""); setPostalCode(""); setSendPage(1); }}
          chips={[
            ...(recipientSearch ? [{ label: `수령인: ${recipientSearch}`, onRemove: () => { setRecipientSearch(""); setSendPage(1); } }] : []),
            ...(postalCode ? [{ label: `우편번호: ${postalCode}`, onRemove: () => { setPostalCode(""); setSendPage(1); } }] : []),
          ]}
        />
      </div>

      <div className="flex-1 min-h-[200px] overflow-hidden bg-white">
        <div className="h-full overflow-y-auto">
          <DataTable
            columns={sendColumns}
            data={sendsData?.items ?? []}
            getRowId={(row) => row.send_id}
            onRowClick={(row) => { setSelectedSendId(row.send_id); setPanelOpen(true); }}
            activeRowId={selectedSendId}
            isLoading={sendsLoading}
            emptyMessage="발송 내역이 없습니다."
            selectedIds={sendSelectedIds}
            onSelectionChange={setSendSelectedIds}
          />
        </div>
      </div>

      {sendsData && (
        <div className="bg-white border-t border-gray-200 flex-shrink-0">
          <Pagination page={sendPage} totalPages={sendsData.total_pages} total={sendsData.total} limit={limit} onPageChange={setSendPage} />
        </div>
      )}

      <SlidingPanel open={panelOpen} onClose={() => { setPanelOpen(false); setTimeout(() => setSelectedSendId(null), 250); }} width={520}>
        {selectedSendId && <SendDetailPanel sendId={selectedSendId} onClose={() => { setPanelOpen(false); setTimeout(() => setSelectedSendId(null), 250); }} />}
      </SlidingPanel>

      <ConfirmModal
        open={cancelTarget !== null}
        onClose={() => setCancelTarget(null)}
        onConfirm={() => cancelTarget !== null && cancelMutation.mutate(cancelTarget)}
        title="발송 취소" description="이 발송을 취소합니다." confirmLabel="취소 처리" variant="destructive"
        isLoading={cancelMutation.isPending}
      />

      <ConfirmModal
        open={generateConfirmOpen}
        onClose={() => setGenerateConfirmOpen(false)}
        onConfirm={() => generateMutation.mutate()}
        title="발송 생성"
        description={`${formatIssue(dispatchIssue)} 정기구독 ${generateCount}건의 발송을 생성합니다.`}
        confirmLabel="발송 생성"
        isLoading={generateMutation.isPending}
      />

      <ResultDialog title="발송 생성 완료" result={generateResult} onClose={() => setGenerateResult(null)} labels={{ total: "전체", success: "생성됨", fail: "실패" }} />
      <ResultDialog title="일괄 상태 전환 완료" result={batchResult} onClose={() => setBatchResult(null)} />
    </div>
  );
}

// ─────────────────────────────────────────────
// 단품 탭
// PREPARING → SHIPPING (기출유 송장 업로드) → DELIVERED (2-3일 후)
// ─────────────────────────────────────────────
function MonthlyTab() {
  const queryClient = useQueryClient();
  const [dispatchIssue, setDispatchIssue] = useState(currentIssue());
  const [sendStatus, setSendStatus] = useState("");
  const [sendPage, setSendPage] = useState(1);
  const [recipientSearch, setRecipientSearch] = useState("");
  const [targetSelectedIds, setTargetSelectedIds] = useState<Set<string | number>>(new Set());
  const [sendSelectedIds, setSendSelectedIds] = useState<Set<string | number>>(new Set());
  const [panelOpen, setPanelOpen] = useState(false);
  const [selectedSendId, setSelectedSendId] = useState<number | null>(null);
  const [cancelTarget, setCancelTarget] = useState<number | null>(null);
  const [generateConfirmOpen, setGenerateConfirmOpen] = useState(false);
  const [generateResult, setGenerateResult] = useState<DispatchGenerateResponse | null>(null);
  const [batchResult, setBatchResult] = useState<SendBatchStatusResponse | null>(null);
  const [trackingResult, setTrackingResult] = useState<DispatchTrackingUploadResponse | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const limit = 20;

  const debouncedRecipientSearch = useDebounce(recipientSearch, 300);
  const isValidIssue = dispatchIssue.length === 6;

  // 미발송 대상 조회
  const { data: targetsRes, isLoading: targetsLoading } = useQuery({
    queryKey: ["monthly-dispatch-targets", dispatchIssue],
    queryFn: () => dispatchApi.getMonthlyTargets({ issue: dispatchIssue, limit: 500 }).then((r) => r.data),
    enabled: isValidIssue,
  });
  const targets: DispatchTarget[] = targetsRes?.data?.targets ?? [];

  // 발송 현황 조회 (해당 호 기준)
  const { data: sendsData, isLoading: sendsLoading } = useQuery({
    queryKey: ["sends-monthly", dispatchIssue, sendPage, limit, sendStatus, debouncedRecipientSearch],
    queryFn: () =>
      sendsApi.getSends({
        page: sendPage,
        limit,
        send_status: sendStatus || null,
        recipient_search: debouncedRecipientSearch || null,
        courier_company: "CJ대한통운",
        issue: isValidIssue ? dispatchIssue : null,
      }).then((r) => r.data),
  });

  const generateMutation = useMutation({
    mutationFn: () => {
      const ids = targetSelectedIds.size > 0
        ? Array.from(targetSelectedIds) as number[]
        : targets.map((t) => t.order_item_id);
      return dispatchApi.generateMonthlyDispatch({
        issue: dispatchIssue,
        official_send_date: null,
        order_item_ids: ids,
      });
    },
    onSuccess: (res) => {
      const result = res.data?.data;
      if (result) setGenerateResult(result);
      toast.success(`${result?.success_count ?? 0}건 발송 생성 완료`);
      queryClient.invalidateQueries({ queryKey: ["monthly-dispatch-targets"] });
      queryClient.invalidateQueries({ queryKey: ["sends-monthly"] });
      setGenerateConfirmOpen(false);
      setTargetSelectedIds(new Set());
    },
    onError: () => toast.error("발송 생성 실패"),
  });

  const cancelMutation = useMutation({
    mutationFn: (sendId: number) => sendsApi.cancelSend(sendId),
    onSuccess: () => {
      toast.success("발송이 취소되었습니다.");
      queryClient.invalidateQueries({ queryKey: ["sends-monthly"] });
      setCancelTarget(null);
    },
    onError: () => toast.error("발송 취소 실패"),
  });

  const batchDeliveredMutation = useMutation({
    mutationFn: () => sendsApi.batchDelivered(Array.from(sendSelectedIds) as number[]),
    onSuccess: (res) => {
      const result = res.data?.data;
      if (result) setBatchResult(result);
      toast.success(`${result?.success_count ?? 0}건 배송완료로 전환`);
      queryClient.invalidateQueries({ queryKey: ["sends-monthly"] });
      setSendSelectedIds(new Set());
    },
    onError: () => toast.error("상태 전환 실패"),
  });

  const handleDownload = async () => {
    if (!isValidIssue) { toast.error("발송 호를 입력하세요. (YYYYMM)"); return; }
    setDownloading(true);
    try {
      const res = await dispatchApi.exportMonthlyDispatch(dispatchIssue);
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.download = `dispatch_monthly_${dispatchIssue}.xlsx`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error("엑셀 다운로드 실패");
    } finally {
      setDownloading(false);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!isValidIssue) { toast.error("발송 호를 먼저 입력하세요."); return; }
    setUploading(true);
    try {
      const res = await dispatchApi.uploadMonthlyTracking(dispatchIssue, file);
      const result = res.data?.data!;
      setTrackingResult(result);
      toast.success(`${result?.success_count ?? 0}건 송장 업로드 완료`);
      queryClient.invalidateQueries({ queryKey: ["sends-monthly"] });
    } catch {
      toast.error("송장 업로드 실패");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  // 기출유 전송 완료 (PREPARING → SHIPPING)
  const batchShippingMutation = useMutation({
    mutationFn: () => sendsApi.batchShipping(Array.from(sendSelectedIds) as number[]),
    onSuccess: (res) => {
      const result = res.data?.data;
      if (result) setBatchResult(result);
      toast.success(`${result?.success_count ?? 0}건 배송중으로 전환`);
      queryClient.invalidateQueries({ queryKey: ["sends-monthly"] });
      setSendSelectedIds(new Set());
    },
    onError: () => toast.error("상태 전환 실패"),
  });

  const sendColumns = makeSendColumns(queryClient, "sends-monthly", setCancelTarget, true);
  const generateCount = targetSelectedIds.size > 0 ? targetSelectedIds.size : targets.length;

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* 발송 호 입력 */}
      <div className="px-5 py-3 bg-white border-b border-gray-200 flex items-center gap-3 flex-shrink-0">
        <span className="text-xs font-medium text-gray-500 whitespace-nowrap">발송 호</span>
        <Input
          className="w-24 h-8 text-sm"
          placeholder="YYYYMM"
          maxLength={6}
          value={dispatchIssue}
          onChange={(e) => setDispatchIssue(e.target.value.replace(/\D/g, ""))}
        />
        {isValidIssue && (
          <span className="text-sm text-blue-600 font-medium">{formatIssue(dispatchIssue)}</span>
        )}
        <span className="text-xs text-amber-600 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded ml-auto">
          오후 3시 마감
        </span>
      </div>

      {/* ── 섹션 1: 미발송 대상 ── */}
      {isValidIssue && (
        <div className="flex-shrink-0 border-b border-gray-200">
          <div className="px-5 py-2.5 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-semibold text-gray-600 uppercase tracking-wide">미발송 대상</h3>
              <span className="text-xs text-gray-400">{targets.length}건</span>
              {targetSelectedIds.size > 0 && (
                <span className="text-xs text-blue-600 font-medium">{targetSelectedIds.size}건 선택됨</span>
              )}
            </div>
            {targets.length > 0 && (
              <Button
                size="sm"
                className="h-7 text-xs"
                onClick={() => setGenerateConfirmOpen(true)}
                disabled={generateMutation.isPending}
              >
                {generateMutation.isPending && <LoadingSpinner size="sm" className="mr-1" />}
                발송 생성 ({generateCount}건)
              </Button>
            )}
          </div>
          <div className="max-h-[280px] overflow-y-auto bg-white">
            <DataTable
              columns={targetColumns}
              data={targets}
              getRowId={(row) => row.order_item_id}
              isLoading={targetsLoading}
              emptyMessage={`${isValidIssue ? formatIssue(dispatchIssue) + " " : ""}미발송 대상이 없습니다.`}
              selectedIds={targetSelectedIds}
              onSelectionChange={setTargetSelectedIds}
            />
          </div>
        </div>
      )}

      {/* ── 섹션 2: 발송 현황 ── */}
      <div className="flex-shrink-0">
        <PageHeader
          left={
            <div className="flex items-center gap-3">
              <h3 className="text-xs font-semibold text-gray-600 uppercase tracking-wide">발송 현황</h3>
              <span className="text-sm text-gray-500">{sendsData?.total ?? 0}건</span>
              {sendSelectedIds.size > 0 && (
                <span className="text-sm text-blue-600 font-medium">{sendSelectedIds.size}건 선택됨</span>
              )}
            </div>
          }
          actions={
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="gap-1.5" onClick={handleDownload}
                disabled={downloading || !isValidIssue}>
                {downloading ? <LoadingSpinner size="sm" /> : <Download className="h-3.5 w-3.5" />}
                기출유 엑셀
              </Button>
              <label>
                <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleUpload}
                  disabled={uploading || !isValidIssue} />
                <Button variant="outline" size="sm" className="gap-1.5" disabled={uploading || !isValidIssue}
                  onClick={(e) => {
                    if (!isValidIssue) { toast.error("발송 호를 먼저 입력하세요."); e.preventDefault(); return; }
                    (e.currentTarget.parentElement?.querySelector("input") as HTMLElement)?.click();
                  }}>
                  {uploading ? <LoadingSpinner size="sm" /> : <Upload className="h-3.5 w-3.5" />}
                  송장 업로드
                </Button>
              </label>
              {sendSelectedIds.size > 0 && (
                <>
                  <Button size="sm" className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white"
                    onClick={() => batchShippingMutation.mutate()} disabled={batchShippingMutation.isPending}>
                    {batchShippingMutation.isPending && <LoadingSpinner size="sm" className="mr-1" />}
                    기출유 전송 완료 ({sendSelectedIds.size})
                  </Button>
                  <Button size="sm" className="gap-1.5 bg-green-600 hover:bg-green-700 text-white"
                    onClick={() => batchDeliveredMutation.mutate()} disabled={batchDeliveredMutation.isPending}>
                    {batchDeliveredMutation.isPending && <LoadingSpinner size="sm" className="mr-1" />}
                    배송완료 전환 ({sendSelectedIds.size})
                  </Button>
                </>
              )}
            </div>
          }
        />

        {/* 상태 필터 */}
        <div className="px-5 py-2 bg-white border-b border-gray-100 flex items-center gap-1.5">
          <span className="text-xs text-gray-400 mr-1">상태</span>
          {SEND_STATUS_FLOW.map((s, i) => (
            <span key={s.value} className="flex items-center gap-1.5">
              {i > 0 && i < 3 && <span className="text-gray-300 text-xs">→</span>}
              <button
                onClick={() => { setSendStatus(sendStatus === s.value ? "" : s.value); setSendPage(1); }}
                className={`text-xs px-2.5 py-1 rounded border transition-colors ${
                  sendStatus === s.value
                    ? "bg-blue-50 border-blue-300 text-blue-700 font-medium"
                    : "border-gray-200 text-gray-500 hover:bg-gray-50"
                }`}
              >
                {s.label}
              </button>
            </span>
          ))}
        </div>

        <FilterBar
          basic={
            <Input className="w-40" placeholder="수령인 검색" value={recipientSearch}
              onChange={(e) => { setRecipientSearch(e.target.value); setSendPage(1); }} />
          }
          hasActiveFilters={!!recipientSearch}
          onReset={() => { setRecipientSearch(""); setSendPage(1); }}
          chips={recipientSearch ? [{ label: `수령인: ${recipientSearch}`, onRemove: () => { setRecipientSearch(""); setSendPage(1); } }] : []}
        />
      </div>

      <div className="flex-1 min-h-[200px] overflow-hidden bg-white">
        <div className="h-full overflow-y-auto">
          <DataTable
            columns={sendColumns}
            data={sendsData?.items ?? []}
            getRowId={(row) => row.send_id}
            onRowClick={(row) => { setSelectedSendId(row.send_id); setPanelOpen(true); }}
            activeRowId={selectedSendId}
            isLoading={sendsLoading}
            emptyMessage="발송 내역이 없습니다."
            selectedIds={sendSelectedIds}
            onSelectionChange={setSendSelectedIds}
          />
        </div>
      </div>

      {sendsData && (
        <div className="bg-white border-t border-gray-200 flex-shrink-0">
          <Pagination page={sendPage} totalPages={sendsData.total_pages} total={sendsData.total} limit={limit} onPageChange={setSendPage} />
        </div>
      )}

      <SlidingPanel open={panelOpen} onClose={() => { setPanelOpen(false); setTimeout(() => setSelectedSendId(null), 250); }} width={520}>
        {selectedSendId && <SendDetailPanel sendId={selectedSendId} onClose={() => { setPanelOpen(false); setTimeout(() => setSelectedSendId(null), 250); }} />}
      </SlidingPanel>

      <ConfirmModal
        open={cancelTarget !== null}
        onClose={() => setCancelTarget(null)}
        onConfirm={() => cancelTarget !== null && cancelMutation.mutate(cancelTarget)}
        title="발송 취소" description="이 발송을 취소합니다." confirmLabel="취소 처리" variant="destructive"
        isLoading={cancelMutation.isPending}
      />

      <ConfirmModal
        open={generateConfirmOpen}
        onClose={() => setGenerateConfirmOpen(false)}
        onConfirm={() => generateMutation.mutate()}
        title="발송 생성"
        description={`${formatIssue(dispatchIssue)} 단품 ${generateCount}건의 발송을 생성합니다.`}
        confirmLabel="발송 생성"
        isLoading={generateMutation.isPending}
      />

      <ResultDialog title="발송 생성 완료" result={generateResult} onClose={() => setGenerateResult(null)} labels={{ total: "전체", success: "생성됨", fail: "실패" }} />
      <ResultDialog title="일괄 상태 전환 완료" result={batchResult} onClose={() => setBatchResult(null)} />

      {/* 송장 업로드 결과 */}
      <Dialog open={!!trackingResult} onOpenChange={(o) => !o && setTrackingResult(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>송장 업로드 완료</DialogTitle>
          </DialogHeader>
          {trackingResult && (
            <div className="space-y-3 py-2">
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center bg-gray-50 rounded-lg py-2.5">
                  <div className="text-lg font-semibold text-gray-900">{trackingResult.total}</div>
                  <div className="text-xs text-gray-500">전체</div>
                </div>
                <div className="text-center bg-green-50 rounded-lg py-2.5">
                  <div className="text-lg font-semibold text-green-700">{trackingResult.success_count}</div>
                  <div className="text-xs text-green-600">성공</div>
                </div>
                <div className="text-center bg-red-50 rounded-lg py-2.5">
                  <div className="text-lg font-semibold text-red-600">{trackingResult.fail_count}</div>
                  <div className="text-xs text-red-500">실패</div>
                </div>
              </div>
              {trackingResult.fail_count > 0 && (
                <div className="text-xs text-red-500 space-y-0.5 max-h-28 overflow-y-auto bg-red-50 rounded-lg p-2.5">
                  {trackingResult.results
                    .filter((r) => !r.success)
                    .map((r) => (
                      <div key={r.send_id} className="flex gap-2">
                        <span className="font-mono text-gray-500 flex-shrink-0">#{r.send_id}</span>
                        <span>{r.message ?? "알 수 없는 오류"}</span>
                      </div>
                    ))}
                </div>
              )}
              {trackingResult.fail_count === 0 && (
                <p className="text-xs text-green-600 text-center">모든 송장번호가 성공적으로 처리되었습니다.</p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setTrackingResult(null)}>확인</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─────────────────────────────────────────────
// 13113 탭 (우편번호 13113 발송)
// ─────────────────────────────────────────────
function PostalCode13113Tab() {
  const queryClient = useQueryClient();
  const [dispatchIssue, setDispatchIssue] = useState(currentIssue());
  const [sendStatus, setSendStatus] = useState("");
  const [sendPage, setSendPage] = useState(1);
  const [recipientSearch, setRecipientSearch] = useState("");
  const [sendSelectedIds, setSendSelectedIds] = useState<Set<string | number>>(new Set());
  const [panelOpen, setPanelOpen] = useState(false);
  const [selectedSendId, setSelectedSendId] = useState<number | null>(null);
  const [cancelTarget, setCancelTarget] = useState<number | null>(null);
  const [batchResult, setBatchResult] = useState<SendBatchStatusResponse | null>(null);
  const limit = 20;

  const debouncedRecipientSearch = useDebounce(recipientSearch, 300);
  const isValidIssue = dispatchIssue.length === 6;

  // 13113 미발송 대상 조회
  const { data: targetsRes, isLoading: targetsLoading } = useQuery({
    queryKey: ["postal13113-targets", dispatchIssue],
    queryFn: () => dispatchApi.getPostalCode13113Targets({ issue: dispatchIssue, limit: 500 }).then((r) => r.data),
    enabled: isValidIssue,
  });
  const targets: DispatchTarget[] = targetsRes?.data?.targets ?? [];

  // 13113 발송 목록
  const { data: sendsData, isLoading: sendsLoading } = useQuery({
    queryKey: ["sends-postal13113", sendPage, limit, sendStatus, debouncedRecipientSearch],
    queryFn: () =>
      sendsApi.getSendsPostalCode13113({
        page: sendPage,
        limit,
        send_status: sendStatus || null,
      }).then((r) => r.data),
  });

  // 일괄 배송중 전환
  const batchShippingMutation = useMutation({
    mutationFn: () => sendsApi.batchShipping(Array.from(sendSelectedIds) as number[]),
    onSuccess: (res) => {
      const result = res.data?.data;
      if (result) setBatchResult(result);
      toast.success(`${result?.success_count ?? 0}건 배송중으로 전환`);
      queryClient.invalidateQueries({ queryKey: ["sends-postal13113"] });
      setSendSelectedIds(new Set());
    },
    onError: () => toast.error("상태 전환 실패"),
  });

  // 일괄 배송완료 전환
  const batchDeliveredMutation = useMutation({
    mutationFn: () => sendsApi.batchDelivered(Array.from(sendSelectedIds) as number[]),
    onSuccess: (res) => {
      const result = res.data?.data;
      if (result) setBatchResult(result);
      toast.success(`${result?.success_count ?? 0}건 배송완료로 전환`);
      queryClient.invalidateQueries({ queryKey: ["sends-postal13113"] });
      setSendSelectedIds(new Set());
    },
    onError: () => toast.error("상태 전환 실패"),
  });

  const cancelMutation = useMutation({
    mutationFn: (sendId: number) => sendsApi.cancelSend(sendId),
    onSuccess: () => {
      toast.success("발송이 취소되었습니다.");
      queryClient.invalidateQueries({ queryKey: ["sends-postal13113"] });
      setCancelTarget(null);
    },
    onError: () => toast.error("발송 취소 실패"),
  });

  const sendColumns = makeSendColumns(queryClient, "sends-postal13113", setCancelTarget, false);

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* 발송 호 입력 */}
      <div className="px-5 py-3 bg-white border-b border-gray-200 flex items-center gap-3 flex-shrink-0">
        <span className="text-xs font-medium text-gray-500 whitespace-nowrap">발송 호</span>
        <Input
          className="w-24 h-8 text-sm"
          placeholder="YYYYMM"
          maxLength={6}
          value={dispatchIssue}
          onChange={(e) => setDispatchIssue(e.target.value.replace(/\D/g, ""))}
        />
        {isValidIssue && (
          <span className="text-sm text-blue-600 font-medium">{formatIssue(dispatchIssue)}</span>
        )}
      </div>

      {/* ── 섹션 1: 미발송 대상 ── */}
      {isValidIssue && (
        <div className="flex-shrink-0 border-b border-gray-200">
          <div className="px-5 py-2.5 bg-gray-50 border-b border-gray-100 flex items-center gap-2">
            <h3 className="text-xs font-semibold text-gray-600 uppercase tracking-wide">미발송 대상</h3>
            <span className="text-xs text-gray-400">{targets.length}건</span>
          </div>
          <div className="max-h-[280px] overflow-y-auto bg-white">
            <DataTable
              columns={targetColumns}
              data={targets}
              getRowId={(row) => row.order_item_id}
              isLoading={targetsLoading}
              emptyMessage={`${isValidIssue ? formatIssue(dispatchIssue) + " " : ""}우편번호 13113 미발송 대상이 없습니다.`}
            />
          </div>
        </div>
      )}

      {/* ── 섹션 2: 발송 현황 ── */}
      <div className="flex-shrink-0">
        <PageHeader
          left={
            <div className="flex items-center gap-3">
              <h3 className="text-xs font-semibold text-gray-600 uppercase tracking-wide">발송 현황</h3>
              <span className="text-sm text-gray-500">{sendsData?.total ?? 0}건</span>
              {sendSelectedIds.size > 0 && (
                <span className="text-sm text-blue-600 font-medium">{sendSelectedIds.size}건 선택됨</span>
              )}
            </div>
          }
          actions={
            sendSelectedIds.size > 0 ? (
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white"
                  onClick={() => batchShippingMutation.mutate()}
                  disabled={batchShippingMutation.isPending}
                >
                  {batchShippingMutation.isPending && <LoadingSpinner size="sm" className="mr-1" />}
                  배송중 전환 ({sendSelectedIds.size})
                </Button>
                <Button
                  size="sm"
                  className="gap-1.5 bg-green-600 hover:bg-green-700 text-white"
                  onClick={() => batchDeliveredMutation.mutate()}
                  disabled={batchDeliveredMutation.isPending}
                >
                  {batchDeliveredMutation.isPending && <LoadingSpinner size="sm" className="mr-1" />}
                  배송완료 전환 ({sendSelectedIds.size})
                </Button>
              </div>
            ) : undefined
          }
        />

        {/* 상태 필터 */}
        <div className="px-5 py-2 bg-white border-b border-gray-100 flex items-center gap-1.5">
          <span className="text-xs text-gray-400 mr-1">상태</span>
          {SEND_STATUS_FLOW.map((s, i) => (
            <span key={s.value} className="flex items-center gap-1.5">
              {i > 0 && i < 3 && <span className="text-gray-300 text-xs">→</span>}
              <button
                onClick={() => { setSendStatus(sendStatus === s.value ? "" : s.value); setSendPage(1); }}
                className={`text-xs px-2.5 py-1 rounded border transition-colors ${
                  sendStatus === s.value
                    ? "bg-blue-50 border-blue-300 text-blue-700 font-medium"
                    : "border-gray-200 text-gray-500 hover:bg-gray-50"
                }`}
              >
                {s.label}
              </button>
            </span>
          ))}
        </div>

        <FilterBar
          basic={
            <Input className="w-40" placeholder="수령인 검색" value={recipientSearch}
              onChange={(e) => { setRecipientSearch(e.target.value); setSendPage(1); }} />
          }
          hasActiveFilters={!!recipientSearch}
          onReset={() => { setRecipientSearch(""); setSendPage(1); }}
          chips={recipientSearch ? [{ label: `수령인: ${recipientSearch}`, onRemove: () => { setRecipientSearch(""); setSendPage(1); } }] : []}
        />
      </div>

      <div className="flex-1 min-h-[200px] overflow-hidden bg-white">
        <div className="h-full overflow-y-auto">
          <DataTable
            columns={sendColumns}
            data={sendsData?.items ?? []}
            getRowId={(row) => row.send_id}
            onRowClick={(row) => { setSelectedSendId(row.send_id); setPanelOpen(true); }}
            activeRowId={selectedSendId}
            isLoading={sendsLoading}
            emptyMessage="우편번호 13113 발송 내역이 없습니다."
            selectedIds={sendSelectedIds}
            onSelectionChange={setSendSelectedIds}
          />
        </div>
      </div>

      {sendsData && (
        <div className="bg-white border-t border-gray-200 flex-shrink-0">
          <Pagination page={sendPage} totalPages={sendsData.total_pages} total={sendsData.total} limit={limit} onPageChange={setSendPage} />
        </div>
      )}

      <SlidingPanel open={panelOpen} onClose={() => { setPanelOpen(false); setTimeout(() => setSelectedSendId(null), 250); }} width={520}>
        {selectedSendId && <SendDetailPanel sendId={selectedSendId} onClose={() => { setPanelOpen(false); setTimeout(() => setSelectedSendId(null), 250); }} />}
      </SlidingPanel>

      <ConfirmModal
        open={cancelTarget !== null}
        onClose={() => setCancelTarget(null)}
        onConfirm={() => cancelTarget !== null && cancelMutation.mutate(cancelTarget)}
        title="발송 취소" description="이 발송을 취소합니다." confirmLabel="취소 처리" variant="destructive"
        isLoading={cancelMutation.isPending}
      />

      <ResultDialog title="일괄 상태 전환 완료" result={batchResult} onClose={() => setBatchResult(null)} />
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
      queryClient.invalidateQueries({ queryKey: ["sends-yearly"] });
      queryClient.invalidateQueries({ queryKey: ["sends-monthly"] });
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
              <Button variant="outline" size="sm" className="gap-1" onClick={() => setIsEditing(true)}>
                <Edit2 className="h-3.5 w-3.5" />
                수정
              </Button>
            )}
            <button onClick={handleClose} className="text-gray-400 hover:text-gray-600 p-1 rounded-md hover:bg-gray-100">
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
                    <Input className="mt-1" value={editForm.recipient_name ?? ""}
                      onChange={(e) => setEditForm((f) => ({ ...f, recipient_name: e.target.value }))} />
                  </div>
                  <div>
                    <Label className="text-xs">연락처</Label>
                    <Input className="mt-1" value={editForm.recipient_phone ?? ""}
                      onChange={(e) => setEditForm((f) => ({ ...f, recipient_phone: e.target.value }))} />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs">우편번호</Label>
                    <Input className="mt-1" value={editForm.postal_code ?? ""}
                      onChange={(e) => setEditForm((f) => ({ ...f, postal_code: e.target.value }))} />
                  </div>
                  <div className="col-span-2">
                    <Label className="text-xs">주소</Label>
                    <Input className="mt-1" value={editForm.recipient_address ?? ""}
                      onChange={(e) => setEditForm((f) => ({ ...f, recipient_address: e.target.value }))} />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">배송 메모</Label>
                  <Input className="mt-1" value={editForm.customer_memo ?? ""}
                    onChange={(e) => setEditForm((f) => ({ ...f, customer_memo: e.target.value }))} placeholder="(선택)" />
                </div>
                <div>
                  <Label className="text-xs">관리자 메모</Label>
                  <Input className="mt-1" value={editForm.admin_memo ?? ""}
                    onChange={(e) => setEditForm((f) => ({ ...f, admin_memo: e.target.value }))} placeholder="(선택)" />
                </div>
                <div className="flex gap-2 pt-1">
                  <Button size="sm" onClick={() => editMutation.mutate()} disabled={editMutation.isPending}>
                    {editMutation.isPending && <LoadingSpinner size="sm" className="mr-1" />}
                    저장
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setIsEditing(false)}>취소</Button>
                </div>
              </div>
            )}

            <PanelSection title="배송지">
              <InfoRow label="수령인" value={send.recipient_name} />
              <InfoRow label="연락처" value={<span className="font-mono">{formatPhone(send.recipient_phone)}</span>} />
              <InfoRow label="주소" value={`(${send.postal_code}) ${send.recipient_address}`} />
              {send.customer_memo && <InfoRow label="배송 메모" value={send.customer_memo} />}
            </PanelSection>

            <PanelSection title="발송 정보">
              {send.tracking_no && (
                <InfoRow label="운송장" value={<span className="font-mono">{send.courier_company} {send.tracking_no}</span>} />
              )}
              {send.official_send_date && <InfoRow label="발송예정일" value={formatDate(send.official_send_date)} />}
              {send.shipped_at && <InfoRow label="배송시작" value={formatDate(send.shipped_at)} />}
              {send.delivered_at && <InfoRow label="배송완료" value={formatDate(send.delivered_at)} />}
              {send.admin_memo && <InfoRow label="관리자 메모" value={send.admin_memo} />}
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
                        <tr key={item.send_item_id} className={item.cancelled_at ? "opacity-50 bg-gray-50" : ""}>
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
                                  <DropdownMenuItem onClick={() => {
                                    setEditingItem(item);
                                    setItemEditForm({ send_num: item.send_num, admin_memo: item.admin_memo ?? "" });
                                  }}>
                                    품목 수정
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem className="text-red-600 focus:text-red-600 focus:bg-red-50"
                                    onClick={() => setItemCancelId(item.send_item_id)}>
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
              {send.cancelled_at && <InfoRow label="취소일" value={formatDateTime(send.cancelled_at)} />}
            </PanelSection>
          </>
        )}
      </div>

      <ConfirmModal open={itemCancelId !== null} onClose={() => setItemCancelId(null)}
        onConfirm={() => itemCancelId !== null && itemCancelMutation.mutate(itemCancelId)}
        title="품목 취소" description="이 발송 품목을 취소합니다. 취소 후 되돌릴 수 없습니다."
        confirmLabel="취소 처리" variant="destructive" isLoading={itemCancelMutation.isPending} />

      <Dialog open={editingItem !== null} onOpenChange={(open) => !open && setEditingItem(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>품목 수정</DialogTitle></DialogHeader>
          {editingItem && (
            <div className="space-y-3 py-1">
              <div className="text-xs text-gray-500 bg-gray-50 rounded-md px-3 py-2">
                {editingItem.product_name}
                <span className="ml-2 font-mono text-gray-400">{editingItem.product_code}</span>
              </div>
              <div>
                <Label className="text-xs">수량</Label>
                <Input type="number" min={1} className="mt-1" value={itemEditForm.send_num}
                  onChange={(e) => setItemEditForm((f) => ({ ...f, send_num: parseInt(e.target.value) || 1 }))} />
              </div>
              <div>
                <Label className="text-xs">관리자 메모</Label>
                <Input className="mt-1" value={itemEditForm.admin_memo}
                  onChange={(e) => setItemEditForm((f) => ({ ...f, admin_memo: e.target.value }))} placeholder="(선택)" />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingItem(null)}>취소</Button>
            <Button onClick={() => itemEditMutation.mutate()} disabled={itemEditMutation.isPending}>
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
