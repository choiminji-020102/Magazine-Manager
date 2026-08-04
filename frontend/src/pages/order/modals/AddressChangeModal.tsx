import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import {
  VipFlagsDisplay,
  VipFlagsEditor,
  activeVipSlot,
  buildVipPayload,
  vipSlotLabel,
} from "@/components/common/VipFlags";
import { addressesApi } from "@/api/addressesApi";
import { orderItemsApi } from "@/api/orderItemsApi";
import { vipSlotsApi } from "@/api/vipSlotsApi";
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
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [selectedAddressId, setSelectedAddressId] = useState<number | null>(null);
  const [newAddr, setNewAddr] = useState<NewAddressValue>(() => buildPrefilledNewAddress(item));
  const [newAddrErrors, setNewAddrErrors] = useState<NewAddressErrors>(EMPTY_NEW_ADDRESS_ERRORS);
  // VIP 그룹은 배송지(Address) 단위 설정이라 배송지를 바꾸면 따라오지 않는다.
  // 이 모달에서 함께 지정해 VIP 발송 대상에서 조용히 빠지는 것을 막는다.
  const [selectedVipSlot, setSelectedVipSlot] = useState<number | null>(null);

  // 고객 배송지 목록
  const { data: addrRes } = useQuery({
    queryKey: ["customer-addresses", customerId],
    queryFn: () =>
      addressesApi.getAddressesByCustomer(customerId).then((r) => r.data),
    enabled: open && !!customerId,
  });

  const { data: vipSlots = [] } = useQuery({
    queryKey: ["vip-slots"],
    queryFn: () => vipSlotsApi.getVipSlots().then((r) => r.data.data ?? []),
    enabled: open,
  });

  const addresses = addrRes?.data ?? [];
  const hasEnabledVipSlot = vipSlots.some((s) => s.is_enabled);
  const currentVipSlot = activeVipSlot(item.address, vipSlots);

  // 라디오 기본값 — 기존 배송지를 고르면 그 배송지의 실제 설정, 신규 입력이면 현재 배송지 설정을 승계.
  // 원시값(number|null)으로 좁혀 두는 이유 — 배열을 의존성에 두면 refetch 로 참조만 바뀌어도
  // effect 가 다시 돌아 관리자가 방금 고른 라디오를 되돌려 버린다.
  const defaultVipSlot = useMemo(() => {
    if (mode === "new") return currentVipSlot;
    const target = addresses.find((a) => a.address_id === selectedAddressId);
    return target ? activeVipSlot(target, vipSlots) : currentVipSlot;
  }, [mode, selectedAddressId, addresses, vipSlots, currentVipSlot]);

  useEffect(() => {
    if (!open) return;
    setSelectedVipSlot(defaultVipSlot);
  }, [open, defaultVipSlot]);

  const mutation = useMutation({
    mutationFn: async () => {
      const res =
        mode === "existing" && selectedAddressId
          ? await orderItemsApi.updateAddress(item.order_item_id, {
              address_id: selectedAddressId,
            })
          : await orderItemsApi.updateAddress(item.order_item_id, {
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

      // 배송지 변경이 실제로 적용된 경우에만 VIP 지정을 반영한다.
      // 배송지 변경은 이미 끝났으므로 VIP 실패로 전체를 실패 처리하지 않는다.
      const changedAddressId = res.data.data?.changed_address_id;
      let vipApplied = false;
      let vipError: string | null = null;
      if (res.data.data?.can_change && changedAddressId) {
        const target = addresses.find((a) => a.address_id === changedAddressId);
        // 신규 생성 주소는 목록에 없음 → VIP 전부 false 로 간주
        if (activeVipSlot(target, vipSlots) !== selectedVipSlot) {
          try {
            await addressesApi.updateAddress(changedAddressId, buildVipPayload(selectedVipSlot));
            vipApplied = true;
          } catch (err) {
            vipError = getErrorMessage(err);
          }
        }
      }
      return { res, vipApplied, vipError };
    },
    onSuccess: ({ res, vipApplied, vipError }) => {
      const result = res.data.data;
      if (!result?.can_change) {
        toast.error(result?.message ?? "배송지를 변경할 수 없습니다.");
        return;
      }
      // 발송 후보에 이미 담긴 건은 예전 주소 그대로다 — 재생성해야 반영되므로 가장 강하게 알린다
      if (result.preparing_issues.length > 0) {
        const preparing = result.preparing_issues.map(formatIssue).join(", ");
        toast.warning(
          "발송 후보를 다시 만들어주세요",
          `배송지는 바뀌었지만, ${preparing}가 이미 발송 후보에 담겨 있어 예전 주소 그대로입니다. ` +
            `발송 후보 화면에서 [발송 생성]을 다시 누르지 않으면 예전 주소로 배송됩니다.`
        );
      } else if (result.already_shipped_issues.length > 0) {
        const issues = result.already_shipped_issues.map(formatIssue).join(", ");
        toast.warning(
          "배송지가 변경되었습니다.",
          `이미 발송 완료된 ${issues}는 예전 주소 그대로이고, 다음 호부터 새 주소로 나갑니다.`
        );
      } else {
        toast.success("배송지가 변경되었습니다.");
      }
      if (vipError) {
        toast.error("VIP 그룹 지정 실패", `배송지는 변경되었습니다. ${vipError}`);
      } else if (vipApplied) {
        const slot = vipSlots.find((s) => s.slot_number === selectedVipSlot);
        toast.success(
          slot
            ? `VIP 그룹 '${vipSlotLabel(slot)}'이 새 배송지에 지정되었습니다.`
            : "새 배송지의 VIP 그룹이 해제되었습니다."
        );
      }
      if (vipApplied) {
        // 배송지 목록 캐시 두 벌 — 이 모달과 OrderDetailPanel 이 서로 다른 키를 쓴다
        queryClient.invalidateQueries({ queryKey: ["customer-addresses"] });
        queryClient.invalidateQueries({ queryKey: ["customerAddresses"] });
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
    setSelectedVipSlot(null);
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
              <VipFlagsDisplay address={item.address} slots={vipSlots} compact />
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

          {/* VIP 그룹 — 배송지 단위 설정이라 변경 시 함께 지정해야 발송 대상에서 빠지지 않는다 */}
          {hasEnabledVipSlot && (
            <div className="border-t border-gray-100 pt-3 space-y-1.5">
              <div className="text-xs font-medium text-gray-500">VIP 그룹</div>
              <VipFlagsEditor
                address={buildVipPayload(selectedVipSlot)}
                slots={vipSlots}
                onChange={setSelectedVipSlot}
                disabled={mutation.isPending}
              />
              <p className="text-xs text-gray-400">
                {mode === "new"
                  ? "※ 현재 배송지의 설정이 기본 선택됩니다. 변경 후 새 배송지에 적용됩니다."
                  : "※ 선택한 배송지의 현재 설정이 표시됩니다. 바꾸면 그 배송지에 적용됩니다."}
              </p>
            </div>
          )}

          <p className="text-xs text-gray-400">
            ※ 이미 발송 완료된 회차는 예전 주소 그대로이고, 남은 회차만 새 주소로 바뀝니다. (구독이 끝나 남은 회차가 없으면 변경 불가)
            <br />
            ※ 이미 <span className="text-amber-600 font-medium">발송 후보에 담긴 건은 [발송 생성]을 다시</span> 눌러야 새 주소로 바뀝니다.
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
