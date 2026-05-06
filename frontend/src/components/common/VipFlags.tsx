import type { VipSlotResponse } from "@/types/vipSlot";

type VipKey = "vip1" | "vip2" | "vip3" | "vip4" | "vip5" | "vip6";

// vip1~vip6 불리언 필드만 요구 (AddressResponse, OrderListResponse, CustomerListItem 모두 호환)
export type VipSource = {
  vip1: boolean;
  vip2: boolean;
  vip3: boolean;
  vip4: boolean;
  vip5: boolean;
  vip6: boolean;
};

function vipKey(slotNumber: number): VipKey {
  return `vip${slotNumber}` as VipKey;
}

function slotLabel(slot: VipSlotResponse): string {
  return slot.label?.trim() || `vip${slot.slot_number}`;
}

// 활성화된 슬롯 중 source에 T로 표시된 것만 칩으로 출력 (읽기 전용)
export function VipFlagsDisplay({
  address,
  slots,
  compact = false,
}: {
  address: VipSource;
  slots: VipSlotResponse[];
  compact?: boolean;
}) {
  const active = slots.filter(
    (s) => s.is_enabled && Boolean(address[vipKey(s.slot_number)])
  );
  if (active.length === 0) return null;

  const chipClass = compact
    ? "inline-flex items-center px-1.5 py-0 rounded bg-amber-50 text-amber-700 text-[10px] font-medium leading-4"
    : "inline-flex items-center px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 text-xs font-medium";

  return (
    <div className="flex flex-wrap gap-1">
      {active.map((s) => (
        <span key={s.slot_number} className={chipClass}>
          {slotLabel(s)}
        </span>
      ))}
    </div>
  );
}

// 활성화된 슬롯만 라디오로 노출 (편집 가능, 한 Address 당 최대 1개).
// 같은 슬롯 다시 클릭 시 해제 (별도 '사용 안 함' 옵션 없음).
// onChange 콜백: 새로 선택된 슬롯 번호 (해제 시 null) — 호출자가 한 PATCH 로 전체 vip1~vip6 일괄 갱신.
export function VipFlagsEditor({
  address,
  slots,
  onChange,
  disabled,
}: {
  address: VipSource;
  slots: VipSlotResponse[];
  onChange: (slotNumber: number | null) => void;
  disabled?: boolean;
}) {
  const enabled = slots.filter((s) => s.is_enabled);
  if (enabled.length === 0) return null;

  // 현재 활성 슬롯 (V-7 단일성 보장 — 없거나 1개)
  const currentActive = enabled.find((s) => Boolean(address[vipKey(s.slot_number)]));
  const currentSlotNumber = currentActive?.slot_number ?? null;

  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1.5" role="radiogroup">
      {enabled.map((s) => {
        const checked = currentSlotNumber === s.slot_number;
        return (
          <label
            key={s.slot_number}
            className={`flex items-center gap-1.5 select-none ${
              disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
            }`}
          >
            {/* HTML radio + custom onClick — 표준 radio 는 같은 항목 재클릭으로 해제 안 되므로 onClick 으로 처리.
                name 안 쓰고 checked prop 으로만 제어 (한 페이지 안 여러 주소의 라디오 그룹 격리). */}
            <input
              type="radio"
              checked={checked}
              disabled={disabled}
              readOnly
              onClick={() => {
                if (disabled) return;
                // 같은 슬롯 다시 클릭 시 해제, 다른 슬롯 클릭 시 그 슬롯으로 변경
                onChange(checked ? null : s.slot_number);
              }}
              className="h-3.5 w-3.5 cursor-pointer accent-blue-600"
            />
            <span className="text-xs text-gray-600">{slotLabel(s)}</span>
          </label>
        );
      })}
    </div>
  );
}
