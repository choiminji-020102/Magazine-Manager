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
        {/* 좌측 체크박스 (col 1, row 1-2) — div onClick 으로 영역 클릭 흡수, input onChange 가 토글 처리.
            grid 위치는 OrderListCard 와 동일하게 명시적으로 지정 — auto-placement 가 묶인 주문/품목 순서로
            인해 배송지를 col 4 row 1 로 잘못 보내는 문제 방지. */}
        <div
          className="col-start-1 row-start-1 row-span-2 flex items-center justify-center border-r border-gray-100"
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

        {/* 발송 (col 2, row 1-2) — OrderListCard "주문" 섹션과 동일한 시각 무게:
            ID/일자 그룹 → h-2 간격 → 묶인 주문 그룹 → 메모 */}
        <section className="col-start-2 row-start-1 row-span-2 border-r border-gray-100 text-xs">
          <SectionHeader title="발송">
            <StatusBadge type="send_status" value={send.send_status} />
          </SectionHeader>
          <div className="px-3 py-2 space-y-0.5">
            <InfoRow
              label="ID"
              value={<span className="font-mono text-gray-600">#{send.send_id}</span>}
            />
            <InfoRow label="생성일" value={formatDate(send.created_at)} />
            <div className="h-2" />
            <InfoRow
              label="주문"
              value={
                send.related_orders.length === 0 ? (
                  <span className="text-gray-300 text-[11px]">-</span>
                ) : (
                  <span className="flex flex-wrap items-center gap-1">
                    <span className="text-gray-400 text-[11px]">
                      ({send.related_orders.length}건)
                    </span>
                    {send.related_orders.map((ro) => (
                      <span
                        key={ro.order_id}
                        className="text-xs px-1.5 py-0.5 bg-sky-50 text-sky-700 rounded"
                        title={`${ro.customer_name} · ${formatPhone(ro.customer_phone)}`}
                      >
                        #{ro.order_id} · {ro.customer_name}
                      </span>
                    ))}
                  </span>
                )
              }
            />
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

        {/* 수령인 (col 3, row 1) — OrderListCard "고객" 위치와 동일 */}
        <section className="col-start-3 row-start-1 border-r border-b border-gray-100 text-xs">
          <SectionHeader title="수령인" />
          <div className="px-3 py-2 space-y-0.5">
            <InfoRow label="이름" value={send.recipient_name} />
            <InfoRow label="연락처" value={formatPhone(send.recipient_phone)} />
          </div>
        </section>

        {/* 배송지 (col 3, row 2) — OrderListCard "배송지" 위치와 동일.
            country_code 배지는 OrderListCard 와 동일하게 SectionHeader 우측에 표시 */}
        <section className="col-start-3 row-start-2 border-r border-gray-100 text-xs">
          <SectionHeader title="배송지">
            {isOverseas && (
              <span className="px-1 py-0.5 bg-amber-100 text-amber-700 rounded text-[10px] font-semibold">
                🌐 {send.country_code}
              </span>
            )}
          </SectionHeader>
          <div className="px-3 py-2 space-y-0.5">
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

        {/* 품목 (col 4, row 1-2) */}
        <section className="col-start-4 row-start-1 row-span-2 text-xs">
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
