import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueries } from "@tanstack/react-query";
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
import { sendsApi } from "@/api/sendsApi";
import { toast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/utils/errorHandler";
import { formatPhone, formatIssue } from "@/utils/format";
import {
  SEND_METHOD_OPTIONS,
  COURIER_COMPANY_OPTIONS,
  SEND_METHOD_TO_COURIER,
} from "@/utils/constants";
import type {
  SendResponse,
  SendMethod,
  CourierCompany,
  SendDetailResponse,
} from "@/types/send";

interface Props {
  open: boolean;
  onClose: () => void;
  sends: SendResponse[]; // 선택된 PREPARING 박스 (페이지가 필터링해 전달)
  onSuccess?: (count: number) => void;
}

export default function TransitionToDeliveredModal({
  open,
  onClose,
  sends,
  onSuccess,
}: Props) {
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

  // courier_company 변경 → tracking_no 자동 세팅
  const handleCourierChange = (next: string) => {
    const co = next as CourierCompany;
    setCourier(co);
    if (co === "자체배송") {
      const prefilled: Record<number, string> = {};
      sends.forEach((s) => { prefilled[s.send_id] = "자체배송"; });
      setTrackingMap(prefilled);
    } else {
      setTrackingMap({});
    }
  };

  // send_method 변경 → courier_company 자동 도출 → handleCourierChange 위임
  const handleSendMethodChange = (next: string) => {
    setSendMethod(next as SendMethod);
    const derived = SEND_METHOD_TO_COURIER[next] as CourierCompany | undefined;
    if (derived) handleCourierChange(derived);
  };

  // 박스 안 SendItem 정보 — 모달 열린 상태에서 박스마다 detail 병렬 조회 (운영자 박스 식별용).
  // 정기 박스: 1 SendItem (한 줄). 단품 박스: N SendItem (여러 줄).
  const detailQueries = useQueries({
    queries: sends.map((s) => ({
      queryKey: ["send-detail", s.send_id],
      queryFn: () => sendsApi.getSend(s.send_id).then((r) => r.data.data!),
      enabled: open,
      staleTime: 60 * 1000,
    })),
  });
  const detailBySendId = useMemo(() => {
    const map = new Map<number, SendDetailResponse>();
    detailQueries.forEach((q, i) => {
      if (q.data) map.set(sends[i].send_id, q.data);
    });
    return map;
  }, [detailQueries, sends]);

  const mutation = useMutation({
    mutationFn: () =>
      dispatchApi
        .transitionToDelivered({
          sends: sends.map((s) => ({
            send_id: s.send_id,
            tracking_no: (trackingMap[s.send_id] ?? "").trim(),
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
    const missingTracking = sends.filter((s) => !(trackingMap[s.send_id] ?? "").trim());
    if (missingTracking.length > 0) {
      toast.error(`운송장 번호를 모두 입력해주세요. (누락: ${missingTracking.length}건)`);
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
      <DialogContent className="max-w-5xl max-h-[88vh] flex flex-col gap-4">
        <DialogHeader>
          <DialogTitle>[배송완료 처리]</DialogTitle>
          <p className="text-xs text-gray-500 mt-1">
            선택된 <span className="font-medium">{sends.length}건</span>을 한
            번에 배송완료로 처리합니다. 운송장 번호는 필수입니다 — 비택배(우편·자체배송 등)는
            배송 방법 선택 시 "자체배송"으로 자동 채워지며 수정 가능합니다. 이미
            배송완료·취소된 박스가 섞여 있으면 전체가 처리되지 않으니, 선택을
            다시 확인해주세요.
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
            <Select
              value={courier}
              onValueChange={handleCourierChange}
            >
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
                <th className="px-2 py-2 text-left font-medium w-64">배송지</th>
                <th className="px-2 py-2 text-left font-medium">상품</th>
                <th className="px-2 py-2 text-left font-medium w-44">
                  운송장 번호 <span className="text-red-500 ml-0.5">*</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {sends.map((s) => {
                const value = trackingMap[s.send_id] ?? "";
                const detail = detailBySendId.get(s.send_id);
                const items = detail?.items ?? [];
                return (
                  <tr
                    key={s.send_id}
                    className="border-t border-gray-100 align-top"
                  >
                    <td className="px-2 py-2 font-mono text-gray-400">
                      #{s.send_id}
                    </td>
                    <td className="px-2 py-2">
                      <div>{s.recipient_name}</div>
                      <div className="text-gray-400">
                        {formatPhone(s.recipient_phone)}
                      </div>
                    </td>
                    <td className="px-2 py-2">
                      <div className="font-mono text-gray-400">
                        {s.postal_code}
                      </div>
                      <div className="truncate">{s.recipient_address}</div>
                    </td>
                    <td className="px-2 py-2">
                      {detail === undefined ? (
                        <span className="text-gray-300 text-[11px]">로딩…</span>
                      ) : items.length === 0 ? (
                        <span className="text-gray-300">-</span>
                      ) : (
                        <div className="space-y-0.5">
                          {items.map((it) => (
                            <div
                              key={it.send_item_id}
                              className="flex items-center gap-1.5"
                            >
                              <span className="font-mono text-gray-500">
                                {it.product_code}
                              </span>
                              <span className="text-gray-300">·</span>
                              <span className="text-gray-600">
                                {formatIssue(it.issue)}
                              </span>
                              <span className="text-gray-400 ml-auto">
                                × {it.send_num}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-2 py-2">
                      <Input
                        className="h-8 font-mono"
                        placeholder="'-'를 제외한 숫자만 입력"
                        value={value}
                        onChange={(e) =>
                          setTrackingMap((prev) => ({
                            ...prev,
                            [s.send_id]: e.target.value,
                          }))
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
          <Button
            variant="ghost"
            onClick={onClose}
            disabled={mutation.isPending}
          >
            닫기
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={
              mutation.isPending ||
              !sendMethod ||
              !courier ||
              sends.length === 0
            }
          >
            {mutation.isPending && (
              <LoadingSpinner size="sm" className="mr-1" />
            )}
            배송완료 처리 ({sends.length}건)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
