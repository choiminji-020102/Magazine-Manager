// Admin 관련 타입

export enum AdminRole {
  SUPER_ADMIN = "SUPER_ADMIN",
  ADMIN = "ADMIN",
  MANAGER = "MANAGER",
}

export interface AdminResponse {
  admin_id: number;
  email: string;
  admin_name: string;
  admin_role: AdminRole;
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AdminCreate {
  email: string;
  password: string;
  admin_name: string;
  admin_role: AdminRole;
  is_active: boolean;
}

export interface AdminUpdate {
  email?: string;
  admin_name?: string;
  admin_role?: AdminRole;
  is_active?: boolean;
}

export interface AdminActivateRequest {
  is_active?: boolean;
}

export interface AdminPasswordChange {
  new_password: string;
}
