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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AddressSearchField } from "@/components/common/AddressSearchField";
import { addressesApi } from "@/api/addressesApi";
import { orderItemsApi } from "@/api/orderItemsApi";
import { toast } from "@/hooks/use-toast";
import { formatPhone } from "@/utils/format";
import type { OrderItemResponse } from "@/types/orderItem";
import type { AddressResponse } from "@/types/address";

interface Props {
  open: boolean;
  onClose: () => void;
  item: OrderItemResponse;
  orderId: number;
  customerId: number;
}

export function AddressChangeModal({ open, onClose, item, orderId, customerId }: Props) {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [selectedAddressId, setSelectedAddressId] = useState<number | null>(null);
  const [newAddr, setNewAddr] = useState({
    recipient_name: "",
    recipient_phone: "",
    postal_code: "",
    recipient_address: "",
    customer_memo: "",
    admin_memo: "",
  });

  // 고객 배송지 목록
  const { data: addrRes } = useQuery({
    queryKey: ["customer-addresses", customerId],
    queryFn: () =>
      addressesApi.getAddressesByCustomer(customerId).then((r) => r.data),
    enabled: open && !!customerId,
  });

  const addresses = addrRes?.data ?? [];

  const mutation = useMutation({
    mutationFn: () => {
      if (mode === "existing" && selectedAddressId) {
        return orderItemsApi.updateAddress(item.order_item_id, {
          address_id: selectedAddressId,
        });
      }
      return orderItemsApi.updateAddress(item.order_item_id, {
        new_address: {
          customer_id: customerId,
          recipient_name: newAddr.recipient_name,
          recipient_phone: newAddr.recipient_phone,
          postal_code: newAddr.postal_code,
          recipient_address: newAddr.recipient_address,
          customer_memo: newAddr.customer_memo || null,
          admin_memo: newAddr.admin_memo || null,
        },
      });
    },
    onSuccess: (res) => {
      const result = res.data.data;
      if (!result?.can_change) {
        toast.error(result?.message ?? "배송지를 변경할 수 없습니다.");
        return;
      }
      toast.success("배송지가 변경되었습니다.");
      queryClient.invalidateQueries({ queryKey: ["order", orderId] });
      handleClose();
    },
    onError: () => toast.error("배송지 변경 실패"),
  });

  const handleClose = () => {
    setSelectedAddressId(null);
    setNewAddr({
      recipient_name: "",
      recipient_phone: "",
      postal_code: "",
      recipient_address: "",
      customer_memo: "",
      admin_memo: "",
    });
    setMode("existing");
    onClose();
  };

  const canSubmit =
    mode === "existing"
      ? !!selectedAddressId
      : !!newAddr.recipient_name &&
        !!newAddr.recipient_phone &&
        !!newAddr.postal_code &&
        !!newAddr.recipient_address;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>배송지 변경</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {/* 현재 배송지 */}
          {item.address && (
            <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-600 space-y-1">
              <div className="text-xs font-medium text-gray-500 mb-1">현재 배송지</div>
              <div className="flex justify-between">
                <span>{item.address.recipient_name}</span>
                <span className="font-mono">{formatPhone(item.address.recipient_phone)}</span>
              </div>
              <div className="text-gray-500">
                ({item.address.postal_code}) {item.address.recipient_address}
              </div>
            </div>
          )}

          {/* 모드 선택 */}
          <div className="flex gap-2">
            <button
              className={`px-3 py-1.5 text-xs rounded-md border transition-colors ${
                mode === "existing"
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-gray-600 border-gray-300"
              }`}
              onClick={() => setMode("existing")}
              disabled={addresses.length === 0}
            >
              기존 배송지
              {addresses.length === 0 && <span className="ml-1 opacity-70">(없음)</span>}
            </button>
            <button
              className={`px-3 py-1.5 text-xs rounded-md border transition-colors ${
                mode === "new"
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-gray-600 border-gray-300"
              }`}
              onClick={() => setMode("new")}
            >
              신규 입력
            </button>
          </div>

          {/* 기존 배송지 목록 */}
          {mode === "existing" && (
            <div className="space-y-1.5 max-h-52 overflow-y-auto">
              {addresses.map((addr: AddressResponse) => (
                <button
                  key={addr.address_id}
                  onClick={() => setSelectedAddressId(addr.address_id)}
                  className={`w-full text-left border rounded-lg p-2.5 text-xs transition-colors ${
                    selectedAddressId === addr.address_id
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="font-medium text-gray-900">{addr.recipient_name}</span>
                    <span className="font-mono text-gray-500">{formatPhone(addr.recipient_phone)}</span>
                  </div>
                  <div className="text-gray-500">
                    ({addr.postal_code}) {addr.recipient_address}
                  </div>
                  {addr.customer_memo && (
                    <div className="text-gray-400 mt-0.5">{addr.customer_memo}</div>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* 신규 배송지 입력 */}
          {mode === "new" && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">수령인 *</Label>
                  <Input
                    className="mt-1"
                    value={newAddr.recipient_name}
                    onChange={(e) =>
                      setNewAddr((p) => ({ ...p, recipient_name: e.target.value }))
                    }
                    placeholder="수령인"
                  />
                </div>
                <div>
                  <Label className="text-xs">연락처 *</Label>
                  <Input
                    className="mt-1"
                    value={newAddr.recipient_phone}
                    onChange={(e) =>
                      setNewAddr((p) => ({ ...p, recipient_phone: e.target.value }))
                    }
                    placeholder="010-0000-0000"
                  />
                </div>
              </div>
              <AddressSearchField
                postalCode={newAddr.postal_code}
                address={newAddr.recipient_address}
                onChange={(postal_code, recipient_address) =>
                  setNewAddr((p) => ({ ...p, postal_code, recipient_address }))
                }
                required
              />
              <div>
                <Label className="text-xs">배송 메모</Label>
                <Input
                  className="mt-1"
                  value={newAddr.customer_memo}
                  onChange={(e) =>
                    setNewAddr((p) => ({ ...p, customer_memo: e.target.value }))
                  }
                  placeholder="(선택)"
                />
              </div>
              <div>
                <Label className="text-xs">관리자 메모</Label>
                <Input
                  className="mt-1"
                  value={newAddr.admin_memo}
                  onChange={(e) =>
                    setNewAddr((p) => ({ ...p, admin_memo: e.target.value }))
                  }
                  placeholder="(선택)"
                />
              </div>
            </div>
          )}

          <p className="text-xs text-gray-400">
            ※ 해당 월 1일 이후이거나 이미 배송 중인 경우 변경이 제한됩니다.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>취소</Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={!canSubmit || mutation.isPending}
          >
            변경
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
