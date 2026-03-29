import api from "./axios";
import type { ResponseModel, PaginatedResponse } from "../types/api";
import type {
  AdminCreate,
  AdminUpdate,
  AdminRoleUpdate,
  AdminResponse,
  AdminPasswordChangeRequest,
} from "../types/admin";

export const adminsApi = {
  // GET /admins - 관리자 목록 조회
  getAdmins: (params: {
    page?: number;
    limit?: number;
    search?: string | null;
    admin_role?: string | null;
    is_active?: boolean | null;
    is_deleted?: boolean;
    sort_by?: string;
    sort_order?: string;
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

  // PUT /admins/{admin_id} - 관리자 수정 (이메일·이름·비밀번호만)
  updateAdmin: (adminId: number, data: AdminUpdate) => {
    return api.put<ResponseModel<AdminResponse>>(`/admins/${adminId}`, data);
  },

  // DELETE /admins/{admin_id} - 관리자 삭제 (소프트)
  deleteAdmin: (adminId: number) => {
    return api.delete<ResponseModel<void>>(`/admins/${adminId}`);
  },

  // POST /admins/{admin_id}/restore - 관리자 복구
  restoreAdmin: (adminId: number) => {
    return api.post<ResponseModel<AdminResponse>>(`/admins/${adminId}/restore`);
  },

  // PATCH /admins/{admin_id}/activate - 관리자 활성화
  activateAdmin: (adminId: number) => {
    return api.patch<ResponseModel<AdminResponse>>(`/admins/${adminId}/activate`);
  },

  // PATCH /admins/{admin_id}/deactivate - 관리자 비활성화
  deactivateAdmin: (adminId: number) => {
    return api.patch<ResponseModel<AdminResponse>>(`/admins/${adminId}/deactivate`);
  },

  // PATCH /admins/{admin_id}/role - 관리자 권한 변경
  changeAdminRole: (adminId: number, data: AdminRoleUpdate) => {
    return api.patch<ResponseModel<AdminResponse>>(`/admins/${adminId}/role`, data);
  },

  // POST /admins/{admin_id}/change-password - 관리자 비밀번호 변경 (자기 자신만)
  changeAdminPassword: (adminId: number, data: AdminPasswordChangeRequest) => {
    return api.post<ResponseModel<void>>(`/admins/${adminId}/change-password`, data);
  },
};
