import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { cafe24API } from "@/api/cafe24Api";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/utils/errorHandler";
import type {
  Cafe24Order,
  Cafe24MappedOrderItem,
  Cafe24OrderImportResponse,
} from "@/types/cafe24";

// ── 헬퍼 ────────────────────────────────────────────────────────────────────

function formatPrice(value: number | null | undefined): string {
  if (value == null) return "-";
  return value.toLocaleString("ko-KR") + "원";
}

function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  return d.toLocaleString("ko-KR", {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

const ORDER_STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  ORDERED: { label: "주문완료", cls: "bg-blue-50 text-blue-700" },
  PAID: { label: "결제완료", cls: "bg-green-50 text-green-700" },
  CANCELLED: { label: "취소", cls: "bg-red-50 text-red-700" },
  UNPAID_CANCELLED: { label: "미결제 취소", cls: "bg-orange-50 text-orange-700" },
  UNKNOWN: { label: "지원 안 함", cls: "bg-yellow-50 text-yellow-700" },
};

function statusBadge(order_status: Cafe24Order["order_status"]) {
  if (!order_status) return { label: "-", cls: "bg-slate-50 text-slate-500" };
  return ORDER_STATUS_BADGE[order_status] ?? { label: order_status, cls: "bg-slate-50 text-slate-600" };
}

const PAYMENT_METHOD_LABEL: Record<string, string> = {
  cash: "무통장",
  card: "신용카드",
  icash: "가상계좌",
  tcash: "계좌이체",
};

function getDefaultDates() {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 3);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { start: fmt(start), end: fmt(end) };
}

// ── 품목 박스 ───────────────────────────────────────────────────────────────

function ItemBox({ item }: { item: Cafe24MappedOrderItem }) {
  const matched = item.product_code !== null;
  const stats = (
    <span className="text-gray-600 whitespace-nowrap">
      수량 {item.order_num}개
      <span className="mx-1 text-gray-300">·</span>
      판매가 {formatPrice(item.sale_price)}
    </span>
  );
  return (
    <div
      className={`border rounded px-2 py-1 text-xs ${
        matched ? "border-gray-200 bg-white" : "border-red-200 bg-red-50"
      }`}
    >
      <div className="flex items-center justify-between gap-3 flex-wrap leading-tight">
        {matched ? (
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <span className="text-green-600 shrink-0">✅</span>
            <span className="font-medium text-gray-900 break-all">{item.product_name}</span>
          </div>
        ) : (
          <span className="text-red-600 font-medium shrink-0">⚠️ 미등록</span>
        )}
        <div className="flex items-center gap-2 shrink-0">
          {stats}
          {matched && (
            <span
              className={`px-1.5 py-0.5 rounded text-[11px] ${
                item.product_kind === "YEARLY"
                  ? "bg-indigo-50 text-indigo-700"
                  : "bg-amber-50 text-amber-700"
              }`}
            >
              {item.product_kind}
            </span>
          )}
        </div>
      </div>
      {item.option_value && (
        <div className="text-gray-500 leading-tight break-all mt-0.5">
          옵션: {item.option_value}
        </div>
      )}
    </div>
  );
}

// ── 주문 카드 ───────────────────────────────────────────────────────────────

function OrderCard({
  order,
  checked,
  onToggle,
}: {
  order: Cafe24Order;
  checked: boolean;
  onToggle: () => void;
}) {
  const isImported = order.already_imported;
  const status = statusBadge(order.order_status);
  const pmLabel = order.payment_method
    ? (PAYMENT_METHOD_LABEL[order.payment_method] ?? order.payment_method)
    : "-";

  if (order.detail_fetch_error) {
    return (
      <div className="border border-red-300 rounded bg-red-50 p-4 text-sm text-red-700">
        <div className="font-mono mb-1">{order.external_order_id}</div>
        상세 조회 실패: {order.detail_fetch_error}
      </div>
    );
  }

  return (
    <div className={`border border-slate-200 rounded-lg overflow-hidden grid grid-cols-[50px_280px_1fr_1fr] grid-rows-[auto_1fr] shadow-sm bg-white ${isImported ? "opacity-90" : ""}`}>
      {/* 좌측: 체크박스 / 이미 가져옴 표시 통합 (row-span 2) */}
      <div
        className={`row-span-2 flex flex-col items-center justify-center gap-1 border-r border-slate-100 ${
          isImported ? "bg-emerald-50" : "bg-white"
        }`}
        title={isImported ? "이미 가져옴" : "신규"}
      >
        {isImported ? (
          <div className="text-[10px] text-emerald-700 font-medium leading-tight text-center">
            <div>이미</div>
            <div>가져옴</div>
          </div>
        ) : (
          <input
            type="checkbox"
            checked={checked}
            onChange={onToggle}
            className="h-4 w-4"
            aria-label={`${order.external_order_id} 선택`}
          />
        )}
      </div>

      {/* 주문 (row-span 2, 세로 전체) */}
      <section className="row-span-2 border-r border-slate-100 text-xs">
        <SectionHeader title="주문">
          <span className={`px-1.5 py-0.5 rounded text-[11px] font-medium ${status.cls}`}>
            {status.label}
          </span>
          {order.payment_method && (
            <span className="px-1.5 py-0.5 rounded text-[11px] font-medium bg-white text-slate-700">
              {pmLabel}
            </span>
          )}
        </SectionHeader>
        <div className="px-3 py-2 space-y-0.5">
          <InfoRow label="주문번호" value={<span className="font-mono">{order.external_order_id}</span>} />
          <InfoRow label="주문일" value={formatDateTime(order.order_at)} />
          <InfoRow label="결제일" value={formatDateTime(order.payment_at)} />
          <InfoRow label="취소일" value={formatDateTime(order.cancelled_at)} />
          <div className="h-2" />
          <InfoRow label="상품금액" value={formatPrice(order.total_amount)} />
          <InfoRow label="배송비" value={formatPrice(order.send_fee)} />
          <InfoRow
            label="결제금액"
            value={<span className="font-semibold text-gray-900">{formatPrice(order.payment_amount)}</span>}
          />
        </div>
      </section>

      {/* 고객 (2열 상단) */}
      <section className="border-r border-b border-slate-100 text-xs">
        <SectionHeader title="고객" />
        <div className="px-3 py-2 space-y-0.5">
          <InfoRow label="이름" value={order.customer_name || "-"} />
          <InfoRow label="연락처" value={order.customer_phone || "-"} />
          <InfoRow label="이메일" value={order.customer_email || "-"} />
        </div>
      </section>

      {/* 품목 (3열 세로 전체) */}
      <section className="row-span-2 text-xs">
        <SectionHeader title="품목">
          <span className="text-slate-400 normal-case tracking-normal text-xs font-normal">
            ({order.items.length}건)
          </span>
        </SectionHeader>
        <div className="px-3 py-2">
          {order.items.length > 0 ? (
            <div className="space-y-1">
              {order.items.map((item, i) => (
                <ItemBox key={i} item={item} />
              ))}
            </div>
          ) : (
            <div className="text-xs text-gray-400">품목 없음</div>
          )}
        </div>
      </section>

      {/* 배송지 (2열 하단) */}
      <section className="border-r border-slate-100 text-xs">
        <SectionHeader title="배송지" />
        <div className="px-3 py-2 space-y-0.5">
          <InfoRow label="수령인" value={order.recipient_name || "-"} />
          <InfoRow label="연락처" value={order.recipient_phone || "-"} />
          <InfoRow
            label="주소"
            value={
              <>
                {order.postal_code && (
                  <span className="mr-1">[{order.postal_code}]</span>
                )}
                {order.recipient_address || "-"}
              </>
            }
          />
        </div>
      </section>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-2 leading-tight">
      <span className="text-gray-400 w-14 shrink-0">{label}</span>
      <span className="text-gray-700 break-all flex-1">{value}</span>
    </div>
  );
}

function SectionHeader({
  title, children,
}: {
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="h-9 px-3 bg-slate-100 flex items-center gap-1.5">
      <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
        {title}
      </span>
      {children}
    </div>
  );
}

// ── Import 미리보기 모달 (dry-run 결과 + 실행 버튼) ─────────────────────────

function PreviewModal({
  open, onClose, onExecute, result, isExecuting,
}: {
  open: boolean;
  onClose: () => void;
  onExecute: () => void;
  result: Cafe24OrderImportResponse | null;
  isExecuting: boolean;
}) {
  if (!result) return null;
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && !isExecuting) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Cafe24 주문 가져오기 미리보기</DialogTitle>
          <p className="text-xs text-gray-500 mt-1">
            저장 전 미리보기입니다. 아래 결과를 확인 후 "실행"을 눌러 실제 저장을 시작하세요.
          </p>
        </DialogHeader>
        <div className="flex-1 overflow-auto space-y-4 py-2">
          {/* 요약 */}
          <div className="flex gap-4 text-sm">
            <div><span className="text-green-600 font-medium">✅ 성공 예상</span> {result.imported_count}건</div>
            <div><span className="text-red-500 font-medium">❌ 실패</span> {result.skipped_count}건</div>
            <div><span className="text-amber-600 font-medium">⚠️ 경고</span> {result.warnings.length}건</div>
          </div>

          {/* 실패 상세 */}
          {result.skipped_orders.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-gray-600 mb-2">실패 상세 ({result.skipped_orders.length}건)</h4>
              <div className="space-y-1 text-xs max-h-60 overflow-auto border border-gray-200 rounded p-2 bg-gray-50">
                {result.skipped_orders.map((s) => (
                  <div key={s.external_order_id} className="flex gap-2">
                    <span className="font-mono text-gray-700">{s.external_order_id}</span>
                    <span className="text-red-500 flex-1">{s.reason}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 경고 상세 */}
          {result.warnings.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-gray-600 mb-2">경고 상세 ({result.warnings.length}건)</h4>
              <div className="space-y-1 text-xs max-h-60 overflow-auto border border-gray-200 rounded p-2 bg-amber-50">
                {result.warnings.map((w, i) => (
                  <div key={i} className="flex gap-2">
                    <span className="font-mono text-gray-700">{w.external_order_id}</span>
                    <span className="text-amber-700 flex-1">{w.message}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={onClose} disabled={isExecuting}>
            취소
          </Button>
          <Button onClick={onExecute} disabled={isExecuting || result.imported_count === 0}>
            {isExecuting ? "실행 중..." : `실행 (${result.imported_count}건 저장)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Import 결과 모달 ────────────────────────────────────────────────────────

function ImportResultModal({
  open, onClose, result,
}: {
  open: boolean;
  onClose: () => void;
  result: Cafe24OrderImportResponse | null;
}) {
  if (!result) return null;
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Cafe24 주문 가져오기 결과</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-auto space-y-4 py-2">
          <div className="flex gap-4 text-sm">
            <div><span className="text-green-600 font-medium">✅ 성공</span> {result.imported_count}건</div>
            <div><span className="text-red-500 font-medium">❌ 실패</span> {result.skipped_count}건</div>
            <div><span className="text-amber-600 font-medium">⚠️ 경고</span> {result.warnings.length}건</div>
          </div>

          {result.skipped_orders.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-gray-600 mb-2">실패 상세 ({result.skipped_orders.length}건)</h4>
              <div className="space-y-1 text-xs max-h-60 overflow-auto border border-gray-200 rounded p-2 bg-gray-50">
                {result.skipped_orders.map((s) => (
                  <div key={s.external_order_id} className="flex gap-2">
                    <span className="font-mono text-gray-700">{s.external_order_id}</span>
                    <span className="text-red-500 flex-1">{s.reason}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.warnings.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-gray-600 mb-2">경고 상세 ({result.warnings.length}건)</h4>
              <div className="space-y-1 text-xs max-h-60 overflow-auto border border-gray-200 rounded p-2 bg-amber-50">
                {result.warnings.map((w, i) => (
                  <div key={i} className="flex gap-2">
                    <span className="font-mono text-gray-700">{w.external_order_id}</span>
                    <span className="text-amber-700 flex-1">{w.message}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button onClick={onClose}>확인</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── 메인 페이지 ─────────────────────────────────────────────────────────────

export default function Cafe24OrderListPage() {
  const defaults = getDefaultDates();
  const queryClient = useQueryClient();

  const [startDate, setStartDate] = useState(defaults.start);
  const [endDate, setEndDate] = useState(defaults.end);
  const [queryDates, setQueryDates] = useState(defaults);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [pendingIds, setPendingIds] = useState<string[]>([]);   // dry-run 시점의 선택 스냅샷 (실제 실행 시 이 배열 사용)
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewResult, setPreviewResult] = useState<Cafe24OrderImportResponse | null>(null);
  const [resultOpen, setResultOpen] = useState(false);
  const [importResult, setImportResult] = useState<Cafe24OrderImportResponse | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["cafe24-orders", queryDates.start, queryDates.end],
    queryFn: () => cafe24API.getOrders(queryDates.start, queryDates.end),
  });

  const orders = data?.orders ?? [];

  const importableIds = useMemo(
    () => orders.filter((o) => !o.already_imported).map((o) => o.external_order_id),
    [orders]
  );

  useEffect(() => {
    setSelectedIds(new Set(importableIds));
  }, [importableIds]);

  // Dry-run: 매핑·검증 결과 미리보기 (저장 안 함)
  const dryRunMutation = useMutation({
    mutationFn: (ids: string[]) =>
      cafe24API.importOrders({ external_order_ids: ids, dry_run: true }),
    onSuccess: (result) => {
      setPreviewResult(result);
      setPreviewOpen(true);
    },
    onError: (err: any) => {
      toast.error(getErrorMessage(err) || "Cafe24 주문 미리보기 실패");
    },
  });

  // 실제 실행: DB에 저장
  const importMutation = useMutation({
    mutationFn: (ids: string[]) =>
      cafe24API.importOrders({ external_order_ids: ids, dry_run: false }),
    onSuccess: (result) => {
      setImportResult(result);
      setResultOpen(true);
      setPreviewOpen(false);
      queryClient.invalidateQueries({
        queryKey: ["cafe24-orders", queryDates.start, queryDates.end],
      });
    },
    onError: (err: any) => {
      toast.error(getErrorMessage(err) || "Cafe24 주문 가져오기 실패");
    },
  });

  const handleSearch = () => {
    setQueryDates({ start: startDate, end: endDate });
  };

  const toggleSelect = (orderId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(orderId)) next.delete(orderId);
      else next.add(orderId);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === importableIds.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(importableIds));
  };

  const selectedCount = selectedIds.size;
  const allSelected = selectedCount > 0 && selectedCount === importableIds.length;
  // 미리보기 모달 열렸거나 실제 실행 중이면 필터·기간 변경 잠금 (대상 불일치 방지)
  const filterLocked = previewOpen || dryRunMutation.isPending || importMutation.isPending;

  const handleImport = () => {
    if (selectedCount === 0) return;
    const ids = Array.from(selectedIds);
    setPendingIds(ids);   // dry-run 시점 스냅샷 — Preview/실행에서 일관 사용
    dryRunMutation.mutate(ids);
  };

  const executeImport = () => {
    importMutation.mutate(pendingIds);   // 선택 변경에 영향받지 않도록 스냅샷 사용
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <PageHeader
        left={
          <span className="text-sm text-gray-500">
            총 {orders.length}건 (신규 {importableIds.length}건)
          </span>
        }
        actions={
          <Button
            size="sm"
            onClick={handleImport}
            disabled={selectedCount === 0 || dryRunMutation.isPending || importMutation.isPending}
          >
            {dryRunMutation.isPending
              ? "미리보기 중..."
              : `선택 ${selectedCount}건 가져오기`}
          </Button>
        }
      />

      {/* 필터 영역 */}
      <div className="flex items-end gap-3 px-5 py-3 border-b border-gray-200 bg-white">
        <div>
          <Label className="text-xs text-gray-500">시작일</Label>
          <Input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            disabled={filterLocked}
            className="mt-1 w-36"
          />
        </div>
        <div>
          <Label className="text-xs text-gray-500">종료일</Label>
          <Input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            disabled={filterLocked}
            className="mt-1 w-36"
          />
        </div>
        <Button size="sm" onClick={handleSearch} disabled={isLoading || filterLocked}>
          조회
        </Button>
        <span className="text-xs text-gray-400">최대 3개월</span>
        {filterLocked && (
          <span className="text-xs text-amber-600">미리보기 중: 필터 변경 불가</span>
        )}
        <div className="ml-auto flex items-center gap-2 text-xs text-gray-600">
          <input
            type="checkbox"
            checked={allSelected}
            disabled={importableIds.length === 0 || filterLocked}
            onChange={toggleSelectAll}
            className="h-4 w-4"
            id="select-all"
          />
          <label htmlFor="select-all" className="cursor-pointer select-none">
            신규 전체 선택/해제
          </label>
        </div>
      </div>

      {/* 카드 목록 */}
      <div className="flex-1 min-h-0 overflow-auto p-3 space-y-2 bg-slate-50">
        {isLoading ? (
          <div className="py-10 text-center">
            <LoadingSpinner size="sm" />
          </div>
        ) : orders.length === 0 ? (
          <div className="py-10 text-center text-sm text-gray-400">
            Cafe24 주문이 없습니다.
          </div>
        ) : (
          orders.map((order) => (
            <OrderCard
              key={order.external_order_id}
              order={order}
              checked={selectedIds.has(order.external_order_id)}
              onToggle={() => toggleSelect(order.external_order_id)}
            />
          ))
        )}
      </div>

      <PreviewModal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        onExecute={executeImport}
        result={previewResult}
        isExecuting={importMutation.isPending}
      />

      <ImportResultModal
        open={resultOpen}
        onClose={() => setResultOpen(false)}
        result={importResult}
      />
    </div>
  );
}
