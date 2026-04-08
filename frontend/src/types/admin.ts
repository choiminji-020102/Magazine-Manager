// Admin 관련 타입

export enum AdminRole {
  SUPER_ADMIN = "SUPER_ADMIN",
  ADMIN = "ADMIN",
  MANAGER = "MANAGER",
}

export interface AdminBase {
  email: string;
  admin_name: string;
  admin_role: AdminRole;
  is_active: boolean;
}

export interface AdminCreate extends AdminBase {
  plain_password: string;
}

export interface AdminUpdate {
  // ⚠️ admin_role 변경은 PATCH /role, 비밀번호 변경은 PUT /auth/password 사용
  email?: string | null;
  admin_name?: string | null;
}

export interface AdminRoleUpdate {
  admin_role: AdminRole;
}

export interface AdminResponse {
  admin_id: number;
  email: string;
  admin_name: string;
  admin_role: string;
  is_active: boolean;
  is_deleted: boolean;
  last_login_at?: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface AdminListQuery {
  page?: number;
  limit?: number;
  admin_role?: AdminRole | null;
  is_active?: boolean | null;
  is_deleted?: boolean;
  search?: string | null;
  sort_by?: string;
  sort_order?: string;
}
