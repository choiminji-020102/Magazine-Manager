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
import { formatIssue, formatAmount } from "@/utils/format";
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
  const [paidAmount, setPaidAmount] = useState("");
  const [refundBank, setRefundBank] = useState("");
  const [refundAccount, setRefundAccount] = useState("");

  const absMonths = Math.abs(parseInt(months) || 0);
  const newEndIssue = addMonthsToIssue(item.final_subscribe_end_issue, absMonths);

  // 유료 연장 시 참고 금액 계산: 단가 × 연장 개월
  const currentPeriod = item.subscribe_period || 12;
  const unitPrice = Math.floor(item.sale_price / currentPeriod);
  const suggestedAmount = unitPrice * absMonths;

  const mutation = useMutation({
    mutationFn: () =>
      orderItemsApi.extendSubscription(item.order_item_id, {
        extend_months: absMonths || 1,
        is_paid: isPaid,
        reason: reason || null,
        ...(isPaid ? {
          paid_amount: paidAmount ? parseInt(paidAmount) : null,
          refund_bank: refundBank || null,
          refund_account: refundAccount || null,
        } : {}),
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
    setPaidAmount("");
    setRefundBank("");
    setRefundAccount("");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-lg">
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
              <span>현재 구독 기간</span>
              <span className="font-medium">
                {formatIssue(item.final_subscribe_start_issue)} ~ {formatIssue(item.final_subscribe_end_issue)}
              </span>
            </div>
            {newEndIssue && (
              <div className="flex justify-between text-blue-600">
                <span>변경 후 구독 기간</span>
                <span className="font-medium">
                  {formatIssue(item.final_subscribe_start_issue)} ~ {formatIssue(newEndIssue)}
                </span>
              </div>
            )}
          </div>

          {/* 연장 유형 */}
          <div>
            <Label>연장 유형</Label>
            <div className="flex rounded-md border border-gray-200 overflow-hidden text-xs mt-1">
              <button
                type="button"
                className={`flex-1 py-2 transition-colors ${!isPaid ? "bg-blue-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
                onClick={() => setIsPaid(false)}
              >
                무상 연장
              </button>
              <button
                type="button"
                className={`flex-1 py-2 transition-colors ${isPaid ? "bg-blue-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
                onClick={() => setIsPaid(true)}
              >
                유료 연장
              </button>
            </div>
          </div>

          {/* 연장 개월 수 */}
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

          {/* 유료 연장: 결제 금액 */}
          {isPaid && absMonths > 0 && (
            <>
              <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-500 space-y-1">
                <div className="font-medium text-gray-600">결제 금액 (참고)</div>
                <div className="flex justify-between">
                  <span>판매가 ÷ 구독기간</span>
                  <span>{formatAmount(item.sale_price)} ÷ {currentPeriod}개월 = {formatAmount(unitPrice)}/월</span>
                </div>
                <div className="flex justify-between">
                  <span>단가 × {absMonths}개월</span>
                  <span>{formatAmount(suggestedAmount)}</span>
                </div>
              </div>

              <div>
                <Label>결제 금액</Label>
                <Input
                  type="number"
                  min={0}
                  className="mt-1"
                  placeholder={String(suggestedAmount)}
                  value={paidAmount}
                  onChange={(e) => setPaidAmount(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <span className="text-xs font-medium text-gray-600">입금 계좌</span>
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
            </>
          )}

          {/* 연장 사유 */}
          <div>
            <Label>연장 사유 <span className="text-gray-400 font-normal">(선택)</span></Label>
            <Input
              className="mt-1"
              placeholder="연장 사유"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>취소</Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || absMonths < 1}
          >
            {isPaid ? "유료 연장" : "무상 연장"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
