import { Phone, Mail } from "lucide-react";
import { Column } from "../common/Table";
import Badge from "../common/Badge";
import { Customer } from "../../api/customersApi";

interface CustomerColumnsProps {
  selectedCustomers: Set<string>;
  onSelectCustomer: (customerId: string, checked: boolean) => void;
}

export const createCustomerColumns = ({
  selectedCustomers,
  onSelectCustomer,
}: CustomerColumnsProps): Column<Customer>[] => [
  {
    key: "checkbox",
    label: "선택",
    width: "50px",
    align: "center",
    render: (_, row) => (
      <div className="flex justify-center">
        <input
          type="checkbox"
          checked={selectedCustomers.has(String(row.customer_id))}
          onChange={(e) =>
            onSelectCustomer(String(row.customer_id), e.target.checked)
          }
          className="w-4 h-4 rounded border-line text-accent focus:ring-accent"
        />
      </div>
    ),
  },
  {
    key: "customer_name",
    label: "이름",
    sortable: true,
    align: "center",
    render: (value) => (
      <span className="font-medium text-ink">{value}</span>
    ),
  },
  {
    key: "customer_phone",
    label: "연락처",
    align: "center",
    render: (value) => (
      <div className="flex items-center justify-center gap-2">
        <Phone className="w-4 h-4 text-muted" />
        <span className="text-sm">{value}</span>
      </div>
    ),
  },
  {
    key: "customer_email",
    label: "이메일",
    align: "center",
    render: (value) => (
      <div className="flex items-center justify-center gap-2">
        <Mail className="w-4 h-4 text-muted" />
        <span className="text-sm truncate">{value || "-"}</span>
      </div>
    ),
  },
  {
    key: "create_channel",
    label: "유입경로",
    align: "center",
    render: (value) => (
      <div className="flex justify-center">
        <Badge
          variant={
            value === "CAFE24"
              ? "cafe24"
              : value === "GPMALL"
              ? "gpmall"
              : "default"
          }
          size="sm"
        >
          {value === "CAFE24"
            ? "Cafe24"
            : value === "GPMALL"
            ? "갓피플몰"
            : value}
        </Badge>
      </div>
    ),
  },
  {
    key: "last_order_at",
    label: "최근 주문일",
    sortable: true,
    align: "center",
    render: (value) => (
      <span className="text-sm text-muted">
        {value ? new Date(value).toLocaleDateString("ko-KR") : "-"}
      </span>
    ),
  },
  {
    key: "created_at",
    label: "가입일",
    sortable: true,
    align: "center",
    render: (value) => (
      <span className="text-sm text-muted">
        {new Date(value).toLocaleDateString("ko-KR")}
      </span>
    ),
  },
];
