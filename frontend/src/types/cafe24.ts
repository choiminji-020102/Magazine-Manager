// Cafe24 관련 타입

export interface Cafe24OAuthStartRequest {
  mall_id: string;
  scopes: string[];
}

export interface Cafe24OAuthStartResponse {
  authorize_url: string;
}

export interface Cafe24TokenStatusResponse {
  mall_id: string;
  authorized: boolean;
  expires_at?: string | null;
  refresh_token_expires_at?: string | null;
  scopes: string[];
}

export interface Cafe24OAuthRefreshResponse {
  mall_id: string;
  expires_at: string | null;
  refresh_token_expires_at: string | null;
}
