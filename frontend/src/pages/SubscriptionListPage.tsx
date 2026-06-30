import { useState, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useDebounce } from "@/hooks/useDebounce";
import { FileDown, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { DataTable, type ColumnDef } from "@/components/common/DataTable";
import { FilterBar } from "@/components/common/FilterBar";
import { PageHeader } from "@/components/common/PageHeader";
import { Pagination } from "@/components/common/Pagination";
import { StatusBadge } from "@/components/common/StatusBadge";
import { SlidingPanel } from "@/components/common/SlidingPanel";
import { orderItemsApi } from "@/api/orderItemsApi";
import { pausesApi } from "@/api/pausesApi";
import { vipSlotsApi } from "@/api/vipSlotsApi";
import SubscriptionDetailPanel from "./subscription/SubscriptionDetailPanel";
import { toast } from "@/hooks/use-toast";
import { formatAmount, formatDate, formatPhone, formatIssue } from "@/utils/format";
import { PRODUCT_KIND_LABEL } from "@/utils/constants";
import { VipFlagsDisplay } from "@/components/common/VipFlags";
import type { SubscriptionListItem } from "@/types/orderItem";
import type { PauseListItem, PauseByIssueResponse } from "@/types/pause";

const PRODUCT_KIND_OPTIONS = [
  { value: "_all", label: "전체 종류" },
  { value: "YEARLY", label: "정기구독" },
  { value: "MONTHLY", label: "단품" },
];

const CANCELLED_OPTIONS = [
  { value: "_all", label: "전체 상태" },
  { value: "false", label: "활성" },
  { value: "true", label: "취소" },
];

export default function SubscriptionListPage() {
  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <Tabs defaultValue="subscriptions" className="flex-1 overflow-hidden flex flex-col">
        <div className="px-5 py-3 bg-white border-b border-gray-200 flex-shrink-0">
          <TabsList>
            <TabsTrigger value="subscriptions">구독 목록</TabsTrigger>
            <TabsTrigger value="pauses">휴지 내역</TabsTrigger>
          </TabsList>
        </div>
        <div className="flex-1 min-h-0 relative">
          <TabsContent value="subscriptions" className="absolute inset-0 m-0 overflow-hidden flex flex-col">
            <SubscriptionListTab />
          </TabsContent>
          <TabsContent value="pauses" className="absolute inset-0 m-0 overflow-hidden flex flex-col">
            <PauseListTab />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}

// ─────────────────────────────────────────────
// 탭 1: 구독 목록 (기존 내용)
// ─────────────────────────────────────────────
function SubscriptionListTab() {
  const [page, setPage] = useState(1);
  const [productKind, setProductKind] = useState("");
  const [cancelledFilter, setCancelledFilter] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [endIssueFrom, setEndIssueFrom] = useState("");
  const [endIssueTo, setEndIssueTo] = useState("");

  const [selectedItem, setSelectedItem] = useState<SubscriptionListItem | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);

  const handleRowClick = useCallback((row: SubscriptionListItem) => {
    setSelectedItem(row);
    setPanelOpen(true);
  }, []);

  const handlePanelClose = useCallback(() => {
    setPanelOpen(false);
    setTimeout(() => setSelectedItem(null), 250);
  }, []);

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [batchModalOpen, setBatchModalOpen] = useState(false);
  const [extendMonths, setExtendMonths] = useState("1");
  const [extendReason, setExtendReason] = useState("");
  const [extendMonthsError, setExtendMonthsError] = useState(false);
  const [extendReasonError, setExtendReasonError] = useState(false);

  const [expiringModalOpen, setExpiringModalOpen] = useState(false);
  const [expiringIssue, setExpiringIssue] = useState("");
  const [expiringIssueError, setExpiringIssueError] = useState(false);
  const [isExpiringDownloading, setIsExpiringDownloading] = useState(false);

  const debouncedCustomerSearch = useDebounce(customerSearch, 300);
  const limit = 20;

  const isCancelledParam =
    cancelledFilter === "true" ? true : cancelledFilter === "false" ? false : null;

  const { data, isLoading, refetch } = useQuery({
    queryKey: [
      "subscriptions",
      page,
      limit,
      productKind,
      cancelledFilter,
      debouncedCustomerSearch,
      endIssueFrom,
      endIssueTo,
    ],
    queryFn: () =>
      orderItemsApi.listOrderItems({
        page,
        limit,
        product_kind: productKind || null,
        is_cancelled: isCancelledParam,
        customer_search: debouncedCustomerSearch || null,
        end_issue_from: endIssueFrom || null,
        end_issue_to: endIssueTo || null,
      }).then((r) => r.data),
  });

  const batchExtendMutation = useMutation({
    mutationFn: () =>
      orderItemsApi.batchExtendSubscription({
        order_item_ids: activeSelectedIds,
        extend_months: parseInt(extendMonths, 10),
        reason: extendReason,
      }),
    onSuccess: (res) => {
      const result = res.data.data;
      if (result) {
        toast.success(
          `일괄 무상 연장 완료`,
          `성공 ${result.success_count}건 / 실패 ${result.fail_count}건`
        );
      }
      setBatchModalOpen(false);
      setSelectedIds(new Set());
      setExtendMonths("1");
      setExtendReason("");
      refetch();
    },
    onError: () => toast.error("일괄 무상 연장 실패"),
  });

  const handleBatchExtendOpen = () => {
    if (selectedIds.size === 0) {
      toast.error("연장할 품목을 선택해주세요.");
      return;
    }
    if (activeSelectedIds.length === 0) {
      toast.error("선택된 항목 중 연장 가능한 구독이 없습니다. (취소된 구독 제외)");
      return;
    }
    setBatchModalOpen(true);
  };

  const handleExpiringDownload = async () => {
    if (!/^\d{6}$/.test(expiringIssue)) {
      setExpiringIssueError(true);
      toast.error("호를 6자리 숫자로 입력해주세요. (예: 202608)");
      return;
    }
    setIsExpiringDownloading(true);
    try {
      await orderItemsApi.downloadExpiringSubscribersExcel(expiringIssue);
      toast.success(
        "재구독 안내 명단 다운로드 완료",
        `${expiringIssue.slice(0, 4)}년 ${parseInt(expiringIssue.slice(4))}월 만기 구독자`,
      );
      setExpiringModalOpen(false);
      setExpiringIssue("");
    } catch {
      toast.error("엑셀 다운로드에 실패했습니다.");
    } finally {
      setIsExpiringDownloading(false);
    }
  };

  const handleBatchExtendConfirm = () => {
    let hasError = false;
    const months = parseInt(extendMonths, 10);
    if (!extendMonths || isNaN(months) || months < 1) {
      setExtendMonthsError(true);
      toast.error("연장 개월 수를 입력해주세요.");
      hasError = true;
    }
    if (!extendReason.trim()) {
      setExtendReasonError(true);
      if (!hasError) toast.error("연장 사유를 입력해주세요.");
      hasError = true;
    }
    if (hasError) return;
    batchExtendMutation.mutate();
  };

  const allIds = data?.items.filter((i) => !i.cancelled_at).map((i) => i.order_item_id) ?? [];
  const allSelected = allIds.length > 0 && allIds.every((id) => selectedIds.has(id));
  const someSelected = allIds.some((id) => selectedIds.has(id));

  const activeSelectedIds = (data?.items ?? [])
    .filter((i) => selectedIds.has(i.order_item_id) && !i.cancelled_at)
    .map((i) => i.order_item_id);
  const cancelledSelectedCount = selectedIds.size - activeSelectedIds.length;

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        allIds.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        allIds.forEach((id) => next.add(id));
        return next;
      });
    }
  };

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const resetFilters = () => {
    setProductKind("");
    setCancelledFilter("");
    setCustomerSearch("");
    setEndIssueFrom("");
    setEndIssueTo("");
    setPage(1);
  };

  const { data: vipSlots = [] } = useQuery({
    queryKey: ["vip-slots"],
    queryFn: () => vipSlotsApi.getVipSlots().then((res) => res.data.data ?? []),
    staleTime: 5 * 60 * 1000,
  });

  const activeChips = [
    ...(productKind
      ? [{ key: "productKind", label: `종류: ${PRODUCT_KIND_LABEL[productKind] ?? productKind}`, onRemove: () => { setProductKind(""); setPage(1); } }]
      : []),
    ...(cancelledFilter
      ? [{ key: "cancelled", label: cancelledFilter === "true" ? "취소" : "활성", onRemove: () => { setCancelledFilter(""); setPage(1); } }]
      : []),
    ...(debouncedCustomerSearch
      ? [{ key: "customer", label: `고객: ${debouncedCustomerSearch}`, onRemove: () => { setCustomerSearch(""); setPage(1); } }]
      : []),
    ...(endIssueFrom
      ? [{ key: "issueFrom", label: `종료호 ≥ ${formatIssue(endIssueFrom)}`, onRemove: () => { setEndIssueFrom(""); setPage(1); } }]
      : []),
    ...(endIssueTo
      ? [{ key: "issueTo", label: `종료호 ≤ ${formatIssue(endIssueTo)}`, onRemove: () => { setEndIssueTo(""); setPage(1); } }]
      : []),
  ];

  const columns: ColumnDef<SubscriptionListItem>[] = [
    {
      key: "select",
      header: (
        <input
          type="checkbox"
          checked={allSelected}
          ref={(el) => { if (el) el.indeterminate = someSelected && !allSelected; }}
          onChange={toggleSelectAll}
          className="rounded border-gray-300"
          disabled={isLoading || allIds.length === 0}
        />
      ),
      cell: (row) => (
        <input
          type="checkbox"
          checked={selectedIds.has(row.order_item_id)}
          onChange={() => toggleSelect(row.order_item_id)}
          onClick={(e) => e.stopPropagation()}
          className="rounded border-gray-300 disabled:opacity-40 disabled:cursor-not-allowed"
          disabled={!!row.cancelled_at}
        />
      ),
      width: "w-10",
    },
    {
      key: "customer",
      header: "고객",
      cell: (row) => (
        <div>
          <div className="font-medium text-gray-900 text-[13px] flex items-center gap-1.5 flex-wrap">
            <span>{row.customer_name ?? "-"}</span>
            {row.address && <VipFlagsDisplay address={row.address} slots={vipSlots} compact />}
          </div>
          <div className="text-xs text-gray-400">{formatPhone(row.customer_phone)}</div>
        </div>
      ),
    },
    {
      key: "product",
      header: "상품",
      cell: (row) => (
        <div>
          <div className="text-[13px] font-medium text-gray-900">{row.product_name}</div>
          <div className="text-xs text-gray-400">{row.product_code}</div>
        </div>
      ),
    },
    {
      key: "kind",
      header: "종류",
      cell: (row) => <StatusBadge type="product_kind" value={row.product_kind} />,
      width: "w-20",
    },
    {
      key: "channel",
      header: "채널",
      cell: (row) =>
        row.order_channel ? <StatusBadge type="channel" value={row.order_channel} /> : <span className="text-xs text-gray-400">-</span>,
      width: "w-24",
    },
    {
      key: "subscribe_start",
      header: "구독 시작",
      cell: (row) => (
        <span className="text-xs text-gray-700">{formatIssue(row.final_subscribe_start_issue)}</span>
      ),
      width: "w-28",
    },
    {
      key: "subscribe_end",
      header: "구독 종료",
      cell: (row) => (
        <span className="text-xs text-gray-700">{formatIssue(row.final_subscribe_end_issue)}</span>
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
      width: "w-28",
    },
    {
      key: "sale_price",
      header: "판매가",
      cell: (row) => (
        <span className="text-xs text-gray-700">{formatAmount(row.sale_price)}</span>
      ),
      width: "w-24",
    },
    {
      key: "status",
      header: "상태",
      cell: (row) => (
        <span className={`text-xs ${row.cancelled_at ? "text-red-500" : "text-green-600"}`}>
          {row.cancelled_at ? "취소" : "활성"}
        </span>
      ),
      width: "w-14",
    },
  ];

  return (
    <>
      <PageHeader
        left={<span className="text-sm text-gray-500">총 {data?.total ?? 0}건</span>}
        actions={
          <div className="flex items-center gap-2">
            {selectedIds.size > 0 && (
              <span className="text-xs text-gray-500">{selectedIds.size}개 선택됨</span>
            )}
            <Button
              size="sm"
              variant="success"
              onClick={() => setExpiringModalOpen(true)}
            >
              <FileDown className="h-3.5 w-3.5" />
              재구독 대상자
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleBatchExtendOpen}
              disabled={selectedIds.size === 0}
            >
              일괄 무상 연장
            </Button>
            <Button size="sm" variant="ghost" onClick={() => refetch()}>
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </div>
        }
      />

      <FilterBar
        basic={
          <>
            <Select
              value={productKind || "_all"}
              onValueChange={(v) => { setProductKind(v === "_all" ? "" : v); setPage(1); }}
            >
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRODUCT_KIND_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={cancelledFilter || "_all"}
              onValueChange={(v) => { setCancelledFilter(v === "_all" ? "" : v); setPage(1); }}
            >
              <SelectTrigger className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CANCELLED_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input
              className="w-44"
              placeholder="고객명 / 연락처"
              value={customerSearch}
              onChange={(e) => { setCustomerSearch(e.target.value); setPage(1); }}
            />
          </>
        }
        advanced={
          <>
            <span className="text-xs text-gray-500 whitespace-nowrap">종료호</span>
            <Input
              className="w-28"
              placeholder="202601"
              value={endIssueFrom}
              onChange={(e) => { setEndIssueFrom(e.target.value); setPage(1); }}
              maxLength={6}
            />
            <span className="text-xs text-gray-400">~</span>
            <Input
              className="w-28"
              placeholder="202612"
              value={endIssueTo}
              onChange={(e) => { setEndIssueTo(e.target.value); setPage(1); }}
              maxLength={6}
            />
          </>
        }
        advancedActiveCount={(endIssueFrom ? 1 : 0) + (endIssueTo ? 1 : 0)}
        chips={activeChips}
        hasActiveFilters={activeChips.length > 0}
        onReset={resetFilters}
      />

      <div className="flex-1 overflow-hidden bg-white">
        <div className="h-full overflow-y-auto">
          <DataTable
            columns={columns}
            data={data?.items ?? []}
            getRowId={(row) => row.order_item_id}
            isLoading={isLoading}
            emptyMessage="구독 내역이 없습니다."
            onRowClick={handleRowClick}
            activeRowId={selectedItem?.order_item_id}
            rowClassName={(row) => row.cancelled_at ? "opacity-50" : undefined}
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

      {/* 재구독 대상자 추출 모달 */}
      <Dialog
        open={expiringModalOpen}
        onOpenChange={(open) => {
          if (!open) {
            setExpiringModalOpen(false);
            setExpiringIssue("");
            setExpiringIssueError(false);
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>재구독 대상자 추출</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <p className="text-sm text-gray-500 leading-loose break-keep">
              구독 종료 호{" "}
              <Input
                className={`!inline-block w-24 h-7 mx-1.5 text-sm text-center align-middle ${expiringIssueError ? "border-red-500" : ""}`}
                placeholder="202608"
                maxLength={6}
                value={expiringIssue}
                onChange={(e) => {
                  setExpiringIssue(e.target.value.replace(/\D/g, ""));
                  setExpiringIssueError(false);
                }}
              />{" "}
              의 재구독 대상자 명단을 엑셀로 내려받습니다.
            </p>
            {expiringIssueError && (
              <p className="text-xs text-red-500">호를 6자리 숫자로 입력해주세요. (예: 202608)</p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => { setExpiringModalOpen(false); setExpiringIssue(""); setExpiringIssueError(false); }}
            >
              취소
            </Button>
            <Button onClick={handleExpiringDownload} disabled={isExpiringDownloading}>
              {isExpiringDownloading ? "다운로드 중..." : "엑셀 다운로드"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 일괄 연장 모달 */}
      <Dialog
        open={batchModalOpen}
        onOpenChange={(open) => {
          if (!open) {
            setBatchModalOpen(false);
            setExtendMonthsError(false);
            setExtendReasonError(false);
          }
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>구독 일괄 무상 연장</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="text-xs text-gray-500 space-y-1">
              <p>
                선택한 <span className="font-semibold text-gray-800">{activeSelectedIds.length}건</span>의 구독을 연장합니다. (YEARLY 상품만 적용)
              </p>
              {cancelledSelectedCount > 0 && (
                <p className="text-amber-600 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                  취소된 구독 {cancelledSelectedCount}건은 자동으로 제외됩니다.
                </p>
              )}
            </div>
            <div>
              <Label>
                연장 개월 수 <span className="text-red-500 ml-0.5">*</span>
              </Label>
              <Input
                className={`mt-1 ${extendMonthsError ? "border-red-500" : ""}`}
                type="number"
                min={1}
                max={24}
                value={extendMonths}
                onChange={(e) => { setExtendMonths(e.target.value); setExtendMonthsError(false); }}
                placeholder="1"
              />
              {extendMonthsError && (
                <p className="text-xs text-red-500 mt-1">연장 개월 수를 입력해주세요.</p>
              )}
            </div>
            <div>
              <Label>
                연장 사유 <span className="text-red-500 ml-0.5">*</span>
              </Label>
              <Input
                className={`mt-1 ${extendReasonError ? "border-red-500" : ""}`}
                value={extendReason}
                onChange={(e) => { setExtendReason(e.target.value); setExtendReasonError(false); }}
                placeholder="연장 사유를 입력하세요."
              />
              {extendReasonError && (
                <p className="text-xs text-red-500 mt-1">연장 사유를 입력해주세요.</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBatchModalOpen(false)}>
              취소
            </Button>
            <Button
              onClick={handleBatchExtendConfirm}
              disabled={batchExtendMutation.isPending}
            >
              연장
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 구독 상세 패널 */}
      <SlidingPanel open={panelOpen} onClose={handlePanelClose}>
        {selectedItem && (
          <SubscriptionDetailPanel item={selectedItem} onClose={handlePanelClose} />
        )}
      </SlidingPanel>
    </>
  );
}

// ─────────────────────────────────────────────
// 탭 2: 휴지 내역
// ─────────────────────────────────────────────
function PauseListTab() {
  const [page, setPage] = useState(1);
  const [issueFilter, setIssueFilter] = useState("");
  const [selectedItem, setSelectedItem] = useState<SubscriptionListItem | null>(null);
  const [selectedPauseId, setSelectedPauseId] = useState<number | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const limit = 20;

  const debouncedIssue = useDebounce(issueFilter, 300);
  const isIssueMode = debouncedIssue.length === 6;

  const handlePanelClose = useCallback(() => {
    setPanelOpen(false);
    setTimeout(() => { setSelectedItem(null); setSelectedPauseId(null); }, 250);
  }, []);

  const handleRowClick = useCallback(async (pause: PauseListItem | PauseByIssueResponse) => {
    try {
      const res = await orderItemsApi.getOrderItem(pause.order_item_id);
      const orderItem = res.data.data!;
      setSelectedItem({
        ...orderItem,
        customer_name: pause.customer_name,
        customer_phone: pause.customer_phone,
        order_channel: pause.order_channel,
      } as SubscriptionListItem);
      setSelectedPauseId(pause.pause_id);
      setPanelOpen(true);
    } catch {
      toast.error("구독 상세 정보를 불러오지 못했습니다.");
    }
  }, []);

  // 호별 조회 (YYYYMM 정확히 입력 시)
  const { data: byIssueRes, isLoading: byIssueLoading } = useQuery({
    queryKey: ["pauses-by-issue", debouncedIssue],
    queryFn: () => pausesApi.getPausesByIssue(debouncedIssue).then((r) => r.data),
    enabled: isIssueMode,
  });

  // 전체 목록 조회 (기본)
  const { data: listRes, isLoading: listLoading } = useQuery({
    queryKey: ["pauses", page, limit, debouncedIssue],
    queryFn: () =>
      pausesApi.getPauses({
        page,
        limit,
        pause_issue: debouncedIssue || null,
      }).then((r) => r.data),
    enabled: !isIssueMode,
  });

  const isLoading = isIssueMode ? byIssueLoading : listLoading;

  // 공통 컬럼 셀 (전체 목록 / 호별 조회 모두 동일한 구성)
  const sharedColumns = {
    customer: {
      key: "customer",
      header: "고객",
      cell: (row: PauseListItem | PauseByIssueResponse) => (
        <div>
          <div className="text-[13px] font-medium text-gray-900">{row.customer_name ?? "-"}</div>
          <div className="text-xs text-gray-400">{formatPhone(row.customer_phone)}</div>
        </div>
      ),
    },
    product_name: {
      key: "product_name",
      header: "상품",
      cell: (row: PauseListItem | PauseByIssueResponse) => (
        <span className="text-[13px] text-gray-700">{row.product_name ?? "-"}</span>
      ),
    },
    pause_issue: {
      key: "pause_issue",
      header: "휴지 호",
      cell: (row: PauseListItem | PauseByIssueResponse) => (
        <span className="text-xs font-mono text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">
          {formatIssue(row.pause_issue)}
        </span>
      ),
      width: "w-28",
    },
    reason: {
      key: "reason",
      header: "사유",
      cell: (row: PauseListItem | PauseByIssueResponse) => (
        <span className="text-xs text-gray-500">{row.reason ?? "-"}</span>
      ),
    },
    created_at: {
      key: "created_at",
      header: "등록일",
      cell: (row: PauseListItem | PauseByIssueResponse) => (
        <span className="text-xs text-gray-400">{formatDate(row.created_at)}</span>
      ),
      width: "w-28",
    },
  };

  const listColumns: ColumnDef<PauseListItem>[] = [
    sharedColumns.customer as ColumnDef<PauseListItem>,
    sharedColumns.product_name as ColumnDef<PauseListItem>,
    sharedColumns.pause_issue as ColumnDef<PauseListItem>,
    sharedColumns.reason as ColumnDef<PauseListItem>,
    sharedColumns.created_at as ColumnDef<PauseListItem>,
  ];

  const byIssueColumns: ColumnDef<PauseByIssueResponse>[] = [
    sharedColumns.customer as ColumnDef<PauseByIssueResponse>,
    sharedColumns.product_name as ColumnDef<PauseByIssueResponse>,
    sharedColumns.pause_issue as ColumnDef<PauseByIssueResponse>,
    sharedColumns.reason as ColumnDef<PauseByIssueResponse>,
    sharedColumns.created_at as ColumnDef<PauseByIssueResponse>,
  ];

  const byIssueItems = byIssueRes?.data ?? [];
  const listItems = listRes?.items ?? [];
  const totalCount = isIssueMode ? byIssueItems.length : (listRes?.total ?? 0);

  return (
    <>
      <PageHeader
        left={
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500">총 {totalCount}건</span>
            {isIssueMode && (
              <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                {formatIssue(debouncedIssue)} 호 조회 중
              </span>
            )}
          </div>
        }
      />

      <FilterBar
        basic={
          <Input
            className="w-36"
            placeholder="호 검색 (YYYYMM)"
            maxLength={6}
            value={issueFilter}
            onChange={(e) => { setIssueFilter(e.target.value.replace(/\D/g, "")); setPage(1); }}
          />
        }
        hasActiveFilters={!!issueFilter}
        onReset={() => { setIssueFilter(""); setPage(1); }}
        chips={issueFilter ? [{ label: `호: ${issueFilter}`, onRemove: () => { setIssueFilter(""); setPage(1); } }] : []}
      />

      <div className="flex-1 overflow-hidden bg-white">
        <div className="h-full overflow-y-auto">
          {isIssueMode ? (
            <DataTable
              columns={byIssueColumns}
              data={byIssueItems}
              getRowId={(row) => row.pause_id}
              isLoading={isLoading}
              emptyMessage={`${formatIssue(debouncedIssue)} 호 휴지 내역이 없습니다.`}
              onRowClick={handleRowClick}
              activeRowId={selectedPauseId ?? undefined}
            />
          ) : (
            <DataTable
              columns={listColumns}
              data={listItems}
              getRowId={(row) => row.pause_id}
              isLoading={isLoading}
              emptyMessage="휴지 내역이 없습니다."
              onRowClick={handleRowClick}
              activeRowId={selectedPauseId ?? undefined}
            />
          )}
        </div>
      </div>

      {!isIssueMode && listRes && (
        <div className="bg-white border-t border-gray-200">
          <Pagination
            page={page}
            totalPages={listRes.total_pages}
            total={listRes.total}
            limit={limit}
            onPageChange={setPage}
          />
        </div>
      )}

      <SlidingPanel open={panelOpen} onClose={handlePanelClose}>
        {selectedItem && (
          <SubscriptionDetailPanel item={selectedItem} onClose={handlePanelClose} />
        )}
      </SlidingPanel>
    </>
  );
}
