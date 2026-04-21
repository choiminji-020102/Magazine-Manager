import api from "./axios";
import type { ResponseModel } from "../types/api";
import type { VipSlotResponse, VipSlotUpdate } from "../types/vipSlot";

export const vipSlotsApi = {
  // GET /vip-slots - 전체 슬롯 조회 (항상 6개)
  getVipSlots: () => {
    return api.get<ResponseModel<VipSlotResponse[]>>("/vip-slots");
  },

  // PATCH /vip-slots/{slot_number} - 라벨/활성화 수정
  updateVipSlot: (slotNumber: number, data: VipSlotUpdate) => {
    return api.patch<ResponseModel<VipSlotResponse>>(`/vip-slots/${slotNumber}`, data);
  },
};
