import React from "react";
import { ArrowRight } from "lucide-react";
import Badge from "../common/Badge";
import { formatSubscriptionPeriod } from "../../utils/customerUtils";

interface OrderItem {
  order_item_id: number;
  product_kind: "YEARLY" | "MONTHLY" | "SINGLE";
  product_name: string;
  subscribe_start_issue: string | null;
  subscribe_end_issue: string | null;
  last_send_issue: string | null;
  price: number;
  sale: number;
}

interface CustomerSubscriptionsTabProps {
  subscriptions: OrderItem[];
  onSubscriptionClick: (item: OrderItem) => void;
}

const CustomerSubscriptionsTab: React.FC<CustomerSubscriptionsTabProps> = ({
  subscriptions,
  onSubscriptionClick,
}) => {
  if (subscriptions.length === 0) {
    return (
      <div className="text-center py-8 text-muted">구독 내역이 없습니다.</div>
    );
  }

  return (
    <div className="space-y-3">
      {subscriptions.map((item) => (
        <div
          key={item.order_item_id}
          className="p-4 border border-line rounded-lg hover:bg-paper transition-colors cursor-pointer"
          onClick={() => onSubscriptionClick(item)}
        >
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <Badge
                  variant={
                    item.product_kind === "YEARLY" ? "info" : "success"
                  }
                  size="sm"
                >
                  {item.product_kind === "YEARLY" ? "연간" : "월간"}
                </Badge>
                <p className="font-medium text-ink">{item.product_name}</p>
              </div>
              <p className="text-sm text-muted mb-1">
                구독기간 :{" "}
                {formatSubscriptionPeriod(
                  item.subscribe_start_issue,
                  item.subscribe_end_issue
                )}
              </p>
              {item.last_send_issue && (
                <p className="text-xs text-muted">
                  최근 발송: {item.last_send_issue}
                </p>
              )}
            </div>
            <div className="text-right ml-4">
              <p className="font-semibold text-ink">
                {item.price.toLocaleString()}원
              </p>
              {item.sale > 0 && (
                <p className="text-xs text-muted line-through">
                  {(item.price + item.sale).toLocaleString()}원
                </p>
              )}
              <ArrowRight className="w-4 h-4 text-muted mt-2 ml-auto" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default CustomerSubscriptionsTab;
