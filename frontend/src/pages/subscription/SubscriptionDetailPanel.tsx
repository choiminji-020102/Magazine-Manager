import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  X,
  ArrowRightLeft,
  CalendarPlus,
  ChevronsDown,
  MapPin,
  Hash,
  Trash2,
  Pencil,
  PauseCircle,
} from "lucide-react";
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
import { StatusBadge } from "@/components/common/StatusBadge";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { ConfirmModal } from "@/components/common/ConfirmModal";
import { SubscriptionExtendModal } from "@/pages/order/modals/SubscriptionExtendModal";
import { SubscriptionShortenModal } from "@/pages/order/modals/SubscriptionShortenModal";
import { SubscriptionChangePeriodModal } from "@/pages/order/modals/SubscriptionChangePeriodModal";
import { PauseCreateModal } from "@/pages/order/modals/PauseCreateModal";
import { AddressChangeModal } from "@/pages/order/modals/AddressChangeModal";
import { OrderItemCancelModal } from "@/pages/order/modals/OrderItemCancelModal";
import { orderItemsApi } from "@/api/orderItemsApi";
import { pausesApi } from "@/api/pausesApi";
import { sendsApi } from "@/api/sendsApi";
import { activityLogsApi } from "@/api/activityLogsApi";
import { vipSlotsApi } from "@/api/vipSlotsApi";
import { getLogDisplay } from "@/utils/activityLogDisplay";
import { toast } from "@/hooks/use-toast";
import { formatAmount, formatPhone, formatIssue, formatDate, formatDateTime } from "@/utils/format";
import { getErrorMessage } from "@/utils/errorHandler";
import { VipFlagsDisplay } from "@/components/common/VipFlags";
import type { SubscriptionListItem } from "@/types/orderItem";
import type { PauseResponse } from "@/types/pause";
import type { SendResponse } from "@/types/send";

interface Props {
  item: SubscriptionListItem;
  onClose: () => void;
}

// ── 섹션 / 행 헬퍼 ──────────────────────────────────────────────────────────

function Section({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="border border-gray-100 rounded-lg overflow-hidden">
      <div className="px-3.5 py-2 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{title}</h3>
        {action}
      </div>
      <div className="px-3.5 py-3 space-y-2.5">{children}</div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div className="flex items-start gap-3">
      <span className="text-xs text-gray-400 w-28 flex-shrink-0 pt-0.5">{label}</span>
      <span className="text-sm text-gray-700 flex-1">{value}</span>
    </div>
  );
}

// ── 메인 컴포넌트 ─────────────────────────────────────────────────────────────

export default function SubscriptionDetailPanel({ item, onClose }: Props) {
  const queryClient = useQueryClient();
  const isYearly = item.product_kind === "YEARLY";

  // ── Fresh 데이터 조회 ──────────────────────────────────────────────────────
  const { data: detail } = useQuery({
    queryKey: ["order-item-detail", item.order_item_id],
    queryFn: () =>
      orderItemsApi.getOrderItem(item.order_item_id).then((r) => r.data.data!),
  });

  const { data: sends = [] } = useQuery<SendResponse[]>({
    queryKey: ["order-sends", item.order_id],
    queryFn: () =>
      sendsApi.getSendsByOrder(item.order_id).then((r) => r.data.data ?? []),
    enabled: !!item.order_id,
  });

  // 변경 이력 (활동 로그)
  const { data: changeLogs = [] } = useQuery({
    queryKey: ["order-item-change-logs", item.order_item_id],
    queryFn: () =>
      activityLogsApi
        .getActivityLogs({
          page: 1,
          limit: 50,
          target_type: "ORDER_ITEM",
          target_id: item.order_item_id,
        })
        .then((r) => r.data.items ?? []),
  });

  const { data: vipSlots = [] } = useQuery({
    queryKey: ["vip-slots"],
    queryFn: () => vipSlotsApi.getVipSlots().then((res) => res.data.data ?? []),
    staleTime: 5 * 60 * 1000,
  });

  // 최신 데이터 (detail 로드 전이면 item 값 사용)
  const isCancelled = !!(detail?.cancelled_at ?? item.cancelled_at);
  const canAction = isYearly && !isCancelled;
  const finalEndIssue = detail?.final_subscribe_end_issue ?? item.final_subscribe_end_issue;
  const finalStartIssue = detail?.final_subscribe_start_issue ?? item.final_subscribe_start_issue;
  const activePauses = detail?.pauses ?? [];

  // 모달에 전달할 freshItem — detail 이 있으면 최신 필드로 덮어씀
  const freshItem = (detail ? { ...item, ...detail } : item) as typeof item;

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["subscriptions"] });
    queryClient.invalidateQueries({ queryKey: ["order-item-detail", item.order_item_id] });
    queryClient.invalidateQueries({ queryKey: ["pauses"] });
    queryClient.invalidateQueries({ queryKey: ["pauses-deleted", item.order_item_id] });
    queryClient.invalidateQueries({ queryKey: ["order-sends", item.order_id] });
    queryClient.invalidateQueries({ queryKey: ["order-item-change-logs", item.order_item_id] });
  };

  // ── 모달 open/close 상태 ───────────────────────────────────────────────────
  const [extendOpen, setExtendOpen] = useState(false);
  const [shortenOpen, setShortenOpen] = useState(false);
  const [changePeriodOpen, setChangePeriodOpen] = useState(false);
  const [addressOpen, setAddressOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);

  // ── 마지막 발송 호 수정 모달 ───────────────────────────────────────────────
  const [lastSendOpen, setLastSendOpen] = useState(false);
  const [lastSendIssue, setLastSendIssue] = useState("");
  const [lastSendIssueError, setLastSendIssueError] = useState(false);

  const lastSendPreview = lastSendIssue.length === 6
    ? formatIssue(lastSendIssue)
    : "";

  const lastSendMutation = useMutation({
    mutationFn: () =>
      orderItemsApi.updateLastSendIssue(item.order_item_id, { last_send_issue: lastSendIssue }),
    onSuccess: () => {
      toast.success("마지막 발송 호가 수정되었습니다.");
      setLastSendOpen(false);
      setLastSendIssue("");
      invalidateAll();
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const handleLastSendConfirm = () => {
    if (!lastSendIssue || lastSendIssue.length !== 6) {
      setLastSendIssueError(true);
      toast.error("마지막 발송 호를 입력해주세요. (YYYYMM)");
      return;
    }
    lastSendMutation.mutate();
  };

  const [pauseOpen, setPauseOpen] = useState(false);

  // ── 휴지 삭제 ─────────────────────────────────────────────────────────────
  const [deletePauseTarget, setDeletePauseTarget] = useState<PauseResponse | null>(null);

  const pauseDeleteMutation = useMutation({
    mutationFn: (pauseId: number) => pausesApi.deletePause(pauseId),
    onSuccess: () => {
      toast.success("휴지가 삭제되었습니다.");
      setDeletePauseTarget(null);
      invalidateAll();
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  // ── 휴지 사유 수정 ────────────────────────────────────────────────────────
  const [editReasonPauseId, setEditReasonPauseId] = useState<number | null>(null);
  const [editReasonValue, setEditReasonValue] = useState("");

  const pauseUpdateMutation = useMutation({
    mutationFn: ({ pauseId, reason }: { pauseId: number; reason: string }) =>
      pausesApi.updatePause(pauseId, { reason: reason || null }),
    onSuccess: () => {
      toast.success("사유가 수정되었습니다.");
      setEditReasonPauseId(null);
      invalidateAll();
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  // ── 렌더 ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full">
      {/* 헤더 */}
      <div className="px-5 py-4 border-b border-gray-200 bg-white flex-shrink-0">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="font-mono text-xs text-gray-400">주문 #{item.order_id}</span>
              <StatusBadge type="product_kind" value={item.product_kind} />
              {isCancelled && (
                <span className="text-xs text-red-500 font-medium">취소됨</span>
              )}
            </div>
            <div className="text-base font-semibold text-gray-900 truncate">
              {item.product_name}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-600 flex-shrink-0"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* 구독 액션 버튼 (YEARLY + 활성) */}
        {canAction && (
          <div className="flex gap-2 flex-wrap mb-2">
            <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={() => setExtendOpen(true)}>
              <CalendarPlus className="h-3.5 w-3.5" />연장
            </Button>
            <Button
              size="sm" variant="outline" className="gap-1 text-xs"
              onClick={() => setShortenOpen(true)}
            >
              <ChevronsDown className="h-3.5 w-3.5" />단축
            </Button>
            <Button
              size="sm" variant="outline" className="gap-1 text-xs"
              onClick={() => setChangePeriodOpen(true)}
            >
              <ArrowRightLeft className="h-3.5 w-3.5" />기간 이동
            </Button>
            <Button
              size="sm" variant="outline" className="gap-1 text-xs"
              onClick={() => setPauseOpen(true)}
            >
              <PauseCircle className="h-3.5 w-3.5" />휴지 등록
            </Button>
          </div>
        )}

        {/* 기타 액션 버튼 */}
        {!isCancelled && (
          <div className="flex gap-2 flex-wrap">
            <Button
              size="sm" variant="outline" className="gap-1 text-xs"
              onClick={() => setAddressOpen(true)}
            >
              <MapPin className="h-3.5 w-3.5" />배송지 변경
            </Button>
            <Button
              size="sm" variant="outline" className="gap-1 text-xs"
              onClick={() => {
                setLastSendIssue(detail?.last_send_issue ?? item.last_send_issue ?? "");
                setLastSendOpen(true);
              }}
            >
              <Hash className="h-3.5 w-3.5" />발송 호 수정
            </Button>
            <Button
              size="sm" variant="outline"
              className="gap-1 text-xs text-red-600 border-red-200 hover:bg-red-50"
              onClick={() => setCancelOpen(true)}
            >
              <Trash2 className="h-3.5 w-3.5" />품목 취소
            </Button>
          </div>
        )}
      </div>

      {/* 스크롤 영역 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {/* 고객 */}
        <Section
          title="고객"
          action={detail?.address ? (
            <VipFlagsDisplay address={detail.address} slots={vipSlots} compact />
          ) : undefined}
        >
          <InfoRow label="고객명" value={item.customer_name ?? "-"} />
          <InfoRow label="연락처" value={formatPhone(item.customer_phone)} />
          {item.order_channel && (
            <InfoRow label="채널" value={<StatusBadge type="channel" value={item.order_channel} />} />
          )}
        </Section>

        {/* 배송지 */}
        <Section title="배송지">
          <InfoRow label="수령인" value={detail?.address?.recipient_name} />
          <InfoRow label="연락처" value={formatPhone(detail?.address?.recipient_phone)} />
          <InfoRow
            label="주소"
            value={
              detail?.address
                ? `(${detail.address.postal_code}) ${detail.address.recipient_address}`
                : null
            }
          />
          {detail?.address?.customer_memo && (
            <InfoRow label="배송 메모" value={detail.address.customer_memo} />
          )}
          {detail?.address?.admin_memo && (
            <InfoRow label="관리자메모" value={detail.address.admin_memo} />
          )}
        </Section>

        {/* 상품 */}
        <Section title="상품">
          <InfoRow label="상품명" value={item.product_name} />
          <InfoRow label="코드" value={<span className="font-mono text-xs">{item.product_code}</span>} />
          <InfoRow label="수량" value={`${item.order_num}부`} />
          <InfoRow label="판매가" value={formatAmount(item.sale_price)} />
          {(detail?.refund_amount ?? item.refund_amount) > 0 && (
            <InfoRow
              label="환불액"
              value={<span className="text-red-600">{formatAmount(detail?.refund_amount ?? item.refund_amount)}</span>}
            />
          )}
          {(detail?.delivered_at ?? item.delivered_at) && (
            <InfoRow label="발송일시" value={formatDateTime(detail?.delivered_at ?? item.delivered_at!)} />
          )}
          {(detail?.admin_memo ?? item.admin_memo) && (
            <div className="mt-2 pt-2 border-t border-gray-100">
              <div className="text-xs font-medium text-gray-500 mb-1">관리자 메모</div>
              <div className="text-xs text-gray-600 whitespace-pre-line">{detail?.admin_memo ?? item.admin_memo}</div>
            </div>
          )}
        </Section>

        {/* 구독 기간 */}
        <Section title="구독 기간">
          {/* 현재 시작 → 종료 강조 카드 */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-3">
            <div className="flex items-center justify-between gap-2">
              <div className="text-center min-w-0">
                <p className="text-[10px] text-gray-400 mb-0.5">시작</p>
                <p className="text-sm font-semibold text-gray-900 whitespace-nowrap">{formatIssue(finalStartIssue)}</p>
              </div>
              <div className="flex-1 flex items-center px-1">
                <div className="h-px flex-1 bg-blue-200" />
                <span className="text-xs text-blue-300 mx-1">→</span>
                <div className="h-px flex-1 bg-blue-200" />
              </div>
              <div className="text-center min-w-0">
                <p className="text-[10px] text-gray-400 mb-0.5">종료</p>
                <p className="text-sm font-semibold text-gray-900 whitespace-nowrap">{formatIssue(finalEndIssue)}</p>
              </div>
            </div>
          </div>

          {/* 구독 기간 + 마지막 발송 */}
          <div className="flex gap-2 text-xs">
            <div className="flex-1 bg-gray-50 rounded-md px-2.5 py-2">
              <p className="text-gray-400 mb-0.5">구독 기간</p>
              <p className="font-medium text-gray-800">{detail?.subscribe_period ?? item.subscribe_period}개월</p>
            </div>
            <div className="flex-1 bg-gray-50 rounded-md px-2.5 py-2">
              <p className="text-gray-400 mb-0.5">마지막 발송</p>
              <p className="font-medium text-gray-800">
                {(detail?.last_send_issue ?? item.last_send_issue)
                  ? formatIssue(detail?.last_send_issue ?? item.last_send_issue!)
                  : "-"}
              </p>
            </div>
          </div>

          {/* 주문 시 기간 — 현재와 다를 때만 표시 */}
          {(item.subscribe_start_issue !== finalStartIssue || item.subscribe_end_issue !== finalEndIssue) && (
            <div className="text-xs text-gray-400 border-t border-gray-100 pt-2">
              <span>주문 시: </span>
              <span className="text-gray-500">
                {formatIssue(item.subscribe_start_issue)} ~ {formatIssue(item.subscribe_end_issue)}
              </span>
            </div>
          )}

          {/* 변경 이력 */}
          {changeLogs.length > 0 && (
            <div className="border-t border-gray-100 pt-2 space-y-1">
              <div className="text-xs font-medium text-gray-500 mb-1">변경 이력</div>
              {changeLogs.map((log) => {
                const { label, color, summary } = getLogDisplay(log);
                return (
                  <div key={log.log_id} className="text-xs text-gray-500 flex items-start gap-1.5">
                    <span className="text-gray-400 flex-shrink-0">{formatDate(log.created_at).slice(5)}</span>
                    <span className={`font-medium ${color}`}>{label}</span>
                    {summary && <span className="text-gray-400">{summary}</span>}
                  </div>
                );
              })}
            </div>
          )}
        </Section>

        {/* 발송 이력 */}
        <Section title="발송 이력">
          {sends.length === 0 ? (
            <p className="text-xs text-gray-400">발송 이력이 없습니다.</p>
          ) : (
            <div className="space-y-1.5">
              {sends.map((send) => (
                <div
                  key={send.send_id}
                  className="flex items-center gap-2 text-xs bg-gray-50 rounded-md px-2.5 py-2"
                >
                  <span className="font-mono text-gray-400 w-14 shrink-0">
                    #{send.send_id}
                  </span>
                  <StatusBadge type="send_status" value={send.send_status} />
                  <span className="text-gray-500 flex-1">
                    {send.delivered_at ? formatDate(send.delivered_at) : "-"}
                  </span>
                  {send.tracking_no && (
                    <span className="font-mono text-gray-500 truncate max-w-[90px]">
                      {send.tracking_no}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* 휴지 내역 (YEARLY만) */}
        {isYearly && (
          <Section title="휴지 내역">
            {activePauses.length === 0 && (
              <p className="text-xs text-gray-400">등록된 휴지가 없습니다.</p>
            )}

            {/* 활성 휴지 */}
            {activePauses.map((pause) => (
              <div key={pause.pause_id} className="flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-gray-700">
                      <PauseCircle className="inline h-3 w-3 mr-1 text-amber-500" />
                      {formatIssue(pause.pause_issue)}
                    </span>
                  </div>
                  {editReasonPauseId === pause.pause_id ? (
                    <div className="flex gap-1 mt-1">
                      <Input
                        className="h-6 text-xs flex-1"
                        value={editReasonValue}
                        onChange={(e) => setEditReasonValue(e.target.value)}
                        placeholder="사유"
                        autoFocus
                      />
                      <Button
                        size="sm" className="h-6 text-xs px-2"
                        onClick={() => pauseUpdateMutation.mutate({ pauseId: pause.pause_id, reason: editReasonValue })}
                        disabled={pauseUpdateMutation.isPending}
                      >저장</Button>
                      <Button
                        size="sm" variant="ghost" className="h-6 text-xs px-2"
                        onClick={() => setEditReasonPauseId(null)}
                      >취소</Button>
                    </div>
                  ) : (
                    pause.reason && (
                      <span className="text-xs text-gray-400 ml-4">{pause.reason}</span>
                    )
                  )}
                </div>
                {editReasonPauseId !== pause.pause_id && (
                  <div className="flex gap-1">
                    <button
                      className="p-1 text-gray-400 hover:text-blue-600 rounded"
                      onClick={() => { setEditReasonPauseId(pause.pause_id); setEditReasonValue(pause.reason ?? ""); }}
                      title="사유 수정"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      className="p-1 text-gray-400 hover:text-red-600 rounded"
                      onClick={() => setDeletePauseTarget(pause as unknown as PauseResponse)}
                      title="삭제"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>
            ))}

          </Section>
        )}

        {/* 시스템 */}
        <Section title="시스템">
          <InfoRow
            label="품목 ID"
            value={<span className="font-mono text-xs text-gray-500">#{item.order_item_id}</span>}
          />
          <InfoRow label="등록일" value={formatDateTime(item.created_at)} />
          <InfoRow label="수정일" value={formatDateTime(item.updated_at)} />
          {isCancelled && (
            <InfoRow
              label="취소일"
              value={<span className="text-red-500">{formatDateTime(detail?.cancelled_at ?? item.cancelled_at!)}</span>}
            />
          )}
        </Section>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* 모달들                                                              */}
      {/* ═══════════════════════════════════════════════════════════════════ */}

      {/* 구독 연장 모달 */}
      <SubscriptionExtendModal
        open={extendOpen}
        onClose={() => setExtendOpen(false)}
        item={freshItem}
        onSuccess={invalidateAll}
      />

      {/* 구독 단축 모달 */}
      <SubscriptionShortenModal
        open={shortenOpen}
        onClose={() => setShortenOpen(false)}
        item={freshItem}
        onSuccess={invalidateAll}
      />

      {/* 기간 이동 모달 */}
      <SubscriptionChangePeriodModal
        open={changePeriodOpen}
        onClose={() => setChangePeriodOpen(false)}
        item={freshItem}
        onSuccess={invalidateAll}
        pauseCount={activePauses.length}
      />

      {/* 배송지 변경 모달 */}
      <AddressChangeModal
        open={addressOpen}
        onClose={() => setAddressOpen(false)}
        item={freshItem}
        customerId={detail?.address?.customer_id ?? 0}
        onSuccess={invalidateAll}
      />

      {/* 마지막 발송 호 수정 모달 */}
      <Dialog open={lastSendOpen} onOpenChange={(o) => { if (!o) { setLastSendOpen(false); setLastSendIssueError(false); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>마지막 발송 호 수정</DialogTitle></DialogHeader>
          <div className="space-y-3 py-1">
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-500">현재 값</span>
                <span className="font-medium text-gray-800">
                  {(detail?.last_send_issue ?? item.last_send_issue)
                    ? formatIssue(detail?.last_send_issue ?? item.last_send_issue!)
                    : "없음"}
                </span>
              </div>
              {lastSendPreview && (
                <div className="flex justify-between border-t border-gray-200 pt-1 mt-1">
                  <span className="text-gray-500">변경 후</span>
                  <span className="font-semibold text-blue-700">{lastSendPreview}</span>
                </div>
              )}
            </div>
            <div>
              <Label>발송 호 <span className="text-red-500 ml-0.5">*</span></Label>
              <Input
                className={`mt-1 ${lastSendIssueError ? "border-red-500" : ""}`}
                placeholder="YYYYMM" maxLength={6}
                value={lastSendIssue}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, "");
                  setLastSendIssue(val);
                  setLastSendIssueError(false);
                }}
              />
              {lastSendIssueError && <p className="text-xs text-red-500 mt-1">발송 호를 입력해주세요.</p>}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLastSendOpen(false)}>취소</Button>
            <Button onClick={handleLastSendConfirm} disabled={lastSendMutation.isPending}>
              {lastSendMutation.isPending && <LoadingSpinner size="sm" className="mr-1" />}저장
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 품목 취소 모달 */}
      <OrderItemCancelModal
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        item={freshItem}
        onSuccess={invalidateAll}
      />

      {/* 휴지 등록 모달 */}
      <PauseCreateModal
        open={pauseOpen}
        onClose={() => setPauseOpen(false)}
        item={freshItem}
        onSuccess={invalidateAll}
      />

      {/* 휴지 삭제 확인 모달 */}
      <ConfirmModal
        open={!!deletePauseTarget}
        onClose={() => setDeletePauseTarget(null)}
        onConfirm={() => deletePauseTarget && pauseDeleteMutation.mutate(deletePauseTarget.pause_id)}
        title="휴지 삭제"
        description={`${deletePauseTarget ? formatIssue(deletePauseTarget.pause_issue) : ""} 휴지를 삭제합니다. 구독 종료 호가 1개월 앞당겨집니다.`}
        confirmLabel="삭제"
        variant="destructive"
        isLoading={pauseDeleteMutation.isPending}
      />
    </div>
  );
}
