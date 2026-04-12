import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ConfirmModal } from "@/components/common/ConfirmModal";
import { Input } from "@/components/ui/input";
import { orderItemsApi } from "@/api/orderItemsApi";
import { toast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/utils/errorHandler";
import { formatAmount } from "@/utils/format";
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
  const [refundAmount, setRefundAmount] = useState("");
  const [refundBank, setRefundBank] = useState("");
  const [refundAccount, setRefundAccount] = useState("");

  // 환불 계산 미리보기
  const calcQuery = useQuery({
    queryKey: ["cancelItemCalculate", item.order_item_id],
    queryFn: async () => {
      const res = await orderItemsApi.cancelItemCalculate(item.order_item_id);
      const data = res.data.data;
      if (data) setRefundAmount(String(data.refund_amount));
      return data;
    },
    enabled: open,
  });

  const mutation = useMutation({
    mutationFn: () =>
      orderItemsApi.cancelOrderItem(item.order_item_id, {
        admin_memo: memo,
        ...(refundAmount !== "" ? { refund_amount: parseInt(refundAmount) || 0 } : {}),
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
    setRefundAmount("");
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

  const calc = calcQuery.data;

  return (
    <ConfirmModal
      open={open}
      onClose={handleClose}
      onConfirm={handleConfirm}
      title="품목 취소"
      description={
        <div className="space-y-3">
          <div>
            <span className="text-xs font-medium text-gray-600">취소 상품</span>
            <p className="text-sm text-gray-800 mt-1">· {item.product_name} ({item.order_num}개)</p>
          </div>

          {/* 환불 계산 (참고) */}
          {calc && (
            <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-500 space-y-1">
              <div className="font-medium text-gray-600">환불 계산 (참고)</div>
              {calc.order_status === "ORDERED" ? (
                <p>결제 전 주문이므로 환불금 없음</p>
              ) : calc.product_kind === "MONTHLY" ? (
                <>
                  <div className="flex justify-between">
                    <span>판매가 × 수량</span>
                    <span>{formatAmount(calc.sale_price)} × {calc.order_num} = {formatAmount(calc.refund_amount)}</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex justify-between">
                    <span>판매가 ÷ 구독기간</span>
                    <span>{formatAmount(calc.sale_price)} ÷ {calc.subscribe_period}개월 = {formatAmount(calc.unit_price)}/월</span>
                  </div>
                  <div className="flex justify-between">
                    <span>배송 {calc.delivered_count}개월, 잔여 {calc.remaining_count}개월</span>
                    <span>{formatAmount(calc.unit_price)} × {calc.remaining_count}개월{calc.order_num > 1 ? ` × ${calc.order_num}` : ""}</span>
                  </div>
                  <div className="flex justify-between font-medium text-gray-700 border-t border-gray-200 pt-1">
                    <span>예상 환불금</span>
                    <span>{formatAmount(calc.refund_amount)}</span>
                  </div>
                </>
              )}
            </div>
          )}
          {calcQuery.isLoading && (
            <p className="text-xs text-gray-400">환불 계산 중...</p>
          )}

          <p className="text-xs text-gray-400">
            ※ 발송이 시작된 상품은 취소할 수 없습니다.
          </p>

          {/* 환불 금액 (직접 입력) */}
          {calc && calc.order_status !== "ORDERED" && (
            <div>
              <span className="text-xs font-medium text-gray-600">환불 금액</span>
              <div className="flex items-center gap-1.5 mt-1">
                <Input
                  type="number"
                  min={0}
                  className="h-8 text-sm"
                  value={refundAmount}
                  onChange={(e) => setRefundAmount(e.target.value)}
                />
                <span className="text-sm text-gray-500 flex-shrink-0">원</span>
              </div>
            </div>
          )}

          {/* 취소 사유 */}
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
