import { useState, useEffect } from "react";
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
import { orderItemsApi } from "@/api/orderItemsApi";
import { toast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/utils/errorHandler";
import { formatIssue, formatAmount } from "@/utils/format";
import { addMonthsToIssue } from "@/utils/date";
import type { OrderItemResponse } from "@/types/orderItem";

interface Props {
  open: boolean;
  onClose: () => void;
  item: OrderItemResponse;
  onSuccess: () => void;
}

export function SubscriptionShortenModal({ open, onClose, item, onSuccess }: Props) {
  const [months, setMonths] = useState("1");
  const [error, setError] = useState<string | null>(null);
  const [calcResult, setCalcResult] = useState<{
    current_end_issue: string;
    shorten_end_issue: string;
    refund_amount: number;
  } | null>(null);
  const [refundConfirmed, setRefundConfirmed] = useState(false);

  const finalEndIssue = item.final_subscribe_end_issue;
  const absMonths = Math.abs(parseInt(months) || 0);
  // 현재 종료 호에서 N개월 앞당긴 호 = 단축 종료 호
  const shortenEndIssue = absMonths > 0 ? addMonthsToIssue(finalEndIssue, -absMonths) : "";

  // 개월 수 변경 시 자동 계산
  useEffect(() => {
    setCalcResult(null);
    setRefundConfirmed(false);
    setError(null);

    if (absMonths <= 0 || !shortenEndIssue) return;

    if (shortenEndIssue >= finalEndIssue) {
      setError("단축 개월 수가 너무 큽니다.");
      return;
    }

    calcMutation.mutate();
  }, [shortenEndIssue]);

  const calcMutation = useMutation({
    mutationFn: () =>
      orderItemsApi.shortenCalculate(item.order_item_id, {
        shorten_end_issue: shortenEndIssue,
      }),
    onSuccess: (res) => setCalcResult(res.data.data ?? null),
    onError: () => setError("환불액 계산에 실패했습니다."),
  });

  const confirmMutation = useMutation({
    mutationFn: () =>
      orderItemsApi.shortenConfirm(item.order_item_id, {
        shorten_end_issue: shortenEndIssue,
        refund_confirmed: true,
      }),
    onSuccess: () => {
      toast.success("구독이 단축되었습니다.");
      onSuccess();
      handleClose();
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const handleClose = () => {
    setMonths("1");
    setCalcResult(null);
    setRefundConfirmed(false);
    setError(null);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>구독 단축</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {/* 현재 구독 정보 */}
          <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-600 space-y-1">
            <div className="flex justify-between">
              <span>상품</span>
              <span className="font-medium">{item.product_name}</span>
            </div>
            <div className="flex justify-between">
              <span>현재 기간</span>
              <span className="font-medium">
                {formatIssue(item.final_subscribe_start_issue)} ~ {formatIssue(finalEndIssue)}
              </span>
            </div>
          </div>

          {/* 단축 개월 수 */}
          <div>
            <Label>단축 개월 수</Label>
            <Input
              type="number"
              min={1}
              max={24}
              className="mt-1"
              value={months}
              onChange={(e) => setMonths(e.target.value)}
            />
            {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
          </div>

          {/* 단축 후 예상 + 환불 정보 */}
          {calcResult && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs space-y-2">
              <div className="font-medium text-blue-800">단축 후 예상</div>
              <div className="text-blue-700 space-y-1">
                <div className="flex justify-between">
                  <span>단축 후 종료 호</span>
                  <span>{formatIssue(calcResult.shorten_end_issue)}</span>
                </div>
                <div className="flex justify-between font-semibold text-blue-900">
                  <span>환불 금액</span>
                  <span>{formatAmount(calcResult.refund_amount)}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <Checkbox
                  id="refund-confirm"
                  checked={refundConfirmed}
                  onCheckedChange={(v) => setRefundConfirmed(!!v)}
                />
                <label htmlFor="refund-confirm" className="text-xs text-blue-800 cursor-pointer">
                  환불 금액을 확인했습니다
                </label>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>취소</Button>
          <Button
            variant="destructive"
            onClick={() => confirmMutation.mutate()}
            disabled={!calcResult || !refundConfirmed || confirmMutation.isPending}
          >
            {absMonths > 0 ? `${absMonths}개월 단축 확정` : "단축 확정"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
