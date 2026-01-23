import React from "react";
import { ArrowRight } from "lucide-react";
import Badge from "../common/Badge";
import { getOrderStatusLabel } from "../../utils/customerUtils";

interface Order {
  order_id: number;
  external_order_id: string | null;
  order_status: "ORDERED" | "PAID" | "CANCELLED" | "SHIPPING" | "COMPLETED";
  order_at: string;
  order_channel: "CAFE24" | "GPMALL" | "OFFLINE";
  payment_amount: number;
  payment_method: string | null;
}

interface CustomerOrdersTabProps {
  orders: Order[];
  onOrderClick: (order: Order) => void;
}

const CustomerOrdersTab: React.FC<CustomerOrdersTabProps> = ({
  orders,
  onOrderClick,
}) => {
  if (orders.length === 0) {
    return (
      <div className="text-center py-8 text-muted">주문 내역이 없습니다.</div>
    );
  }

  return (
    <div className="space-y-3">
      {orders.map((order) => (
        <div
          key={order.order_id}
          className="p-4 border border-line rounded-lg hover:bg-paper transition-colors cursor-pointer"
          onClick={() => onOrderClick(order)}
        >
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <p className="font-mono text-sm text-accent">
                  {order.external_order_id || `주문 #${order.order_id}`}
                </p>
                <Badge
                  variant={
                    order.order_status === "COMPLETED"
                      ? "success"
                      : order.order_status === "CANCELLED"
                      ? "default"
                      : "info"
                  }
                  size="sm"
                >
                  {getOrderStatusLabel(order.order_status)}
                </Badge>
              </div>
              <p className="text-sm text-muted mb-1">
                {new Date(order.order_at).toLocaleString("ko-KR")}
              </p>
              <p className="text-sm text-ink">
                {order.order_channel === "CAFE24"
                  ? "Cafe24"
                  : order.order_channel === "GPMALL"
                  ? "갓피플몰"
                  : order.order_channel}
              </p>
            </div>
            <div className="text-right ml-4">
              <p className="font-semibold text-ink text-lg">
                {order.payment_amount.toLocaleString()}원
              </p>
              <p className="text-xs text-muted mt-1">
                결제: {order.payment_method || "-"}
              </p>
              <ArrowRight className="w-4 h-4 text-muted mt-2 ml-auto" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default CustomerOrdersTab;
