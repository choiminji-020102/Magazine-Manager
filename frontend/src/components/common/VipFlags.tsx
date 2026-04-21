import { Checkbox } from "@/components/ui/checkbox";
import type { AddressResponse } from "@/types/address";
import type { VipSlotResponse } from "@/types/vipSlot";

type VipKey = "vip1" | "vip2" | "vip3" | "vip4" | "vip5" | "vip6";

function vipKey(slotNumber: number): VipKey {
  return `vip${slotNumber}` as VipKey;
}

function slotLabel(slot: VipSlotResponse): string {
  return slot.label?.trim() || `vip${slot.slot_number}`;
}

// 활성화된 슬롯 중 address에 T로 표시된 것만 칩으로 출력 (읽기 전용)
export function VipFlagsDisplay({
  address,
  slots,
}: {
  address: AddressResponse;
  slots: VipSlotResponse[];
}) {
  const active = slots.filter(
    (s) => s.is_enabled && Boolean(address[vipKey(s.slot_number)])
  );
  if (active.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1">
      {active.map((s) => (
        <span
          key={s.slot_number}
          className="inline-flex items-center px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs font-medium"
        >
          {slotLabel(s)}
        </span>
      ))}
    </div>
  );
}

// 활성화된 슬롯만 체크박스 노출 (편집 가능)
export function VipFlagsEditor({
  address,
  slots,
  onToggle,
  disabled,
}: {
  address: AddressResponse;
  slots: VipSlotResponse[];
  onToggle: (slotNumber: number, checked: boolean) => void;
  disabled?: boolean;
}) {
  const enabled = slots.filter((s) => s.is_enabled);
  if (enabled.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1.5">
      {enabled.map((s) => {
        const checked = Boolean(address[vipKey(s.slot_number)]);
        return (
          <label
            key={s.slot_number}
            className="flex items-center gap-1.5 cursor-pointer select-none"
          >
            <Checkbox
              checked={checked}
              onCheckedChange={(c) => onToggle(s.slot_number, c === true)}
              disabled={disabled}
            />
            <span className="text-xs text-gray-600">{slotLabel(s)}</span>
          </label>
        );
      })}
    </div>
  );
}
