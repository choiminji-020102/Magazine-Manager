// ActivityLog 관련 타입

export interface ActivityLogListQuery {
  page: number;
  limit: number;
  admin_id?: number | null;
  action?: string | null;
  target_type?: string | null;
  target_id?: number | null;
  // target_ids 가 있으면 백엔드가 IN 절 적용 (단건 target_id 무시).
  // 페이지 안 박스들의 활동 로그를 한 번에 좁혀 가져올 때 사용.
  target_ids?: number[] | null;
  start_date?: string | null;
  end_date?: string | null;
}

export interface ActivityLogCreate {
  admin_id?: number | null;
  admin_name?: string | null;
  action: string;
  target_type: string;
  target_id?: number | null;
  target_name?: string | null;
  details?: Record<string, any> | null;
  ip_address?: string | null;
  user_agent?: string | null;
}

export interface ActivityLogResponse {
  log_id: number;
  admin_id?: number | null;
  admin_name?: string | null;
  action: string;
  target_type: string;
  target_id?: number | null;
  target_name?: string | null;
  details?: Record<string, any> | null;
  ip_address?: string | null;
  user_agent?: string | null;
  created_at: string;
}
