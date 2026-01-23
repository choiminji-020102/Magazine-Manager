import React from "react";
import Input from "../common/Input";
import { Customer } from "../../api/customersApi";

interface CustomerInfoTabProps {
  customer: Customer;
  isEditMode: boolean;
  editForm: Partial<Customer>;
  onEditFormChange: (form: Partial<Customer>) => void;
}

const CustomerInfoTab: React.FC<CustomerInfoTabProps> = ({
  customer,
  isEditMode,
  editForm,
  onEditFormChange,
}) => {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div className="p-4 bg-paper rounded-lg">
          <div className="space-y-4">
            {isEditMode ? (
              <>
                <Input
                  label="이름"
                  value={editForm.customer_name || customer.customer_name}
                  onChange={(e) =>
                    onEditFormChange({
                      ...editForm,
                      customer_name: e.target.value,
                    })
                  }
                  required
                />
                <Input
                  label="전화번호"
                  type="tel"
                  value={editForm.customer_phone || customer.customer_phone}
                  onChange={(e) =>
                    onEditFormChange({
                      ...editForm,
                      customer_phone: e.target.value,
                    })
                  }
                  required
                />
                <Input
                  label="이메일"
                  type="email"
                  value={
                    editForm.customer_email !== undefined
                      ? editForm.customer_email || ""
                      : customer.customer_email || ""
                  }
                  onChange={(e) =>
                    onEditFormChange({
                      ...editForm,
                      customer_email: e.target.value || null,
                    })
                  }
                />
              </>
            ) : (
              <>
                <div>
                  <label className="text-xs text-muted uppercase tracking-wide">
                    이름
                  </label>
                  <p className="text-base font-medium text-ink mt-1">
                    {customer.customer_name}
                  </p>
                </div>
                <div>
                  <label className="text-xs text-muted uppercase tracking-wide">
                    전화번호
                  </label>
                  <p className="text-base text-ink mt-1">
                    {customer.customer_phone}
                  </p>
                </div>
                <div>
                  <label className="text-xs text-muted uppercase tracking-wide">
                    이메일
                  </label>
                  <p className="text-base text-ink mt-1">
                    {customer.customer_email || "-"}
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
        <div className="p-4 bg-paper rounded-lg">
          <div className="space-y-4">
            <div>
              <label className="text-xs text-muted uppercase tracking-wide">
                유입채널
              </label>
              <p className="text-base text-ink mt-1">
                {customer.create_channel === "CAFE24"
                  ? "Cafe24"
                  : customer.create_channel === "GPMALL"
                  ? "갓피플몰"
                  : customer.create_channel}
              </p>
              {isEditMode && (
                <p className="text-xs text-muted mt-1">
                  유입 경로는 수정할 수 없습니다.
                </p>
              )}
            </div>
            <div>
              <label className="text-xs text-muted uppercase tracking-wide">
                마지막 주문일
              </label>
              <p className="text-base text-ink mt-1">
                {customer.last_order_at
                  ? new Date(customer.last_order_at).toLocaleDateString("ko-KR")
                  : "-"}
              </p>
            </div>
            <div>
              <label className="text-xs text-muted uppercase tracking-wide">
                가입일
              </label>
              <p className="text-base text-ink mt-1">
                {new Date(customer.created_at).toLocaleDateString("ko-KR")}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CustomerInfoTab;
