import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AddressSearchField } from "@/components/common/AddressSearchField";
import { formatPhoneInput } from "@/utils/format";

export interface NewAddressValue {
  recipient_name: string;
  recipient_phone: string;
  postal_code: string;
  recipient_address: string;
  customer_memo: string;
  admin_memo: string;
}

export interface NewAddressErrors {
  name: boolean;
  phone: boolean;
  address: boolean;
}

export const EMPTY_NEW_ADDRESS: NewAddressValue = {
  recipient_name: "",
  recipient_phone: "",
  postal_code: "",
  recipient_address: "",
  customer_memo: "",
  admin_memo: "",
};

// 기존 배송지를 입력 폼 기본값으로 변환 — 배송지 변경 시 바꿀 항목만 고치도록 현재 값을 채워 둔다.
// (Address 는 불변이라 저장 시에는 새 배송지가 생성되어 교체된다)
export function toNewAddressValue(
  address?: { [K in keyof NewAddressValue]?: string | null } | null
): NewAddressValue {
  return {
    recipient_name: address?.recipient_name ?? "",
    recipient_phone: address?.recipient_phone ?? "",
    postal_code: address?.postal_code ?? "",
    recipient_address: address?.recipient_address ?? "",
    customer_memo: address?.customer_memo ?? "",
    admin_memo: address?.admin_memo ?? "",
  };
}

export const EMPTY_NEW_ADDRESS_ERRORS: NewAddressErrors = {
  name: false,
  phone: false,
  address: false,
};

// 모든 필수 누락을 한 번에 표시하고, toast 안내는 첫 누락 필드만 반환한다.
export function validateNewAddress(
  addr: NewAddressValue
): { errors: NewAddressErrors; firstMessage: string | null } {
  const errors: NewAddressErrors = { name: false, phone: false, address: false };
  let firstMessage: string | null = null;

  if (!addr.recipient_name.trim()) {
    errors.name = true;
    firstMessage = firstMessage ?? "수령인을 입력해주세요.";
  }
  if (!addr.recipient_phone.trim()) {
    errors.phone = true;
    firstMessage = firstMessage ?? "연락처를 입력해주세요.";
  }
  if (!addr.postal_code || !addr.recipient_address.trim()) {
    errors.address = true;
    firstMessage = firstMessage ?? "주소를 입력해주세요.";
  }

  return { errors, firstMessage };
}

interface NewAddressFormProps {
  value: NewAddressValue;
  onChange: (value: NewAddressValue) => void;
  errors: NewAddressErrors;
  onErrorsChange: (errors: NewAddressErrors) => void;
}

export function NewAddressForm({ value, onChange, errors, onErrorsChange }: NewAddressFormProps) {
  const set = (patch: Partial<NewAddressValue>) => onChange({ ...value, ...patch });

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className={`text-xs ${errors.name ? "text-red-500" : ""}`}>
            수령인 <span className="text-red-500 ml-0.5">*</span>
          </Label>
          <Input
            className={`mt-1 ${errors.name ? "border-red-500 focus:ring-red-500" : ""}`}
            value={value.recipient_name}
            onChange={(e) => {
              set({ recipient_name: e.target.value });
              onErrorsChange({ ...errors, name: false });
            }}
            placeholder="수령인"
          />
          {errors.name && <p className="text-xs text-red-500 mt-1">수령인을 입력해주세요.</p>}
        </div>
        <div>
          <Label className={`text-xs ${errors.phone ? "text-red-500" : ""}`}>
            연락처 <span className="text-red-500 ml-0.5">*</span>
          </Label>
          <Input
            className={`mt-1 ${errors.phone ? "border-red-500 focus:ring-red-500" : ""}`}
            value={value.recipient_phone}
            onChange={(e) => {
              set({ recipient_phone: formatPhoneInput(e.target.value) });
              onErrorsChange({ ...errors, phone: false });
            }}
            placeholder="010-0000-0000"
          />
          {errors.phone && <p className="text-xs text-red-500 mt-1">연락처를 입력해주세요.</p>}
        </div>
      </div>
      <AddressSearchField
        postalCode={value.postal_code}
        address={value.recipient_address}
        onChange={(postal_code, recipient_address) => {
          set({ postal_code, recipient_address });
          onErrorsChange({ ...errors, address: false });
        }}
        required
        error={errors.address}
      />
      <div>
        <Label className="text-xs">배송 요청사항</Label>
        <Input
          className="mt-1"
          value={value.customer_memo}
          onChange={(e) => set({ customer_memo: e.target.value })}
          placeholder="문 앞에 놔주세요 (선택)"
        />
      </div>
      <div>
        <Label className="text-xs">관리자 메모</Label>
        <Input
          className="mt-1"
          value={value.admin_memo}
          onChange={(e) => set({ admin_memo: e.target.value })}
          placeholder="내부 메모 (선택)"
        />
      </div>
    </div>
  );
}
