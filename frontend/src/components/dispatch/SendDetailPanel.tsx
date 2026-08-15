import { Fragment, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Edit2, X } from "lucide-react";
import { StatusBadge } from "@/components/common/StatusBadge";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { ConfirmModal } from "@/components/common/ConfirmModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { sendsApi } from "@/api/sendsApi";
import { sendItemsApi } from "@/api/sendItemsApi";
import { activityLogsApi } from "@/api/activityLogsApi";
import { formatDateTime, formatPhone, formatIssue } from "@/utils/format";
import { toast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/utils/errorHandler";
import {
  SEND_METHOD_OPTIONS,
  COURIER_COMPANY_OPTIONS,
  SEND_METHOD_TO_COURIER,
  RESEND_REASON_OPTIONS,
} from "@/utils/constants";
import type {
  SendMethod,
  CourierCompany,
  SendTrackingUpdate,
  SendDetailResponse,
} from "@/types/send";

// Send.admin_memo / SendItem.admin_memo 공통 길이 상한
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

  // 편집 모드 — 다른 도메인 패널과 동일하게 토글 하나로 본문 전체를 전환한다.
  // 발송 메모(상태 무관)와 운송장 3필드(DELIVERED 만)를 한 번에 다루고,
  // 저장 시 실제로 바뀐 쪽의 API 만 호출한다.
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState(EMPTY_EDIT_FORM);
  // 필드별 에러 메시지 (UI_GUIDE §10 3종 세트: border-red + 메시지 + toast)
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});

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

  const memoDirty = !!send && editForm.admin_memo.trim() !== (send.admin_memo ?? "").trim();
  const trackingDirty =
    !!send &&
    canEditTracking &&
    (editForm.tracking_no.trim() !== (send.tracking_no ?? "") ||
      editForm.send_method !== ((send.send_method as SendMethod | null) ?? "") ||
      editForm.courier_company !== ((send.courier_company as CourierCompany | null) ?? ""));

  const updateMutation = useMutation({
    // 바뀐 쪽만 호출한다 — 엔드포인트가 admin-memo / tracking 으로 나뉘어 있고
    // 운송장 API 는 DELIVERED 전용이라 무조건 호출하면 PREPARING 에서 400 이 난다.
    // 두 요청은 순차 실행 — 앞이 실패하면 뒤는 보내지 않는다 (부분 반영 최소화).
    mutationFn: async () => {
      const messages: string[] = [];
      if (memoDirty) {
        const res = await sendsApi.updateAdminMemo(sendId, {
          admin_memo: editForm.admin_memo.trim() || null,
        });
        messages.push(res.data.message);
      }
      if (trackingDirty && send) {
        // 실제로 바뀐 필드만 담는다. 백엔드 crud 는 None 인 필드를 건너뛰므로
        // 안 바뀐 필드를 굳이 실어 보낼 이유가 없다 (셋 다 없으면 422).
        const payload: SendTrackingUpdate = {};
        if (editForm.tracking_no.trim() !== (send.tracking_no ?? "")) {
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
      }
      return messages;
    },
    onSuccess: (messages) => {
      toast.success(messages.join(" ") || "수정되었습니다.");
      setEditMode(false);
      setEditErrors({});
      queryClient.invalidateQueries({ queryKey: ["send-detail", sendId] });
      queryClient.invalidateQueries({ queryKey: ["preparing-sends"] });
      queryClient.invalidateQueries({ queryKey: ["delivered-sends"] });
      // SubscriptionDetailPanel 의 발송 내역 query — orderItemId 무관 prefix 무효화
      queryClient.invalidateQueries({ queryKey: ["order-item-sends"] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
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
      onClose();
      queryClient.invalidateQueries({ queryKey: ["preparing-sends"] });
      queryClient.invalidateQueries({ queryKey: ["paid-not-prepared-count"] });
      queryClient.invalidateQueries({ queryKey: ["send-detail", sendId] });
      queryClient.invalidateQueries({ queryKey: ["order-item-sends"] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner />
      </div>
    );
  }

  if (!send) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-gray-400">
        발송 정보를 불러올 수 없습니다.
      </div>
    );
  }

  const isOverseas = send.country_code !== "KR";

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
      <div className="flex-1 overflow-y-auto p-4 space-y-3 text-sm">
        {/* 수령인 / 주소 */}
        <Section title="수령인">
          <Row label="이름">{send.recipient_name}</Row>
          <Row label="연락처">{formatPhone(send.recipient_phone)}</Row>
          <Row label="국가">
            {send.country_code === "KR" ? (
              <span>대한민국 (KR)</span>
            ) : (
              <span className="px-1 py-0.5 bg-amber-100 text-amber-700 rounded text-xs font-semibold">
                🌐 {send.country_code}
              </span>
            )}
          </Row>
          <Row label="우편번호">
            <span className="font-mono">{send.postal_code}</span>
          </Row>
          <Row label="주소">{send.recipient_address}</Row>
          {send.customer_memo && <Row label="배송 요청사항">{send.customer_memo}</Row>}
        </Section>

        {/* 발송 메모(Send.admin_memo) — 상태 무관 편집 가능 (PREPARING/DELIVERED/CANCELLED) */}
        <Section title="발송 메모">
          {editMode ? (
            <>
              <textarea
                className={`w-full px-3 py-2 text-xs border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-500 ${
                  editForm.admin_memo.length > MEMO_MAX_LEN ? "border-red-500" : "border-gray-300"
                }`}
                rows={3}
                maxLength={MEMO_MAX_LEN}
                placeholder="발송 메모"
                value={editForm.admin_memo}
                onChange={(e) => setEditForm((f) => ({ ...f, admin_memo: e.target.value }))}
                disabled={updateMutation.isPending}
              />
              <span
                className={`text-[11px] ${
                  editForm.admin_memo.length > MEMO_MAX_LEN ? "text-red-500" : "text-gray-400"
                }`}
              >
                {editForm.admin_memo.length} / {MEMO_MAX_LEN}
              </span>
            </>
          ) : (
            <p className="text-sm text-gray-700 whitespace-pre-line">
              {send.admin_memo || <span className="text-gray-400">발송 메모가 없습니다.</span>}
            </p>
          )}
        </Section>

        {/* 묶인 주문 */}
        {send.related_orders.length > 0 && (
          <Section title="묶인 주문">
            <div className="space-y-1">
              {send.related_orders.map((ro) => (
                <div key={ro.order_id} className="text-xs text-gray-700 flex items-center gap-2">
                  <span className="font-mono text-gray-400">#{ro.order_id}</span>
                  <span>·</span>
                  <span>{ro.customer_name}</span>
                  <span>·</span>
                  <span className="font-mono text-gray-500">{formatPhone(ro.customer_phone)}</span>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* 운송장 — DELIVERED 박스에서만 편집 가능 (PREPARING/CANCELLED 은 read-only) */}
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
                          f.courier_company ||
                          ((SEND_METHOD_TO_COURIER[sm] as CourierCompany | undefined) ?? ""),
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
              <Row label="배송 방법">{send.send_method ?? "-"}</Row>
              <Row label="운송사">{send.courier_company ?? "-"}</Row>
              <Row label="송장 번호">
                {/* font-mono 는 값이 있을 때만 — 숫자 자릿수를 맞춰 읽기 쉬우라고 쓰는 것이라
                    빈 값 '-' 에까지 씌우면 모노스페이스 고정폭 때문에 하이픈만 길어 보인다. */}
                {send.tracking_no ? <span className="font-mono">{send.tracking_no}</span> : "-"}
              </Row>
              {/* 편집 모드인데 입력이 안 나오는 이유를 그 자리에서 밝힌다 */}
              {editMode && (
                <p className="text-xs text-gray-400">
                  운송장은 배송 완료 상태에서만 수정할 수 있습니다.
                </p>
              )}
            </>
          )}
        </Section>

        {/* 박스 안 SendItem 목록 — 각 품목 admin_memo 인라인 편집 */}
        <BoxContentsSection
          key={`box-${send.send_id}`}
          send={send}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ["send-detail", sendId] });
            queryClient.invalidateQueries({ queryKey: ["preparing-sends"] });
            queryClient.invalidateQueries({ queryKey: ["delivered-sends"] });
            queryClient.invalidateQueries({ queryKey: ["order-item-sends"] });
          }}
        />

        {/* 재배송 — 입력(추가 버튼/폼)과 내역 리스트를 한 섹션에 통합.
            DELIVERED 박스만 입력 가능(ResendInputSection 내부 조건 아님 — 부모에서 분기).
            내역은 PREPARING 박스에서도 표시될 수 있으나 정의상 항상 0건.
            백엔드 활동 로그 API 는 created_at DESC 반환이라 그 순서 그대로 표시 (최신부터 위로).
            백엔드 정렬 변경 시 깨짐. */}
        <Section title={`재배송 (${resendLogs.length}건)`}>
          {/* 입력 — DELIVERED 만. key 로 박스 바뀔 때 toggle/입력 state 초기화. */}
          {send.send_status === "DELIVERED" && (
            <ResendInputSection
              key={send.send_id}
              send={send}
              onSuccess={() => {
                queryClient.invalidateQueries({ queryKey: ["send-resend-logs", sendId] });
                queryClient.invalidateQueries({ queryKey: ["delivered-resend-logs"] });
                queryClient.invalidateQueries({ queryKey: ["resendLogs"] });
              }}
            />
          )}
          {/* 내역 리스트 */}
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
                            <li key={it.send_item_id}>
                              <span className="font-mono text-gray-500">{it.product_code}</span>{" "}
                              <span className="text-gray-700">{it.product_name}</span>
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

        {/* 시스템 메타 */}
        <Section title="시스템">
          <Row label="생성일">{formatDateTime(send.created_at)}</Row>
          <Row label="수정일">{formatDateTime(send.updated_at)}</Row>
          {send.delivered_at && <Row label="발송 완료일">{formatDateTime(send.delivered_at)}</Row>}
        </Section>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* 모달들                                                              */}
      {/* ═══════════════════════════════════════════════════════════════════ */}

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
    </div>
  );
}


// ── 박스 내용 섹션 — SendItem 목록 + 품목별 admin_memo 인라인 편집 ───────────
// 상품 셀에 product_code + product_name inline (SendItemBox 와 동일 톤).
// admin_memo 는 truthy 시 메모 텍스트 클릭으로 편집 진입, falsy 시 "+ 메모 추가" 버튼.
// 한 번에 하나의 SendItem 만 편집 가능 (editingItemId 단일 state).

interface BoxContentsSectionProps {
  send: SendDetailResponse;
  onSuccess: () => void;
}

function BoxContentsSection({ send, onSuccess }: BoxContentsSectionProps) {
  const [editingItemId, setEditingItemId] = useState<number | null>(null);
  const [memoDraft, setMemoDraft] = useState("");

  const MAX_LEN = 1000;
  const overLimit = memoDraft.length > MAX_LEN;

  const mutation = useMutation({
    mutationFn: ({ id, memo }: { id: number; memo: string | null }) =>
      sendItemsApi.updateSendItem(id, { admin_memo: memo }).then((r) => r.data),
    onSuccess: (res) => {
      toast.success(res.message ?? "품목 메모가 수정되었습니다.");
      setEditingItemId(null);
      onSuccess();
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const startEdit = (itemId: number, current: string | null) => {
    setEditingItemId(itemId);
    setMemoDraft(current ?? "");
  };

  const cancelEdit = () => {
    setEditingItemId(null);
    setMemoDraft("");
  };

  const saveEdit = (itemId: number) => {
    if (overLimit) return;
    mutation.mutate({ id: itemId, memo: memoDraft.trim() || null });
  };

  return (
    <Section title={`박스 내용 (${send.items.length}건)`}>
      {send.items.length === 0 ? (
        <p className="text-xs text-gray-400">발송 품목이 없습니다.</p>
      ) : (
        <table className="w-full text-xs">
          <thead className="text-gray-400 border-b border-gray-100">
            <tr>
              <th className="text-left py-1 pr-2 font-normal">상품</th>
              <th className="text-left py-1 pr-2 font-normal">발송호</th>
              <th className="text-right py-1 font-normal">수량</th>
            </tr>
          </thead>
          <tbody>
            {send.items.map((it) => {
              const isEditing = editingItemId === it.send_item_id;
              // 편집 모드에서만 의미 있음 — 변경 없는 저장으로 인한 불필요 API 호출 방지
              // (AdminMemoSection 의 dirty 패턴과 동일).
              const isDirty =
                isEditing && memoDraft.trim() !== (it.admin_memo ?? "").trim();
              return (
                <Fragment key={it.send_item_id}>
                  {/* 데이터 행 — 상품 / 발송호 / 수량.
                      편집 모드일 땐 메모 표시 줄을 숨기고(아래 별도 tr 의 textarea 가 대체),
                      table border 도 다음 tr 로 미룬다 (편집 행과 데이터 행 사이엔 구분선 없음). */}
                  <tr className={isEditing ? "align-top" : "border-b border-gray-50 align-top"}>
                    <td className="py-1 pr-2">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-gray-700">{it.product_code}</span>
                        <span className="text-gray-500 truncate">{it.product_name}</span>
                      </div>
                      {!isEditing && (
                        it.admin_memo ? (
                          <button
                            onClick={() => startEdit(it.send_item_id, it.admin_memo)}
                            disabled={mutation.isPending}
                            className="block w-full text-left text-[11px] text-gray-500 truncate hover:bg-gray-50 rounded px-1 -mx-1 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
                            title={`${it.admin_memo}\n(클릭하여 편집)`}
                          >
                            📝 {it.admin_memo}
                          </button>
                        ) : (
                          <button
                            onClick={() => startEdit(it.send_item_id, null)}
                            disabled={mutation.isPending}
                            className="text-[11px] text-gray-400 hover:text-blue-500 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:text-gray-400"
                          >
                            + 메모 추가
                          </button>
                        )
                      )}
                    </td>
                    <td className="py-1 pr-2 text-gray-600">{formatIssue(it.issue)}</td>
                    <td className="py-1 text-right font-semibold text-gray-700">{it.send_num}</td>
                  </tr>
                  {/* 편집 행 — 전체 폭(colSpan=3) textarea. 데이터 행 바로 아래에 펼쳐짐. */}
                  {isEditing && (
                    <tr className="border-b border-gray-50">
                      <td colSpan={3} className="pt-1 pb-2">
                        <div className="space-y-1">
                          <textarea
                            className={`w-full px-2 py-1 text-[11px] border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-500 ${
                              overLimit ? "border-red-500" : "border-gray-300"
                            }`}
                            rows={2}
                            maxLength={MAX_LEN}
                            placeholder="품목 메모"
                            value={memoDraft}
                            onChange={(e) => setMemoDraft(e.target.value)}
                            disabled={mutation.isPending}
                            autoFocus
                          />
                          <div className="flex items-center justify-between">
                            <span className={`text-[10px] ${overLimit ? "text-red-500" : "text-gray-400"}`}>
                              {memoDraft.length} / {MAX_LEN}
                            </span>
                            <div className="flex items-center gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={cancelEdit}
                                disabled={mutation.isPending}
                              >
                                취소
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => saveEdit(it.send_item_id)}
                                disabled={!isDirty || mutation.isPending || overLimit}
                              >
                                {mutation.isPending && <LoadingSpinner size="sm" className="mr-1" />}
                                저장
                              </Button>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      )}
    </Section>
  );
}


// ── 재배송 입력 섹션 ──────────────────────────────────────────────────────────
// DELIVERED 박스에만 노출. 토글로 폼 펼침. 박스 안 SendItem 다중 선택 (기본 모두).

interface ResendInputSectionProps {
  send: SendDetailResponse;
  onSuccess: () => void;
}

function ResendInputSection({ send, onSuccess }: ResendInputSectionProps) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [sendMethod, setSendMethod] = useState<SendMethod | "">("");
  const [courier, setCourier] = useState<CourierCompany | "">("");
  const [trackingNo, setTrackingNo] = useState("");
  const [memo, setMemo] = useState("");
  // SendItem 다중 선택 — 기본 모두 선택 (박스 통째 재발송이 기본 시나리오)
  const [selectedItemIds, setSelectedItemIds] = useState<Set<number>>(new Set());
  // 필수 필드 에러 (UI_GUIDE §10 3종 세트: border-red + 메시지 + toast)
  const [reasonError, setReasonError] = useState(false);
  const [sendMethodError, setSendMethodError] = useState(false);
  const [courierError, setCourierError] = useState(false);
  const [itemsError, setItemsError] = useState(false);

  const allItemIds = useMemo(() => send.items.map((it) => it.send_item_id), [send.items]);

  // 폼 열릴 때 초기화 (모두 선택)
  useEffect(() => {
    if (open) {
      setSelectedItemIds(new Set(allItemIds));
    }
  }, [open, allItemIds]);

  // 폼 닫힐 때 에러 상태 초기화 — 다시 열었을 때 이전 빨간 상태 잔존 방지.
  // onSuccess 경로 외에 취소 버튼 / 외부 트리거로 닫는 경우도 포함.
  useEffect(() => {
    if (!open) {
      setReasonError(false);
      setSendMethodError(false);
      setCourierError(false);
      setItemsError(false);
    }
  }, [open]);

  const mutation = useMutation({
    mutationFn: () =>
      sendsApi
        .resendSend(send.send_id, {
          reason: reason.trim(),
          send_method: sendMethod as SendMethod,
          courier_company: courier as CourierCompany,
          send_item_ids: Array.from(selectedItemIds),
          tracking_no: trackingNo.trim(),
          memo: memo.trim() || null,
        })
        .then((r) => r.data),
    onSuccess: (res) => {
      toast.success(res.message ?? "재배송 내역이 기록되었습니다.");
      // 폼 초기화
      setOpen(false);
      setReason("");
      setSendMethod("");
      setCourier("");
      setTrackingNo("");
      setMemo("");
      setReasonError(false);
      setSendMethodError(false);
      setCourierError(false);
      setItemsError(false);
      onSuccess();
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const handleSubmit = () => {
    // 모든 필수 누락을 한 번에 표시 (재제출 강요 방지). toast 는 첫 누락만.
    let firstError: string | null = null;
    if (!reason.trim()) {
      setReasonError(true);
      if (!firstError) firstError = "재배송 사유를 입력해주세요.";
    }
    if (!sendMethod) {
      setSendMethodError(true);
      if (!firstError) firstError = "배송 방법을 선택해주세요.";
    }
    if (!courier) {
      setCourierError(true);
      if (!firstError) firstError = "운송사를 선택해주세요.";
    }
    if (selectedItemIds.size === 0) {
      setItemsError(true);
      if (!firstError) firstError = "재배송할 품목을 1개 이상 선택해주세요.";
    }
    if (firstError) {
      toast.error(firstError);
      return;
    }
    mutation.mutate();
  };

  const toggleItem = (id: number, checked: boolean) => {
    setSelectedItemIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
    // 사용자 상호작용 시 즉시 에러 해제 (다음 submit 에서 재검증)
    setItemsError(false);
  };

  if (!open) {
    // 부모 Section "재배송" 안에서 렌더 — 자체 wrapper 없이 버튼만
    return (
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        + 재배송 내역 추가
      </Button>
    );
  }

  // 토글 ON — 별도 파란 박스 (다른 도메인 패널의 편집 폼과 동일한 톤)
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3.5 space-y-3">
      <div className="text-xs font-semibold text-blue-700">재배송 입력</div>
      {/* 사유 */}
      <div>
        <Label className={`text-xs ${reasonError ? "text-red-500" : "text-gray-600"}`}>
          사유 <span className="text-red-500 ml-0.5">*</span>
        </Label>
        <Select value={reason} onValueChange={(v) => { setReason(v); setReasonError(false); }}>
          <SelectTrigger className={`mt-1 h-8 text-xs bg-white ${reasonError ? "border-red-500 focus:ring-red-500" : ""}`}>
            <SelectValue placeholder="선택 또는 직접 입력" />
          </SelectTrigger>
          <SelectContent>
            {RESEND_REASON_OPTIONS.map((r) => (
              <SelectItem key={r.value} value={r.value} className="text-xs">
                {r.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          className={`mt-1 h-8 text-xs bg-white ${reasonError ? "border-red-500 focus:ring-red-500" : ""}`}
          placeholder="또는 직접 입력 (덮어쓰기)"
          value={reason}
          onChange={(e) => { setReason(e.target.value); setReasonError(false); }}
        />
        {reasonError && <p className="text-xs text-red-500 mt-1">재배송 사유를 입력해주세요.</p>}
      </div>

      {/* 배송 방법 / 운송사 */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className={`text-xs ${sendMethodError ? "text-red-500" : "text-gray-600"}`}>
            배송 방법 <span className="text-red-500 ml-0.5">*</span>
          </Label>
          <Select
            value={sendMethod}
            onValueChange={(v) => {
              const sm = v as SendMethod;
              setSendMethod(sm);
              setSendMethodError(false);
              const derived = SEND_METHOD_TO_COURIER[sm] as CourierCompany | undefined;
              if (derived && !courier) {
                setCourier(derived);
                setCourierError(false);
              }
            }}
          >
            <SelectTrigger className={`mt-1 h-8 text-xs bg-white ${sendMethodError ? "border-red-500 focus:ring-red-500" : ""}`}>
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
          {sendMethodError && <p className="text-xs text-red-500 mt-1">배송 방법을 선택해주세요.</p>}
        </div>
        <div>
          <Label className={`text-xs ${courierError ? "text-red-500" : "text-gray-600"}`}>
            운송사 <span className="text-red-500 ml-0.5">*</span>
          </Label>
          <Select value={courier} onValueChange={(v) => { setCourier(v as CourierCompany); setCourierError(false); }}>
            <SelectTrigger className={`mt-1 h-8 text-xs bg-white ${courierError ? "border-red-500 focus:ring-red-500" : ""}`}>
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
          {courierError && <p className="text-xs text-red-500 mt-1">운송사를 선택해주세요.</p>}
        </div>
      </div>

      {/* 송장 / 메모 */}
      <div>
        <Label className="text-xs text-gray-600">송장 번호 (선택)</Label>
        <Input
          className="mt-1 h-8 text-xs font-mono bg-white"
          placeholder="숫자만 추출되어 저장됨"
          value={trackingNo}
          onChange={(e) => setTrackingNo(e.target.value)}
        />
      </div>
      <div>
        <Label className="text-xs text-gray-600">메모 (선택)</Label>
        <textarea
          className="mt-1 w-full px-3 py-2 text-xs border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          rows={2}
          placeholder="추가 안내"
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
        />
      </div>

      {/* SendItem 다중 선택 */}
      <div>
        <Label className={`text-xs ${itemsError ? "text-red-500" : "text-gray-600"}`}>
          재배송 품목 <span className="text-red-500 ml-0.5">*</span> ({selectedItemIds.size}/{send.items.length})
        </Label>
        <div className={`mt-1 border rounded divide-y divide-gray-100 bg-white ${itemsError ? "border-red-500" : "border-gray-200"}`}>
          {send.items.map((it) => (
            <label
              key={it.send_item_id}
              className="flex items-center gap-2 px-2 py-1.5 text-xs cursor-pointer hover:bg-gray-50"
            >
              <Checkbox
                checked={selectedItemIds.has(it.send_item_id)}
                onCheckedChange={(c) => toggleItem(it.send_item_id, c === true)}
              />
              <span className="font-mono text-gray-600">{it.product_code}</span>
              <span className="text-gray-400">·</span>
              <span className="text-gray-600">{formatIssue(it.issue)}</span>
              <span className="text-gray-400 ml-auto">× {it.send_num}</span>
            </label>
          ))}
        </div>
        {itemsError && <p className="text-xs text-red-500 mt-1">재배송할 품목을 1개 이상 선택해주세요.</p>}
      </div>

      {/* 액션 */}
      <div className="flex justify-end gap-2 pt-1">
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setOpen(false)}
          disabled={mutation.isPending}
        >
          취소
        </Button>
        <Button size="sm" onClick={handleSubmit} disabled={mutation.isPending}>
          {mutation.isPending && <LoadingSpinner size="sm" className="mr-1" />}
          기록 저장
        </Button>
      </div>
    </div>
  );
}

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

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="text-xs text-gray-400 w-24 flex-shrink-0 pt-0.5">{label}</span>
      <span className="text-sm text-gray-700 flex-1">{children}</span>
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
