import React from "react";
import Badge from "../common/Badge";
import { getOrderStatusLabel } from "../../utils/customerUtils";
import { getChannelLabel } from "../../utils/customerUtils";

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

interface Order {
  order_id: number;
  external_order_id: string | null;
  order_channel: "CAFE24" | "GPMALL" | "OFFLINE";
  order_status: "ORDERED" | "PAID" | "CANCELLED" | "SHIPPING" | "COMPLETED";
  total_amount: number;
  discount_amount: number;
  send_fee: number;
  payment_amount: number;
  payment_method: string | null;
  address_id: number | null;
  request_memo: string | null;
  admin_memo: string | null;
  order_at: string;
  payment_at: string | null;
  cancelled_at: string | null;
  order_items?: OrderItem[];
}

interface OrderDetailPanelProps {
  order: Order;
  orderItems: OrderItem[];
  getAddressById: (addressId: number) => Address | undefined;
}

const OrderDetailPanel: React.FC<OrderDetailPanelProps> = ({
  order,
  orderItems,
  getAddressById,
}) => {
  const address = order.address_id ? getAddressById(order.address_id) : null;
  const addressMemo = address?.address_memo || "";
  const requestMemo = order.request_memo || "";
  const showRequestMemo =
    addressMemo.trim() !== requestMemo.trim() && requestMemo;

  const items = order.order_items
    ? order.order_items
    : orderItems.filter((item) => item.order_id === order.order_id);

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
              외부 주문 번호
            </label>
            <p className="text-sm text-ink font-medium">
              {order.external_order_id || "-"}
            </p>
          </div>
          <div>
            <label className="text-xs text-muted uppercase tracking-wide block mb-1">
              주문 채널
            </label>
            <p className="text-sm text-ink font-medium">
              {getChannelLabel(order.order_channel)}
            </p>
          </div>
          <div>
            <label className="text-xs text-muted uppercase tracking-wide block mb-1">
              주문 상태
            </label>
            <p className="text-sm text-ink font-medium">
              {getOrderStatusLabel(order.order_status)}
            </p>
          </div>
          <div>
            <label className="text-xs text-muted uppercase tracking-wide block mb-1">
              결제 방식
            </label>
            <p className="text-sm text-ink font-medium">
              {order.payment_method || "-"}
            </p>
          </div>
          <div>
            <label className="text-xs text-muted uppercase tracking-wide block mb-1">
              주문 일시
            </label>
            <p className="text-sm text-ink font-medium">
              {new Date(order.order_at).toLocaleString("ko-KR")}
            </p>
          </div>
          <div>
            <label className="text-xs text-muted uppercase tracking-wide block mb-1">
              결제 일시
            </label>
            <p className="text-sm text-ink font-medium">
              {order.payment_at
                ? new Date(order.payment_at).toLocaleString("ko-KR")
                : "-"}
            </p>
          </div>
          <div>
            <label className="text-xs text-muted uppercase tracking-wide block mb-1">
              취소 일시
            </label>
            <p className="text-sm text-ink font-medium">
              {order.cancelled_at
                ? new Date(order.cancelled_at).toLocaleString("ko-KR")
                : "-"}
            </p>
          </div>
        </div>
      </div>

      {/* 금액 정보 */}
      <div className="p-4 bg-paper rounded-lg border border-line">
        <h3 className="text-sm font-semibold text-ink mb-4 uppercase tracking-wide">
          금액 정보
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-muted uppercase tracking-wide block mb-1">
              상품 금액
            </label>
            <p className="text-sm text-ink font-medium">
              {order.total_amount.toLocaleString()}원
            </p>
          </div>
          <div>
            <label className="text-xs text-muted uppercase tracking-wide block mb-1">
              할인 금액
            </label>
            <p className="text-sm text-ink font-medium">
              {order.discount_amount.toLocaleString()}원
            </p>
          </div>
          <div>
            <label className="text-xs text-muted uppercase tracking-wide block mb-1">
              배송비
            </label>
            <p className="text-sm text-ink font-medium">
              {order.send_fee.toLocaleString()}원
            </p>
          </div>
          <div>
            <label className="text-xs text-muted uppercase tracking-wide block mb-1">
              최종 결제 금액
            </label>
            <p className="text-base font-bold text-accent">
              {order.payment_amount.toLocaleString()}원
            </p>
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
          <p className="text-sm text-ink">배송지 정보 없음</p>
        )}
      </div>

      {/* 고객 요청사항 */}
      {showRequestMemo && (
        <div className="p-4 bg-paper rounded-lg border border-line">
          <h3 className="text-sm font-semibold text-ink mb-4 uppercase tracking-wide">
            고객 요청사항
          </h3>
          <p className="text-sm text-ink whitespace-pre-wrap">
            {order.request_memo}
          </p>
        </div>
      )}

      {/* 관리자 메모 */}
      <div className="p-4 bg-paper rounded-lg border border-line">
        <h3 className="text-sm font-semibold text-ink mb-4 uppercase tracking-wide">
          관리자 메모
        </h3>
        <p className="text-sm text-ink whitespace-pre-wrap">
          {order.admin_memo || "-"}
        </p>
      </div>

      {/* 주문 품목 */}
      <div className="p-4 bg-paper rounded-lg border border-line">
        <h3 className="text-sm font-semibold text-ink mb-4 uppercase tracking-wide">
          주문 품목
        </h3>
        {items.length === 0 ? (
          <p className="text-sm text-muted">주문 품목이 없습니다.</p>
        ) : (
          <div className="space-y-3">
            {items.map((item) => {
              const itemAddress = getAddressById(item.address_id);
              return (
                <div
                  key={item.order_item_id}
                  className="p-3 bg-white rounded border border-line space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={
                          item.product_kind === "YEARLY"
                            ? "info"
                            : item.product_kind === "MONTHLY"
                            ? "success"
                            : "default"
                        }
                        size="sm"
                      >
                        {item.product_kind === "YEARLY"
                          ? "연간"
                          : item.product_kind === "MONTHLY"
                          ? "월간"
                          : "단권"}
                      </Badge>
                      <span className="font-medium text-ink">
                        {item.product_name}
                      </span>
                    </div>
                    <span className="font-semibold text-ink">
                      {item.price.toLocaleString()}원
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-muted">외부 품목 ID:</span>{" "}
                      <span className="text-ink">
                        {item.external_order_item_id || "-"}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted">상품 코드:</span>{" "}
                      <span className="text-ink">{item.product_code}</span>
                    </div>
                    <div>
                      <span className="text-muted">할인 금액:</span>{" "}
                      <span className="text-ink">
                        {item.sale.toLocaleString()}원
                      </span>
                    </div>
                    <div>
                      <span className="text-muted">주문 수량:</span>{" "}
                      <span className="text-ink">{item.order_num}</span>
                    </div>
                    {(item.product_kind === "YEARLY" ||
                      item.product_kind === "MONTHLY") && (
                      <>
                        <div>
                          <span className="text-muted">구독 시작 호:</span>{" "}
                          <span className="text-ink">
                            {item.subscribe_start_issue || "-"}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted">구독 종료 호:</span>{" "}
                          <span className="text-ink">
                            {item.subscribe_end_issue || "-"}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted">최근 발송 호:</span>{" "}
                          <span className="text-ink">
                            {item.last_send_issue || "-"}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted">실제 마지막 발송 호:</span>{" "}
                          <span className="text-ink">
                            {item.final_subscribe_end_issue || "-"}
                          </span>
                        </div>
                      </>
                    )}
                    <div>
                      <span className="text-muted">발송 일시:</span>{" "}
                      <span className="text-ink">
                        {item.sended_at
                          ? new Date(item.sended_at).toLocaleString("ko-KR")
                          : "-"}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted">취소 일시:</span>{" "}
                      <span className="text-ink">
                        {item.cancelled_at
                          ? new Date(item.cancelled_at).toLocaleString("ko-KR")
                          : "-"}
                      </span>
                    </div>
                  </div>
                  {itemAddress && (
                    <div className="pt-2 border-t border-line">
                      <p className="text-sm text-muted mb-1">배송지</p>
                      <p className="text-sm text-ink">
                        {itemAddress.address_name} / {itemAddress.phone} /{" "}
                        {itemAddress.postal_code} {itemAddress.address1}{" "}
                        {itemAddress.address2}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default OrderDetailPanel;
