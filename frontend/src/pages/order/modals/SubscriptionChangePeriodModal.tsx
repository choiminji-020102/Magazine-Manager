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
import { ChevronLeft, ChevronRight } from "lucide-react";
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
  pauseCount?: number;
}

export function SubscriptionChangePeriodModal({ open, onClose, item, onSuccess, pauseCount = 0 }: Props) {
  const [direction, setDirection] = useState<"backward" | "forward">("forward");
  const [months, setMonths] = useState("1");

  const absMonths = Math.abs(parseInt(months) || 0);
  const offset = direction === "backward" ? -absMonths : absMonths;
  const newStartIssue = offset !== 0 ? addMonthsToIssue(item.final_subscribe_start_issue, offset) : "";
  const newEndIssue = newStartIssue
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
    setDirection("forward");
    setMonths("1");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>기간 이동</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {/* 현재 구독 정보 */}
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
            {newStartIssue && newEndIssue && (
              <div className="flex justify-between text-blue-600">
                <span>변경 후 구독 기간</span>
                <span className="font-medium">
                  {formatIssue(newStartIssue)} ~ {formatIssue(newEndIssue)}
                </span>
              </div>
            )}
          </div>

          {/* 방향 선택 */}
          <div>
            <Label>이동 방향</Label>
            <div className="flex rounded-md border border-gray-200 overflow-hidden text-xs mt-1">
              <button
                type="button"
                className={`flex-1 py-2 flex items-center justify-center gap-1 transition-colors ${
                  direction === "backward" ? "bg-blue-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"
                }`}
                onClick={() => setDirection("backward")}
              >
                <ChevronLeft className="h-3.5 w-3.5" />앞당기기
              </button>
              <button
                type="button"
                className={`flex-1 py-2 flex items-center justify-center gap-1 transition-colors ${
                  direction === "forward" ? "bg-blue-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"
                }`}
                onClick={() => setDirection("forward")}
              >
                뒤로 미루기<ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* 개월 수 */}
          <div>
            <Label>이동 개월 수</Label>
            <Input
              type="number"
              min={1}
              max={24}
              className="mt-1"
              value={months}
              onChange={(e) => setMonths(e.target.value)}
            />
          </div>

          <p className="text-xs text-gray-400">
            ※ 구독 개월 수{pauseCount > 0 ? `(${item.subscribe_period}개월 +휴지 ${pauseCount}개월)` : ""}는 유지되며 시작/종료 호만 이동됩니다.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>취소</Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={!newStartIssue || mutation.isPending}
          >
            {direction === "backward" ? `${months}개월 앞당기기` : `${months}개월 뒤로 미루기`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
