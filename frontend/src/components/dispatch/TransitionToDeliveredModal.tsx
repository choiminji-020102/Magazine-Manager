import { useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { dispatchApi } from "@/api/dispatchApi";
import { toast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/utils/errorHandler";
import { formatPhone } from "@/utils/format";
import {
  SEND_METHOD_OPTIONS,
  COURIER_COMPANY_OPTIONS,
  SEND_METHOD_TO_COURIER,
} from "@/utils/constants";
import type { SendResponse, SendMethod, CourierCompany } from "@/types/send";

interface Props {
  open: boolean;
  onClose: () => void;
  sends: SendResponse[];      // 선택된 PREPARING 박스 (페이지가 필터링해 전달)
  onSuccess?: (count: number) => void;
}

export default function TransitionToDeliveredModal({ open, onClose, sends, onSuccess }: Props) {
  const [sendMethod, setSendMethod] = useState<SendMethod | "">("");
  const [courier, setCourier] = useState<CourierCompany | "">("");
  // tracking_no by send_id (운송장 번호 입력값 — 표준화는 백엔드 책임)
  const [trackingMap, setTrackingMap] = useState<Record<number, string>>({});

  // 모달 오픈 시 입력 초기화
  useEffect(() => {
    if (open) {
      setSendMethod("");
      setCourier("");
      setTrackingMap({});
    }
  }, [open]);

  // send_method 선택 시 courier 자동 도출 (운영자가 수정 가능)
  const handleSendMethodChange = (next: string) => {
    const sm = next as SendMethod;
    setSendMethod(sm);
    const derived = SEND_METHOD_TO_COURIER[sm] as CourierCompany | undefined;
    if (derived) setCourier(derived);
  };

  const allTrackingFilled = useMemo(
    () => sends.every((s) => (trackingMap[s.send_id] ?? "").trim().length > 0),
    [sends, trackingMap],
  );

  const mutation = useMutation({
    mutationFn: () =>
      dispatchApi
        .transitionToDelivered({
          sends: sends.map((s) => ({
            send_id: s.send_id,
            tracking_no: trackingMap[s.send_id] ?? "",
          })),
          send_method: sendMethod as SendMethod,
          courier_company: courier as CourierCompany,
        })
        .then((r) => r.data.data!),
    onSuccess: (data) => {
      toast.success(`배송완료 처리 완료: ${data.transitioned_count}건`);
      onSuccess?.(data.transitioned_count);
      onClose();
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const handleSubmit = () => {
    if (!sendMethod) {
      toast.error("배송 방법을 선택해주세요.");
      return;
    }
    if (!courier) {
      toast.error("운송사를 선택해주세요.");
      return;
    }
    if (!allTrackingFilled) {
      toast.error("모든 박스의 운송장 번호를 입력해주세요.");
      return;
    }
    mutation.mutate();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o && !mutation.isPending) onClose();
      }}
    >
      <DialogContent className="max-w-3xl max-h-[88vh] flex flex-col gap-4">
        <DialogHeader>
          <DialogTitle>[배송완료 처리]</DialogTitle>
          <p className="text-xs text-gray-500 mt-1">
            선택된 <span className="font-medium">{sends.length}건</span>을 일괄 DELIVERED 로
            전환합니다. 한 건이라도 PREPARING 이 아니면 전체 거부됩니다.
          </p>
        </DialogHeader>

        {/* 공통 필드 — send_method / courier_company */}
        <div className="grid grid-cols-2 gap-3 pb-3 border-b border-gray-100">
          <div>
            <Label className="text-xs text-gray-500">
              배송 방법 <span className="text-red-500 ml-0.5">*</span>
            </Label>
            <Select value={sendMethod} onValueChange={handleSendMethodChange}>
              <SelectTrigger className="mt-1 h-9 text-sm">
                <SelectValue placeholder="선택해주세요" />
              </SelectTrigger>
              <SelectContent>
                {SEND_METHOD_OPTIONS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-gray-500">
              운송사 <span className="text-red-500 ml-0.5">*</span>
            </Label>
            <Select value={courier} onValueChange={(v) => setCourier(v as CourierCompany)}>
              <SelectTrigger className="mt-1 h-9 text-sm">
                <SelectValue placeholder="선택해주세요" />
              </SelectTrigger>
              <SelectContent>
                {COURIER_COMPANY_OPTIONS.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-400 mt-1">
              배송 방법 선택 시 자동 채워집니다. 필요 시 수정.
            </p>
          </div>
        </div>

        {/* 박스별 운송장 입력 */}
        <div className="flex-1 min-h-0 overflow-y-auto border border-gray-200 rounded">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 text-gray-500 sticky top-0">
              <tr>
                <th className="px-2 py-2 text-left font-medium w-20">발송ID</th>
                <th className="px-2 py-2 text-left font-medium w-32">수령인</th>
                <th className="px-2 py-2 text-left font-medium">배송지</th>
                <th className="px-2 py-2 text-left font-medium w-44">
                  운송장 번호 <span className="text-red-500">*</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {sends.map((s) => {
                const value = trackingMap[s.send_id] ?? "";
                const empty = value.trim().length === 0;
                return (
                  <tr key={s.send_id} className="border-t border-gray-100">
                    <td className="px-2 py-2 font-mono text-gray-400">#{s.send_id}</td>
                    <td className="px-2 py-2">
                      <div>{s.recipient_name}</div>
                      <div className="text-gray-400">{formatPhone(s.recipient_phone)}</div>
                    </td>
                    <td className="px-2 py-2">
                      <div className="font-mono text-gray-400">{s.postal_code}</div>
                      <div className="truncate max-w-md">{s.recipient_address}</div>
                    </td>
                    <td className="px-2 py-2">
                      <Input
                        className={`h-8 font-mono ${empty ? "border-red-200" : ""}`}
                        placeholder="운송장 번호"
                        value={value}
                        onChange={(e) =>
                          setTrackingMap((prev) => ({ ...prev, [s.send_id]: e.target.value }))
                        }
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={mutation.isPending}>
            닫기
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={
              mutation.isPending || !sendMethod || !courier || !allTrackingFilled || sends.length === 0
            }
          >
            {mutation.isPending && <LoadingSpinner size="sm" className="mr-1" />}
            배송완료 처리 ({sends.length}건)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
