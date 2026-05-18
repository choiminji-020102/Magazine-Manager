import type { KeyboardEvent } from "react";
import { MoreHorizontal } from "lucide-react";
import { InfoRow } from "@/components/common/list-card/InfoRow";
import { SectionHeader } from "@/components/common/list-card/SectionHeader";
import { StatusBadge } from "@/components/common/StatusBadge";
import { VipFlagsDisplay } from "@/components/common/VipFlags";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import OrderItemBox from "@/components/order/OrderItemBox";
import { formatAmount, formatDateTime, formatPhone, formatShortDateTime } from "@/utils/format";
import { PAYMENT_METHOD_LABEL } from "@/utils/constants";
import type { OrderListResponse, PaymentMethod } from "@/types/order";
import type { OrderItemDetailResponse } from "@/types/orderItem";
import type { VipSlotResponse } from "@/types/vipSlot";

interface Props {
  order: OrderListResponse;
  items: OrderItemDetailResponse[] | undefined;
  itemsError: boolean;
  vipSlots: VipSlotResponse[];
  onCardClick: () => void;
  onPaymentComplete: () => void;
}

export default function OrderListCard({
  order,
  items,
  itemsError,
  vipSlots,
  onCardClick,
  onPaymentComplete,
}: Props) {
  const isCancelled = order.cancelled_at != null;
  const isOverseas = order.country_code != null && order.country_code !== "KR";
  const paymentMethodLabel = order.payment_method
    ? PAYMENT_METHOD_LABEL[order.payment_method as PaymentMethod] ?? order.payment_method
    : null;

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
      className={`border rounded-lg overflow-hidden bg-white shadow-sm hover:shadow-md cursor-pointer transition-shadow flex flex-col focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 ${
        isCancelled ? "opacity-60 bg-gray-50 border-gray-200" : "border-gray-200"
      }`}
    >
      <div className="grid grid-cols-[280px_1fr_1fr] grid-rows-[auto_1fr]">
        {/* 주문 (col 1, row 1-2) */}
        <section className="col-start-1 row-start-1 row-span-2 border-r border-gray-100 text-xs">
          <SectionHeader title="주문">
            <StatusBadge type="order_status" value={order.order_status} />
            <StatusBadge type="channel" value={order.order_channel} />
            {paymentMethodLabel && (
              <span className="px-1.5 py-0.5 rounded text-[11px] font-medium bg-white text-gray-700">
                {paymentMethodLabel}
              </span>
            )}
            {/* 카드 우상단 ⋯ 액션 드롭다운 — 표시할 액션이 있을 때만 렌더 (상세 보기는 카드 본문 클릭으로 열림) */}
            {order.order_status === "ORDERED" && (
              <div className="ml-auto" onClick={(e) => e.stopPropagation()}>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon-sm">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={onPaymentComplete}>
                      결제완료 처리
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}
          </SectionHeader>
          <div className="px-3 py-2 space-y-0.5">
            <InfoRow label="주문일" value={formatDateTime(order.order_at)} />
            {order.payment_at && (
              <InfoRow label="결제일" value={formatDateTime(order.payment_at)} />
            )}
            {order.cancelled_at && (
              <InfoRow
                label="취소일"
                value={<span className="text-red-500">{formatDateTime(order.cancelled_at)}</span>}
              />
            )}
            <div className="h-2" />
            <InfoRow label="상품금액" value={formatAmount(order.total_amount)} />
            {order.discount_amount > 0 && (
              <InfoRow label="할인" value={`-${formatAmount(order.discount_amount)}`} />
            )}
            <InfoRow label="배송비" value={formatAmount(order.send_fee)} />
            {order.refund_amount > 0 && (
              <InfoRow
                label="환불"
                value={
                  <span className="text-orange-600">-{formatAmount(order.refund_amount)}</span>
                }
              />
            )}
            <InfoRow
              label="결제금액"
              value={
                <span className="font-semibold text-gray-900">
                  {formatAmount(order.payment_amount)}
                </span>
              }
            />
            {order.customer_memo && (
              <InfoRow
                label="고객메모"
                value={
                  <span className="block truncate text-gray-500" title={order.customer_memo}>
                    {order.customer_memo}
                  </span>
                }
              />
            )}
            {order.admin_memo && (
              <InfoRow
                label="메모"
                value={
                  <span className="block truncate text-gray-500" title={order.admin_memo}>
                    📝 {order.admin_memo}
                  </span>
                }
              />
            )}
          </div>
        </section>

        {/* 고객 (col 2, row 1) */}
        <section className="col-start-2 row-start-1 border-r border-b border-gray-100 text-xs">
          <SectionHeader title="고객">
            <VipFlagsDisplay address={order} slots={vipSlots} compact />
          </SectionHeader>
          <div className="px-3 py-2 space-y-0.5">
            <InfoRow label="이름" value={order.customer_name ?? "-"} />
            <InfoRow label="연락처" value={formatPhone(order.customer_phone)} />
            <InfoRow label="이메일" value={order.customer_email || "-"} />
          </div>
        </section>

        {/* 배송지 (col 2, row 2) */}
        <section className="col-start-2 row-start-2 border-r border-gray-100 text-xs">
          <SectionHeader title="배송지">
            {isOverseas && (
              <span className="px-1 py-0.5 bg-amber-100 text-amber-700 rounded text-[10px] font-semibold">
                🌐 {order.country_code}
              </span>
            )}
          </SectionHeader>
          <div className="px-3 py-2 space-y-0.5">
            {order.recipient_name ? (
              <>
                <InfoRow label="수령인" value={order.recipient_name} />
                <InfoRow label="연락처" value={formatPhone(order.recipient_phone)} />
                <InfoRow
                  label="주소"
                  value={
                    <>
                      {order.postal_code && (
                        <span className="font-mono mr-1">[{order.postal_code}]</span>
                      )}
                      {order.recipient_address}
                    </>
                  }
                />
              </>
            ) : (
              <span className="text-gray-300 text-[11px]">배송지 없음</span>
            )}
          </div>
        </section>

        {/* 품목 (col 3, row 1-2) */}
        <section className="col-start-3 row-start-1 row-span-2 text-xs">
          <SectionHeader title="품목">
            <span className="text-gray-400 text-xs font-normal normal-case tracking-normal">
              ({order.item_count}건)
            </span>
          </SectionHeader>
          <div className="px-3 py-2">
            {itemsError ? (
              <span className="text-red-500 text-[11px]">조회 실패</span>
            ) : items === undefined ? (
              <span className="text-gray-300 text-[11px]">로딩…</span>
            ) : items.length === 0 ? (
              <span className="text-gray-300 text-[11px]">품목 없음</span>
            ) : (
              <div className="space-y-1.5">
                {items.map((it) => (
                  <OrderItemBox key={it.order_item_id} item={it} />
                ))}
              </div>
            )}
          </div>
        </section>
      </div>

      {/* 카드 footer — 시스템 메타 (작은 회색).
          좌측: 식별자 (#ID + 외부 ID) / 우측: 시스템 타임스탬프 (생성·수정) */}
      <div className="px-3 py-1.5 text-[10px] text-gray-400 border-t border-gray-100 flex items-center gap-3">
        <span className="font-mono mr-auto">
          #{order.order_id}
          {order.external_order_id && (
            <span className="ml-2">{order.external_order_id}</span>
          )}
        </span>
        <span>생성 {formatShortDateTime(order.created_at)}</span>
        <span>수정 {formatShortDateTime(order.updated_at)}</span>
      </div>
    </div>
  );
}
