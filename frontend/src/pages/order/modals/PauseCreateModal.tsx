import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
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
import { pausesApi } from "@/api/pausesApi";
import { toast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/utils/errorHandler";
import { formatIssue } from "@/utils/format";
import { generateIssueRange, addMonthsToIssue } from "@/utils/date";
import type { OrderItemResponse } from "@/types/orderItem";

interface Props {
  open: boolean;
  onClose: () => void;
  item: OrderItemResponse;
  onSuccess: () => void;
}

export function PauseCreateModal({ open, onClose, item, onSuccess }: Props) {
  const [selectedIssues, setSelectedIssues] = useState<string[]>([]);
  const [reason, setReason] = useState("");

  // 기존 휴지 목록 조회
  const { data: pausesRes } = useQuery({
    queryKey: ["pauses", item.order_item_id],
    queryFn: () => pausesApi.getPausesByOrderItem(item.order_item_id).then((r) => r.data),
    enabled: open,
  });

  const existingPauses = pausesRes?.data ?? [];
  const activePauses = existingPauses.filter((p) => !p.is_deleted);

  const singleMutation = useMutation({
    mutationFn: () =>
      pausesApi.createPause({
        order_item_id: item.order_item_id,
        pause_issue: selectedIssues[0],
        reason: reason || null,
      }),
    onSuccess: () => {
      toast.success("휴지가 등록되었습니다.");
      onSuccess();
      handleClose();
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const batchMutation = useMutation({
    mutationFn: () =>
      pausesApi.batchCreatePause({
        order_item_id: item.order_item_id,
        pause_issues: selectedIssues,
        reason: reason || null,
      }),
    onSuccess: () => {
      toast.success("휴지가 등록되었습니다.");
      onSuccess();
      handleClose();
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const createMutation = selectedIssues.length <= 1 ? singleMutation : batchMutation;

  const deleteMutation = useMutation({
    mutationFn: (pauseId: number) => pausesApi.deletePause(pauseId),
    onSuccess: () => {
      toast.success("휴지가 삭제되었습니다.");
      onSuccess();
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const handleClose = () => {
    setSelectedIssues([]);
    setReason("");
    onClose();
  };

  const toggleIssue = (issue: string) => {
    setSelectedIssues((prev) =>
      prev.includes(issue) ? prev.filter((i) => i !== issue) : [...prev, issue]
    );
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-lg">
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
              <span>현재 구독 기간</span>
              <span className="font-medium">
                {formatIssue(item.final_subscribe_start_issue)} ~ {formatIssue(item.final_subscribe_end_issue)}
              </span>
            </div>
            {selectedIssues.length > 0 && (
              <div className="flex justify-between text-blue-600">
                <span>변경 후 구독 기간</span>
                <span className="font-medium">
                  {formatIssue(item.final_subscribe_start_issue)} ~ {formatIssue(addMonthsToIssue(item.final_subscribe_end_issue, selectedIssues.length))}
                </span>
              </div>
            )}
          </div>

          {/* 기존 휴지 목록 */}
          {activePauses.length > 0 && (
            <div>
              <div className="text-xs font-medium text-gray-500 mb-1.5">등록된 휴지</div>
              <div className="space-y-1">
                {activePauses.map((pause) => (
                  <div
                    key={pause.pause_id}
                    className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded px-2.5 py-1.5 text-xs"
                  >
                    <span className="font-medium text-amber-700">
                      {formatIssue(pause.pause_issue)}
                    </span>
                    <div className="flex items-center gap-2">
                      {pause.reason && (
                        <span className="text-amber-600 truncate max-w-[100px]">{pause.reason}</span>
                      )}
                      <button
                        onClick={() => deleteMutation.mutate(pause.pause_id)}
                        className="text-red-500 hover:text-red-700 text-xs"
                      >
                        삭제
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 휴지 호 선택 (다중 선택 가능) */}
          <div>
            <Label>휴지 호 선택 <span className="text-xs text-gray-400 font-normal">(여러 개 선택 가능)</span></Label>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {generateIssueRange(item.final_subscribe_start_issue, item.final_subscribe_end_issue).map((issue) => {
                const isExisting = activePauses.some((p) => p.pause_issue === issue);
                const isSent = !!(item.last_send_issue && issue <= item.last_send_issue);
                const isDisabled = isExisting || isSent;
                const isSelected = selectedIssues.includes(issue);
                return (
                  <button
                    key={issue}
                    type="button"
                    disabled={isDisabled}
                    onClick={() => toggleIssue(issue)}
                    className={`px-2.5 py-1 rounded text-xs border transition-colors ${
                      isDisabled
                        ? "bg-gray-100 text-gray-300 border-gray-200 cursor-not-allowed line-through"
                        : isSelected
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-white text-gray-600 border-gray-300 hover:border-blue-400 hover:text-blue-600"
                    }`}
                  >
                    {formatIssue(issue)}
                  </button>
                );
              })}
            </div>
            {selectedIssues.length > 0 && (
              <p className="text-xs text-blue-600 mt-1.5">{selectedIssues.length}개 선택됨</p>
            )}
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
            ※ 휴지 등록 시 선택한 호 수만큼 최종 구독 종료 호가 연장됩니다.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>닫기</Button>
          <Button
            onClick={() => createMutation.mutate()}
            disabled={selectedIssues.length === 0 || createMutation.isPending}
          >
            휴지 등록 {selectedIssues.length > 0 && `(${selectedIssues.length}건)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
