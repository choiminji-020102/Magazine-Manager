import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, Calendar, ChevronRight, Edit2, RotateCcw, X } from "lucide-react";
import { StatusBadge } from "@/components/common/StatusBadge";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { ConfirmModal } from "@/components/common/ConfirmModal";
import { SlidingPanel } from "@/components/common/SlidingPanel";
import { SendResendModal } from "@/components/dispatch/SendResendModal";
import { TrackingNoValue } from "@/components/dispatch/TrackingNoValue";
import OrderDetailPanel from "@/pages/order/OrderDetailPanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { sendsApi } from "@/api/sendsApi";
import { activityLogsApi } from "@/api/activityLogsApi";
import { formatDateTime, formatPhone, formatIssue } from "@/utils/format";
import { toast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/utils/errorHandler";
import {
  SEND_METHOD_OPTIONS,
  COURIER_COMPANY_OPTIONS,
  SEND_METHOD_TO_COURIER,
} from "@/utils/constants";
import type {
  SendMethod,
  CourierCompany,
  SendTrackingUpdate,
  SendResponse,
  SendDetailResponse,
} from "@/types/send";

// 발송 메모 입력 길이 상한 — 백엔드 SendAdminMemoUpdate 가 max_length=1000 으로 강제한다.
// 서버가 422 로 거절하기 전에 입력 단계에서 막는다.
const MEMO_MAX_LEN = 1000;

interface Props {
  sendId: number;
  onClose: () => void;
}

// 발송 박스 단위 상세 패널.
// PreparingSendListPage / DeliveredSendListPage 의 행 클릭 시 열림.
// 박스 안 SendItem 책 종류 확인용 (#11 약점 보강) + 재배송 내역 노출.
//
// SlidingPanel 은 부모 페이지가 렌더한다 — 다른 도메인 패널(OrderDetailPanel,
// CustomerDetailPanel 등) 과 동일한 뼈대. 이 컴포넌트는 내용물만 반환하므로
// 헤더를 sticky 가 아니라 flex 형제로 고정할 수 있고, 스크롤은 본문에만 걸린다.

const EMPTY_EDIT_FORM = {
  admin_memo: "",
  send_method: "" as SendMethod | "",
  courier_company: "" as CourierCompany | "",
  tracking_no: "",
};

export default function SendDetailPanel({ sendId, onClose }: Props) {
  const queryClient = useQueryClient();

  // 박스 강제 삭제 — 위험 액션이라 2단계 확인 (1차 대상/규모 안내 → 2차 비가역성 강조).
  // 2차에서 취소 시 1차로 돌아가지 않고 그대로 닫힘 (모달 중첩 UX 단순화).
  const [deleteStep1Open, setDeleteStep1Open] = useState(false);
  const [deleteStep2Open, setDeleteStep2Open] = useState(false);
  const [resendOpen, setResendOpen] = useState(false);
  // 묶인 주문 행에서 겹쳐 여는 주문 상세 (CustomerDetailPanel → OrderDetailPanel 과 동일).
  // 열림 상태와 ID 를 분리해야 닫을 때 빈 패널이 슬라이드되지 않는다.
  const [orderPanelId, setOrderPanelId] = useState<number | null>(null);
  const [orderPanelOpen, setOrderPanelOpen] = useState(false);

  const openOrderPanel = (orderId: number) => {
    setOrderPanelId(orderId);
    setOrderPanelOpen(true);
  };

  const closeOrderPanel = useCallback(() => {
    setOrderPanelOpen(false);
    setTimeout(() => setOrderPanelId(null), 250);
  }, []);

  // 편집 모드 — 다른 도메인 패널과 동일하게 토글 하나로 본문 전체를 전환한다.
  // 발송 메모(상태 무관)와 운송장 3필드(DELIVERED 만)를 한 번에 다루고,
  // 저장 시 실제로 바뀐 쪽의 API 만 호출한다.
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState(EMPTY_EDIT_FORM);
  // 필드별 에러 메시지 (UI_GUIDE §10 3종 세트: border-red + 메시지 + toast)
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});
  // 저장 중 '메모는 반영됐는데 운송장이 실패' 를 알리기 위한 플래그.
  // state 가 아니라 ref 인 이유 — 화면을 다시 그릴 값이 아니라 onError 로 넘기는 신호다.
  const memoSavedRef = useRef(false);

  const { data: send, isLoading } = useQuery({
    queryKey: ["send-detail", sendId],
    queryFn: () => sendsApi.getSend(sendId).then((r) => r.data.data!),
  });

  const { data: resendLogs = [] } = useQuery({
    queryKey: ["send-resend-logs", sendId],
    queryFn: () =>
      activityLogsApi
        .getActivityLogs({
          page: 1,
          limit: 50,
          target_type: "SEND",
          target_id: sendId,
          action: "RESEND",
        })
        .then((r) => r.data.items ?? []),
  });

  // 박스가 바뀌거나 서버 값이 갱신되면 draft 를 최신 값으로 맞춘다.
  // 편집 중에는 덮어쓰지 않는다 (OrderDetailPanel 과 동일한 패턴).
  useEffect(() => {
    if (!send || editMode) return;
    setEditForm({
      admin_memo: send.admin_memo ?? "",
      send_method: (send.send_method as SendMethod | null) ?? "",
      courier_company: (send.courier_company as CourierCompany | null) ?? "",
      tracking_no: send.tracking_no ?? "",
    });
  }, [send, editMode]);

  // 운송장 3필드는 백엔드가 DELIVERED 에서만 수정을 허용한다
  // (send_service.update_tracking — PREPARING/CANCELLED 는 400).
  const canEditTracking = send?.send_status === "DELIVERED";

  // 서버 값도 trim 해서 비교한다 — 백엔드가 이미 정규화해 내려주지만(운송장은 숫자만,
  // 방법·운송사는 strip), 양쪽을 같은 기준으로 비교해야 헛 dirty 판정이 없다.
  const memoDirty = !!send && editForm.admin_memo.trim() !== (send.admin_memo ?? "").trim();
  const trackingDirty =
    !!send &&
    canEditTracking &&
    (editForm.tracking_no.trim() !== (send.tracking_no ?? "").trim() ||
      editForm.send_method !== ((send.send_method as SendMethod | null) ?? "") ||
      editForm.courier_company !== ((send.courier_company as CourierCompany | null) ?? ""));

  // 저장 응답에 담겨 오는 갱신된 Send 를 상세 캐시에 즉시 반영한다.
  // 무효화만 하면 refetch 가 도착하기 전까지 읽기 행이 옛 값을 그리고,
  // 그 사이 [수정] 을 다시 누르면 draft 가 옛 값으로 되돌아가 방금 저장한 값을 덮어쓴다.
  // 응답은 items 가 없는 SendResponse 라 기존 캐시 위에 병합한다.
  const applyUpdatedSend = (updated: SendResponse | null | undefined) => {
    if (!updated) return;
    queryClient.setQueryData<SendDetailResponse>(["send-detail", sendId], (old) =>
      old ? { ...old, ...updated } : old,
    );
  };

  const updateMutation = useMutation({
    // 바뀐 쪽만 호출한다 — 엔드포인트가 admin-memo / tracking 으로 나뉘어 있고
    // 운송장 API 는 DELIVERED 전용이라 무조건 호출하면 PREPARING 에서 400 이 난다.
    // 두 요청은 순차 실행 — 앞이 실패하면 뒤는 보내지 않는다.
    //
    // 두 요청을 한 버튼에 묶은 이상 '앞은 성공, 뒤는 실패' 가 가능하다.
    // (권한이 다르다 — admin-memo 는 require_manager, tracking 은 require_admin.
    //  MANAGER 계정이 둘을 함께 고치면 메모만 저장되고 운송장은 403 이 난다.)
    // 그래서 캐시 무효화는 onSuccess 가 아니라 onSettled 에서 한다 —
    // 실패해도 서버에 이미 반영된 앞쪽 변경이 화면에 즉시 드러나야 한다.
    mutationFn: async () => {
      const messages: string[] = [];
      memoSavedRef.current = false;
      if (memoDirty) {
        const res = await sendsApi.updateAdminMemo(sendId, {
          admin_memo: editForm.admin_memo.trim() || null,
        });
        messages.push(res.data.message);
        memoSavedRef.current = true;
        applyUpdatedSend(res.data.data);
      }
      if (trackingDirty && send) {
        // 실제로 바뀐 필드만 담는다. 백엔드 crud 는 None 인 필드를 건너뛰므로
        // 안 바뀐 필드를 굳이 실어 보낼 이유가 없다 (셋 다 없으면 422).
        const payload: SendTrackingUpdate = {};
        // 조건은 위 trackingDirty 와 정확히 같아야 한다 —
        // 어긋나면 dirty 인데 payload 가 비어 422(셋 다 없음)를 맞을 수 있다.
        if (editForm.tracking_no.trim() !== (send.tracking_no ?? "").trim()) {
          payload.tracking_no = editForm.tracking_no.trim();
        }
        if (editForm.send_method !== ((send.send_method as SendMethod | null) ?? "")) {
          payload.send_method = editForm.send_method as SendMethod;
        }
        if (editForm.courier_company !== ((send.courier_company as CourierCompany | null) ?? "")) {
          payload.courier_company = editForm.courier_company as CourierCompany;
        }
        const res = await sendsApi.updateTracking(sendId, payload);
        messages.push(res.data.message);
        applyUpdatedSend(res.data.data);
      }
      return messages;
    },
    onSuccess: (messages) => {
      toast.success(messages.join(" ") || "수정되었습니다.");
      setEditMode(false);
      setEditErrors({});
    },
    onError: (err) => {
      // 앞선 메모 저장이 이미 서버에 반영된 채 뒤가 실패했다면 그 사실을 밝힌다.
      // 편집 모드는 열어 둔다 — 사용자가 실패한 쪽만 고쳐 다시 저장할 수 있어야 한다.
      // (아래 onSettled 의 무효화로 memoDirty 는 false 가 되므로 메모가 재전송되지는 않는다.)
      const message = getErrorMessage(err);
      toast.error(
        memoSavedRef.current ? `${message} (발송 메모는 저장되었습니다.)` : message,
      );
    },
    onSettled: () => {
      memoSavedRef.current = false;
      queryClient.invalidateQueries({ queryKey: ["send-detail", sendId] });
      queryClient.invalidateQueries({ queryKey: ["preparing-sends"] });
      queryClient.invalidateQueries({ queryKey: ["delivered-sends"] });
      // SubscriptionDetailPanel 의 발송 내역 query — orderItemId 무관 prefix 무효화
      queryClient.invalidateQueries({ queryKey: ["order-item-sends"] });
    },
  });

  const handleSave = () => {
    if (!send) return;

    // 모든 위반을 한 번에 표시 (재제출 강요 방지). toast 는 첫 항목만.
    const errors: Record<string, string> = {};
    if (canEditTracking) {
      // 운송장 3필드는 값을 지울 수 없다 — 백엔드 crud 가 None 인 필드를 건너뛰므로
      // 비운 채로 저장하면 아무 일도 일어나지 않는다. 조용히 무시되느니 막고 알린다.
      if (send.tracking_no && !editForm.tracking_no.trim()) {
        errors.tracking_no = "송장 번호는 지울 수 없습니다. 다른 번호로 수정해주세요.";
      }
      if (send.send_method && !editForm.send_method) {
        errors.send_method = "배송 방법은 지울 수 없습니다. 다른 값으로 수정해주세요.";
      }
      if (send.courier_company && !editForm.courier_company) {
        errors.courier_company = "운송사는 지울 수 없습니다. 다른 값으로 수정해주세요.";
      }
      // 백엔드는 입력에서 숫자만 추출해 저장하고, 추출 결과가 비면 422 를 낸다.
      if (editForm.tracking_no.trim() && !/\d/.test(editForm.tracking_no)) {
        errors.tracking_no = "송장 번호에 숫자가 없습니다. 번호를 확인해주세요.";
      }
    }
    if (Object.keys(errors).length > 0) {
      setEditErrors(errors);
      toast.error(Object.values(errors)[0]);
      return;
    }

    if (!memoDirty && !trackingDirty) {
      toast.error("변경된 항목이 없습니다.");
      return;
    }
    updateMutation.mutate();
  };

  const handleCancelEdit = () => {
    if (!send) return;
    updateMutation.reset();
    setEditMode(false);
    setEditErrors({});
    setEditForm({
      admin_memo: send.admin_memo ?? "",
      send_method: (send.send_method as SendMethod | null) ?? "",
      courier_company: (send.courier_company as CourierCompany | null) ?? "",
      tracking_no: send.tracking_no ?? "",
    });
  };

  // PREPARING 박스 강제 삭제 — 운영자 직접 박스 단위 정리용.
  // OrderItem 취소 시 자동 제거 흐름과 별개. 사유/메모는 받지 않는다.
  const deleteMutation = useMutation({
    mutationFn: () => sendsApi.deletePreparingSend(sendId).then((r) => r.data),
    onSuccess: (res) => {
      toast.success(res.message ?? "PREPARING 박스가 삭제되었습니다.");
      setDeleteStep2Open(false);
      // 삭제된 박스의 캐시는 무효화가 아니라 제거한다 — 무효화하면 아직 살아 있는
      // observer 가 GET /sends/{id} 를 다시 쏘고, 하드 삭제라 404 가 돌아온다.
      // onClose() 는 setState 예약일 뿐이라 이 시점엔 아직 언마운트 전이다.
      queryClient.removeQueries({ queryKey: ["send-detail", sendId] });
      queryClient.removeQueries({ queryKey: ["send-resend-logs", sendId] });
      onClose();
      queryClient.invalidateQueries({ queryKey: ["preparing-sends"] });
      queryClient.invalidateQueries({ queryKey: ["paid-not-prepared-count"] });
      queryClient.invalidateQueries({ queryKey: ["order-item-sends"] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  // 로딩·조회 실패 때도 헤더 줄의 X 는 남긴다 — 부모가 SlidingPanel 에 title 을 넘기지 않아
  // 여기서 그리지 않으면 화면에 닫기 버튼이 하나도 없다 (ESC·오버레이 클릭만 남는다).
  if (isLoading || !send) {
    return (
      <div className="flex flex-col h-full">
        <div className="px-5 py-4 border-b border-gray-200 bg-white flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">발송 상세</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1 rounded-md hover:bg-gray-100 flex-shrink-0 ml-2"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <LoadingSpinner />
          </div>
        ) : (
          <div className="flex items-center justify-center py-12 text-sm text-gray-400">
            발송 정보를 불러올 수 없습니다.
          </div>
        )}
      </div>
    );
  }

  const isOverseas = send.country_code !== "KR";
  const hasTracking = !!(send.send_method || send.courier_company || send.tracking_no);

  return (
    <div className="flex flex-col h-full">
      {/* 패널 헤더 */}
      <div className="px-5 py-4 border-b border-gray-200 bg-white">
        <div className="flex items-start justify-between mb-3">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 mb-1">
              <StatusBadge type="send_status" value={send.send_status} />
              {/* 해외 발송 배지 — 카드 계열(PreparingSendCard 등)과 동일 규격 */}
              {isOverseas && (
                <span className="px-1 py-0.5 bg-amber-100 text-amber-700 rounded text-[10px] font-semibold">
                  🌐 {send.country_code}
                </span>
              )}
            </div>
            {/* 제목은 박스 ID 가 아니라 수령인 — 다른 패널이 고객명·상품명을 쓰는 것과 같다.
                ID 는 사람이 식별하지 못하므로 부제로 내린다. */}
            <div className="font-semibold text-gray-900 text-base leading-tight truncate">
              {send.recipient_name}
            </div>
            <div className="text-xs text-gray-400 mt-0.5">
              <span className="font-mono">{formatPhone(send.recipient_phone)}</span>
              <span className="mx-1.5">·</span>
              <span className="font-mono">발송 #{send.send_id}</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1 rounded-md hover:bg-gray-100 flex-shrink-0 ml-2"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* 액션 버튼 */}
        <div className="flex items-center gap-2">
          {editMode ? (
            <>
              <Button size="sm" onClick={handleSave} disabled={updateMutation.isPending}>
                {updateMutation.isPending && <LoadingSpinner size="sm" className="mr-1" />}
                저장
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleCancelEdit}
                disabled={updateMutation.isPending}
              >
                취소
              </Button>
            </>
          ) : (
            <>
              {/* 발송 메모는 상태 무관 편집 가능이라 [수정] 은 항상 노출.
                  운송장 3필드는 편집 모드 안에서 DELIVERED 일 때만 입력으로 바뀐다. */}
              <Button
                variant="outline"
                size="sm"
                className="gap-1"
                onClick={() => setEditMode(true)}
              >
                <Edit2 className="h-3 w-3" />
                수정
              </Button>
              {/* 재배송은 이미 나간 박스에 대한 사후 기록이라 DELIVERED 만 (백엔드도 400 으로 차단) */}
              {send.send_status === "DELIVERED" && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1"
                  onClick={() => setResendOpen(true)}
                >
                  <RotateCcw className="h-3 w-3" />
                  재배송 기록
                </Button>
              )}
              {send.send_status === "PREPARING" && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDeleteStep1Open(true)}
                  disabled={deleteMutation.isPending}
                  className="text-red-600 border-red-200 hover:bg-red-50"
                >
                  {deleteMutation.isPending && <LoadingSpinner size="sm" className="mr-1" />}
                  박스 삭제
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {/* 스크롤 영역 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {/* 발송 품목 — 이 패널을 여는 1순위 목적이 '이 박스에 뭐가 들었나' 라서 맨 위에 둔다 */}
        <BoxContentsSection send={send} />

        {/* 배송지 — 섹션 이름을 다른 도메인 패널과 맞춘다 (기존 '수령인').
            Send 의 수령인 필드는 Address 스냅샷이라 배송지 그 자체다.
            행 구성도 OrderDetailPanel·SubscriptionDetailPanel 과 동일하게 맞춘다 —
            국가는 행으로 두지 않는다. 국내가 대부분이라 'KR' 한 줄이 늘 자리만 차지하고,
            해외는 이 패널 헤더의 🌐 배지가 이미 알려주기 때문 (카드 계열도 같은 방식). */}
        <Section title="배송지">
          <InfoRow label="수령인" value={send.recipient_name} />
          <InfoRow label="연락처" value={formatPhone(send.recipient_phone)} />
          {/* 주소 표기는 OrderDetailPanel·카드 계열과 동일 — [우편번호] font-mono + 주소 전문.
              우편번호를 별도 행으로 두면 한 줄로 읽히는 주소가 두 줄로 갈라진다. */}
          <InfoRow
            label="주소"
            value={
              <>
                {send.postal_code && (
                  <span className="font-mono mr-1">[{send.postal_code}]</span>
                )}
                {send.recipient_address}
              </>
            }
          />
          <InfoRow label="배송 요청사항" value={send.customer_memo} />
        </Section>

        {/* 같은 배송지 주문 — MONTHLY·VIP 그룹화가 (우편번호, 주소) 만으로 묶기 때문에
            주소가 같으면 다른 고객의 책도 한 박스에 담긴다 (dispatch_grouping_service).
            제목을 '묶인 주문' 이 아니라 '같은 배송지 주문' 으로 둔 이유 — 무엇을 기준으로
            묶였는지가 제목에 드러나야 '왜 남의 주문이 여기 있지' 에 바로 답이 된다.
            행을 누르면 그 주문 상세를 겹쳐 연다 (CustomerDetailPanel 의 주문 행과 동일). */}
        {send.related_orders.length > 0 && (
          <Section title={`같은 배송지 주문 (${send.related_orders.length}건)`}>
            {/* 안내는 2건 이상일 때만 — 1건이면 묶인 게 없어 '묶였습니다' 가 사실과 다르다.
                (실데이터 98.6% 가 1건이라 늘 띄우면 대부분 거짓말이 된다) */}
            {send.related_orders.length > 1 && (
              <p className="text-xs text-gray-400">
                배송지가 같아 이 주문들의 책이 한 박스에 담겼습니다.
              </p>
            )}
            <div className="space-y-2">
              {send.related_orders.map((ro) => (
                /* 껍질은 발송 품목 섹션과 같은 gray-50 단색 — Section 안이라 흰 배경 +
                   테두리 카드(CustomerDetailPanel 의 OrderRow)를 쓰면 테두리가 중첩된다.
                   그쪽은 TabsContent 에 직접 놓여 감싸는 껍질이 없는 경우다.
                   눌리는 행이므로 hover 는 한 단계 진한 gray-100 으로 준다. */
                <button
                  key={ro.order_id}
                  onClick={() => openOrderPanel(ro.order_id)}
                  className="group w-full flex items-center gap-2 text-xs text-gray-900 text-left bg-gray-50 rounded-md px-3 py-2.5 hover:bg-gray-100 transition-colors"
                >
                  {/* 이름·연락처를 앞에 둔다 — #order_id 는 사람이 식별하지 못하는 내부 ID라
                      맨 뒤 보조 자리로 내린다. 둘 다 항상 표시한다.
                      연락처는 sans — 한글 이름과 한 줄에 이어 붙는 자리라 숫자만 고정폭이면
                      글씨체가 튄다. 바로 위 [배송지] 섹션의 연락처도 sans 다.
                      #ID 는 mono 유지 (프로젝트 전체 11곳이 예외 없이 mono). */}
                  <span>{ro.customer_name}</span>
                  <span className="text-gray-300">·</span>
                  <span className="text-gray-500">{formatPhone(ro.customer_phone)}</span>
                  <span className="font-mono text-gray-400 ml-auto">#{ro.order_id}</span>
                  {/* 행 전체가 눌리지만 무엇이 열리는지 글자로 밝힌다 (기존엔 title 툴팁뿐이라
                      hover 해야 알 수 있었다). 표기는 OrderItemCard 의 [구독 상세] 와 동일 규격.
                      button 안이라 span 으로 두고 group-hover 로 링크 피드백을 준다. */}
                  <span className="inline-flex items-center gap-0.5 text-blue-600 group-hover:text-blue-800 group-hover:underline flex-shrink-0">
                    주문 상세
                    <ChevronRight className="h-3.5 w-3.5" />
                  </span>
                </button>
              ))}
            </div>
          </Section>
        )}

        {/* 운송장 — DELIVERED 박스에서만 편집 가능 (PREPARING/CANCELLED 은 read-only).
            값이 하나도 없는 PREPARING 박스에서는 '-' 세 줄이 자리만 차지하므로 감춘다.
            (운송장은 DELIVERED 전환 시점에 채워진다 — PREPARING 은 정의상 항상 비어 있음) */}
        {(hasTracking || editMode) && (
          <Section title="운송장">
            {editMode && canEditTracking ? (
              <>
                <EditRow label="배송 방법">
                  <div className="flex-1">
                    <Select
                      value={editForm.send_method}
                      onValueChange={(v) => {
                        const sm = v as SendMethod;
                        setEditForm((f) => ({
                          ...f,
                          send_method: sm,
                          // 운영자가 운송사를 이미 지정한 상태라면 덮지 않는다
                          courier_company:
                            f.courier_company || SEND_METHOD_TO_COURIER[sm],
                        }));
                        setEditErrors((e) => ({ ...e, send_method: "", courier_company: "" }));
                      }}
                    >
                      <SelectTrigger
                        className={`h-7 text-xs ${editErrors.send_method ? "border-red-500" : ""}`}
                      >
                        <SelectValue placeholder="선택" />
                      </SelectTrigger>
                      <SelectContent>
                        {SEND_METHOD_OPTIONS.map((m) => (
                          <SelectItem key={m.value} value={m.value} className="text-xs">
                            {m.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {editErrors.send_method && (
                      <p className="text-xs text-red-500 mt-1">{editErrors.send_method}</p>
                    )}
                  </div>
                </EditRow>
                <EditRow label="운송사">
                  <div className="flex-1">
                    <Select
                      value={editForm.courier_company}
                      onValueChange={(v) => {
                        setEditForm((f) => ({ ...f, courier_company: v as CourierCompany }));
                        setEditErrors((e) => ({ ...e, courier_company: "" }));
                      }}
                    >
                      <SelectTrigger
                        className={`h-7 text-xs ${editErrors.courier_company ? "border-red-500" : ""}`}
                      >
                        <SelectValue placeholder="선택" />
                      </SelectTrigger>
                      <SelectContent>
                        {COURIER_COMPANY_OPTIONS.map((c) => (
                          <SelectItem key={c.value} value={c.value} className="text-xs">
                            {c.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {editErrors.courier_company && (
                      <p className="text-xs text-red-500 mt-1">{editErrors.courier_company}</p>
                    )}
                  </div>
                </EditRow>
                <EditRow label="송장 번호">
                  <div className="flex-1">
                    <Input
                      className={`h-7 text-xs font-mono ${editErrors.tracking_no ? "border-red-500" : ""}`}
                      placeholder="숫자만 추출되어 저장됨"
                      value={editForm.tracking_no}
                      onChange={(e) => {
                        setEditForm((f) => ({ ...f, tracking_no: e.target.value }));
                        setEditErrors((er) => ({ ...er, tracking_no: "" }));
                      }}
                    />
                    {editErrors.tracking_no && (
                      <p className="text-xs text-red-500 mt-1">{editErrors.tracking_no}</p>
                    )}
                  </div>
                </EditRow>
              </>
            ) : (
              <>
                <InfoRow label="배송 방법" value={send.send_method ?? "-"} />
                <InfoRow label="운송사" value={send.courier_company ?? "-"} />
                <InfoRow
                  label="송장 번호"
                  value={
                    /* 표기·CJ 조회 링크 조건은 DeliveredSendCard 와 공유 (TrackingNoValue 주석 참조) */
                    <TrackingNoValue
                      trackingNo={send.tracking_no}
                      courierCompany={send.courier_company}
                    />
                  }
                />
                {/* 편집 모드인데 입력이 안 나오는 이유를 그 자리에서 밝힌다 */}
                {editMode && (
                  <p className="text-xs text-gray-400">
                    운송장은 배송 완료 상태에서만 수정할 수 있습니다.
                  </p>
                )}
              </>
            )}
          </Section>
        )}

        {/* 재배송 내역 — 입력은 헤더 [재배송 기록] → SendResendModal.
            재배송은 DELIVERED 에서만 가능하므로 그 외 상태에서는 내역이 있을 때만 노출한다
            (PREPARING 에 '재배송 0건' 을 띄워봐야 늘 0건이다).
            백엔드 활동 로그 API 는 created_at DESC 반환이라 그 순서 그대로 표시 (최신부터 위로).
            백엔드 정렬 변경 시 깨짐. */}
        {(send.send_status === "DELIVERED" || resendLogs.length > 0) && (
          <Section title={`재배송 (${resendLogs.length}건)`}>
            {resendLogs.length === 0 ? (
              <p className="text-xs text-gray-400">재배송 내역이 없습니다.</p>
            ) : (
              <div className="space-y-2">
                {resendLogs.map((log) => {
                  const d = log.details ?? {};
                  const resendIds = (Array.isArray(d.send_item_ids) ? d.send_item_ids : []) as number[];
                  const resendItems = resendIds
                    .map((id) => send.items.find((it) => it.send_item_id === id))
                    .filter((it): it is NonNullable<typeof it> => !!it);
                  const isFull =
                    resendItems.length > 0 && resendItems.length === send.items.length;
                  return (
                    <div key={log.log_id} className="border border-orange-100 bg-orange-50/50 rounded p-2 space-y-0.5">
                      <div className="text-xs text-gray-500">{formatDateTime(log.created_at)}</div>
                      {d.reason && <div className="text-xs text-gray-700">사유: {d.reason}</div>}
                      {resendItems.length > 0 && (
                        <div className="text-xs text-gray-700">
                          <div>
                            품목:{" "}
                            {isFull
                              ? `전체 ${resendItems.length}건`
                              : `일부 ${resendItems.length}/${send.items.length}건`}
                          </div>
                          <ul className="ml-4 mt-0.5 space-y-0.5">
                            {resendItems.map((it) => (
                              <li key={it.send_item_id} className="text-gray-700">
                                {it.product_name}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {d.send_method && (
                        <div className="text-xs text-gray-700">
                          방법: {d.send_method}
                          {d.courier_company && <span className="text-gray-400"> · {d.courier_company}</span>}
                        </div>
                      )}
                      {d.tracking_no && (
                        <div className="text-xs text-gray-700 font-mono">운송장: {d.tracking_no}</div>
                      )}
                      {d.memo && <div className="text-xs text-gray-500">메모: {d.memo}</div>}
                    </div>
                  );
                })}
              </div>
            )}
          </Section>
        )}

        {/* 발송 메모(Send.admin_memo) — 상태 무관 편집 가능 (PREPARING/DELIVERED/CANCELLED).
            시스템 바로 앞, 맨 아래에 두는 이유 — 자유 입력 보조 정보라 위 섹션들(무엇을·
            어디로·어떻게 보냈나)의 흐름을 끊지 않아야 한다. 실제로 채워진 Send 도 없다. */}
        <Section title="발송 메모">
          {editMode ? (
            <>
              <textarea
                className="w-full px-3 py-2 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-500"
                rows={3}
                maxLength={MEMO_MAX_LEN}
                placeholder="발송 메모"
                value={editForm.admin_memo}
                onChange={(e) => setEditForm((f) => ({ ...f, admin_memo: e.target.value }))}
                disabled={updateMutation.isPending}
              />
              {/* maxLength 가 초과 입력을 막아주므로 경고 색은 필요 없지만,
                  상한에서 갑자기 안 써지는 이유는 알려줘야 한다 */}
              <span className="text-[11px] text-gray-400">
                {editForm.admin_memo.length} / {MEMO_MAX_LEN}
              </span>
            </>
          ) : (
            <p className="text-sm text-gray-700 whitespace-pre-line">
              {send.admin_memo || <span className="text-gray-400">발송 메모가 없습니다.</span>}
            </p>
          )}
        </Section>

        {/* 시스템 메타 */}
        <Section title="시스템">
          <InfoRow
            label="발송 ID"
            value={<span className="font-mono text-xs text-gray-500">#{send.send_id}</span>}
          />
          <InfoRow label="생성일" value={formatDateTime(send.created_at)} />
          <InfoRow label="수정일" value={formatDateTime(send.updated_at)} />
          {send.delivered_at && (
            <InfoRow label="발송 완료일" value={formatDateTime(send.delivered_at)} />
          )}
          {send.cancelled_at && (
            <InfoRow
              label="취소일"
              value={<span className="text-red-500">{formatDateTime(send.cancelled_at)}</span>}
            />
          )}
        </Section>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* 모달들                                                              */}
      {/* ═══════════════════════════════════════════════════════════════════ */}

      {/* 재배송 내역 기록 */}
      <SendResendModal
        open={resendOpen}
        onClose={() => setResendOpen(false)}
        send={send}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["send-resend-logs", sendId] });
          queryClient.invalidateQueries({ queryKey: ["delivered-resend-logs"] });
          queryClient.invalidateQueries({ queryKey: ["resendLogs"] });
        }}
      />

      {/* 박스 강제 삭제 1차 — 일반 확인 (대상/규모 안내) */}
      <ConfirmModal
        open={deleteStep1Open}
        onClose={() => setDeleteStep1Open(false)}
        onConfirm={() => {
          setDeleteStep1Open(false);
          setDeleteStep2Open(true);
        }}
        title="박스 강제 삭제"
        description={
          <>
            발송 박스 <span className="font-mono">#{send.send_id}</span> 와 발송 품목{" "}
            <strong>{send.items.length}건</strong>이 모두 삭제됩니다.
            <br />주문 자체는 유지됩니다.
          </>
        }
        confirmLabel="계속"
        variant="destructive"
      />

      {/* 박스 강제 삭제 2차 — 비가역성 강조 (최종 확인) */}
      <ConfirmModal
        open={deleteStep2Open}
        onClose={() => setDeleteStep2Open(false)}
        onConfirm={() => deleteMutation.mutate()}
        title="정말 삭제하시겠습니까?"
        description={
          <>
            이 작업은 <strong className="text-red-600">되돌릴 수 없습니다.</strong>
            <br />박스 <span className="font-mono">#{send.send_id}</span> 와 품목{" "}
            <strong>{send.items.length}건</strong>이 영구 삭제됩니다.
          </>
        }
        confirmLabel="영구 삭제"
        variant="destructive"
        isLoading={deleteMutation.isPending}
      />

      {/* 묶인 주문 상세 — 이 패널 위에 겹쳐 연다 */}
      <SlidingPanel open={orderPanelOpen} onClose={closeOrderPanel}>
        {orderPanelId !== null && (
          <OrderDetailPanel orderId={orderPanelId} onClose={closeOrderPanel} />
        )}
      </SlidingPanel>
    </div>
  );
}


// ── 발송 품목 섹션 — SendItem 목록 (읽기 전용) ────────────────────────────────
// 품목마다 상품명 + 발송호 + 수량을 모두 표시한다. 박스 98.2% 가 1품목이라 표 헤더가
// 데이터 한 줄을 설명하는 꼴이 되므로, 표가 아니라 항목 껍질 + 아이콘 지표로 그린다.
// 이 패널을 여는 1순위 목적인 '이 박스에 뭐가 들었나' 만 답한다.
//
// 품목별 admin_memo 인라인 편집은 제거했다 (PUT /send-items/{id} 미사용 상태).
// 메모는 발송 단위로만 다룬다 — '발송 메모' 섹션(Send.admin_memo).

function BoxContentsSection({ send }: { send: SendDetailResponse }) {
  return (
    <Section title={`발송 품목 (${send.items.length}건)`}>
      {send.items.length === 0 ? (
        <p className="text-xs text-gray-400">발송 품목이 없습니다.</p>
      ) : (
        <div className="space-y-2">
          {send.items.map((it) => (
            /* 껍질은 gray-50 단색 — SubscriptionDetailPanel 발송 내역과 같은 이유로
               '흰 배경 + gray-100 테두리 + gray-50 헤더 띠' 카드를 쓰지 않는다.
               그건 Section 이 이미 쓰는 구조라 테두리 안에 같은 테두리,
               회색 띠 안에 회색 띠가 되어 경계가 사라진다. */
            <div key={it.send_item_id} className="bg-gray-50 rounded-md px-3 py-2.5">
              {/* 상품명 왼쪽 · 지표 오른쪽 — 두 줄로 쌓으면 오른쪽 절반이 빈다.
                  OrderItemCard 의 헤더·배송지 행과 같은 justify-between 배치. */}
              <div className="flex items-start justify-between gap-3">
                {/* 상품명이 제목 — 한 박스 안에서 품목을 구별해 주는 값이라 맨 앞에 둔다.
                    잘라내지 않고 흘린다: 상품명이 '1년 정기구독 - 26년 2월호 시작 …' 처럼
                    구독 종류·시작 호로 시작해서 truncate 를 걸면 앞머리만 남고 정작 어떤
                    책인지가 잘려나간다. 이름이 길면 여기서만 줄바꿈되고 지표는 첫 줄에 남는다. */}
                <div className="text-xs text-gray-900 flex-1 min-w-0">{it.product_name}</div>
                {/* 지표 표기는 주문 상세 [품목] 탭의 품목 카드와 동일 규격 —
                    아이콘(h-3.5 gray-400) + text-xs, 박스 없음.
                    flex-shrink-0 — 상품명에 밀려 발송호·수량이 쪼개지지 않게 한다. */}
                <div className="flex items-center gap-x-4 text-xs text-gray-900 flex-shrink-0">
                  <span className="inline-flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-gray-400" />
                    {formatIssue(it.issue)}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <BookOpen className="h-3.5 w-3.5 text-gray-400" />
                    {it.send_num}권
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}

// 섹션 컴포넌트
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border border-gray-100 rounded-lg overflow-hidden">
      <div className="px-3.5 py-2 bg-gray-50 border-b border-gray-100">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{title}</h3>
      </div>
      <div className="px-3.5 py-3 space-y-2.5">{children}</div>
    </div>
  );
}

// 정보 행 컴포넌트 — 값이 없으면 렌더하지 않는다 (다른 도메인 패널과 동일).
// '-' 를 보여야 하는 자리는 호출부에서 ?? "-" 로 채워 넘긴다.
function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  if (!value && value !== 0) return null;
  return (
    <div className="flex items-start gap-3">
      <span className="text-xs text-gray-400 w-24 flex-shrink-0 pt-0.5">{label}</span>
      <span className="text-sm text-gray-700 flex-1 whitespace-pre-line">{value}</span>
    </div>
  );
}

// 편집 행 — 라벨 폭은 Row 와 같게 맞춰 읽기 모드 ↔ 편집 모드 전환 시 값이 흔들리지 않게 한다.
// items-start 인 이유: 에러 메시지가 인풋 아래 붙어 행 높이가 늘어나기 때문 (다른 패널은 items-center).
function EditRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="text-xs text-gray-400 w-24 flex-shrink-0 pt-1.5">{label}</span>
      {children}
    </div>
  );
}
