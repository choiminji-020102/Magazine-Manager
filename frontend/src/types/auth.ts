// Auth 관련 타입

export interface LoginRequest {
  email: string;
  plain_password: string;
}

export interface TokenPairResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
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

export interface TokenPayload {
  sub: string;
  type: string;
  exp: number;
  iat: number;
}
