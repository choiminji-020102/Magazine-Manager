/**
 * 현재 시각을 KST 기준 ISO 문자열로 반환 (timezone 접미사 없이)
 * DB가 KST로 저장하므로 UTC가 아닌 KST 시각을 보내야 함
 * 예: "2026-04-02T17:35:25"
 */
export function nowKstISO(): string {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 19);
}
