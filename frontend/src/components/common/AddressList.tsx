import { formatPhone } from "@/utils/format";
import type { AddressResponse } from "@/types/address";

interface AddressListProps {
  addresses: AddressResponse[];
  selectedAddressId: number | null;
  onSelect: (addressId: number) => void;
  currentAddressId?: number | null;
  emptyMessage?: string;
}

export function AddressList({
  addresses,
  selectedAddressId,
  onSelect,
  currentAddressId,
  emptyMessage = "등록된 배송지가 없습니다.",
}: AddressListProps) {
  if (addresses.length === 0) {
    return <p className="text-sm text-gray-500 text-center py-4">{emptyMessage}</p>;
  }

  return (
    <div className="space-y-1.5 max-h-52 overflow-y-auto">
      {addresses.map((addr) => {
        const isSelected = selectedAddressId === addr.address_id;
        const isCurrent = currentAddressId != null && addr.address_id === currentAddressId;
        return (
          <button
            key={addr.address_id}
            onClick={() => onSelect(addr.address_id)}
            className={`w-full text-left border rounded-lg p-2.5 text-xs transition-colors ${
              isSelected
                ? "border-blue-500 bg-blue-50"
                : isCurrent
                ? "border-gray-300 bg-gray-50"
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
            {isCurrent && (
              <span className="text-xs text-blue-600 mt-1 inline-block">현재 배송지</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
