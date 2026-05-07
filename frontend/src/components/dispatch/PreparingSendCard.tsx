import type { KeyboardEvent } from "react";
import { InfoRow } from "@/components/common/list-card/InfoRow";
import { SectionHeader } from "@/components/common/list-card/SectionHeader";
import { StatusBadge } from "@/components/common/StatusBadge";
import SendItemBox from "@/components/dispatch/SendItemBox";
import { formatDate, formatShortDateTime, formatPhone } from "@/utils/format";
import type { SendResponse, SendDetailResponse } from "@/types/send";

interface Props {
  send: SendResponse;
  detail: SendDetailResponse | undefined;
  detailError: boolean;
  checked: boolean;
  onToggleCheck: () => void;
  onCardClick: () => void;
}

export default function PreparingSendCard({
  send,
  detail,
  detailError,
  checked,
  onToggleCheck,
  onCardClick,
}: Props) {
  const items = detail?.items ?? [];
  const isOverseas = send.country_code !== "KR";

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    // Enter / Space 로 카드 열기 — 마우스 클릭 동등
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onCardClick();
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onCardClick}
      onKeyDown={handleKeyDown}
      className={`border rounded-lg overflow-hidden bg-white shadow-sm hover:shadow-md cursor-pointer transition-shadow flex flex-col focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 ${
        checked ? "border-blue-400 bg-blue-50/30" : "border-gray-200"
      }`}
    >
      <div className="grid grid-cols-[50px_280px_1fr_1fr] grid-rows-[auto_1fr]">
        {/* 좌측 체크박스 (row-span 2) — div onClick 으로 영역 클릭 흡수, input onChange 가 토글 처리 */}
        <div
          className="row-span-2 flex items-center justify-center border-r border-gray-100"
          onClick={(e) => e.stopPropagation()}
        >
          <input
            type="checkbox"
            checked={checked}
            onChange={onToggleCheck}
            className="h-4 w-4"
            aria-label={`발송 ${send.send_id} 선택`}
          />
        </div>

        {/* 발송 (row-span 2) */}
        <section className="row-span-2 border-r border-gray-100 text-xs">
          <SectionHeader title="발송">
            <StatusBadge type="send_status" value={send.send_status} />
          </SectionHeader>
          <div className="px-3 py-2 space-y-0.5">
            <InfoRow
              label="ID"
              value={<span className="font-mono text-gray-600">#{send.send_id}</span>}
            />
            <InfoRow label="생성일" value={formatDate(send.created_at)} />
            {send.admin_memo && (
              <InfoRow
                label="메모"
                value={
                  <span className="block truncate text-gray-500" title={send.admin_memo}>
                    📝 {send.admin_memo}
                  </span>
                }
              />
            )}
          </div>
        </section>

        {/* 수령·배송지 (위) */}
        <section className="border-r border-b border-gray-100 text-xs">
          <SectionHeader title="수령·배송지">
            {isOverseas && (
              <span className="px-1 py-0.5 bg-amber-100 text-amber-700 rounded text-[10px] font-semibold">
                🌐 {send.country_code}
              </span>
            )}
          </SectionHeader>
          <div className="px-3 py-2 space-y-0.5">
            <InfoRow label="수령인" value={send.recipient_name} />
            <InfoRow label="연락처" value={formatPhone(send.recipient_phone)} />
            <InfoRow
              label="주소"
              value={
                <>
                  {send.postal_code && (
                    <span className="font-mono mr-1">[{send.postal_code}]</span>
                  )}
                  {send.recipient_address}
                </>
              }
            />
            {send.customer_memo && (
              <InfoRow
                label="배송메모"
                value={
                  <span className="block truncate text-gray-500" title={send.customer_memo}>
                    {send.customer_memo}
                  </span>
                }
              />
            )}
          </div>
        </section>

        {/* 묶인 주문 (아래) */}
        <section className="border-r border-gray-100 text-xs">
          <SectionHeader title="묶인 주문">
            <span className="text-gray-400 text-xs font-normal normal-case tracking-normal">
              ({send.related_orders.length}건)
            </span>
          </SectionHeader>
          <div className="px-3 py-2">
            {send.related_orders.length === 0 ? (
              <span className="text-gray-300 text-[11px]">-</span>
            ) : (
              <div className="flex flex-wrap gap-1">
                {send.related_orders.map((ro) => (
                  <span
                    key={ro.order_id}
                    className="text-xs px-1.5 py-0.5 bg-sky-50 text-sky-700 rounded"
                    title={`${ro.customer_name} · ${formatPhone(ro.customer_phone)}`}
                  >
                    #{ro.order_id} · {ro.customer_name}
                  </span>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* 품목 (row-span 2) */}
        <section className="row-span-2 text-xs">
          <SectionHeader title="품목">
            <span className="text-gray-400 text-xs font-normal normal-case tracking-normal">
              ({items.length}건)
            </span>
          </SectionHeader>
          <div className="px-3 py-2">
            {detailError ? (
              <span className="text-red-500 text-[11px]">조회 실패</span>
            ) : detail === undefined ? (
              <span className="text-gray-300 text-[11px]">로딩…</span>
            ) : items.length === 0 ? (
              <span className="text-gray-300 text-[11px]">품목 없음</span>
            ) : (
              <div className="space-y-1.5">
                {items.map((it) => (
                  <SendItemBox key={it.send_item_id} item={it} />
                ))}
              </div>
            )}
          </div>
        </section>
      </div>

      {/* 카드 footer — 시스템 메타 (우하단 작은 회색, 카드 4컬럼 전체 span) */}
      <div className="px-3 py-1.5 text-[10px] text-gray-400 border-t border-gray-100 flex justify-end gap-3">
        <span>생성 {formatShortDateTime(send.created_at)}</span>
        <span>수정 {formatShortDateTime(send.updated_at)}</span>
      </div>
    </div>
  );
}
