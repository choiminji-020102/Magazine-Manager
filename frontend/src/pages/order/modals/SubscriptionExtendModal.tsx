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
import { orderItemsApi } from "@/api/orderItemsApi";
import { toast } from "@/hooks/use-toast";
import { formatIssue } from "@/utils/format";
import type { OrderItemResponse } from "@/types/orderItem";

interface Props {
  open: boolean;
  onClose: () => void;
  item: OrderItemResponse;
  orderId: number;
}

export function SubscriptionExtendModal({ open, onClose, item, orderId }: Props) {
  const queryClient = useQueryClient();
  const [months, setMonths] = useState("1");
  const [reason, setReason] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      orderItemsApi.extendSubscription(item.order_item_id, {
        extend_months: parseInt(months) || 1,
        is_paid: false,
        reason: reason || null,
      }),
    onSuccess: () => {
      toast.success("구독이 연장되었습니다.");
      queryClient.invalidateQueries({ queryKey: ["order", orderId] });
      onClose();
    },
    onError: () => toast.error("구독 연장 실패"),
  });

  const handleClose = () => {
    setMonths("1");
    setReason("");
    onClose();
  };

  const newEndIssue = (() => {
    // 현재 종료 호에서 months만큼 더한 값 계산 (표시용)
    const current = item.final_subscribe_end_issue;
    if (!current || current.length !== 6) return null;
    const year = parseInt(current.slice(0, 4));
    const month = parseInt(current.slice(4, 6));
    const m = parseInt(months) || 0;
    const totalMonths = year * 12 + month + m;
    const newYear = Math.floor((totalMonths - 1) / 12);
    const newMonth = ((totalMonths - 1) % 12) + 1;
    return `${newYear}${String(newMonth).padStart(2, "0")}`;
  })();

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
              placeholder="무상 연장 사유"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
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
