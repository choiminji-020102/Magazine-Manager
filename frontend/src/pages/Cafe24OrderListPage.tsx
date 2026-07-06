import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, XCircle, AlertTriangle, Info } from "lucide-react";
import { cafe24API } from "@/api/cafe24Api";
import { PageHeader } from "@/components/common/PageHeader";
import { FilterBar } from "@/components/common/FilterBar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { todayKstDate } from "@/utils/date";
import { PAYMENT_METHOD_LABEL } from "@/utils/constants";
import { formatAmount, formatDateTime, formatPhone } from "@/utils/format";
import { ImportStatCard, ImportDetailCard } from "@/components/common/ImportResultCards";
import { InfoRow } from "@/components/common/list-card/InfoRow";
import { SectionHeader } from "@/components/common/list-card/SectionHeader";
import { StatusBadge } from "@/components/common/StatusBadge";
import Cafe24ConnectionGate from "@/components/cafe24/Cafe24ConnectionGate";
import type {
  Cafe24Order,
  Cafe24MappedOrderItem,
  Cafe24OrderImportResponse,
} from "@/types/cafe24";

// ── 헬퍼 ────────────────────────────────────────────────────────────────────

function getDefaultDates() {
  return { start: todayKstDate(-3), end: todayKstDate() };
}

// ── 품목 박스 ───────────────────────────────────────────────────────────────

function ItemBox({ item }: { item: Cafe24MappedOrderItem }) {
  const matched = item.product_code !== null;
  const isYearly = item.product_kind === "YEARLY";
  const years = isYearly && item.subscribe_period ? item.subscribe_period / 12 : null;

  return (
    <div
      className={`border rounded p-2 text-[11px] space-y-0.5 ${
        matched ? "border-gray-100 bg-white" : "border-red-200 bg-red-50"
      }`}
    >
      {/* 그룹 1 — 식별 (OrderItemBox §4.3 와 동일 패턴) */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {matched ? (
          <span
            className={`px-1 py-0.5 rounded text-[10px] font-semibold ${
              isYearly ? "bg-purple-100 text-purple-700" : "bg-sky-100 text-sky-700"
            }`}
          >
            {isYearly ? "정기" : "단품"}
          </span>
        ) : (
          <span className="px-1 py-0.5 rounded text-[10px] font-semibold bg-red-100 text-red-700">
            ⚠️ 미등록
          </span>
        )}
        {matched && item.product_name && (
          <span className="text-gray-700 truncate">{item.product_name}</span>
        )}
        <span className="font-mono text-gray-500">
          {matched ? item.product_code : item.cafe24_product_code}
        </span>
        {item.external_order_item_id && (
          <span className="font-mono text-gray-400 text-[10px]">
            {item.external_order_item_id}
          </span>
        )}
      </div>

      {/* 그룹 2 — 가격 */}
      <div className="text-gray-600">
        {matched && item.sale_price !== null ? (
          <>
            {formatAmount(item.sale_price)} × {item.order_num}권
            {isYearly && years !== null && (
              <span className="text-gray-400">
                {" "}(1년단가 {formatAmount(item.unit_price)} × {years}년)
              </span>
            )}
          </>
        ) : (
          <>
            {formatAmount(item.unit_price)} × {item.order_num}권
            <span className="text-red-600"> (상품 미매칭)</span>
          </>
        )}
      </div>

      {/* 그룹 3 — 구독 (정기 + 매칭 시) */}
      {matched && isYearly && item.subscribe_period && (
        <div className="text-gray-600">구독 {item.subscribe_period}개월</div>
      )}

      {/* 옵션 (있을 때) */}
      {item.option_value && (
        <div className="text-gray-500 break-all">옵션: {item.option_value}</div>
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
  const isOverseas = order.country_code != null && order.country_code !== "KR";
  const pmLabel = order.payment_method
    ? (PAYMENT_METHOD_LABEL[order.payment_method] ?? order.payment_method)
    : "-";

  if (order.detail_fetch_error) {
    return (
      <div className="border border-red-200 rounded bg-red-50 p-4 text-sm text-red-700">
        <div className="font-mono mb-1">{order.external_order_id}</div>
        상세 조회 실패: {order.detail_fetch_error}
      </div>
    );
  }

  return (
    <div className={`border border-gray-200 rounded-lg overflow-hidden grid grid-cols-[50px_280px_1fr_1fr] grid-rows-[auto_1fr] shadow-sm hover:shadow-md transition-shadow bg-white ${isImported ? "opacity-90" : ""}`}>
      {/* 좌측: 체크박스 / 이미 가져옴 표시 통합 (row-span 2) */}
      <div
        className={`row-span-2 flex flex-col items-center justify-center gap-1 border-r border-gray-100 ${
          isImported ? "bg-green-50" : "bg-white"
        }`}
        title={isImported ? "이미 가져옴" : "신규"}
      >
        {isImported ? (
          <div className="text-[10px] text-green-700 font-medium leading-tight text-center">
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
      <section className="row-span-2 border-r border-gray-100 text-xs">
        <SectionHeader title="주문">
          {order.order_status && (
            <StatusBadge type="order_status" value={order.order_status} />
          )}
          <StatusBadge type="channel" value={order.order_channel} />
          {order.payment_method && (
            <span className="px-1.5 py-0.5 rounded text-[11px] font-medium bg-white text-gray-700">
              {pmLabel}
            </span>
          )}
        </SectionHeader>
        <div className="px-3 py-2 space-y-0.5">
          <InfoRow label="주문번호" value={<span className="font-mono">{order.external_order_id}</span>} />
          <InfoRow label="주문일" value={formatDateTime(order.order_at)} />
          <InfoRow label="결제일" value={formatDateTime(order.payment_at)} />
          <div className="h-2" />
          <InfoRow label="상품금액" value={formatAmount(order.total_amount)} />
          <InfoRow label="배송비" value={formatAmount(order.send_fee)} />
          <InfoRow
            label="결제금액"
            value={<span className="font-semibold text-gray-900">{formatAmount(order.payment_amount)}</span>}
          />
          {order.customer_memo && (
            <InfoRow
              label="고객메모"
              value={
                <span className="block truncate text-gray-500" title={order.customer_memo}>
                  {order.customer_memo}
                </span>
              }
            />
          )}
        </div>
      </section>

      {/* 고객 (2열 상단) */}
      <section className="border-r border-b border-gray-100 text-xs">
        <SectionHeader title="고객" />
        <div className="px-3 py-2 space-y-0.5">
          <InfoRow label="이름" value={order.customer_name || "-"} />
          <InfoRow label="연락처" value={formatPhone(order.customer_phone)} />
          <InfoRow label="이메일" value={order.customer_email || "-"} />
          {order.admin_memo && (
            <InfoRow
              label="관리자메모"
              value={
                <span className="block truncate text-gray-500" title={order.admin_memo}>
                  {order.admin_memo}
                </span>
              }
            />
          )}
        </div>
      </section>

      {/* 품목 (3열 세로 전체) */}
      <section className="row-span-2 text-xs">
        <SectionHeader title="품목">
          <span className="text-gray-400 normal-case tracking-normal text-xs font-normal">
            ({order.items.length}건)
          </span>
        </SectionHeader>
        <div className="px-3 py-2">
          {order.items.length > 0 ? (
            <div className="space-y-1.5">
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
      <section className="border-r border-gray-100 text-xs">
        <SectionHeader title="배송지">
          {isOverseas && (
            <span className="px-1 py-0.5 bg-amber-100 text-amber-700 rounded text-[10px] font-semibold">
              🌐 {order.country_code}
            </span>
          )}
        </SectionHeader>
        <div className="px-3 py-2 space-y-0.5">
          <InfoRow label="수령인" value={order.recipient_name || "-"} />
          <InfoRow label="연락처" value={formatPhone(order.recipient_phone)} />
          <InfoRow
            label="주소"
            value={
              <>
                {order.postal_code && (
                  <span className="font-mono mr-1">[{order.postal_code}]</span>
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

// ── 공통 요약/상세 뷰 ───────────────────────────────────────────────────────

function ImportResultView({
  result, mode,
}: {
  result: Cafe24OrderImportResponse;
  mode: "preview" | "result";
}) {
  const successLabel = mode === "preview" ? "성공 예상" : "성공";
  const hasNothingToSave = mode === "preview" && result.imported_count === 0;

  return (
    <div className="space-y-4">
      {/* 요약 카드 3개 */}
      <div className="grid grid-cols-3 gap-2">
        <ImportStatCard
          label={successLabel}
          count={result.imported_count}
          icon={<CheckCircle2 className="h-5 w-5" />}
          tone="success"
        />
        <ImportStatCard
          label="실패"
          count={result.skipped_count}
          icon={<XCircle className="h-5 w-5" />}
          tone="danger"
        />
        <ImportStatCard
          label="경고"
          count={result.warnings.length}
          icon={<AlertTriangle className="h-5 w-5" />}
          tone="warning"
        />
      </div>

      {/* 저장할 항목 없음 안내 (미리보기 전용) */}
      {hasNothingToSave && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
          <Info className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
          <div className="text-xs text-amber-700 leading-relaxed">
            저장할 항목이 없습니다. 아래 실패 상세를 확인한 뒤 선택을 조정해 주세요.
          </div>
        </div>
      )}

      {/* 실패 상세 */}
      {result.skipped_orders.length > 0 && (
        <section>
          <h4 className="text-xs font-semibold text-red-600 mb-1.5 flex items-center gap-1">
            <XCircle className="h-3.5 w-3.5" />
            실패 상세 ({result.skipped_orders.length}건)
          </h4>
          <div className="space-y-1.5 max-h-56 overflow-auto pr-1">
            {result.skipped_orders.map((s) => (
              <ImportDetailCard
                key={s.external_order_id}
                itemKey={s.external_order_id}
                message={s.reason}
                tone="danger"
              />
            ))}
          </div>
        </section>
      )}

      {/* 경고 상세 */}
      {result.warnings.length > 0 && (
        <section>
          <h4 className="text-xs font-semibold text-amber-700 mb-1.5 flex items-center gap-1">
            <AlertTriangle className="h-3.5 w-3.5" />
            경고 상세 ({result.warnings.length}건)
          </h4>
          <div className="space-y-1.5 max-h-56 overflow-auto pr-1">
            {result.warnings.map((w, i) => (
              <ImportDetailCard
                key={i}
                itemKey={w.external_order_id}
                message={w.message}
                tone="warning"
              />
            ))}
          </div>
        </section>
      )}
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
            저장 전 미리보기입니다. 결과를 확인한 뒤 "실행"을 눌러 실제 저장을 시작하세요.
          </p>
        </DialogHeader>
        <div className="flex-1 overflow-auto py-2">
          <ImportResultView result={result} mode="preview" />
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={onClose} disabled={isExecuting}>
            취소
          </Button>
          <Button onClick={onExecute} disabled={isExecuting || result.imported_count === 0}>
            {isExecuting
              ? "실행 중..."
              : result.imported_count === 0
              ? "저장할 항목 없음"
              : `실행 (${result.imported_count}건 저장)`}
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
        <div className="flex-1 overflow-auto py-2">
          <ImportResultView result={result} mode="result" />
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

      <Cafe24ConnectionGate>
        {/* 필터 영역 */}
        <FilterBar
          basic={
            <>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                disabled={filterLocked}
                className="w-36"
              />
              <span className="text-xs text-gray-400">~</span>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                disabled={filterLocked}
                className="w-36"
              />
              <Button size="sm" onClick={handleSearch} disabled={isLoading || filterLocked}>
                조회
              </Button>
              <span className="text-xs text-gray-400">최대 3개월</span>
              {filterLocked && (
                <span className="text-xs text-amber-600">미리보기 중: 필터 변경 불가</span>
              )}
            </>
          }
          actions={
            <div className="flex items-center gap-2 text-xs text-gray-600">
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
          }
        />

        {/* 카드 목록 */}
        <div className="flex-1 min-h-0 overflow-auto p-3 space-y-2 bg-gray-50">
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
      </Cafe24ConnectionGate>

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
