import { useState, useEffect } from "react";
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
import { getErrorMessage } from "@/utils/errorHandler";
import type { OrderItemDetailResponse } from "@/types/orderItem";

interface Props {
  open: boolean;
  onClose: () => void;
  item: OrderItemDetailResponse;
  orderId: number;
}

export function OrderItemEditModal({ open, onClose, item, orderId }: Props) {
  const queryClient = useQueryClient();

  const [form, setForm] = useState({
    order_num: item.order_num,
    sale_price: item.sale_price,
    admin_memo: item.admin_memo ?? "",
  });

  // 모달 열릴 때 최신 값으로 초기화
  useEffect(() => {
    if (open) {
      setForm({
        order_num: item.order_num,
        sale_price: item.sale_price,
        admin_memo: item.admin_memo ?? "",
      });
    }
  }, [open, item]);

  const mutation = useMutation({
    mutationFn: () =>
      orderItemsApi.updateOrderItem(item.order_item_id, {
        order_num: form.order_num,
        sale_price: form.sale_price,
        admin_memo: form.admin_memo || null,
      }),
    onSuccess: () => {
      toast.success("품목이 수정되었습니다.");
      queryClient.invalidateQueries({ queryKey: ["order", orderId] });
      onClose();
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>품목 수정</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-1">
          <div className="text-xs text-gray-500 bg-gray-50 rounded-md px-3 py-2">
            {item.product_name}
            <span className="ml-2 font-mono text-gray-400">{item.product_code}</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">수량</Label>
              <Input
                type="number"
                min={1}
                className="mt-1"
                value={form.order_num}
                onChange={(e) =>
                  setForm((f) => ({ ...f, order_num: parseInt(e.target.value) || 1 }))
                }
              />
            </div>
            <div>
              <Label className="text-xs">판매가 (원)</Label>
              <Input
                type="number"
                min={0}
                className="mt-1"
                value={form.sale_price}
                onChange={(e) =>
                  setForm((f) => ({ ...f, sale_price: parseInt(e.target.value) || 0 }))
                }
              />
            </div>
          </div>

          <div>
            <Label className="text-xs">관리자 메모</Label>
            <Input
              className="mt-1"
              value={form.admin_memo}
              onChange={(e) => setForm((f) => ({ ...f, admin_memo: e.target.value }))}
              placeholder="(선택)"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            취소
          </Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            저장
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
