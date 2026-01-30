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
  email?: string | null;
  admin_name?: string | null;
  admin_role?: AdminRole | null;
  is_active?: boolean | null;
}

export interface AdminResponse {
  admin_id: number;
  email: string;
  admin_name: string;
  admin_role: string;
  is_active: boolean;
  last_login_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface AdminActivateRequest {
  is_active?: boolean | null;
}

export interface AdminPasswordChange {
  new_password: string;
}
