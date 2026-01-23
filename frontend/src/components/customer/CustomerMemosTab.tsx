import React from "react";
import Button from "../common/Button";
import Textarea from "../common/Textarea";
import { Customer } from "../../api/customersApi";
import { customerAPI } from "../../api/customersApi";

interface CustomerMemosTabProps {
  customer: Customer;
  newMemo: string;
  onNewMemoChange: (memo: string) => void;
  onCustomerUpdate: (customer: Customer) => void;
}

const CustomerMemosTab: React.FC<CustomerMemosTabProps> = ({
  customer,
  newMemo,
  onNewMemoChange,
  onCustomerUpdate,
}) => {
  const handleSaveMemo = async () => {
    if (!newMemo.trim()) return;
    try {
      const updatedCustomer = await customerAPI.update(customer.customer_id, {
        admin_memo: newMemo,
      });
      onCustomerUpdate(updatedCustomer);
      onNewMemoChange("");
      alert("메모가 저장되었습니다.");
    } catch (err: any) {
      alert(err?.message || "메모 저장에 실패했습니다.");
    }
  };

  return (
    <div className="space-y-4">
      <div className="p-4 bg-info-50 border border-info-200 rounded-lg">
        <Textarea
          placeholder="관리자 메모를 입력하세요..."
          value={newMemo}
          onChange={(e) => onNewMemoChange(e.target.value)}
          rows={3}
        />
        <div className="flex justify-end mt-3">
          <Button size="sm" onClick={handleSaveMemo} disabled={!newMemo.trim()}>
            메모 저장
          </Button>
        </div>
      </div>

      <div className="p-4 bg-white border border-line rounded-lg">
        <div>
          <label className="text-xs text-muted uppercase tracking-wide mb-2 block">
            현재 관리자 메모
          </label>
          <p className="text-ink whitespace-pre-wrap">
            {customer.admin_memo || "메모가 없습니다."}
          </p>
        </div>
      </div>
    </div>
  );
};

export default CustomerMemosTab;
