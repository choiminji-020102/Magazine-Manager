import { formatDate, formatIssueShort, formatShortDateTime } from "@/utils/format";
import type { SendItemResponse } from "@/types/sendItem";

// SendItem 압축 박스 — LIST_CARD_LAYOUT.md §2.3 (배송 준비 중 + 배송 완료 공통).
// product_code · product_name / issue × 수량 / admin_memo / cancelled_at /
// 시스템 메타 (생성·수정 일시) 6그룹.
export default function SendItemBox({ item }: { item: SendItemResponse }) {
  const isCancelled = item.cancelled_at != null;
  return (
    <div
      className={`border border-gray-100 rounded p-2 text-[11px] space-y-0.5 ${
        isCancelled ? "opacity-60 bg-gray-50" : ""
      }`}
    >
      <div className="flex items-center gap-1.5">
        <span className="font-mono text-gray-500">{item.product_code}</span>
        <span className="text-gray-700 truncate">{item.product_name}</span>
      </div>
      <div className="text-gray-600">
        {formatIssueShort(item.issue)} × {item.send_num}부
      </div>
      {item.admin_memo && (
        <div className="block truncate text-gray-500" title={item.admin_memo}>
          📝 {item.admin_memo}
        </div>
      )}
      {isCancelled && (
        <div className="text-red-500">취소 {formatDate(item.cancelled_at)}</div>
      )}
      <div className="text-[9px] text-gray-300 pt-0.5">
        생성 {formatShortDateTime(item.created_at)} · 수정 {formatShortDateTime(item.updated_at)}
      </div>
    </div>
  );
}
