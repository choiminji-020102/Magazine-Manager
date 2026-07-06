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
import { AddressList } from "@/components/common/AddressList";
import {
  NewAddressForm,
  EMPTY_NEW_ADDRESS,
  EMPTY_NEW_ADDRESS_ERRORS,
  validateNewAddress,
  type NewAddressValue,
  type NewAddressErrors,
} from "@/components/common/NewAddressForm";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { addressesApi } from "@/api/addressesApi";
import { orderItemsApi } from "@/api/orderItemsApi";
import { toast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/utils/errorHandler";
import { formatPhone, formatIssue } from "@/utils/format";
import type { OrderItemResponse } from "@/types/orderItem";

interface Props {
  open: boolean;
  onClose: () => void;
  item: OrderItemResponse;
  customerId: number;
  onSuccess: () => void;
}

function buildPrefilledNewAddress(item: OrderItemResponse): NewAddressValue {
  return {
    ...EMPTY_NEW_ADDRESS,
    recipient_name: item.address?.recipient_name ?? "",
    recipient_phone: item.address?.recipient_phone ?? "",
  };
}

export function AddressChangeModal({ open, onClose, item, customerId, onSuccess }: Props) {
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [selectedAddressId, setSelectedAddressId] = useState<number | null>(null);
  const [newAddr, setNewAddr] = useState<NewAddressValue>(() => buildPrefilledNewAddress(item));
  const [newAddrErrors, setNewAddrErrors] = useState<NewAddressErrors>(EMPTY_NEW_ADDRESS_ERRORS);

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
      if (result.already_shipped_issues.length > 0) {
        const issues = result.already_shipped_issues.map(formatIssue).join(", ");
        toast.warning(
          "배송지가 변경되었습니다.",
          `이미 발송 완료된 ${issues}는 기존 배송지가 유지됩니다.`
        );
      } else {
        toast.success("배송지가 변경되었습니다.");
      }
      onSuccess();
      handleClose();
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const handleClose = () => {
    setSelectedAddressId(null);
    setNewAddr(buildPrefilledNewAddress(item));
    setNewAddrErrors(EMPTY_NEW_ADDRESS_ERRORS);
    setMode("existing");
    onClose();
  };

  const handleSubmit = () => {
    if (mode === "existing") {
      if (!selectedAddressId) {
        toast.error("변경할 배송지를 선택해주세요.");
        return;
      }
      mutation.mutate();
      return;
    }

    const { errors, firstMessage } = validateNewAddress(newAddr);
    setNewAddrErrors(errors);
    if (firstMessage) {
      toast.error(firstMessage);
      return;
    }
    mutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-lg">
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
            <AddressList
              addresses={addresses}
              selectedAddressId={selectedAddressId}
              onSelect={setSelectedAddressId}
              currentAddressId={item.address?.address_id}
            />
          )}

          {/* 신규 배송지 입력 */}
          {mode === "new" && (
            <NewAddressForm
              value={newAddr}
              onChange={setNewAddr}
              errors={newAddrErrors}
              onErrorsChange={setNewAddrErrors}
            />
          )}

          <p className="text-xs text-gray-400">
            ※ 이미 발송 완료된 회차는 기존 배송지가 유지되고, 남은 회차만 변경됩니다. (전 회차 발송 완료 시 변경 불가)
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={mutation.isPending}>취소</Button>
          <Button onClick={handleSubmit} disabled={mutation.isPending}>
            {mutation.isPending && <LoadingSpinner size="sm" className="mr-1" />}
            변경
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
