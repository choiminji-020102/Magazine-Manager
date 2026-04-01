/**
 * 호(YYYYMM) → "2026년 4월호"
 */
export function formatIssue(issue: string): string {
  if (!issue || issue.length < 6) return issue;
  const year = issue.slice(0, 4);
  const month = parseInt(issue.slice(4, 6), 10);
  return `${year}년 ${month}월호`;
}

/**
 * 정수(원) → "1,000원"
 */
export function formatAmount(amount: number | null | undefined): string {
  if (amount == null) return "-";
  return amount.toLocaleString("ko-KR") + "원";
}

/**
 * 연락처 → "010-1234-5678"
 */
export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return "-";
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 11) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return phone;
}

/**
 * 날짜 문자열 → "2026-04-01" (DB가 KST로 저장하므로 변환 없이 그대로 표시)
 */
export function formatDate(
  dt: string | Date | null | undefined,
  options?: { showTime?: boolean }
): string {
  if (!dt) return "-";

  // 문자열이면 직접 파싱 (timezone 변환 없이)
  if (typeof dt === "string") {
    // "2026-04-01T14:30:00" 또는 "2026-04-01 14:30:00" 형태
    const cleaned = dt.replace("T", " ").replace("Z", "").split(".")[0];
    const [datePart, timePart] = cleaned.split(" ");
    if (!datePart) return "-";

    if (options?.showTime && timePart) {
      const [hour, min] = timePart.split(":");
      return `${datePart} ${hour}:${min}`;
    }
    return datePart;
  }

  // Date 객체면 로컬 시간 기준 표시
  const year = dt.getFullYear();
  const month = String(dt.getMonth() + 1).padStart(2, "0");
  const day = String(dt.getDate()).padStart(2, "0");

  if (options?.showTime) {
    const hour = String(dt.getHours()).padStart(2, "0");
    const min = String(dt.getMinutes()).padStart(2, "0");
    return `${year}-${month}-${day} ${hour}:${min}`;
  }
  return `${year}-${month}-${day}`;
}

/**
 * ISO 날짜 문자열 → "2026-04-01 14:32" (KST 기준)
 */
export function formatDateTime(dt: string | Date | null | undefined): string {
  return formatDate(dt, { showTime: true });
}
