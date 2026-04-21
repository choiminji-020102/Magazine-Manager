// VIP 슬롯 (파일 기반 저장, DB 테이블 아님)

export interface VipSlotResponse {
  slot_number: number;
  label: string | null;
  is_enabled: boolean;
}

export interface VipSlotUpdate {
  label?: string | null;
  is_enabled?: boolean;
}
