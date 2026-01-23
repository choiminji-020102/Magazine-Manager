// ActivityLog 관련 타입

export interface ActivityLogResponse {
  log_id: number;
  admin_id: number | null;
  admin_name: string | null;
  action: string;
  target_type: string;
  target_id: number | null;
  target_name: string | null;
  details: any | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}
