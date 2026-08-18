import { useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { sendsApi } from "@/api/sendsApi";
import { toast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/utils/errorHandler";
import { formatIssue, formatPhone } from "@/utils/format";
import {
  SEND_METHOD_OPTIONS,
  COURIER_COMPANY_OPTIONS,
  SEND_METHOD_TO_COURIER,
  RESEND_REASON_OPTIONS,
} from "@/utils/constants";
import type { SendMethod, CourierCompany, SendDetailResponse } from "@/types/send";

interface Props {
  open: boolean;
  onClose: () => void;
  send: SendDetailResponse;
  onSuccess: () => void;
}

// 재배송 내역 기록 모달 — DELIVERED 박스에서만 진입 가능 (호출부에서 분기).
// Send 본체는 바뀌지 않는다. 활동 로그(action=RESEND) 에만 기록되는 사후 입력 흐름.
// 박스 안 SendItem 다중 선택 (기본 모두 — 박스 통째 재발송이 기본 시나리오).

export function SendResendModal({ open, onClose, send, onSuccess }: Props) {
  const [reason, setReason] = useState("");
  const [sendMethod, setSendMethod] = useState<SendMethod | "">("");
  const [courier, setCourier] = useState<CourierCompany | "">("");
  const [trackingNo, setTrackingNo] = useState("");
  const [memo, setMemo] = useState("");
  const [selectedItemIds, setSelectedItemIds] = useState<Set<number>>(new Set());
  // 필수 필드 에러 (UI_GUIDE §10 3종 세트: border-red + 메시지 + toast)
  const [reasonError, setReasonError] = useState(false);
  const [sendMethodError, setSendMethodError] = useState(false);
  const [courierError, setCourierError] = useState(false);
  const [trackingError, setTrackingError] = useState(false);
  const [itemsError, setItemsError] = useState(false);

  const allItemIds = useMemo(() => send.items.map((it) => it.send_item_id), [send.items]);

  // 모달 열릴 때 품목 전체 선택 — 오픈 시점 스냅샷만 필요하다.
  // deps 에 allItemIds 를 넣으면 모달이 열려 있는 동안 items 가 갱신될 때
  // 운영자가 해제한 체크가 전부 되살아나, 부분 재배송이 전체 재배송으로 기록된다.
  // eslint-disable-next-line react-hooks/exhaustive-deps -- 오픈 시점 스냅샷만 필요 (items 변경 추적 안 함)
  useEffect(() => {
    if (open) setSelectedItemIds(new Set(allItemIds));
  }, [open]);

  const resetForm = () => {
    setReason("");
    setSendMethod("");
    setCourier("");
    setTrackingNo("");
    setMemo("");
    setReasonError(false);
    setSendMethodError(false);
    setCourierError(false);
    setTrackingError(false);
    setItemsError(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

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
      onSuccess();
      handleClose();
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
    // 백엔드 SendResendRequest.tracking_no 는 필수 — 빈 문자열이면 422.
    // 자체배송처럼 번호가 없는 경우엔 "자체배송" 같은 문자열을 그대로 넣는다 (형식 검증 없음).
    if (!trackingNo.trim()) {
      setTrackingError(true);
      if (!firstError) firstError = "송장 번호를 입력해주세요.";
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

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>재배송 내역 기록</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1 max-h-[70vh] overflow-y-auto">
          {/* 대상 박스 요약 — 모달은 패널과 화면이 분리되므로 어느 박스인지 다시 밝힌다 */}
          <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-600 space-y-1">
            <div className="flex justify-between gap-3">
              <span>수령인</span>
              <span className="font-medium text-right">
                {send.recipient_name}
                <span className="ml-1.5 font-mono text-gray-500">
                  {formatPhone(send.recipient_phone)}
                </span>
              </span>
            </div>
            <div className="flex justify-between gap-3">
              <span>주소</span>
              <span className="font-medium text-right">
                {send.postal_code && <span className="font-mono mr-1">[{send.postal_code}]</span>}
                {send.recipient_address}
              </span>
            </div>
            <div className="flex justify-between gap-3">
              <span>기존 발송</span>
              <span className="font-medium text-right">
                {send.send_method ?? "-"} · {send.courier_company ?? "-"} ·{" "}
                {send.tracking_no ? (
                  <span className="font-mono">{send.tracking_no}</span>
                ) : (
                  "-"
                )}
              </span>
            </div>
          </div>

          {/* 사유 — 옵션 선택 또는 직접 입력 (직접 입력이 덮어씀) */}
          <div>
            <Label className={reasonError ? "text-red-500" : undefined}>
              사유 <span className="text-red-500 ml-0.5">*</span>
            </Label>
            <Select
              value={reason}
              onValueChange={(v) => {
                setReason(v);
                setReasonError(false);
              }}
            >
              <SelectTrigger className={`mt-1 h-8 text-xs ${reasonError ? "border-red-500" : ""}`}>
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
              className={`mt-1 h-8 text-xs ${reasonError ? "border-red-500" : ""}`}
              placeholder="또는 직접 입력 (덮어쓰기)"
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                setReasonError(false);
              }}
            />
            {reasonError && <p className="text-xs text-red-500 mt-1">재배송 사유를 입력해주세요.</p>}
          </div>

          {/* 배송 방법 / 운송사 */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className={sendMethodError ? "text-red-500" : undefined}>
                배송 방법 <span className="text-red-500 ml-0.5">*</span>
              </Label>
              <Select
                value={sendMethod}
                onValueChange={(v) => {
                  const sm = v as SendMethod;
                  setSendMethod(sm);
                  setSendMethodError(false);
                  // 운영자가 운송사를 이미 지정한 상태라면 덮지 않는다.
                  // 매핑은 SendMethod 전 값을 덮는 total Record 라 undefined 검사 불필요.
                  if (!courier) {
                    setCourier(SEND_METHOD_TO_COURIER[sm]);
                    setCourierError(false);
                  }
                }}
              >
                <SelectTrigger
                  className={`mt-1 h-8 text-xs ${sendMethodError ? "border-red-500" : ""}`}
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
              {sendMethodError && (
                <p className="text-xs text-red-500 mt-1">배송 방법을 선택해주세요.</p>
              )}
            </div>
            <div>
              <Label className={courierError ? "text-red-500" : undefined}>
                운송사 <span className="text-red-500 ml-0.5">*</span>
              </Label>
              <Select
                value={courier}
                onValueChange={(v) => {
                  setCourier(v as CourierCompany);
                  setCourierError(false);
                }}
              >
                <SelectTrigger
                  className={`mt-1 h-8 text-xs ${courierError ? "border-red-500" : ""}`}
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
              {courierError && <p className="text-xs text-red-500 mt-1">운송사를 선택해주세요.</p>}
            </div>
          </div>

          {/* 송장 번호 — 백엔드 필수. 형식 검증이 없어 자체배송은 문자열을 그대로 넣는다 */}
          <div>
            <Label className={trackingError ? "text-red-500" : undefined}>
              송장 번호 <span className="text-red-500 ml-0.5">*</span>
            </Label>
            <Input
              className={`mt-1 h-8 text-xs font-mono ${trackingError ? "border-red-500" : ""}`}
              placeholder="번호가 없으면 '자체배송' 등으로 입력"
              value={trackingNo}
              onChange={(e) => {
                setTrackingNo(e.target.value);
                setTrackingError(false);
              }}
            />
            {trackingError && <p className="text-xs text-red-500 mt-1">송장 번호를 입력해주세요.</p>}
          </div>

          {/* 메모 */}
          <div>
            <Label>메모 (선택)</Label>
            <textarea
              className="mt-1 w-full px-3 py-2 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows={2}
              placeholder="추가 안내"
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
            />
          </div>

          {/* 재배송 품목 다중 선택 */}
          <div>
            <Label className={itemsError ? "text-red-500" : undefined}>
              재배송 품목 <span className="text-red-500 ml-0.5">*</span>{" "}
              <span className="font-normal text-gray-400">
                ({selectedItemIds.size}/{send.items.length})
              </span>
            </Label>
            <div
              className={`mt-1 border rounded divide-y divide-gray-100 ${
                itemsError ? "border-red-500" : "border-gray-200"
              }`}
            >
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
                  <span className="text-gray-500 truncate">{it.product_name}</span>
                  <span className="text-gray-400 ml-auto flex-shrink-0">
                    {formatIssue(it.issue)} · {it.send_num}권
                  </span>
                </label>
              ))}
            </div>
            {itemsError && (
              <p className="text-xs text-red-500 mt-1">재배송할 품목을 1개 이상 선택해주세요.</p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={mutation.isPending}>
            취소
          </Button>
          <Button onClick={handleSubmit} disabled={mutation.isPending}>
            {mutation.isPending && <LoadingSpinner size="sm" className="mr-1" />}
            기록 저장
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
