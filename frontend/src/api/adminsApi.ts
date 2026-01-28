import api from "./axios";
import type { ResponseModel, PaginatedResponse } from "../types/api";
import type {
  AdminCreate,
  AdminUpdate,
  AdminResponse,
  AdminActivateRequest,
  AdminPasswordChange,
} from "../types/admin";

export const adminsApi = {
  // GET /admins - 관리자 목록 조회
  getAdmins: (params: {
    page?: number;
    limit?: number;
    search?: string | null;
    role?: string | null;
  }) => {
    return api.get<PaginatedResponse<AdminResponse>>("/admins", { params });
  },

  // GET /admins/{admin_id} - 관리자 상세 조회
  getAdmin: (adminId: number) => {
    return api.get<ResponseModel<AdminResponse>>(`/admins/${adminId}`);
  },

  // POST /admins - 관리자 등록
  createAdmin: (data: AdminCreate) => {
    return api.post<ResponseModel<AdminResponse>>("/admins", data);
  },

  // PUT /admins/{admin_id} - 관리자 수정
  updateAdmin: (adminId: number, data: AdminUpdate) => {
    return api.put<ResponseModel<AdminResponse>>(`/admins/${adminId}`, data);
  },

  // DELETE /admins/{admin_id} - 관리자 삭제
  deleteAdmin: (adminId: number) => {
    return api.delete<ResponseModel<void>>(`/admins/${adminId}`);
  },

  // PATCH /admins/{admin_id}/activate - 관리자 활성화/비활성화
  activateAdmin: (adminId: number, data: AdminActivateRequest) => {
    return api.patch<ResponseModel<{ is_active: boolean }>>(`/admins/${adminId}/activate`, data);
  },

  // PATCH /admins/{admin_id}/password - 관리자 비밀번호 변경
  changeAdminPassword: (adminId: number, data: AdminPasswordChange) => {
    return api.patch<ResponseModel<void>>(`/admins/${adminId}/password`, data);
  },
};
