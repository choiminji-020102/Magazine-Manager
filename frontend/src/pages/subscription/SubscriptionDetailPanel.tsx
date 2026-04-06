import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  X,
  ArrowRightLeft,
  CalendarPlus,
  ChevronsDown,
  MapPin,
  Hash,
  Trash2,
  RotateCcw,
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
import { orderItemsApi } from "@/api/orderItemsApi";
import { pausesApi } from "@/api/pausesApi";
import { addressesApi } from "@/api/addressesApi";
import { sendsApi } from "@/api/sendsApi";
import { toast } from "@/hooks/use-toast";
import { formatAmount, formatPhone, formatIssue, formatDate, formatDateTime } from "@/utils/format";
import type { SubscriptionListItem } from "@/types/orderItem";
import type { OrderItemAddressUpdate } from "@/types/orderItem";
import type { PauseResponse } from "@/types/pause";
import type { AddressResponse } from "@/types/address";
import type { SendResponse } from "@/types/send";

interface Props {
  item: SubscriptionListItem;
  onClose: () => void;
}

// ── 호 계산 유틸 ──────────────────────────────────────────────────────────────

function addMonthsToIssue(issue: string, months: number): string {
  if (!issue || issue.length !== 6 || isNaN(months) || months < 1) return "";
  const year = parseInt(issue.slice(0, 4), 10);
  const month = parseInt(issue.slice(4, 6), 10);
  const d = new Date(year, month - 1 + months, 1);
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}`;
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

  const { data: deletedPauses = [] } = useQuery<PauseResponse[]>({
    queryKey: ["pauses-deleted", item.order_item_id],
    queryFn: () =>
      pausesApi
        .getPauses({ order_item_id: item.order_item_id, is_deleted: true, limit: 50 })
        .then((r) => r.data.items ?? []),
    enabled: isYearly,
  });

  const { data: sends = [] } = useQuery<SendResponse[]>({
    queryKey: ["order-sends", item.order_id],
    queryFn: () =>
      sendsApi.getSendsByOrder(item.order_id).then((r) => r.data.data ?? []),
    enabled: !!item.order_id,
  });

  // 최신 데이터 (detail 로드 전이면 item 값 사용)
  const isCancelled = !!(detail?.cancelled_at ?? item.cancelled_at);
  const canAction = isYearly && !isCancelled;
  const finalEndIssue = detail?.final_subscribe_end_issue ?? item.final_subscribe_end_issue;
  const finalStartIssue = detail?.final_subscribe_start_issue ?? item.final_subscribe_start_issue;
  const activePauses = detail?.pauses ?? [];

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["subscriptions"] });
    queryClient.invalidateQueries({ queryKey: ["order-item-detail", item.order_item_id] });
    queryClient.invalidateQueries({ queryKey: ["pauses-deleted", item.order_item_id] });
    queryClient.invalidateQueries({ queryKey: ["order-sends", item.order_id] });
  };

  // ── 연장 모달 ─────────────────────────────────────────────────────────────
  const [extendOpen, setExtendOpen] = useState(false);
  const [extendMonths, setExtendMonths] = useState("1");
  const [extendIsPaid, setExtendIsPaid] = useState(false);
  const [extendReason, setExtendReason] = useState("");
  const [extendMonthsError, setExtendMonthsError] = useState(false);

  // 연장 후 예상 종료 호 실시간 계산
  const extendPreviewEndIssue = (() => {
    const months = parseInt(extendMonths, 10);
    if (isNaN(months) || months < 1) return "";
    return addMonthsToIssue(finalEndIssue, months);
  })();

  const extendMutation = useMutation({
    mutationFn: () =>
      orderItemsApi.extendSubscription(item.order_item_id, {
        extend_months: parseInt(extendMonths, 10),
        is_paid: extendIsPaid,
        reason: extendReason || undefined,
      }),
    onSuccess: () => {
      toast.success("구독 기간이 연장되었습니다.");
      setExtendOpen(false);
      setExtendMonths("1");
      setExtendIsPaid(false);
      setExtendReason("");
      invalidateAll();
    },
    onError: () => toast.error("연장 실패"),
  });

  const handleExtendConfirm = () => {
    const months = parseInt(extendMonths, 10);
    if (!extendMonths || isNaN(months) || months < 1) {
      setExtendMonthsError(true);
      toast.error("연장 개월 수를 입력해주세요.");
      return;
    }
    extendMutation.mutate();
  };

  // ── 단축 모달 ─────────────────────────────────────────────────────────────
  const [shortenOpen, setShortenOpen] = useState(false);
  const [shortenEndIssue, setShortenEndIssue] = useState("");
  const [shortenEndIssueError, setShortenEndIssueError] = useState<string | null>(null);
  const [shortenCalcResult, setShortenCalcResult] = useState<{
    current_end_issue: string;
    shorten_end_issue: string;
    refund_amount: number;
  } | null>(null);

  const shortenCalcMutation = useMutation({
    mutationFn: () =>
      orderItemsApi.shortenCalculate(item.order_item_id, { shorten_end_issue: shortenEndIssue }),
    onSuccess: (res) => setShortenCalcResult(res.data.data ?? null),
    onError: () => setShortenEndIssueError("환불액 계산에 실패했습니다. 입력값을 확인해주세요."),
  });

  // 6자리 완성 시 자동 계산
  useEffect(() => {
    if (shortenEndIssue.length === 6 && !isNaN(Number(shortenEndIssue))) {
      setShortenCalcResult(null);
      // 현재 종료 호 이상이면 API 호출 없이 즉시 안내
      if (shortenEndIssue >= finalEndIssue) {
        setShortenEndIssueError("현재 종료 호보다 이전 호를 입력해주세요. 기간 연장은 '연장' 기능을 이용해주세요.");
        return;
      }
      setShortenEndIssueError(null);
      shortenCalcMutation.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shortenEndIssue]);

  const shortenConfirmMutation = useMutation({
    mutationFn: () =>
      orderItemsApi.shortenConfirm(item.order_item_id, {
        shorten_end_issue: shortenEndIssue,
        refund_confirmed: true,
      }),
    onSuccess: () => {
      toast.success("구독 기간이 단축되었습니다.");
      setShortenOpen(false);
      setShortenEndIssue("");
      setShortenCalcResult(null);
      invalidateAll();
    },
    onError: () => toast.error("단축 실패"),
  });

  // ── 기간 이동 모달 ────────────────────────────────────────────────────────
  const [changePeriodOpen, setChangePeriodOpen] = useState(false);
  const [newStartIssue, setNewStartIssue] = useState("");
  const [newStartIssueError, setNewStartIssueError] = useState(false);

  // 기간 이동 후 예상 종료 호 실시간 계산
  const changePeriodPreviewEndIssue = (() => {
    if (newStartIssue.length !== 6 || isNaN(Number(newStartIssue))) return "";
    return addMonthsToIssue(newStartIssue, item.subscribe_period - 1 + activePauses.length);
  })();

  const changePeriodMutation = useMutation({
    mutationFn: () =>
      orderItemsApi.changePeriod(item.order_item_id, { new_start_issue: newStartIssue }),
    onSuccess: () => {
      toast.success("구독 기간이 이동되었습니다.");
      setChangePeriodOpen(false);
      setNewStartIssue("");
      invalidateAll();
    },
    onError: () => toast.error("기간 이동 실패"),
  });

  const handleChangePeriodConfirm = () => {
    if (!newStartIssue || newStartIssue.length !== 6) {
      setNewStartIssueError(true);
      toast.error("새 구독 시작 호를 입력해주세요. (YYYYMM)");
      return;
    }
    changePeriodMutation.mutate();
  };

  // ── 배송지 변경 모달 ──────────────────────────────────────────────────────
  const [addressOpen, setAddressOpen] = useState(false);
  const [addressTab, setAddressTab] = useState<"existing" | "new">("existing");
  const [selectedAddressId, setSelectedAddressId] = useState<number | null>(null);
  const [addressResult, setAddressResult] = useState<{ can_change: boolean; message: string } | null>(null);

  // 새 배송지 폼
  const [newAddr, setNewAddr] = useState({
    recipient_name: "",
    recipient_phone: "",
    postal_code: "",
    recipient_address: "",
    customer_memo: "",
    admin_memo: "",
  });
  const [newAddrErrors, setNewAddrErrors] = useState<Record<string, boolean>>({});

  // 고객 배송지 목록
  const customerId = detail?.address?.customer_id;
  const { data: customerAddresses = [], isLoading: addressesLoading } = useQuery<AddressResponse[]>({
    queryKey: ["customer-addresses", customerId],
    queryFn: () =>
      addressesApi
        .getAddressesByCustomer(customerId!)
        .then((r) => r.data.data ?? []),
    enabled: addressOpen && !!customerId,
  });

  const addressMutation = useMutation({
    mutationFn: (data: OrderItemAddressUpdate) =>
      orderItemsApi.updateAddress(item.order_item_id, data),
    onSuccess: (res) => {
      const result = res.data.data;
      if (result?.can_change) {
        toast.success("배송지가 변경되었습니다.");
        setAddressOpen(false);
        setSelectedAddressId(null);
        setNewAddr({ recipient_name: "", recipient_phone: "", postal_code: "", recipient_address: "", customer_memo: "", admin_memo: "" });
        invalidateAll();
      } else if (result) {
        setAddressResult({ can_change: result.can_change, message: result.message });
      }
    },
    onError: () => toast.error("배송지 변경 실패"),
  });

  const handleAddressConfirm = () => {
    if (addressTab === "existing") {
      if (!selectedAddressId) {
        toast.error("배송지를 선택해주세요.");
        return;
      }
      setAddressResult(null);
      addressMutation.mutate({ address_id: selectedAddressId });
    } else {
      const errors: Record<string, boolean> = {};
      if (!newAddr.recipient_name.trim()) errors.recipient_name = true;
      if (!newAddr.recipient_phone.trim()) errors.recipient_phone = true;
      if (!newAddr.postal_code.trim()) errors.postal_code = true;
      if (!newAddr.recipient_address.trim()) errors.recipient_address = true;
      if (Object.keys(errors).length > 0) {
        setNewAddrErrors(errors);
        toast.error("필수 항목을 입력해주세요.");
        return;
      }
      setAddressResult(null);
      addressMutation.mutate({
        new_address: {
          customer_id: customerId ?? 0,
          recipient_name: newAddr.recipient_name,
          recipient_phone: newAddr.recipient_phone,
          postal_code: newAddr.postal_code,
          recipient_address: newAddr.recipient_address,
          customer_memo: newAddr.customer_memo || undefined,
          admin_memo: newAddr.admin_memo || undefined,
        },
      });
    }
  };

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
    onError: () => toast.error("마지막 발송 호 수정 실패"),
  });

  const handleLastSendConfirm = () => {
    if (!lastSendIssue || lastSendIssue.length !== 6) {
      setLastSendIssueError(true);
      toast.error("마지막 발송 호를 입력해주세요. (YYYYMM)");
      return;
    }
    lastSendMutation.mutate();
  };

  // ── 품목 취소 모달 ────────────────────────────────────────────────────────
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelMemo, setCancelMemo] = useState("");
  const [cancelMemoError, setCancelMemoError] = useState(false);

  const cancelMutation = useMutation({
    mutationFn: () =>
      orderItemsApi.cancelOrderItem(item.order_item_id, { admin_memo: cancelMemo }),
    onSuccess: () => {
      toast.success("품목이 취소되었습니다.");
      setCancelOpen(false);
      setCancelMemo("");
      invalidateAll();
    },
    onError: () => toast.error("취소 실패"),
  });

  const handleCancelConfirm = () => {
    if (!cancelMemo.trim()) {
      setCancelMemoError(true);
      toast.error("취소 사유를 입력해주세요.");
      return;
    }
    cancelMutation.mutate();
  };

  // ── 휴지 등록 모달 ────────────────────────────────────────────────────────
  const [pauseOpen, setPauseOpen] = useState(false);
  const [pauseMode, setPauseMode] = useState<"single" | "batch">("single");
  const [pauseIssue, setPauseIssue] = useState("");
  const [pauseIssueError, setPauseIssueError] = useState(false);
  const [pauseIssuesBatch, setPauseIssuesBatch] = useState("");
  const [pauseIssuesBatchError, setPauseIssuesBatchError] = useState(false);
  const [pauseReason, setPauseReason] = useState("");

  const pauseCreateSingleMutation = useMutation({
    mutationFn: () =>
      pausesApi.createPause({
        order_item_id: item.order_item_id,
        pause_issue: pauseIssue,
        reason: pauseReason || undefined,
      }),
    onSuccess: () => {
      toast.success("휴지가 등록되었습니다.");
      setPauseOpen(false);
      setPauseIssue("");
      setPauseIssuesBatch("");
      setPauseReason("");
      invalidateAll();
    },
    onError: () => toast.error("휴지 등록 실패"),
  });

  const pauseCreateBatchMutation = useMutation({
    mutationFn: () =>
      pausesApi.batchCreatePause({
        order_item_id: item.order_item_id,
        pause_issues: pauseIssuesBatch
          .split(",")
          .map((s) => s.trim())
          .filter((s) => s.length === 6),
        reason: pauseReason || undefined,
      }),
    onSuccess: () => {
      toast.success("휴지가 등록되었습니다.");
      setPauseOpen(false);
      setPauseIssue("");
      setPauseIssuesBatch("");
      setPauseReason("");
      invalidateAll();
    },
    onError: () => toast.error("휴지 등록 실패"),
  });

  const pauseCreateMutation = pauseMode === "single" ? pauseCreateSingleMutation : pauseCreateBatchMutation;

  const handlePauseCreate = () => {
    if (pauseMode === "single") {
      if (!pauseIssue || pauseIssue.length !== 6) {
        setPauseIssueError(true);
        toast.error("휴지 호를 입력해주세요. (YYYYMM)");
        return;
      }
    } else {
      const issues = pauseIssuesBatch
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s.length === 6);
      if (issues.length === 0) {
        setPauseIssuesBatchError(true);
        toast.error("올바른 형식의 휴지 호를 입력해주세요. (YYYYMM, 쉼표 구분)");
        return;
      }
    }
    pauseCreateMutation.mutate();
  };

  // ── 휴지 삭제 ─────────────────────────────────────────────────────────────
  const [deletePauseTarget, setDeletePauseTarget] = useState<PauseResponse | null>(null);

  const pauseDeleteMutation = useMutation({
    mutationFn: (pauseId: number) => pausesApi.deletePause(pauseId),
    onSuccess: () => {
      toast.success("휴지가 삭제되었습니다.");
      setDeletePauseTarget(null);
      invalidateAll();
    },
    onError: () => toast.error("휴지 삭제 실패"),
  });

  // ── 휴지 복구 ─────────────────────────────────────────────────────────────
  const pauseRestoreMutation = useMutation({
    mutationFn: (pauseId: number) => pausesApi.restorePause(pauseId),
    onSuccess: () => {
      toast.success("휴지가 복구되었습니다.");
      invalidateAll();
    },
    onError: () => toast.error("휴지 복구 실패"),
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
    onError: () => toast.error("사유 수정 실패"),
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
              onClick={() => { setShortenCalcResult(null); setShortenEndIssue(""); setShortenOpen(true); }}
            >
              <ChevronsDown className="h-3.5 w-3.5" />단축
            </Button>
            <Button
              size="sm" variant="outline" className="gap-1 text-xs"
              onClick={() => { setNewStartIssue(finalStartIssue); setChangePeriodOpen(true); }}
            >
              <ArrowRightLeft className="h-3.5 w-3.5" />기간 이동
            </Button>
            <Button
              size="sm" variant="outline" className="gap-1 text-xs"
              onClick={() => {
                setPauseIssue("");
                setPauseIssuesBatch("");
                setPauseReason("");
                setPauseMode("single");
                setPauseOpen(true);
              }}
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
              onClick={() => {
                setAddressResult(null);
                setSelectedAddressId(null);
                setAddressTab("existing");
                setNewAddr({ recipient_name: "", recipient_phone: "", postal_code: "", recipient_address: "", customer_memo: "", admin_memo: "" });
                setNewAddrErrors({});
                setAddressOpen(true);
              }}
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
        <Section title="고객">
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
          {(detail?.sended_at ?? item.sended_at) && (
            <InfoRow label="발송일시" value={formatDateTime(detail?.sended_at ?? item.sended_at!)} />
          )}
          {(detail?.admin_memo ?? item.admin_memo) && (
            <InfoRow label="관리자메모" value={detail?.admin_memo ?? item.admin_memo} />
          )}
        </Section>

        {/* 구독 기간 */}
        <Section title="구독 기간">
          {/* 현재 시작 → 종료 강조 카드 */}
          <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-3">
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
              <p className="font-medium text-gray-800">{item.subscribe_period}개월</p>
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

          {/* 유료 종료 — 주문 시 종료와 다를 때만 표시 */}
          {item.paid_subscribe_end_issue !== item.subscribe_end_issue && (
            <div className="text-xs text-gray-400 flex items-center gap-1.5 border-t border-gray-100 pt-2">
              <span>유료 종료:</span>
              <span className="text-gray-600 font-medium">
                {formatIssue(detail?.paid_subscribe_end_issue ?? item.paid_subscribe_end_issue)}
              </span>
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
                    {send.official_send_date
                      ? formatDate(send.official_send_date)
                      : send.shipped_at
                      ? formatDate(send.shipped_at)
                      : "-"}
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
            {activePauses.length === 0 && deletedPauses.length === 0 && (
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

            {/* 삭제된 휴지 */}
            {deletedPauses.length > 0 && (
              <>
                {activePauses.length > 0 && (
                  <div className="border-t border-gray-100 pt-2 mt-1">
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-2">삭제된 휴지</p>
                  </div>
                )}
                {deletedPauses.map((pause) => (
                  <div key={pause.pause_id} className="flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <span className="text-xs text-gray-400 line-through">
                        {formatIssue(pause.pause_issue)}
                      </span>
                      {pause.reason && (
                        <span className="text-xs text-gray-300 ml-1">{pause.reason}</span>
                      )}
                    </div>
                    {!isCancelled && (
                      <button
                        className="p-1 text-gray-400 hover:text-blue-600 rounded"
                        onClick={() => pauseRestoreMutation.mutate(pause.pause_id)}
                        disabled={pauseRestoreMutation.isPending}
                        title="복구"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </>
            )}
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

      {/* 연장 모달 */}
      <Dialog open={extendOpen} onOpenChange={(o) => { if (!o) { setExtendOpen(false); setExtendMonthsError(false); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>구독 연장</DialogTitle></DialogHeader>
          <div className="space-y-3 py-1">
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-500">현재 종료</span>
                <span className="font-medium text-gray-800">{formatIssue(finalEndIssue)}</span>
              </div>
              {extendPreviewEndIssue && (
                <div className="flex justify-between border-t border-gray-200 pt-1">
                  <span className="text-gray-500">연장 후 종료</span>
                  <span className="font-semibold text-blue-700">{formatIssue(extendPreviewEndIssue)}</span>
                </div>
              )}
            </div>
            <div>
              <Label>연장 개월 수 <span className="text-red-500 ml-0.5">*</span></Label>
              <Input
                className={`mt-1 ${extendMonthsError ? "border-red-500" : ""}`}
                type="number" min={1} max={24}
                value={extendMonths}
                onChange={(e) => { setExtendMonths(e.target.value); setExtendMonthsError(false); }}
              />
              {extendMonthsError && <p className="text-xs text-red-500 mt-1">연장 개월 수를 입력해주세요.</p>}
            </div>
            <div>
              <Label>연장 사유</Label>
              <Input className="mt-1" placeholder="선택 입력" value={extendReason} onChange={(e) => setExtendReason(e.target.value)} />
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input type="checkbox" checked={extendIsPaid} onChange={(e) => setExtendIsPaid(e.target.checked)} className="rounded border-gray-300" />
              유료 연장
              <span className="text-xs text-gray-400">(paid_subscribe_end_issue도 갱신)</span>
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExtendOpen(false)}>취소</Button>
            <Button onClick={handleExtendConfirm} disabled={extendMutation.isPending}>
              {extendMutation.isPending && <LoadingSpinner size="sm" className="mr-1" />}연장
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 단축 모달 */}
      <Dialog open={shortenOpen} onOpenChange={(o) => { if (!o) { setShortenOpen(false); setShortenCalcResult(null); setShortenEndIssueError(null); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>구독 단축</DialogTitle></DialogHeader>
          <div className="space-y-3 py-1">
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-500">현재 종료</span>
                <span className="font-medium text-gray-800">{formatIssue(finalEndIssue)}</span>
              </div>
            </div>
            <div>
              <Label>단축 종료 호 <span className="text-red-500 ml-0.5">*</span></Label>
              <div className="relative mt-1">
                <Input
                  className={shortenEndIssueError ? "border-red-500" : ""}
                  placeholder="YYYYMM" maxLength={6}
                  value={shortenEndIssue}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, "");
                    setShortenEndIssue(val);
                    setShortenEndIssueError(null);
                    if (val.length < 6) setShortenCalcResult(null);
                  }}
                />
                {shortenCalcMutation.isPending && (
                  <div className="absolute right-2 top-1/2 -translate-y-1/2">
                    <LoadingSpinner size="sm" />
                  </div>
                )}
              </div>
              {shortenEndIssueError && <p className="text-xs text-red-500 mt-1">{shortenEndIssueError}</p>}
              <p className="text-xs text-gray-400 mt-1">6자리 입력 시 자동으로 환불액을 계산합니다.</p>
            </div>
            {shortenCalcResult && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">현재 종료</span>
                  <span className="font-medium">{formatIssue(shortenCalcResult.current_end_issue)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">단축 후 종료</span>
                  <span className="font-medium text-amber-700">{formatIssue(shortenCalcResult.shorten_end_issue)}</span>
                </div>
                <div className="flex justify-between text-xs border-t border-amber-200 pt-1.5">
                  <span className="text-gray-500">예상 환불액</span>
                  <span className="font-semibold text-red-600">{formatAmount(shortenCalcResult.refund_amount)}</span>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShortenOpen(false)}>취소</Button>
            <Button variant="destructive" onClick={() => shortenConfirmMutation.mutate()} disabled={!shortenCalcResult || shortenConfirmMutation.isPending}>
              {shortenConfirmMutation.isPending && <LoadingSpinner size="sm" className="mr-1" />}단축 확정
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 기간 이동 모달 */}
      <Dialog open={changePeriodOpen} onOpenChange={(o) => { if (!o) { setChangePeriodOpen(false); setNewStartIssueError(false); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>구독 기간 이동</DialogTitle></DialogHeader>
          <div className="space-y-3 py-1">
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-500">현재 시작</span>
                <span className="font-medium text-gray-800">{formatIssue(finalStartIssue)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">현재 종료</span>
                <span className="font-medium text-gray-800">{formatIssue(finalEndIssue)}</span>
              </div>
              {changePeriodPreviewEndIssue && newStartIssue.length === 6 && (
                <>
                  <div className="border-t border-gray-200 pt-1 mt-1 flex justify-between">
                    <span className="text-gray-500">이동 후 시작</span>
                    <span className="font-semibold text-blue-700">{formatIssue(newStartIssue)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">이동 후 종료</span>
                    <span className="font-semibold text-blue-700">{formatIssue(changePeriodPreviewEndIssue)}</span>
                  </div>
                </>
              )}
            </div>
            <p className="text-xs text-gray-400">기간({item.subscribe_period}개월) 유지, 시작/종료 호만 이동됩니다.</p>
            <div>
              <Label>새 구독 시작 호 <span className="text-red-500 ml-0.5">*</span></Label>
              <Input
                className={`mt-1 ${newStartIssueError ? "border-red-500" : ""}`}
                placeholder="YYYYMM" maxLength={6}
                value={newStartIssue}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, "");
                  setNewStartIssue(val);
                  setNewStartIssueError(false);
                }}
              />
              {newStartIssueError && <p className="text-xs text-red-500 mt-1">새 구독 시작 호를 입력해주세요.</p>}
              <p className="text-xs text-gray-400 mt-1">6자리 입력 시 이동 후 종료 호가 자동으로 계산됩니다.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setChangePeriodOpen(false)}>취소</Button>
            <Button onClick={handleChangePeriodConfirm} disabled={changePeriodMutation.isPending}>
              {changePeriodMutation.isPending && <LoadingSpinner size="sm" className="mr-1" />}이동
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 배송지 변경 모달 */}
      <Dialog open={addressOpen} onOpenChange={(o) => { if (!o) { setAddressOpen(false); setAddressResult(null); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>배송지 변경</DialogTitle></DialogHeader>
          <div className="space-y-3 py-1">
            {/* 탭 전환 */}
            <div className="flex rounded-md border border-gray-200 overflow-hidden text-xs">
              <button
                className={`flex-1 py-1.5 ${addressTab === "existing" ? "bg-blue-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
                onClick={() => { setAddressTab("existing"); setAddressResult(null); }}
              >기존 배송지 선택</button>
              <button
                className={`flex-1 py-1.5 ${addressTab === "new" ? "bg-blue-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
                onClick={() => { setAddressTab("new"); setAddressResult(null); }}
              >새 배송지 등록</button>
            </div>

            {addressTab === "existing" ? (
              <div className="space-y-2">
                {addressesLoading ? (
                  <div className="flex justify-center py-4">
                    <LoadingSpinner size="sm" />
                  </div>
                ) : customerAddresses.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-3">등록된 배송지가 없습니다.</p>
                ) : (
                  customerAddresses.map((addr) => {
                    const isCurrent = addr.address_id === (detail?.address_id ?? item.address_id);
                    const isSelected = selectedAddressId === addr.address_id;
                    return (
                      <button
                        key={addr.address_id}
                        onClick={() => setSelectedAddressId(addr.address_id)}
                        className={`w-full text-left rounded-lg border p-3 text-xs transition-colors ${
                          isSelected
                            ? "border-blue-400 bg-blue-50"
                            : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium text-gray-800">{addr.recipient_name}</span>
                          <div className="flex gap-1">
                            {isCurrent && (
                              <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">현재</span>
                            )}
                            {isSelected && (
                              <span className="text-[10px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded">선택됨</span>
                            )}
                          </div>
                        </div>
                        <p className="text-gray-500">{formatPhone(addr.recipient_phone)}</p>
                        <p className="text-gray-600 mt-0.5">({addr.postal_code}) {addr.recipient_address}</p>
                        {addr.customer_memo && (
                          <p className="text-gray-400 mt-0.5">{addr.customer_memo}</p>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            ) : (
              <div className="space-y-2.5">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">받는 분 <span className="text-red-500 ml-0.5">*</span></Label>
                    <Input
                      className={`mt-1 h-8 text-xs ${newAddrErrors.recipient_name ? "border-red-500" : ""}`}
                      placeholder="홍길동"
                      value={newAddr.recipient_name}
                      onChange={(e) => { setNewAddr(p => ({ ...p, recipient_name: e.target.value })); setNewAddrErrors(p => ({ ...p, recipient_name: false })); }}
                    />
                    {newAddrErrors.recipient_name && <p className="text-xs text-red-500 mt-0.5">필수 항목</p>}
                  </div>
                  <div>
                    <Label className="text-xs">연락처 <span className="text-red-500 ml-0.5">*</span></Label>
                    <Input
                      className={`mt-1 h-8 text-xs ${newAddrErrors.recipient_phone ? "border-red-500" : ""}`}
                      placeholder="01012345678"
                      value={newAddr.recipient_phone}
                      onChange={(e) => { setNewAddr(p => ({ ...p, recipient_phone: e.target.value })); setNewAddrErrors(p => ({ ...p, recipient_phone: false })); }}
                    />
                    {newAddrErrors.recipient_phone && <p className="text-xs text-red-500 mt-0.5">필수 항목</p>}
                  </div>
                </div>
                <div>
                  <Label className="text-xs">우편번호 <span className="text-red-500 ml-0.5">*</span></Label>
                  <Input
                    className={`mt-1 h-8 text-xs ${newAddrErrors.postal_code ? "border-red-500" : ""}`}
                    placeholder="12345"
                    value={newAddr.postal_code}
                    onChange={(e) => { setNewAddr(p => ({ ...p, postal_code: e.target.value })); setNewAddrErrors(p => ({ ...p, postal_code: false })); }}
                  />
                  {newAddrErrors.postal_code && <p className="text-xs text-red-500 mt-0.5">필수 항목</p>}
                </div>
                <div>
                  <Label className="text-xs">주소 <span className="text-red-500 ml-0.5">*</span></Label>
                  <Input
                    className={`mt-1 h-8 text-xs ${newAddrErrors.recipient_address ? "border-red-500" : ""}`}
                    placeholder="서울특별시 강남구 ..."
                    value={newAddr.recipient_address}
                    onChange={(e) => { setNewAddr(p => ({ ...p, recipient_address: e.target.value })); setNewAddrErrors(p => ({ ...p, recipient_address: false })); }}
                  />
                  {newAddrErrors.recipient_address && <p className="text-xs text-red-500 mt-0.5">필수 항목</p>}
                </div>
                <div>
                  <Label className="text-xs">배송 메모</Label>
                  <Input
                    className="mt-1 h-8 text-xs"
                    placeholder="선택 입력"
                    value={newAddr.customer_memo}
                    onChange={(e) => setNewAddr(p => ({ ...p, customer_memo: e.target.value }))}
                  />
                </div>
                <div>
                  <Label className="text-xs">관리자 메모</Label>
                  <Input
                    className="mt-1 h-8 text-xs"
                    placeholder="선택 입력"
                    value={newAddr.admin_memo}
                    onChange={(e) => setNewAddr(p => ({ ...p, admin_memo: e.target.value }))}
                  />
                </div>
              </div>
            )}

            {addressResult && (
              <div className={`rounded-lg p-3 text-xs ${addressResult.can_change ? "bg-green-50 border border-green-200 text-green-700" : "bg-red-50 border border-red-200 text-red-700"}`}>
                {addressResult.message}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddressOpen(false)}>닫기</Button>
            {!addressResult?.can_change && (
              <Button onClick={handleAddressConfirm} disabled={addressMutation.isPending}>
                {addressMutation.isPending && <LoadingSpinner size="sm" className="mr-1" />}변경
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 마지막 발송 호 수정 모달 */}
      <Dialog open={lastSendOpen} onOpenChange={(o) => { if (!o) { setLastSendOpen(false); setLastSendIssueError(false); } }}>
        <DialogContent className="max-w-sm">
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
      <Dialog open={cancelOpen} onOpenChange={(o) => { if (!o) { setCancelOpen(false); setCancelMemoError(false); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>품목 취소</DialogTitle></DialogHeader>
          <div className="space-y-3 py-1">
            <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded p-2">
              배송 시작(배송 중, 배송 완료) 이후에는 취소할 수 없습니다.
            </p>
            <div>
              <Label>취소 사유 <span className="text-red-500 ml-0.5">*</span></Label>
              <textarea
                className={`mt-1 w-full min-h-[80px] resize-none rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-0 ${
                  cancelMemoError ? "border-red-500 focus:ring-red-500" : "border-input"
                }`}
                placeholder="취소 사유를 입력해주세요."
                value={cancelMemo}
                onChange={(e) => { setCancelMemo(e.target.value); setCancelMemoError(false); }}
              />
              {cancelMemoError && <p className="text-xs text-red-500 mt-1">취소 사유를 입력해주세요.</p>}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelOpen(false)}>닫기</Button>
            <Button variant="destructive" onClick={handleCancelConfirm} disabled={cancelMutation.isPending}>
              {cancelMutation.isPending && <LoadingSpinner size="sm" className="mr-1" />}취소 확정
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 휴지 등록 모달 */}
      <Dialog open={pauseOpen} onOpenChange={(o) => { if (!o) { setPauseOpen(false); setPauseIssueError(false); setPauseIssuesBatchError(false); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>휴지 등록</DialogTitle></DialogHeader>
          <div className="space-y-3 py-1">
            {/* 단건 / 다건 토글 */}
            <div className="flex rounded-md border border-gray-200 overflow-hidden text-xs">
              <button
                className={`flex-1 py-1.5 ${pauseMode === "single" ? "bg-blue-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
                onClick={() => setPauseMode("single")}
              >단건</button>
              <button
                className={`flex-1 py-1.5 ${pauseMode === "batch" ? "bg-blue-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
                onClick={() => setPauseMode("batch")}
              >다건</button>
            </div>

            {pauseMode === "single" ? (
              <div>
                <Label>휴지 호 <span className="text-red-500 ml-0.5">*</span></Label>
                <Input
                  className={`mt-1 ${pauseIssueError ? "border-red-500" : ""}`}
                  placeholder="YYYYMM" maxLength={6}
                  value={pauseIssue}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, "");
                    setPauseIssue(val);
                    setPauseIssueError(false);
                  }}
                />
                {pauseIssueError && <p className="text-xs text-red-500 mt-1">휴지 호를 입력해주세요.</p>}
              </div>
            ) : (
              <div>
                <Label>휴지 호 목록 <span className="text-red-500 ml-0.5">*</span></Label>
                <Input
                  className={`mt-1 ${pauseIssuesBatchError ? "border-red-500" : ""}`}
                  placeholder="202604,202605,202606"
                  value={pauseIssuesBatch}
                  onChange={(e) => { setPauseIssuesBatch(e.target.value); setPauseIssuesBatchError(false); }}
                />
                <p className="text-xs text-gray-400 mt-1">쉼표(,)로 구분해서 입력하세요.</p>
                {pauseIssuesBatchError && <p className="text-xs text-red-500 mt-1">올바른 형식으로 입력해주세요.</p>}
              </div>
            )}

            <div>
              <Label>사유</Label>
              <Input
                className="mt-1" placeholder="선택 입력"
                value={pauseReason}
                onChange={(e) => setPauseReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPauseOpen(false)}>취소</Button>
            <Button onClick={handlePauseCreate} disabled={pauseCreateMutation.isPending}>
              {pauseCreateMutation.isPending && <LoadingSpinner size="sm" className="mr-1" />}등록
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
