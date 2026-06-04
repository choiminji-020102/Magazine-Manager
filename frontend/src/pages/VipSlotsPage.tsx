import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
  const [selectedSlotNumber, setSelectedSlotNumber] = useState<number>(1);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["vip-slots"],
    queryFn: () => vipSlotsApi.getVipSlots().then((res) => res.data.data ?? []),
  });

  const enabledCount = data?.filter((s) => s.is_enabled).length ?? 0;
  const selectedSlot = data?.find((s) => s.slot_number === selectedSlotNumber) ?? null;

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <PageHeader
        left={<span className="text-sm text-gray-500">{enabledCount}개 활성</span>}
      />

      <div className="flex-1 min-h-0 flex overflow-hidden">
        {/* 왼쪽: 슬롯 목록 */}
        <div className="w-64 flex-shrink-0 border-r border-gray-200 flex flex-col bg-gray-50">
          <div className="px-4 py-2.5 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">슬롯</span>
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">활성</span>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="flex justify-center py-8">
                <LoadingSpinner size="md" />
              </div>
            ) : isError || !data ? (
              <p className="text-sm text-red-500 px-4 py-4">불러오지 못했습니다.</p>
            ) : (
              data.map((slot) => (
                <SlotListItem
                  key={slot.slot_number}
                  slot={slot}
                  isSelected={selectedSlotNumber === slot.slot_number}
                  onClick={() => setSelectedSlotNumber(slot.slot_number)}
                  onSaved={() => queryClient.invalidateQueries({ queryKey: ["vip-slots"] })}
                />
              ))
            )}
          </div>
        </div>

        {/* 오른쪽: 선택된 슬롯 상세 */}
        <div className="flex-1 min-w-0 flex flex-col bg-white overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <LoadingSpinner size="lg" />
            </div>
          ) : selectedSlot ? (
            <SlotDetail
              slot={selectedSlot}
              onSaved={() => queryClient.invalidateQueries({ queryKey: ["vip-slots"] })}
            />
          ) : (
            <EmptyState message="슬롯을 선택하세요." className="h-full" />
          )}
        </div>
      </div>
    </div>
  );
}

function SlotListItem({
  slot,
  isSelected,
  onClick,
  onSaved,
}: {
  slot: VipSlotResponse;
  isSelected: boolean;
  onClick: () => void;
  onSaved: () => void;
}) {
  const toggleMutation = useMutation({
    mutationFn: (is_enabled: boolean) =>
      vipSlotsApi.updateVipSlot(slot.slot_number, { is_enabled }),
    onSuccess: () => onSaved(),
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  return (
    <div
      className={`flex items-center border-b border-gray-100 transition-colors ${
        isSelected
          ? "bg-blue-50 border-l-[3px] border-l-blue-600"
          : "hover:bg-gray-100 border-l-[3px] border-l-transparent"
      }`}
    >
      {/* 클릭 영역 (슬롯 선택) */}
      <button className="flex items-center gap-3 flex-1 min-w-0 px-4 py-3 text-left" onClick={onClick}>
        <span
          className={`w-2 h-2 rounded-full flex-shrink-0 ${
            slot.is_enabled ? "bg-green-500" : "bg-gray-300"
          }`}
        />
        <span className="font-mono text-xs bg-white border border-gray-200 px-2 py-0.5 rounded text-gray-500 flex-shrink-0">
          vip{slot.slot_number}
        </span>
        <span className={`text-sm truncate ${slot.label ? "text-gray-700" : "text-gray-400"}`}>
          {slot.label ?? "미설정"}
        </span>
      </button>
      {/* 활성화 토글 (클릭 독립) */}
      <div className="px-4 py-3 flex-shrink-0">
        {toggleMutation.isPending ? (
          <LoadingSpinner size="sm" />
        ) : (
          <Checkbox
            checked={slot.is_enabled}
            onCheckedChange={(c) => {
              if ((c === true) !== slot.is_enabled) toggleMutation.mutate(c === true);
            }}
          />
        )}
      </div>
    </div>
  );
}

function SlotDetail({
  slot,
  onSaved,
}: {
  slot: VipSlotResponse;
  onSaved: () => void;
}) {
  const [labelInput, setLabelInput] = useState(slot.label ?? "");

  useEffect(() => {
    setLabelInput(slot.label ?? "");
  }, [slot.slot_number, slot.label]);

  const mutation = useMutation({
    mutationFn: (label: string | null) =>
      vipSlotsApi.updateVipSlot(slot.slot_number, { label }),
    onSuccess: () => onSaved(),
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const handleLabelBlur = () => {
    const trimmed = labelInput.trim();
    const current = slot.label ?? "";
    if (trimmed === current) return;
    mutation.mutate(trimmed === "" ? null : trimmed);
  };

  return (
    <>
      {/* 슬롯 설정 헤더 */}
      <div className="px-5 py-3.5 border-b border-gray-200 flex-shrink-0 flex items-center gap-4">
        <span className="font-mono text-sm bg-gray-100 px-2.5 py-1 rounded text-gray-600 flex-shrink-0">
          vip{slot.slot_number}
        </span>
        <div className="flex-1 max-w-sm">
          <Input
            value={labelInput}
            onChange={(e) => setLabelInput(e.target.value)}
            onBlur={handleLabelBlur}
            placeholder="라벨 미설정"
            maxLength={50}
            className="h-8 text-sm"
            disabled={mutation.isPending}
          />
        </div>
        {mutation.isPending && (
          <LoadingSpinner size="sm" className="flex-shrink-0" />
        )}
      </div>

      {/* 배송지 목록 */}
      <div className="flex-1 overflow-hidden">
        <div className="h-full overflow-y-auto">
          <VipAddressList slotNumber={slot.slot_number} />
        </div>
      </div>
    </>
  );
}

function VipAddressList({ slotNumber }: { slotNumber: number }) {
  const { data, isLoading } = useQuery({
    queryKey: ["vip-slot-addresses", slotNumber],
    queryFn: () =>
      addressesApi
        .getAddresses({
          vip_slot_number: slotNumber,
          limit: 100,
          sort_by: "recipient_name",
          sort_order: "asc",
        })
        .then((r) => r.data),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const items: AddressResponse[] = data?.items ?? [];

  if (items.length === 0) {
    return <EmptyState message="등록된 배송지가 없습니다." />;
  }

  return (
    <table className="w-full">
      <thead>
        <tr className="border-b border-gray-200 bg-white">
          <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wide w-28">이름</th>
          <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wide w-36">연락처</th>
          <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wide w-24">우편번호</th>
          <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">주소</th>
        </tr>
      </thead>
      <tbody>
        {items.map((addr, i) => (
          <tr
            key={addr.address_id}
            className={`border-b border-gray-100 ${i % 2 === 1 ? "bg-gray-50/40" : ""}`}
            style={{ height: "44px" }}
          >
            <td className="px-3 py-2.5 text-sm font-medium text-gray-900">{addr.recipient_name}</td>
            <td className="px-3 py-2.5 text-sm font-mono text-gray-500">{addr.recipient_phone}</td>
            <td className="px-3 py-2.5 text-xs font-mono text-gray-400">{addr.postal_code}</td>
            <td className="px-3 py-2.5 text-sm text-gray-700">{addr.recipient_address}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
