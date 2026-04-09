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

/**
 * 호(YYYYMM)에 N개월을 더한 호 반환 (음수 가능)
 * 예: addMonthsToIssue("202604", 3) → "202607"
 * 예: addMonthsToIssue("202604", -2) → "202602"
 */
export function addMonthsToIssue(issue: string, months: number): string {
  if (!issue || issue.length !== 6 || isNaN(months) || months === 0) return "";
  const year = parseInt(issue.slice(0, 4), 10);
  const month = parseInt(issue.slice(4, 6), 10);
  const d = new Date(year, month - 1 + months, 1);
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * 구독 기간 내 월 목록 생성 (YYYYMM 형식)
 * 예: generateIssueRange("202604", "202703") → ["202604", "202605", ..., "202703"]
 */
export function generateIssueRange(start: string, end: string): string[] {
  const issues: string[] = [];
  let y = parseInt(start.slice(0, 4));
  let m = parseInt(start.slice(4, 6));
  const ey = parseInt(end.slice(0, 4));
  const em = parseInt(end.slice(4, 6));
  while (y < ey || (y === ey && m <= em)) {
    issues.push(`${y}${String(m).padStart(2, "0")}`);
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return issues;
}
