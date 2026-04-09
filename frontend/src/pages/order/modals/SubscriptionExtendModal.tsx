import { useState } from "react";
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
import { orderItemsApi } from "@/api/orderItemsApi";
import { toast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/utils/errorHandler";
import { formatIssue } from "@/utils/format";
import { addMonthsToIssue } from "@/utils/date";
import type { OrderItemResponse } from "@/types/orderItem";

interface Props {
  open: boolean;
  onClose: () => void;
  item: OrderItemResponse;
  onSuccess: () => void;
}

export function SubscriptionExtendModal({ open, onClose, item, onSuccess }: Props) {
  const [months, setMonths] = useState("1");
  const [isPaid, setIsPaid] = useState(false);
  const [reason, setReason] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      orderItemsApi.extendSubscription(item.order_item_id, {
        extend_months: parseInt(months) || 1,
        is_paid: isPaid,
        reason: reason || null,
      }),
    onSuccess: () => {
      toast.success("구독이 연장되었습니다.");
      onSuccess();
      handleClose();
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const handleClose = () => {
    setMonths("1");
    setIsPaid(false);
    setReason("");
    onClose();
  };

  const newEndIssue = addMonthsToIssue(item.final_subscribe_end_issue, parseInt(months) || 0);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>구독 연장</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {/* 현재 구독 기간 */}
          <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-600 space-y-1">
            <div className="flex justify-between">
              <span>상품</span>
              <span className="font-medium">{item.product_name}</span>
            </div>
            <div className="flex justify-between">
              <span>현재 종료 호</span>
              <span className="font-medium">{formatIssue(item.final_subscribe_end_issue)}</span>
            </div>
            {newEndIssue && (
              <div className="flex justify-between text-blue-600">
                <span>연장 후 종료 호</span>
                <span className="font-medium">{formatIssue(newEndIssue)}</span>
              </div>
            )}
          </div>

          <div>
            <Label>연장 개월 수</Label>
            <Input
              type="number"
              min={1}
              max={24}
              className="mt-1"
              value={months}
              onChange={(e) => setMonths(e.target.value)}
            />
          </div>

          <div>
            <Label>연장 사유 <span className="text-gray-400 font-normal">(선택)</span></Label>
            <Input
              className="mt-1"
              placeholder="연장 사유"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              className="rounded border-gray-300"
              checked={isPaid}
              onChange={(e) => setIsPaid(e.target.checked)}
            />
            <span className="text-xs text-gray-600">유료 연장 (결제 구독 종료 호도 함께 연장)</span>
          </label>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>취소</Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !months || parseInt(months) < 1}
          >
            연장
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
