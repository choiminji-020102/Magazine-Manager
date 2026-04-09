import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { getErrorMessage } from "@/utils/errorHandler";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { pausesApi } from "@/api/pausesApi";
import { toast } from "@/hooks/use-toast";
import { formatIssue } from "@/utils/format";
import type { OrderItemResponse } from "@/types/orderItem";

interface Props {
  open: boolean;
  onClose: () => void;
  item: OrderItemResponse;
  orderId: number;
}

export function PauseCreateModal({ open, onClose, item, orderId }: Props) {
  const queryClient = useQueryClient();
  const [pauseIssue, setPauseIssue] = useState("");
  const [reason, setReason] = useState("");

  // 기존 휴지 목록 조회
  const { data: pausesRes } = useQuery({
    queryKey: ["pauses", item.order_item_id],
    queryFn: () => pausesApi.getPausesByOrderItem(item.order_item_id).then((r) => r.data),
    enabled: open,
  });

  const existingPauses = pausesRes?.data ?? [];

  const createMutation = useMutation({
    mutationFn: () =>
      pausesApi.createPause({
        order_item_id: item.order_item_id,
        pause_issue: pauseIssue,
        reason: reason || null,
      }),
    onSuccess: () => {
      toast.success("휴지가 등록되었습니다.");
      queryClient.invalidateQueries({ queryKey: ["order", orderId] });
      queryClient.invalidateQueries({ queryKey: ["pauses", item.order_item_id] });
      handleClose();
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const deleteMutation = useMutation({
    mutationFn: (pauseId: number) => pausesApi.deletePause(pauseId),
    onSuccess: () => {
      toast.success("휴지가 삭제되었습니다.");
      queryClient.invalidateQueries({ queryKey: ["order", orderId] });
      queryClient.invalidateQueries({ queryKey: ["pauses", item.order_item_id] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const handleClose = () => {
    setPauseIssue("");
    setReason("");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>휴지 등록</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {/* 현재 구독 정보 */}
          <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-600 space-y-1">
            <div className="flex justify-between">
              <span>상품</span>
              <span className="font-medium">{item.product_name}</span>
            </div>
            <div className="flex justify-between">
              <span>구독 기간</span>
              <span className="font-medium">
                {formatIssue(item.final_subscribe_start_issue)} ~ {formatIssue(item.final_subscribe_end_issue)}
              </span>
            </div>
          </div>

          {/* 기존 휴지 목록 */}
          {existingPauses.filter((p) => !p.is_deleted).length > 0 && (
            <div>
              <div className="text-xs font-medium text-gray-500 mb-1.5">등록된 휴지</div>
              <div className="space-y-1">
                {existingPauses
                  .filter((p) => !p.is_deleted)
                  .map((pause) => (
                    <div
                      key={pause.pause_id}
                      className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded px-2.5 py-1.5 text-xs"
                    >
                      <span className="font-medium text-amber-800">
                        {formatIssue(pause.pause_issue)}
                      </span>
                      <div className="flex items-center gap-2">
                        {pause.reason && (
                          <span className="text-amber-600 truncate max-w-[100px]">{pause.reason}</span>
                        )}
                        <button
                          onClick={() => deleteMutation.mutate(pause.pause_id)}
                          className="text-red-400 hover:text-red-600 text-xs"
                        >
                          삭제
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* 신규 휴지 등록 */}
          <div>
            <Label>휴지 호 <span className="text-xs text-gray-400">(YYYYMM)</span></Label>
            <Input
              className="mt-1"
              placeholder="예: 202607"
              maxLength={6}
              value={pauseIssue}
              onChange={(e) => setPauseIssue(e.target.value.replace(/\D/g, ""))}
            />
          </div>

          <div>
            <Label>사유 <span className="text-gray-400 font-normal">(선택)</span></Label>
            <Input
              className="mt-1"
              placeholder="휴지 사유"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>

          <p className="text-xs text-gray-400">
            ※ 휴지 등록 시 최종 구독 종료 호가 1개월 연장됩니다.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>닫기</Button>
          <Button
            onClick={() => createMutation.mutate()}
            disabled={pauseIssue.length !== 6 || createMutation.isPending}
          >
            휴지 등록
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
