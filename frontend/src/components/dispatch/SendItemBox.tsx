import { formatIssueShort } from "@/utils/format";
import type { SendItemResponse } from "@/types/sendItem";

// SendItem 압축 박스 — 배송 준비 중 + 배송 완료 공통.
// product_code · product_name / issue × 수량 / admin_memo.
export default function SendItemBox({ item }: { item: SendItemResponse }) {
  return (
    <div className="border border-gray-100 rounded p-2 text-[11px] space-y-0.5">
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
    </div>
  );
}
