import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { ConfirmModal } from "@/components/common/ConfirmModal";
import { orderItemsApi } from "@/api/orderItemsApi";
import { toast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/utils/errorHandler";
import type { OrderItemResponse } from "@/types/orderItem";

interface Props {
  open: boolean;
  onClose: () => void;
  item: OrderItemResponse;
  onSuccess: () => void;
}

export function OrderItemCancelModal({ open, onClose, item, onSuccess }: Props) {
  const [memo, setMemo] = useState("");
  const [memoError, setMemoError] = useState(false);

  const mutation = useMutation({
    mutationFn: () =>
      orderItemsApi.cancelOrderItem(item.order_item_id, {
        admin_memo: memo,
      }),
    onSuccess: () => {
      toast.success("품목이 취소되었습니다.");
      onSuccess();
      handleClose();
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const handleClose = () => {
    setMemo("");
    setMemoError(false);
    onClose();
  };

  const handleConfirm = () => {
    if (!memo.trim()) {
      setMemoError(true);
      toast.error("취소 사유를 입력해주세요.");
      return;
    }
    mutation.mutate();
  };

  return (
    <ConfirmModal
      open={open}
      onClose={handleClose}
      onConfirm={handleConfirm}
      title="품목 취소"
      description={
        <div className="space-y-3">
          <p>
            <span className="font-medium">{item.product_name}</span> 품목을 취소합니다.
          </p>
          <p className="text-xs text-gray-400">
            ※ 배송 중이거나 배송 완료된 MONTHLY 품목은 취소할 수 없습니다.
          </p>
          <textarea
            className={`w-full border rounded-md p-2 text-sm resize-none h-20 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              memoError ? "border-red-500" : "border-gray-300"
            }`}
            placeholder="취소 사유를 입력해주세요."
            value={memo}
            onChange={(e) => {
              setMemo(e.target.value);
              if (memoError) setMemoError(false);
            }}
          />
          {memoError && <p className="text-xs text-red-500">취소 사유를 입력해주세요.</p>}
        </div>
      }
      confirmLabel="품목 취소"
      variant="destructive"
      isLoading={mutation.isPending}
    />
  );
}
