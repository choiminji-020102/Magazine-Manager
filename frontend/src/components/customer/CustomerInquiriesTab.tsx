import React from "react";
import { MessageSquare } from "lucide-react";

const CustomerInquiriesTab: React.FC = () => {
  return (
    <div className="space-y-4">
      <div className="text-center py-12 text-muted">
        <MessageSquare className="w-12 h-12 mx-auto mb-3 text-muted/50" />
        <p>문의 내역이 없습니다.</p>
        <p className="text-xs mt-2">문의 내역 기능은 준비 중입니다.</p>
      </div>
    </div>
  );
};

export default CustomerInquiriesTab;
