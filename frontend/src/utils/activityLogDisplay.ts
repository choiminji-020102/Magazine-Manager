import { formatIssue, formatAmount } from "@/utils/format";

/**
 * 활동 로그 → 변경 내역 UI 표시용 데이터 변환
 * 주문 상세 모달, 구독 상세 패널에서 공통 사용
 */
export function getLogDisplay(log: { action: string; details?: Record<string, any> | null }) {
  const d = log.details;
  const parts: string[] = [];

  // 기간 변경 요약 (연장/단축/이동)
  const periodSummary = () => {
    if (d?.before?.start && d?.after?.start) {
      parts.push(`${formatIssue(d.before.start)}~${formatIssue(d.before.end)} → ${formatIssue(d.after.start)}~${formatIssue(d.after.end)}`);
    }
    if (d?.reason) parts.push(`(${d.reason})`);
    if (d?.refund_amount != null && d.refund_amount > 0) parts.push(`환불 ${formatAmount(d.refund_amount)}`);
  };

  if (d?.action === "구독 연장") {
    periodSummary();
    return { label: "구독 연장", color: "text-blue-600", summary: parts.join(" ") };
  }
  if (d?.action === "구독 단축") {
    periodSummary();
    return { label: "구독 단축", color: "text-red-600", summary: parts.join(" ") };
  }
  if (d?.action === "구독 기간 이동") {
    periodSummary();
    return { label: "기간 이동", color: "text-purple-600", summary: parts.join(" ") };
  }
  if (d?.action === "배송지 변경") {
    return { label: "배송지 변경", color: "text-green-600", summary: "" };
  }
  if (d?.action === "마지막 발송 호 업데이트") {
    if (d?.prev_issue && d?.new_issue) {
      parts.push(`${formatIssue(d.prev_issue)} → ${formatIssue(d.new_issue)}`);
    }
    return { label: "발송호 수정", color: "text-gray-600", summary: parts.join(" ") };
  }
  if (d?.action === "품목 수정") {
    if (d?.before && d?.after) {
      if (d.before.order_num != null) parts.push(`수량: ${d.before.order_num}→${d.after.order_num}`);
      if (d.before.sale_price != null) parts.push(`판매가: ${formatAmount(d.before.sale_price)}→${formatAmount(d.after.sale_price)}`);
      if (d.before.admin_memo !== undefined) parts.push(`메모: "${d.before.admin_memo || ""}"→"${d.after.admin_memo || ""}"`);
    }
    return { label: "품목 수정", color: "text-gray-600", summary: parts.join(", ") };
  }
  if (log.action === "CANCEL") {
    if (d?.reason) parts.push(`(${d.reason})`);
    if (d?.refund_amount != null && d.refund_amount > 0) parts.push(`환불 ${formatAmount(d.refund_amount)}`);
    return { label: "품목 취소", color: "text-red-600", summary: parts.join(" ") };
  }
  if (log.action === "CREATE") {
    if (d?.product_code) parts.push(d.product_code);
    return { label: "품목 추가", color: "text-blue-600", summary: parts.join(" ") };
  }
  if (log.action === "RESEND") {
    if (d?.reason) parts.push(d.reason);
    if (Array.isArray(d?.send_item_ids) && d.send_item_ids.length > 0) {
      parts.push(`품목 ${d.send_item_ids.length}건`);
    }
    if (d?.send_method) parts.push(d.send_method);
    if (d?.courier_company) parts.push(d.courier_company);
    if (d?.tracking_no) parts.push(`운송장 ${d.tracking_no}`);
    if (d?.memo) parts.push(d.memo);
    return { label: "재배송", color: "text-orange-600", summary: parts.join(" · ") };
  }
  return { label: log.action, color: "text-gray-600", summary: "" };
}
