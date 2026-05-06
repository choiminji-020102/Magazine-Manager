import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { SlidingPanel } from "@/components/common/SlidingPanel";
import { StatusBadge } from "@/components/common/StatusBadge";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
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
  SendDetailResponse,
} from "@/types/send";

interface Props {
  open: boolean;
  onClose: () => void;
  sendId: number | null;
}

// 발송 박스 단위 상세 패널.
// PreparingSendListPage / DeliveredSendListPage 의 행 클릭 시 열림.
// 박스 안 SendItem 책 종류 확인용 (#11 약점 보강) + 재배송 이력 노출.
// 향후 PR6.5.5 에서 [재배송 입력] 섹션 추가 예정.

export default function SendDetailPanel({ open, onClose, sendId }: Props) {
  const queryClient = useQueryClient();
  const { data: sendData, isLoading } = useQuery({
    queryKey: ["send-detail", sendId],
    queryFn: () => sendsApi.getSend(sendId!).then((r) => r.data.data!),
    enabled: open && sendId !== null,
  });

  const { data: resendLogs = [] } = useQuery({
    queryKey: ["send-resend-logs", sendId],
    queryFn: () =>
      activityLogsApi
        .getActivityLogs({
          page: 1,
          limit: 50,
          target_type: "SEND",
          target_id: sendId!,
          action: "RESEND",
        })
        .then((r) => r.data.items ?? []),
    enabled: open && sendId !== null,
  });

  const send = sendData;

  return (
    <SlidingPanel
      open={open}
      onClose={onClose}
      title={send ? `발송 #${send.send_id}` : "발송 상세"}
      width={520}
    >
      {isLoading || !send ? (
        <div className="flex items-center justify-center py-16">
          <LoadingSpinner size="lg" />
        </div>
      ) : (
        <div className="p-4 space-y-5 text-sm">
          {/* 상태 + ID */}
          <div className="flex items-center gap-2">
            <StatusBadge type="send_status" value={send.send_status} />
            <span className="font-mono text-xs text-gray-400">#{send.send_id}</span>
          </div>

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
            {send.customer_memo && <Row label="배송메모">{send.customer_memo}</Row>}
            {send.admin_memo && <Row label="관리자메모">{send.admin_memo}</Row>}
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

          {/* 운송장 */}
          <Section title="운송장">
            <Row label="배송 방법">{send.send_method ?? "-"}</Row>
            <Row label="운송사">{send.courier_company ?? "-"}</Row>
            <Row label="송장 번호">
              <span className="font-mono">{send.tracking_no ?? "-"}</span>
            </Row>
          </Section>

          {/* 박스 안 SendItem 목록 — #11 약점 보강 */}
          <Section title={`박스 내용 (${send.items.length}건)`}>
            {send.items.length === 0 ? (
              <p className="text-xs text-gray-400">발송 품목이 없습니다.</p>
            ) : (
              <table className="w-full text-xs">
                <thead className="text-gray-400 border-b border-gray-100">
                  <tr>
                    <th className="text-left py-1 pr-2 font-normal">상품코드</th>
                    <th className="text-left py-1 pr-2 font-normal">발송호</th>
                    <th className="text-right py-1 font-normal">수량</th>
                  </tr>
                </thead>
                <tbody>
                  {send.items.map((it) => (
                    <tr key={it.send_item_id} className="border-b border-gray-50">
                      <td className="py-1 pr-2 font-mono text-gray-700">{it.product_code}</td>
                      <td className="py-1 pr-2 text-gray-600">{formatIssue(it.issue)}</td>
                      <td className="py-1 text-right font-semibold text-gray-700">{it.send_num}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Section>

          {/* 재배송 이력 */}
          <Section title={`재배송 이력 (${resendLogs.length}건)`}>
            {resendLogs.length === 0 ? (
              <p className="text-xs text-gray-400">재배송 이력이 없습니다.</p>
            ) : (
              <div className="space-y-2">
                {resendLogs.map((log) => {
                  const d = log.details ?? {};
                  return (
                    <div key={log.log_id} className="border border-orange-100 bg-orange-50/50 rounded p-2 space-y-0.5">
                      <div className="text-xs text-gray-500">{formatDateTime(log.created_at)}</div>
                      {d.reason && <div className="text-xs text-gray-700">사유: {d.reason}</div>}
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

          {/* 재배송 입력 — DELIVERED 박스만 노출.
              key={send.send_id} 로 박스 바뀔 때 ResendInputSection 의 toggle/입력 state 초기화. */}
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

          {/* 시스템 메타 */}
          <Section title="시스템">
            <Row label="생성">{formatDateTime(send.created_at)}</Row>
            <Row label="수정">{formatDateTime(send.updated_at)}</Row>
            {send.delivered_at && <Row label="배송완료">{formatDateTime(send.delivered_at)}</Row>}
            {send.cancelled_at && <Row label="취소">{formatDateTime(send.cancelled_at)}</Row>}
          </Section>
        </div>
      )}
    </SlidingPanel>
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

  const allItemIds = useMemo(() => send.items.map((it) => it.send_item_id), [send.items]);

  // 폼 열릴 때 초기화 (모두 선택)
  useEffect(() => {
    if (open) {
      setSelectedItemIds(new Set(allItemIds));
    }
  }, [open, allItemIds]);

  const mutation = useMutation({
    mutationFn: () =>
      sendsApi
        .resendSend(send.send_id, {
          reason: reason.trim(),
          send_method: sendMethod as SendMethod,
          courier_company: courier as CourierCompany,
          send_item_ids: Array.from(selectedItemIds),
          tracking_no: trackingNo.trim() || null,
          memo: memo.trim() || null,
        })
        .then((r) => r.data),
    onSuccess: (res) => {
      toast.success(res.message ?? "재배송 이력이 기록되었습니다.");
      // 폼 초기화
      setOpen(false);
      setReason("");
      setSendMethod("");
      setCourier("");
      setTrackingNo("");
      setMemo("");
      onSuccess();
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const handleSubmit = () => {
    if (!reason.trim()) {
      toast.error("재배송 사유를 입력해주세요.");
      return;
    }
    if (!sendMethod) {
      toast.error("배송 방법을 선택해주세요.");
      return;
    }
    if (!courier) {
      toast.error("운송사를 선택해주세요.");
      return;
    }
    if (selectedItemIds.size === 0) {
      toast.error("재배송할 품목을 1개 이상 선택해주세요.");
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
  };

  if (!open) {
    return (
      <Section title="재배송">
        <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
          + 재배송 이력 추가
        </Button>
      </Section>
    );
  }

  return (
    <Section title="재배송 입력">
      <div className="space-y-3 border border-gray-200 rounded p-3 bg-gray-50/50">
        {/* 사유 */}
        <div>
          <Label className="text-xs text-gray-600">
            사유 <span className="text-red-500 ml-0.5">*</span>
          </Label>
          <Select value={reason} onValueChange={setReason}>
            <SelectTrigger className="mt-1 h-8 text-xs">
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
            className="mt-1 h-8 text-xs"
            placeholder="또는 직접 입력 (덮어쓰기)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>

        {/* 배송 방법 / 운송사 */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs text-gray-600">
              배송 방법 <span className="text-red-500 ml-0.5">*</span>
            </Label>
            <Select
              value={sendMethod}
              onValueChange={(v) => {
                const sm = v as SendMethod;
                setSendMethod(sm);
                const derived = SEND_METHOD_TO_COURIER[sm] as CourierCompany | undefined;
                if (derived && !courier) setCourier(derived);
              }}
            >
              <SelectTrigger className="mt-1 h-8 text-xs">
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
          </div>
          <div>
            <Label className="text-xs text-gray-600">
              운송사 <span className="text-red-500 ml-0.5">*</span>
            </Label>
            <Select value={courier} onValueChange={(v) => setCourier(v as CourierCompany)}>
              <SelectTrigger className="mt-1 h-8 text-xs">
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
          </div>
        </div>

        {/* 송장 / 메모 */}
        <div>
          <Label className="text-xs text-gray-600">송장 번호 (선택)</Label>
          <Input
            className="mt-1 h-8 text-xs font-mono"
            placeholder="숫자만 추출되어 저장됨"
            value={trackingNo}
            onChange={(e) => setTrackingNo(e.target.value)}
          />
        </div>
        <div>
          <Label className="text-xs text-gray-600">메모 (선택)</Label>
          <textarea
            className="mt-1 w-full px-3 py-2 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            rows={2}
            placeholder="추가 안내"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
          />
        </div>

        {/* SendItem 다중 선택 */}
        <div>
          <Label className="text-xs text-gray-600">
            재배송 품목 <span className="text-red-500 ml-0.5">*</span> ({selectedItemIds.size}/{send.items.length})
          </Label>
          <div className="mt-1 border border-gray-200 rounded divide-y divide-gray-100">
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
    </Section>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-1.5">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{title}</h3>
      <div>{children}</div>
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 text-xs">
      <span className="text-gray-400 w-20 shrink-0">{label}</span>
      <span className="text-gray-700">{children}</span>
    </div>
  );
}
