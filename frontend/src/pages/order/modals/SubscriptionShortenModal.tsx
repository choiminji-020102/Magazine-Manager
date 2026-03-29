import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import { formatIssue, formatAmount } from "@/utils/format";
import type { OrderItemResponse } from "@/types/orderItem";

interface Props {
  open: boolean;
  onClose: () => void;
  item: OrderItemResponse;
  orderId: number;
}

export function SubscriptionShortenModal({ open, onClose, item, orderId }: Props) {
  const queryClient = useQueryClient();
  const [shortenEndIssue, setShortenEndIssue] = useState("");
  const [calcResult, setCalcResult] = useState<{
    current_end_issue: string;
    shorten_end_issue: string;
    refund_amount: number;
  } | null>(null);
  const [refundConfirmed, setRefundConfirmed] = useState(false);

  const calcMutation = useMutation({
    mutationFn: () =>
      orderItemsApi.shortenCalculate(item.order_item_id, {
        shorten_end_issue: shortenEndIssue,
      }),
    onSuccess: (res) => {
      setCalcResult(res.data.data ?? null);
    },
    onError: () => toast.error("환불 계산 실패"),
  });

  const confirmMutation = useMutation({
    mutationFn: () =>
      orderItemsApi.shortenConfirm(item.order_item_id, {
        shorten_end_issue: shortenEndIssue,
        refund_confirmed: refundConfirmed,
      }),
    onSuccess: () => {
      toast.success("구독이 단축되었습니다.");
      queryClient.invalidateQueries({ queryKey: ["order", orderId] });
      handleClose();
    },
    onError: () => toast.error("구독 단축 실패"),
  });

  const handleClose = () => {
    setShortenEndIssue("");
    setCalcResult(null);
    setRefundConfirmed(false);
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
              <span>현재 종료 호</span>
              <span className="font-medium">{formatIssue(item.final_subscribe_end_issue)}</span>
            </div>
          </div>

          <div>
            <Label>단축 종료 호 <span className="text-xs text-gray-400">(YYYYMM)</span></Label>
            <div className="flex gap-2 mt-1">
              <Input
                placeholder="예: 202606"
                maxLength={6}
                value={shortenEndIssue}
                onChange={(e) => {
                  setShortenEndIssue(e.target.value.replace(/\D/g, ""));
                  setCalcResult(null);
                }}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => calcMutation.mutate()}
                disabled={shortenEndIssue.length !== 6 || calcMutation.isPending}
              >
                계산
              </Button>
            </div>
          </div>

          {/* 환불 계산 결과 */}
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
            disabled={
              !calcResult ||
              !refundConfirmed ||
              confirmMutation.isPending
            }
          >
            단축 확정
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
