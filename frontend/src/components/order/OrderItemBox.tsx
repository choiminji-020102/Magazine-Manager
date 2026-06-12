import { formatAmount, formatDate, formatShortDateTime } from "@/utils/format";
import type { OrderItemResponse } from "@/types/orderItem";

// OrderItem 압축 박스 — LIST_CARD_LAYOUT.md §4.3 6그룹.
// 1. 식별  : product_kind 배지 + product_name + product_code + external_order_item_id
// 2. 가격  : sale_price × order_num + (정가 list_price) + 환불 refund_amount
// 3. 구독  : subscribe_period · start ~ end · final 변경 시 별도 줄 · last_send_issue   (정기만)
// 4. 일시  : delivered_at / cancelled_at  (둘 중 1개라도 값 있을 때)
// 5. 메모  : admin_memo  (있을 때만)
// 6. 시스템 메타: created_at · updated_at  (작은 회색)
export default function OrderItemBox({ item }: { item: OrderItemResponse }) {
  const isCancelled = item.cancelled_at != null;
  const isYearly = item.product_kind === "YEARLY";
  const subscribeChanged =
    item.final_subscribe_start_issue !== item.subscribe_start_issue ||
    item.final_subscribe_end_issue !== item.subscribe_end_issue;

  return (
    <div
      className={`border border-gray-100 rounded p-2 text-[11px] space-y-0.5 ${
        isCancelled ? "opacity-60 bg-gray-50" : ""
      }`}
    >
      {/* 그룹 1 — 식별 */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <span
          className={`px-1 py-0.5 rounded text-[10px] font-semibold ${
            isYearly ? "bg-purple-100 text-purple-700" : "bg-sky-100 text-sky-700"
          }`}
        >
          {isYearly ? "정기" : "단품"}
        </span>
        <span className="text-gray-700 truncate">{item.product_name}</span>
        <span className="font-mono text-gray-500">{item.product_code}</span>
        {item.external_order_item_id && (
          <span className="font-mono text-gray-400 text-[10px]">
            {item.external_order_item_id}
          </span>
        )}
      </div>

      {/* 그룹 2 — 가격 */}
      <div className="text-gray-600">
        {formatAmount(item.sale_price)} × {item.order_num}개
        {item.list_price !== item.sale_price && (
          <span className="text-gray-400"> (정가 {formatAmount(item.list_price)})</span>
        )}
        {item.refund_amount > 0 && (
          <span className="text-orange-600"> · 환불 {formatAmount(item.refund_amount)}</span>
        )}
      </div>

      {/* 그룹 3 — 구독 (정기만) */}
      {isYearly && (
        <div className="text-gray-600">
          {subscribeChanged ? (
            <>
              <div>
                <span className="text-gray-400">원본</span> {item.subscribe_period}개월{" "}
                {formatIssueRange(item.subscribe_start_issue, item.subscribe_end_issue)}
              </div>
              <div>
                <span className="text-gray-400">→ 현재</span>{" "}
                {formatIssueRange(item.final_subscribe_start_issue, item.final_subscribe_end_issue)}
                {item.last_send_issue && (
                  <>
                    {" · "}
                    <span className="text-gray-400">발송</span> {formatIssueDot(item.last_send_issue)}
                  </>
                )}
              </div>
            </>
          ) : (
            <>
              구독 {item.subscribe_period}개월 ·{" "}
              {formatIssueRange(item.final_subscribe_start_issue, item.final_subscribe_end_issue)}
              {item.last_send_issue && (
                <>
                  {" · "}
                  <span className="text-gray-400">발송</span> {formatIssueDot(item.last_send_issue)}
                </>
              )}
            </>
          )}
        </div>
      )}

      {/* 그룹 4 — 일시 (delivered_at / cancelled_at 둘 중 하나라도 있을 때) */}
      {(item.delivered_at || item.cancelled_at) && (
        <div className="text-gray-600">
          {item.delivered_at && <>발송 {formatDate(item.delivered_at)}</>}
          {item.delivered_at && item.cancelled_at && <span> / </span>}
          {item.cancelled_at && (
            <span className="text-red-500">취소 {formatDate(item.cancelled_at)}</span>
          )}
        </div>
      )}

      {/* 그룹 5 — 메모 (있을 때만) */}
      {item.admin_memo && (
        <div className="block truncate text-gray-500" title={item.admin_memo}>
          📝 {item.admin_memo}
        </div>
      )}

      {/* 그룹 6 — 시스템 메타 (작은 회색) */}
      <div className="text-[9px] text-gray-300 pt-0.5">
        생성 {formatShortDateTime(item.created_at)} · 수정 {formatShortDateTime(item.updated_at)}
      </div>
    </div>
  );
}

// "202604" → "2026.04"
function formatIssueDot(issue: string): string {
  if (!issue || issue.length < 6) return issue;
  return `${issue.slice(0, 4)}.${issue.slice(4, 6)}`;
}

// "202604" + "202703" → "2026.04 ~ 2027.03"
function formatIssueRange(start: string, end: string): string {
  return `${formatIssueDot(start)} ~ ${formatIssueDot(end)}`;
}
