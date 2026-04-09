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
  pauseCount?: number; // 활성 휴지 개수 (종료호 계산에 반영)
}

export function SubscriptionChangePeriodModal({ open, onClose, item, onSuccess, pauseCount = 0 }: Props) {
  const [newStartIssue, setNewStartIssue] = useState("");

  const previewEndIssue = newStartIssue.length === 6
    ? addMonthsToIssue(newStartIssue, (item.subscribe_period ?? 12) - 1 + pauseCount)
    : "";

  const mutation = useMutation({
    mutationFn: () =>
      orderItemsApi.changePeriod(item.order_item_id, {
        new_start_issue: newStartIssue,
      }),
    onSuccess: () => {
      toast.success("구독 기간이 이동되었습니다.");
      onSuccess();
      handleClose();
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const handleClose = () => {
    setNewStartIssue("");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>기간 이동</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-600 space-y-1">
            <div className="flex justify-between">
              <span>상품</span>
              <span className="font-medium">{item.product_name}</span>
            </div>
            <div className="flex justify-between">
              <span>현재 구독 기간</span>
              <span className="font-medium">
                {formatIssue(item.final_subscribe_start_issue)} ~ {formatIssue(item.final_subscribe_end_issue)}
              </span>
            </div>
            <div className="flex justify-between">
              <span>구독 개월 수</span>
              <span className="font-medium">{item.subscribe_period}개월{pauseCount > 0 && ` (+휴지 ${pauseCount}개월)`}</span>
            </div>
          </div>

          <div>
            <Label>새 시작 호 <span className="text-xs text-gray-400">(YYYYMM)</span></Label>
            <Input
              className="mt-1"
              placeholder="예: 202607"
              maxLength={6}
              value={newStartIssue}
              onChange={(e) => setNewStartIssue(e.target.value.replace(/\D/g, ""))}
            />
          </div>

          {previewEndIssue && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700 space-y-1">
              <div className="font-medium text-blue-800">이동 후 예상 기간</div>
              <div className="flex justify-between">
                <span>새 시작 호</span>
                <span>{formatIssue(newStartIssue)}</span>
              </div>
              <div className="flex justify-between">
                <span>새 종료 호</span>
                <span>{formatIssue(previewEndIssue)}</span>
              </div>
            </div>
          )}

          <p className="text-xs text-gray-400">
            ※ 구독 개월 수는 유지되며 시작/종료 호만 이동됩니다.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>취소</Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={newStartIssue.length !== 6 || mutation.isPending}
          >
            기간 이동
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
