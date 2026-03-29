import { useState, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useDebounce } from "@/hooks/useDebounce";
import { RefreshCw } from "lucide-react";
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
import { DataTable, type ColumnDef } from "@/components/common/DataTable";
import { FilterBar } from "@/components/common/FilterBar";
import { PageHeader } from "@/components/common/PageHeader";
import { Pagination } from "@/components/common/Pagination";
import { StatusBadge } from "@/components/common/StatusBadge";
import { SlidingPanel } from "@/components/common/SlidingPanel";
import { orderItemsApi } from "@/api/orderItemsApi";
import SubscriptionDetailPanel from "./subscription/SubscriptionDetailPanel";
import { toast } from "@/hooks/use-toast";
import { formatAmount, formatPhone, formatIssue } from "@/utils/format";
import { PRODUCT_KIND_LABEL } from "@/utils/constants";
import type { SubscriptionListItem } from "@/types/orderItem";

const PRODUCT_KIND_OPTIONS = [
  { value: "_all", label: "전체 종류" },
  { value: "YEARLY", label: "정기구독" },
  { value: "MONTHLY", label: "단편" },
];

const CANCELLED_OPTIONS = [
  { value: "_all", label: "전체 상태" },
  { value: "false", label: "활성" },
  { value: "true", label: "취소" },
];

export default function SubscriptionListPage() {
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

  // 전체 선택/해제 (취소된 항목 제외)
  const allIds = data?.items.filter((i) => !i.cancelled_at).map((i) => i.order_item_id) ?? [];
  const allSelected = allIds.length > 0 && allIds.every((id) => selectedIds.has(id));
  const someSelected = allIds.some((id) => selectedIds.has(id));

  // 선택된 항목 중 활성/취소 건 분리
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
          <div className="font-medium text-gray-900 text-[13px]">{row.customer_name ?? "-"}</div>
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
    <div className="flex-1 min-h-0 flex flex-col">
      <PageHeader
        left={<span className="text-sm text-gray-500">총 {data?.total ?? 0}건</span>}
        actions={
          <div className="flex items-center gap-2">
            {selectedIds.size > 0 && (
              <span className="text-xs text-gray-500">{selectedIds.size}개 선택됨</span>
            )}
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
              <SelectTrigger className="h-8 w-32 text-xs">
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
              <SelectTrigger className="h-8 w-28 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CANCELLED_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input
              className="h-8 w-44 text-xs"
              placeholder="고객명 / 연락처"
              value={customerSearch}
              onChange={(e) => { setCustomerSearch(e.target.value); setPage(1); }}
            />
          </>
        }
        advanced={
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 whitespace-nowrap">종료호</span>
            <Input
              className="h-8 w-28 text-xs"
              placeholder="202601"
              value={endIssueFrom}
              onChange={(e) => { setEndIssueFrom(e.target.value); setPage(1); }}
              maxLength={6}
            />
            <span className="text-xs text-gray-400">~</span>
            <Input
              className="h-8 w-28 text-xs"
              placeholder="202612"
              value={endIssueTo}
              onChange={(e) => { setEndIssueTo(e.target.value); setPage(1); }}
              maxLength={6}
            />
          </div>
        }
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
    </div>
  );
}
