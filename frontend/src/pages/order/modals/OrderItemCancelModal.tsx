import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { ConfirmModal } from "@/components/common/ConfirmModal";
import { Input } from "@/components/ui/input";
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
  const [refundBank, setRefundBank] = useState("");
  const [refundAccount, setRefundAccount] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      orderItemsApi.cancelOrderItem(item.order_item_id, {
        admin_memo: memo,
        ...(refundBank && refundAccount
          ? { refund_bank: refundBank, refund_account: refundAccount }
          : {}),
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
    setRefundBank("");
    setRefundAccount("");
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
            <span className="font-medium">{item.product_name}</span> ({item.order_num}개) 품목을 취소합니다.
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

          {/* 환불 계좌 */}
          <div className="border-t border-gray-200 pt-3 space-y-2">
            <span className="text-xs font-medium text-gray-600">환불 계좌</span>
            <div className="flex gap-2">
              <Input
                className="h-8 text-sm flex-[1]"
                placeholder="은행명"
                value={refundBank}
                onChange={(e) => setRefundBank(e.target.value)}
              />
              <Input
                className="h-8 text-sm flex-[2]"
                placeholder="계좌번호"
                value={refundAccount}
                onChange={(e) => setRefundAccount(e.target.value)}
              />
            </div>
          </div>
        </div>
      }
      confirmLabel="품목 취소"
      variant="destructive"
      isLoading={mutation.isPending}
    />
  );
}
