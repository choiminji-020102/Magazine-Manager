import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronRight } from "lucide-react";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { EmptyState } from "@/components/common/EmptyState";
import { PageHeader } from "@/components/common/PageHeader";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { vipSlotsApi } from "@/api/vipSlotsApi";
import { addressesApi } from "@/api/addressesApi";
import type { VipSlotResponse } from "@/types/vipSlot";
import type { AddressResponse } from "@/types/address";
import { toast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/utils/errorHandler";

export default function VipSlotsPage() {
  const queryClient = useQueryClient();
  const [expandedSlot, setExpandedSlot] = useState<number | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["vip-slots"],
    queryFn: () => vipSlotsApi.getVipSlots().then((res) => res.data.data ?? []),
  });

  const enabledCount = data?.filter((s) => s.is_enabled).length ?? 0;

  const handleToggleExpand = (slotNumber: number) => {
    setExpandedSlot((prev) => (prev === slotNumber ? null : slotNumber));
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      {/* Nit 수정: 로딩 중에도 항상 렌더링 (다른 페이지와 동일하게 ?? 0 기본값 사용) */}
      <PageHeader
        left={
          <span className="text-sm text-gray-500">{enabledCount}개 활성</span>
        }
      />

      {/* 안내 문구 */}
      <div className="px-5 py-2.5 bg-white border-b border-gray-200 flex-shrink-0">
        <p className="text-xs text-gray-400 leading-relaxed">
          활성화된 슬롯에 속한 배송지의 주문은 일반 단품·정기 발송에서 자동으로 제외되고, VIP 탭에서 별도로 발송 처리해야 합니다.
          해외배송·합포장 등 일반 발송 흐름으로 처리할 수 없는 특수 케이스를 분리할 때 사용하세요.
        </p>
      </div>

      <div className="flex-1 overflow-hidden bg-white">
        <div className="h-full overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <LoadingSpinner size="lg" />
            </div>
          ) : isError || !data ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-sm text-red-500">VIP 슬롯을 불러오지 못했습니다.</p>
            </div>
          ) : data.length === 0 ? (
            <EmptyState message="슬롯 정보가 없습니다." className="h-full" />
          ) : (
            <table className="w-full">
              <thead>
                {/* Warning 수정: 헤더 패딩 px-3 py-2.5 통일 (DataTable 기준) */}
                <tr className="border-b border-gray-200 bg-white">
                  <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wide w-36">
                    슬롯
                  </th>
                  <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                    라벨
                  </th>
                  <th className="px-3 py-2.5 text-center text-xs font-medium text-gray-500 uppercase tracking-wide w-28">
                    활성화
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.map((slot, i) => (
                  <VipSlotRows
                    key={slot.slot_number}
                    slot={slot}
                    isEven={i % 2 === 1}
                    isExpanded={expandedSlot === slot.slot_number}
                    onToggleExpand={() => handleToggleExpand(slot.slot_number)}
                    onSaved={() => queryClient.invalidateQueries({ queryKey: ["vip-slots"] })}
                  />
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

function VipSlotRows({
  slot,
  isEven,
  isExpanded,
  onToggleExpand,
  onSaved,
}: {
  slot: VipSlotResponse;
  isEven: boolean;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onSaved: () => void;
}) {
  const [labelInput, setLabelInput] = useState(slot.label ?? "");

  useEffect(() => {
    setLabelInput(slot.label ?? "");
  }, [slot.label]);

  const mutation = useMutation({
    mutationFn: (payload: { label?: string | null; is_enabled?: boolean }) =>
      vipSlotsApi.updateVipSlot(slot.slot_number, payload),
    onSuccess: () => onSaved(),
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const handleLabelBlur = () => {
    const trimmed = labelInput.trim();
    const current = slot.label ?? "";
    if (trimmed === current) return;
    mutation.mutate({ label: trimmed === "" ? null : trimmed });
  };

  const handleToggle = (checked: boolean) => {
    if (checked === slot.is_enabled) return;
    mutation.mutate({ is_enabled: checked });
  };

  return (
    <>
      {/* 슬롯 행 */}
      {/* Warning 수정: 셀 패딩 px-3 py-2.5 통일, 행 높이 44px (DataTable 기준) */}
      <tr
        className={`border-b border-gray-100 transition-colors ${
          isEven ? "bg-gray-50/40 hover:bg-gray-100/60" : "hover:bg-gray-50"
        } ${isExpanded ? "border-b-0" : ""}`}
        style={{ height: "44px" }}
      >
        <td className="px-3 py-2.5">
          <button
            className="flex items-center gap-1.5 group"
            onClick={onToggleExpand}
            title="배송지 목록 보기"
          >
            {isExpanded ? (
              <ChevronDown className="h-3.5 w-3.5 text-gray-400 group-hover:text-gray-600 flex-shrink-0" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 text-gray-400 group-hover:text-gray-600 flex-shrink-0" />
            )}
            <span className="inline-block font-mono text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded group-hover:bg-gray-200 transition-colors">
              vip{slot.slot_number}
            </span>
          </button>
        </td>
        <td className="px-3 py-2.5">
          <Input
            value={labelInput}
            onChange={(e) => setLabelInput(e.target.value)}
            onBlur={handleLabelBlur}
            placeholder="라벨 미설정"
            maxLength={50}
            className={`h-8 text-sm max-w-xs ${!slot.is_enabled ? "text-gray-400" : ""}`}
            disabled={mutation.isPending}
          />
        </td>
        <td className="px-3 py-2.5 text-center">
          {mutation.isPending ? (
            <div className="flex justify-center">
              <LoadingSpinner size="sm" />
            </div>
          ) : (
            <Checkbox
              checked={slot.is_enabled}
              onCheckedChange={(c) => handleToggle(c === true)}
            />
          )}
        </td>
      </tr>

      {/* 주소 목록 (아코디언) */}
      {isExpanded && (
        <tr className={`border-b border-gray-200 ${isEven ? "bg-gray-50/40" : "bg-white"}`}>
          <td colSpan={3} className="p-0">
            <VipAddressList slotNumber={slot.slot_number} />
          </td>
        </tr>
      )}
    </>
  );
}

function VipAddressList({ slotNumber }: { slotNumber: number }) {
  const { data, isLoading } = useQuery({
    queryKey: ["vip-slot-addresses", slotNumber],
    queryFn: () =>
      addressesApi
        .getAddresses({ vip_slot_number: slotNumber, limit: 100, sort_by: "recipient_name", sort_order: "asc" })
        .then((r) => r.data),
  });

  /* Nit 수정: 아코디언 로딩도 스피너만 (페이지 레벨과 동일 방식) */
  if (isLoading) {
    return (
      <div className="flex items-center justify-center px-10 py-4">
        <LoadingSpinner size="sm" />
      </div>
    );
  }

  const items: AddressResponse[] = data?.items ?? [];

  if (items.length === 0) {
    return (
      <div className="px-10 py-3 text-xs text-gray-400">
        이 슬롯에 등록된 배송지가 없습니다.
      </div>
    );
  }

  return (
    <div className="px-10 py-3 space-y-1.5">
      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">
        배송지 {items.length}개
      </p>
      {items.map((addr) => (
        <div key={addr.address_id} className="flex items-center gap-4 text-xs py-1">
          <span className="font-medium text-gray-800 w-20 flex-shrink-0">{addr.recipient_name}</span>
          <span className="font-mono text-gray-400 w-32 flex-shrink-0">{addr.recipient_phone}</span>
          <span className="text-gray-500 truncate">
            [{addr.postal_code}] {addr.recipient_address}
          </span>
        </div>
      ))}
    </div>
  );
}
