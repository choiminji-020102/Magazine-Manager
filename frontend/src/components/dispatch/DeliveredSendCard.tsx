import type { KeyboardEvent } from "react";
import { ExternalLink } from "lucide-react";
import { InfoRow } from "@/components/common/list-card/InfoRow";
import { SectionHeader } from "@/components/common/list-card/SectionHeader";
import { StatusBadge } from "@/components/common/StatusBadge";
import SendItemBox from "@/components/dispatch/SendItemBox";
import { formatDateTime, formatShortDateTime, formatPhone } from "@/utils/format";
import type { SendResponse, SendDetailResponse } from "@/types/send";
import type { ActivityLogResponse } from "@/types/activityLog";

interface Props {
  send: SendResponse;
  detail: SendDetailResponse | undefined;
  detailError: boolean;
  resendLogs: ActivityLogResponse[];
  onCardClick: () => void;
}

export default function DeliveredSendCard({
  send,
  detail,
  detailError,
  resendLogs,
  onCardClick,
}: Props) {
  const items = detail?.items ?? [];
  const isOverseas = send.country_code !== "KR";
  const lastResendLog = resendLogs[resendLogs.length - 1];
  const resendTooltip = lastResendLog
    ? [
        lastResendLog.details?.reason && `사유: ${lastResendLog.details.reason}`,
        lastResendLog.details?.send_method && `방법: ${lastResendLog.details.send_method}`,
        lastResendLog.details?.courier_company && `운송사: ${lastResendLog.details.courier_company}`,
        lastResendLog.details?.tracking_no && `운송장: ${lastResendLog.details.tracking_no}`,
        lastResendLog.details?.memo && `메모: ${lastResendLog.details.memo}`,
      ]
        .filter(Boolean)
        .join("\n")
    : "";

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
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
      className="border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm hover:shadow-md cursor-pointer transition-shadow flex flex-col focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-300"
    >
      <div className="grid grid-cols-[280px_1fr_1fr] grid-rows-[auto_1fr]">
        {/* 발송 (col 1, row 1-2) — PreparingSendCard 와 동일 구조.
            grid 위치는 PreparingSendCard 와 동일하게 명시 — auto-placement 가
            품목/배송지 순서를 흐트러뜨리는 문제 방지. */}
        <section className="col-start-1 row-start-1 row-span-2 border-r border-gray-100 text-xs">
          <SectionHeader title="발송">
            <StatusBadge type="send_status" value={send.send_status} />
            {resendLogs.length > 0 && (
              <span
                className="px-1 py-0.5 bg-orange-50 text-orange-700 rounded text-[10px] font-semibold cursor-help"
                title={resendTooltip}
              >
                🔁 재배송
              </span>
            )}
          </SectionHeader>
          <div className="px-3 py-2 space-y-0.5">
            <InfoRow
              label="배송일"
              value={send.delivered_at ? formatDateTime(send.delivered_at) : "-"}
            />
            <InfoRow label="배송 방법" value={send.send_method ?? "-"} />
            <InfoRow label="운송사" value={send.courier_company ?? "-"} />
            <InfoRow
              label="송장번호"
              value={
                send.tracking_no ? (
                  <a
                    href={`https://www.cjlogistics.com/ko/tool/parcel/tracking?gnbInvcNo=${encodeURIComponent(send.tracking_no)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    title="CJ대한통운에서 조회"
                    className="font-mono text-gray-700 inline-flex items-center gap-1 group hover:underline"
                  >
                    {send.tracking_no}
                    <ExternalLink className="h-3 w-3 text-gray-400 group-hover:text-gray-700" />
                  </a>
                ) : (
                  "-"
                )
              }
            />
            <InfoRow
              label="주문"
              value={
                send.related_orders.length === 0 ? (
                  <span className="text-gray-300 text-[11px]">-</span>
                ) : (
                  <span className="text-sky-700 text-[11px]">
                    {send.related_orders.length}건 묶음
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

        {/* 배송지 (col 2, row 1-2) — 수령인 정보(recipient_name/recipient_phone)와 주소 통합.
            customer 가 아닌 recipient_xxx 필드 사용 (Send 는 수령자만 존재).
            country_code 배지는 SectionHeader 우측에 표시 */}
        <section className="col-start-2 row-start-1 row-span-2 border-r border-gray-100 text-xs">
          <SectionHeader title="배송지">
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

        {/* 품목 (col 3, row 1-2) */}
        <section className="col-start-3 row-start-1 row-span-2 text-xs">
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

      {/* 카드 footer — 시스템 메타.
          좌측: 식별자 (#ID) / 우측: 시스템 타임스탬프 (생성·수정) */}
      <div className="px-3 py-1.5 text-[10px] text-gray-400 border-t border-gray-100 flex items-center gap-3">
        <span className="font-mono mr-auto">#{send.send_id}</span>
        <span>생성 {formatShortDateTime(send.created_at)}</span>
        <span>수정 {formatShortDateTime(send.updated_at)}</span>
      </div>
    </div>
  );
}
