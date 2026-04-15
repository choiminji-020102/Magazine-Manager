// Cafe24 관련 타입

export interface Cafe24OAuthStartResponse {
  authorize_url: string;
}

export interface Cafe24TokenStatusResponse {
  authorized: boolean;
  expires_at?: string | null;
  refresh_token_expires_at?: string | null;
  mall_id: string;
  scopes: string[];
}
