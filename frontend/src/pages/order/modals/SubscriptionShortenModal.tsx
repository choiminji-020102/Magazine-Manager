import { useState, useEffect } from "react";
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

import type { OrderItemResponse } from "@/types/orderItem";

interface Props {
  open: boolean;
  onClose: () => void;
  item: OrderItemResponse;
  onSuccess: () => void;
}

export function SubscriptionShortenModal({ open, onClose, item, onSuccess }: Props) {
  const [months, setMonths] = useState("1");
  const [error, setError] = useState<string | null>(null);
  const [calcResult, setCalcResult] = useState<{
    current_end_issue: string;
    shorten_end_issue: string;
    shorten_count: number;
    paid_period: number;
    unit_price: number;
    sale_price: number;
    order_num: number;
    refund_amount: number;
  } | null>(null);
  const [refundAmount, setRefundAmount] = useState("");
  const [refundBank, setRefundBank] = useState("");
  const [refundAccount, setRefundAccount] = useState("");

  const absMonths = Math.abs(parseInt(months) || 0);

  // 최대 단축 가능 개월 계산 (발송 완료 호 이후만 단축 가능)
  const calcMaxShorten = () => {
    const endY = parseInt(item.final_subscribe_end_issue.slice(0, 4));
    const endM = parseInt(item.final_subscribe_end_issue.slice(4, 6));
    if (item.last_send_issue) {
      const sentY = parseInt(item.last_send_issue.slice(0, 4));
      const sentM = parseInt(item.last_send_issue.slice(4, 6));
      return (endY - sentY) * 12 + (endM - sentM);
    }
    const startY = parseInt(item.subscribe_start_issue.slice(0, 4));
    const startM = parseInt(item.subscribe_start_issue.slice(4, 6));
    return (endY - startY) * 12 + (endM - startM);
  };
  const maxShorten = calcMaxShorten();

  // 모달 열릴 때 + 개월 수 변경 시 자동 계산
  useEffect(() => {
    if (!open) return;

    setCalcResult(null);
    setError(null);

    if (absMonths <= 0) return;

    calcMutation.mutate();
  }, [open, absMonths]);

  const calcMutation = useMutation({
    mutationFn: () =>
      orderItemsApi.shortenCalculate(item.order_item_id, {
        shorten_months: absMonths,
      }),
    onSuccess: (res) => {
      const data = res.data.data ?? null;
      setCalcResult(data);
      if (data) setRefundAmount(String(data.refund_amount));
    },
    onError: () => setError("환불액 계산에 실패했습니다."),
  });

  const confirmMutation = useMutation({
    mutationFn: () =>
      orderItemsApi.shortenConfirm(item.order_item_id, {
        shorten_end_issue: calcResult!.shorten_end_issue,
        refund_amount: parseInt(refundAmount) || 0,
        ...(refundBank && refundAccount
          ? { refund_bank: refundBank, refund_account: refundAccount }
          : {}),
      }),
    onSuccess: () => {
      toast.success("구독이 단축되었습니다.");
      onSuccess();
      handleClose();
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const handleClose = () => {
    setMonths("1");
    setCalcResult(null);
    setRefundAmount("");
    setRefundBank("");
    setRefundAccount("");
    setError(null);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>구독 단축</DialogTitle>
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
                {formatIssue(item.final_subscribe_start_issue)} ~ {formatIssue(calcResult?.current_end_issue ?? item.final_subscribe_end_issue)}
              </span>
            </div>
            {calcResult && (
              <div className="flex justify-between text-blue-600">
                <span>변경 후 구독 기간</span>
                <span className="font-medium">
                  {formatIssue(item.final_subscribe_start_issue)} ~ {formatIssue(calcResult.shorten_end_issue)}
                </span>
              </div>
            )}
          </div>

          {/* 단축 개월 수 */}
          <div>
            <Label>단축 개월 수 <span className="text-xs text-gray-400 font-normal">(최대 {maxShorten}개월)</span></Label>
            <Input
              type="number"
              min={1}
              max={maxShorten}
              className="mt-1"
              value={months}
              onChange={(e) => setMonths(e.target.value)}
            />
            {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
          </div>

          {/* 환불 계산 (참고용) */}
          {calcResult && (
            <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-500 space-y-1">
              <div className="font-medium text-gray-600">환불 계산 (참고)</div>
              <div className="flex justify-between">
                <span>판매가 ÷ 구독기간</span>
                <span>{formatAmount(calcResult.sale_price)} ÷ {calcResult.paid_period}개월 = {formatAmount(calcResult.unit_price)}/월</span>
              </div>
              <div className="flex justify-between">
                <span>단가 × {calcResult.shorten_count}개월{calcResult.order_num > 1 ? ` × ${calcResult.order_num}` : ""}</span>
                <span>{formatAmount(calcResult.refund_amount)}</span>
              </div>
            </div>
          )}

          <p className="text-xs text-gray-400">
            ※ 구독 단축 후에는 되돌릴 수 없습니다.
          </p>

          {/* 환불 금액 (직접 입력) */}
          {calcResult && (
            <div>
              <Label>환불 금액</Label>
              <div className="flex items-center gap-1.5 mt-1">
                <Input
                  type="number"
                  min={0}
                  value={refundAmount}
                  onChange={(e) => setRefundAmount(e.target.value)}
                />
                <span className="text-sm text-gray-500 flex-shrink-0">원</span>
              </div>
            </div>
          )}

          {/* 환불 계좌 */}
          {calcResult && (
            <div className="space-y-2">
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
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>취소</Button>
          <Button
            variant="destructive"
            onClick={() => confirmMutation.mutate()}
            disabled={!calcResult || !refundAmount || confirmMutation.isPending}
          >
            {absMonths > 0 ? `${absMonths}개월 단축 확정` : "단축 확정"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
