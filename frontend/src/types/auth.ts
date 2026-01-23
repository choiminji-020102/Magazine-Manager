// Auth 관련 타입

import { AdminCreate, AdminResponse } from "./admin";

export interface LoginRequest {
  email: string;
  plain_password: string;
}

export interface TokenPairResponse {
  access_token: string;
  refresh_token: string;
  token_type: string; // 기본값 "bearer"
}

export interface RefreshRequest {
  access_token: string;
  refresh_token: string;
}

export interface LogoutRequest {
  refresh_token: string;
}

export interface PasswordChangeRequest {
  current_password: string;
  new_password: string;
}

// Re-export for convenience
export type { AdminCreate, AdminResponse };
