import React from "react";
import Badge from "../common/Badge";
import { getSendStatusLabel } from "../../utils/customerUtils";

interface OrderItem {
  order_item_id: number;
  product_code: string;
  product_kind: "YEARLY" | "MONTHLY" | "SINGLE";
  product_name: string;
}

interface SendItem {
  send_item_id: number;
  order_item_id: number;
  product_code: string;
  product_kind?: "YEARLY" | "MONTHLY" | "SINGLE";
  send_num: number;
  purchase: number;
  product_name?: string;
  unit_weight: number;
  unit_width: number;
  unit_length: number;
  unit_height: number;
  cancelled_at: string | null;
}

interface Send {
  send_id: number;
  send_status: "PREPARING" | "SHIPPED" | "DELIVERED" | "CANCELLED";
  send_date: string | null;
  courier_company: string | null;
  tracking_no: string | null;
  cancelled_at: string | null;
  send_memo: string | null;
  address_name: string;
  phone: string;
  nation: string;
  postal_code: string;
  address: string;
  address_memo: string | null;
  send_items?: SendItem[];
}

interface SendDetailPanelProps {
  send: Send;
  sendItems: SendItem[];
  getOrderItemById: (orderItemId: number) => OrderItem | undefined;
}

const SendDetailPanel: React.FC<SendDetailPanelProps> = ({
  send,
  sendItems,
  getOrderItemById,
}) => {
  const items = send.send_items || sendItems;

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
              발송 상태
            </label>
            <p className="text-sm text-ink font-medium">
              {getSendStatusLabel(send.send_status)}
            </p>
          </div>
          <div>
            <label className="text-xs text-muted uppercase tracking-wide block mb-1">
              발송 날짜
            </label>
            <p className="text-sm text-ink font-medium">
              {send.send_date
                ? new Date(send.send_date).toLocaleDateString("ko-KR")
                : "-"}
            </p>
          </div>
          <div>
            <label className="text-xs text-muted uppercase tracking-wide block mb-1">
              택배사
            </label>
            <p className="text-sm text-ink font-medium">
              {send.courier_company || "-"}
            </p>
          </div>
          <div>
            <label className="text-xs text-muted uppercase tracking-wide block mb-1">
              운송장 번호
            </label>
            <p className="text-sm text-ink font-mono font-medium">
              {send.tracking_no || "-"}
            </p>
          </div>
          <div>
            <label className="text-xs text-muted uppercase tracking-wide block mb-1">
              취소 일시
            </label>
            <p className="text-sm text-ink font-medium">
              {send.cancelled_at
                ? new Date(send.cancelled_at).toLocaleString("ko-KR")
                : "-"}
            </p>
          </div>
        </div>
      </div>

      {/* 배송지 정보 (스냅샷) */}
      <div className="p-4 bg-paper rounded-lg border border-line">
        <h3 className="text-sm font-semibold text-ink mb-4 uppercase tracking-wide">
          배송지 정보 (스냅샷)
        </h3>
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-muted uppercase tracking-wide block mb-1">
                수령인
              </label>
              <p className="text-sm text-ink font-medium">{send.address_name}</p>
            </div>
            <div>
              <label className="text-xs text-muted uppercase tracking-wide block mb-1">
                연락처
              </label>
              <p className="text-sm text-ink font-medium">{send.phone}</p>
            </div>
            <div>
              <label className="text-xs text-muted uppercase tracking-wide block mb-1">
                국가
              </label>
              <p className="text-sm text-ink font-medium">{send.nation}</p>
            </div>
            <div>
              <label className="text-xs text-muted uppercase tracking-wide block mb-1">
                우편번호
              </label>
              <p className="text-sm text-ink font-medium">{send.postal_code}</p>
            </div>
          </div>
          <div>
            <label className="text-xs text-muted uppercase tracking-wide block mb-1">
              주소
            </label>
            <p className="text-sm text-ink font-medium">{send.address}</p>
          </div>
          {send.address_memo && (
            <div>
              <label className="text-xs text-muted uppercase tracking-wide block mb-1">
                배송 특이사항
              </label>
              <p className="text-sm text-ink font-medium">{send.address_memo}</p>
            </div>
          )}
        </div>
      </div>

      {/* 내부 배송 메모 */}
      {send.send_memo && (
        <div className="p-4 bg-paper rounded-lg border border-line">
          <h3 className="text-sm font-semibold text-ink mb-4 uppercase tracking-wide">
            내부 배송 메모
          </h3>
          <p className="text-sm text-ink whitespace-pre-wrap">
            {send.send_memo}
          </p>
        </div>
      )}

      {/* 배송 품목 */}
      <div className="p-4 bg-paper rounded-lg border border-line">
        <h3 className="text-sm font-semibold text-ink mb-4 uppercase tracking-wide">
          배송 품목
        </h3>
        {items.length === 0 ? (
          <p className="text-sm text-muted">배송 품목이 없습니다.</p>
        ) : (
          <div className="space-y-3">
            {items.map((sendItem) => {
              const orderItem = getOrderItemById(sendItem.order_item_id);
              const productKind =
                sendItem.product_kind || orderItem?.product_kind;
              const productName =
                sendItem.product_name || orderItem?.product_name || "-";
              const productCode =
                sendItem.product_code || orderItem?.product_code || "-";

              return (
                <div
                  key={sendItem.send_item_id}
                  className="p-3 bg-white rounded border border-line space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {productKind && (
                        <Badge
                          variant={
                            productKind === "YEARLY"
                              ? "info"
                              : productKind === "MONTHLY"
                              ? "success"
                              : "default"
                          }
                          size="sm"
                        >
                          {productKind === "YEARLY"
                            ? "연간"
                            : productKind === "MONTHLY"
                            ? "월간"
                            : "단권"}
                        </Badge>
                      )}
                      <span className="font-medium text-ink">{productName}</span>
                    </div>
                    <span className="font-semibold text-ink">
                      {sendItem.send_num}권
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <label className="text-xs text-muted uppercase tracking-wide block mb-1">
                        상품 코드
                      </label>
                      <p className="text-sm text-ink font-medium">
                        {productCode}
                      </p>
                    </div>
                    <div>
                      <label className="text-xs text-muted uppercase tracking-wide block mb-1">
                        제작단가
                      </label>
                      <p className="text-sm text-ink font-medium">
                        {sendItem.purchase
                          ? `${sendItem.purchase.toLocaleString()}원`
                          : "-"}
                      </p>
                    </div>
                    <div>
                      <label className="text-xs text-muted uppercase tracking-wide block mb-1">
                        무게
                      </label>
                      <p className="text-sm text-ink font-medium">
                        {sendItem.unit_weight ? `${sendItem.unit_weight}g` : "-"}
                      </p>
                    </div>
                    <div>
                      <label className="text-xs text-muted uppercase tracking-wide block mb-1">
                        크기
                      </label>
                      <p className="text-sm text-ink font-medium">
                        {sendItem.unit_width &&
                        sendItem.unit_length &&
                        sendItem.unit_height
                          ? `${sendItem.unit_width}×${sendItem.unit_length}×${sendItem.unit_height}mm`
                          : "-"}
                      </p>
                    </div>
                    {sendItem.cancelled_at && (
                      <div className="col-span-2">
                        <label className="text-xs text-muted uppercase tracking-wide block mb-1">
                          취소 일시
                        </label>
                        <p className="text-sm text-ink font-medium">
                          {new Date(sendItem.cancelled_at).toLocaleString(
                            "ko-KR"
                          )}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default SendDetailPanel;
