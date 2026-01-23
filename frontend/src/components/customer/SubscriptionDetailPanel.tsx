import React from "react";

interface Address {
  address_id: number;
  address_name: string;
  phone: string;
  nation: string;
  postal_code: string;
  address1: string;
  address2: string;
  address_memo: string | null;
}

interface OrderItem {
  order_item_id: number;
  external_order_item_id: string | null;
  product_code: string;
  product_kind: "YEARLY" | "MONTHLY" | "SINGLE";
  product_name: string;
  price: number;
  sale: number;
  order_num: number;
  subscribe_start_issue: string | null;
  subscribe_end_issue: string | null;
  last_send_issue: string | null;
  final_subscribe_end_issue: string | null;
  address_id: number;
  sended_at: string | null;
  cancelled_at: string | null;
}

interface SubscriptionDetailPanelProps {
  orderItem: OrderItem;
  getAddressById: (addressId: number) => Address | undefined;
}

const SubscriptionDetailPanel: React.FC<SubscriptionDetailPanelProps> = ({
  orderItem,
  getAddressById,
}) => {
  const address = getAddressById(orderItem.address_id);

  return (
    <div className="space-y-4">
      {/* 기본 정보 */}
      <div className="p-4 bg-paper rounded-lg border border-line">
        <h3 className="text-sm font-semibold text-ink mb-4 uppercase tracking-wide">
          기본 정보
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-muted uppercase tracking-wide block mb-1">
              외부 주문 품목 ID
            </label>
            <p className="text-sm text-ink font-medium">
              {orderItem.external_order_item_id || "-"}
            </p>
          </div>
          <div>
            <label className="text-xs text-muted uppercase tracking-wide block mb-1">
              상품 코드
            </label>
            <p className="text-sm text-ink font-medium">
              {orderItem.product_code}
            </p>
          </div>
          <div>
            <label className="text-xs text-muted uppercase tracking-wide block mb-1">
              상품 종류
            </label>
            <p className="text-sm text-ink font-medium">
              {orderItem.product_kind === "YEARLY"
                ? "연간"
                : orderItem.product_kind === "MONTHLY"
                ? "월간"
                : "단권"}
            </p>
          </div>
          <div>
            <label className="text-xs text-muted uppercase tracking-wide block mb-1">
              상품명
            </label>
            <p className="text-sm text-ink font-medium">
              {orderItem.product_name}
            </p>
          </div>
          <div>
            <label className="text-xs text-muted uppercase tracking-wide block mb-1">
              단가
            </label>
            <p className="text-sm text-ink font-medium">
              {orderItem.price.toLocaleString()}원
            </p>
          </div>
          <div>
            <label className="text-xs text-muted uppercase tracking-wide block mb-1">
              할인 금액
            </label>
            <p className="text-sm text-ink font-medium">
              {orderItem.sale.toLocaleString()}원
            </p>
          </div>
          <div>
            <label className="text-xs text-muted uppercase tracking-wide block mb-1">
              주문 수량
            </label>
            <p className="text-sm text-ink font-medium">{orderItem.order_num}</p>
          </div>
        </div>
      </div>

      {/* 배송지 정보 */}
      <div className="p-4 bg-paper rounded-lg border border-line">
        <h3 className="text-sm font-semibold text-ink mb-4 uppercase tracking-wide">
          배송지 정보
        </h3>
        {address ? (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-muted uppercase tracking-wide block mb-1">
                  수령인
                </label>
                <p className="text-sm text-ink font-medium">
                  {address.address_name}
                </p>
              </div>
              <div>
                <label className="text-xs text-muted uppercase tracking-wide block mb-1">
                  연락처
                </label>
                <p className="text-sm text-ink font-medium">{address.phone}</p>
              </div>
              <div>
                <label className="text-xs text-muted uppercase tracking-wide block mb-1">
                  국가
                </label>
                <p className="text-sm text-ink font-medium">{address.nation}</p>
              </div>
              <div>
                <label className="text-xs text-muted uppercase tracking-wide block mb-1">
                  우편번호
                </label>
                <p className="text-sm text-ink font-medium">
                  {address.postal_code}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-muted uppercase tracking-wide block mb-1">
                  주소
                </label>
                <p className="text-sm text-ink font-medium">{address.address1}</p>
              </div>
              <div>
                <label className="text-xs text-muted uppercase tracking-wide block mb-1">
                  상세주소
                </label>
                <p className="text-sm text-ink font-medium">
                  {address.address2 || "-"}
                </p>
              </div>
            </div>
            <div>
              <label className="text-xs text-muted uppercase tracking-wide block mb-1">
                배송 특이사항
              </label>
              <p className="text-sm text-ink font-medium">
                {address.address_memo || "-"}
              </p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-ink">배송지 정보를 찾을 수 없습니다.</p>
        )}
      </div>

      {/* 구독 호 정보 */}
      <div className="p-4 bg-paper rounded-lg border border-line">
        <h3 className="text-sm font-semibold text-ink mb-4 uppercase tracking-wide">
          구독 호 정보
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-muted uppercase tracking-wide block mb-1">
              구독 시작 호
            </label>
            <p className="text-sm text-ink font-medium">
              {orderItem.subscribe_start_issue || "-"}
            </p>
          </div>
          <div>
            <label className="text-xs text-muted uppercase tracking-wide block mb-1">
              구독 종료 호
            </label>
            <p className="text-sm text-ink font-medium">
              {orderItem.subscribe_end_issue || "-"}
            </p>
          </div>
          <div>
            <label className="text-xs text-muted uppercase tracking-wide block mb-1">
              최근 발송 호
            </label>
            <p className="text-sm text-ink font-medium">
              {orderItem.last_send_issue || "-"}
            </p>
          </div>
          <div>
            <label className="text-xs text-muted uppercase tracking-wide block mb-1">
              실제 마지막 발송 호
            </label>
            <p className="text-sm text-ink font-medium">
              {orderItem.final_subscribe_end_issue || "-"}
            </p>
          </div>
        </div>
      </div>

      {/* 일시 정보 */}
      <div className="p-4 bg-paper rounded-lg border border-line">
        <h3 className="text-sm font-semibold text-ink mb-4 uppercase tracking-wide">
          일시 정보
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-muted uppercase tracking-wide block mb-1">
              발송 일시
            </label>
            <p className="text-sm text-ink font-medium">
              {orderItem.sended_at
                ? new Date(orderItem.sended_at).toLocaleString("ko-KR")
                : "-"}
            </p>
          </div>
          <div>
            <label className="text-xs text-muted uppercase tracking-wide block mb-1">
              취소 일시
            </label>
            <p className="text-sm text-ink font-medium">
              {orderItem.cancelled_at
                ? new Date(orderItem.cancelled_at).toLocaleString("ko-KR")
                : "-"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SubscriptionDetailPanel;
