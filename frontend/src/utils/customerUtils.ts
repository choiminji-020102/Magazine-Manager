// 고객 관련 유틸리티 함수

/**
 * 구독 호수를 "25년 03월호" 형식으로 변환
 */
export const formatIssue = (issue: string | null): string => {
  if (!issue) return "-";
  // "202403" 형식을 "25년 03월호" 형식으로 변환
  if (issue.length === 6) {
    const year = issue.substring(0, 4);
    const month = issue.substring(4, 6);
    const yearShort = String(parseInt(year) % 100).padStart(2, "0");
    return `${yearShort}년 ${month}월호`;
  }
  return issue;
};

/**
 * 구독기간을 "25년 03월호~26년 02월호" 형식으로 변환
 */
export const formatSubscriptionPeriod = (
  startIssue: string | null,
  endIssue: string | null
): string => {
  if (!startIssue || !endIssue) return "-";
  return `${formatIssue(startIssue)}~${formatIssue(endIssue)}`;
};

/**
 * 주문 상태를 한글로 변환
 */
export const getOrderStatusLabel = (
  status: "ORDERED" | "PAID" | "CANCELLED" | "SHIPPING" | "COMPLETED"
): string => {
  const labels = {
    ORDERED: "주문완료",
    PAID: "결제완료",
    CANCELLED: "취소됨",
    SHIPPING: "배송중",
    COMPLETED: "배송완료",
  };
  return labels[status];
};

/**
 * 배송 상태를 한글로 변환
 */
export const getSendStatusLabel = (
  status: "PREPARING" | "SHIPPED" | "DELIVERED" | "CANCELLED"
): string => {
  const labels = {
    PREPARING: "준비중",
    SHIPPED: "배송중",
    DELIVERED: "배송완료",
    CANCELLED: "취소됨",
  };
  return labels[status];
};

/**
 * 유입 경로를 한글로 변환
 */
export const getChannelLabel = (channel: string): string => {
  if (channel === "CAFE24") return "Cafe24";
  if (channel === "GPMALL") return "갓피플몰";
  if (channel === "OFFLINE") return "오프라인";
  return channel;
};
