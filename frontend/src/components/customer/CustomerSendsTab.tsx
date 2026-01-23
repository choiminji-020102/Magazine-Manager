import React from "react";
import { ArrowRight } from "lucide-react";
import Badge from "../common/Badge";
import { getSendStatusLabel } from "../../utils/customerUtils";

interface Send {
  send_id: number;
  send_status: "PREPARING" | "SHIPPED" | "DELIVERED" | "CANCELLED";
  send_date: string | null;
  courier_company: string | null;
  tracking_no: string | null;
  address_name: string;
  phone: string;
}

interface CustomerSendsTabProps {
  sends: Send[];
  onSendClick: (send: Send) => void;
}

const CustomerSendsTab: React.FC<CustomerSendsTabProps> = ({
  sends,
  onSendClick,
}) => {
  if (sends.length === 0) {
    return (
      <div className="text-center py-8 text-muted">배송 내역이 없습니다.</div>
    );
  }

  return (
    <div className="space-y-3">
      {sends.map((send) => (
        <div
          key={send.send_id}
          className="p-4 border border-line rounded-lg hover:bg-paper transition-colors cursor-pointer"
          onClick={() => onSendClick(send)}
        >
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <Badge
                  variant={
                    send.send_status === "DELIVERED"
                      ? "success"
                      : send.send_status === "CANCELLED"
                      ? "default"
                      : "info"
                  }
                  size="sm"
                >
                  {getSendStatusLabel(send.send_status)}
                </Badge>
                {send.tracking_no && (
                  <p className="font-mono text-sm text-accent">
                    {send.tracking_no}
                  </p>
                )}
              </div>
              <p className="text-sm text-muted mb-1">
                {send.send_date
                  ? new Date(send.send_date).toLocaleDateString("ko-KR")
                  : "-"}
              </p>
              <p className="text-sm text-ink">
                {send.courier_company || "택배사 미지정"}
              </p>
            </div>
            <div className="text-right ml-4">
              <p className="text-sm text-ink font-medium">{send.address_name}</p>
              <p className="text-xs text-muted mt-1">{send.phone}</p>
              <ArrowRight className="w-4 h-4 text-muted mt-2 ml-auto" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default CustomerSendsTab;
