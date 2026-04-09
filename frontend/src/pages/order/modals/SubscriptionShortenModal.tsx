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
import type { OrderItemResponse } from "@/types/orderItem";

interface Props {
  open: boolean;
  onClose: () => void;
  item: OrderItemResponse;
  onSuccess: () => void;
}

export function SubscriptionShortenModal({ open, onClose, item, onSuccess }: Props) {
  const [shortenEndIssue, setShortenEndIssue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [calcResult, setCalcResult] = useState<{
    current_end_issue: string;
    shorten_end_issue: string;
    refund_amount: number;
  } | null>(null);
  const [refundConfirmed, setRefundConfirmed] = useState(false);

  const finalEndIssue = item.final_subscribe_end_issue;

  // 6자리 입력 시 자동 계산
  useEffect(() => {
    if (shortenEndIssue.length === 6 && !isNaN(Number(shortenEndIssue))) {
      setCalcResult(null);
      if (shortenEndIssue >= finalEndIssue) {
        setError(`현재 종료 호(${formatIssue(finalEndIssue)})보다 이전 호를 입력해주세요.`);
        return;
      }
      setError(null);
      calcMutation.mutate();
    } else {
      setCalcResult(null);
      setError(null);
    }
  }, [shortenEndIssue]);

  const calcMutation = useMutation({
    mutationFn: () =>
      orderItemsApi.shortenCalculate(item.order_item_id, {
        shorten_end_issue: shortenEndIssue,
      }),
    onSuccess: (res) => setCalcResult(res.data.data ?? null),
    onError: () => setError("환불액 계산에 실패했습니다. 입력값을 확인해주세요."),
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
    setShortenEndIssue("");
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
          <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-600 space-y-1">
            <div className="flex justify-between">
              <span>상품</span>
              <span className="font-medium">{item.product_name}</span>
            </div>
            <div className="flex justify-between">
              <span>현재 종료 호</span>
              <span className="font-medium">{formatIssue(finalEndIssue)}</span>
            </div>
          </div>

          <div>
            <Label>단축 종료 호 <span className="text-xs text-gray-400">(YYYYMM)</span></Label>
            <Input
              className={`mt-1 ${error ? "border-red-500" : ""}`}
              placeholder="예: 202606"
              maxLength={6}
              value={shortenEndIssue}
              onChange={(e) => {
                setShortenEndIssue(e.target.value.replace(/\D/g, ""));
                setRefundConfirmed(false);
              }}
            />
            {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
          </div>

          {calcResult && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-2">
              <div className="text-xs font-medium text-amber-800">환불 계산 결과</div>
              <div className="text-xs text-amber-700 space-y-1">
                <div className="flex justify-between">
                  <span>현재 종료</span>
                  <span>{formatIssue(calcResult.current_end_issue)}</span>
                </div>
                <div className="flex justify-between">
                  <span>단축 종료</span>
                  <span>{formatIssue(calcResult.shorten_end_issue)}</span>
                </div>
                <div className="flex justify-between font-semibold text-amber-900">
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
                <label htmlFor="refund-confirm" className="text-xs text-amber-800 cursor-pointer">
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
            단축 확정
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
