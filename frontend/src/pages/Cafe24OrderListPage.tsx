import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { cafe24API } from "@/api/cafe24Api";
import { DataTable, ColumnDef } from "@/components/common/DataTable";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Cafe24Order } from "@/types/cafe24";

function formatCafe24Price(value: string | number): string {
  const num = Math.floor(Number(value));
  return num.toLocaleString("ko-KR") + "원";
}

function formatCafe24Date(dateStr: string | null): string {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  return d.toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" });
}

// 기본값: 오늘부터 3일 전
function getDefaultDates() {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 3);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { start: fmt(start), end: fmt(end) };
}

// 영문 필드명 헤더용 — 소문자, 줄바꿈 허용
const ENG_HEADER_CLASS = "normal-case text-[10px] leading-tight";

function amountCell(row: Cafe24Order, field: string): string {
  const val = row[field];
  if (val == null) return "-";
  return formatCafe24Price(val);
}

function nestedAmountCell(row: Cafe24Order, parent: string, field: string): string {
  const obj = row[parent];
  if (!obj || obj[field] == null) return "-";
  return formatCafe24Price(obj[field]);
}

const columns: ColumnDef<Cafe24Order>[] = [
  // 기본 정보
  {
    key: "order_id",
    header: "주문번호",
    cell: (row) => <span className="text-xs font-mono text-gray-700">{row.order_id}</span>,
    width: "w-40",
  },
  {
    key: "billing_name",
    header: "결제자명",
    cell: (row) => <span className="text-[13px] font-medium text-gray-900">{row.billing_name}</span>,
    width: "w-28",
  },
  {
    key: "payment_method_name",
    header: "결제수단명",
    cell: (row) => (
      <span className="text-xs text-gray-600">
        {Array.isArray(row.payment_method_name) ? row.payment_method_name.join(", ") : "-"}
      </span>
    ),
    width: "w-24",
  },
  {
    key: "payment_amount",
    header: "최종 결제 금액",
    cell: (row) => <span className="text-[13px] font-medium">{formatCafe24Price(row.payment_amount)}</span>,
    width: "w-28",
  },
  {
    key: "paid",
    header: "결제 여부",
    cell: (row) => (
      <span className={`text-xs font-medium ${row.paid === "T" ? "text-green-600" : "text-gray-400"}`}>
        {row.paid === "T" ? "결제완료" : "미결제"}
      </span>
    ),
    width: "w-20",
  },
  {
    key: "canceled",
    header: "취소 여부",
    cell: (row) => (
      <span className={`text-xs font-medium ${row.canceled === "T" ? "text-red-500" : "text-gray-400"}`}>
        {row.canceled === "T" ? "취소" : "-"}
      </span>
    ),
    width: "w-20",
  },
  {
    key: "first_order",
    header: "first_order",
    headerClassName: ENG_HEADER_CLASS,
    cell: (row) => <span className="text-xs text-gray-600">{row.first_order}</span>,
    width: "w-12",
  },
  {
    key: "order_from_mobile",
    header: "order_from_mobile",
    headerClassName: ENG_HEADER_CLASS,
    cell: (row) => <span className="text-xs text-gray-600">{row.order_from_mobile}</span>,
    width: "w-12",
  },
  {
    key: "use_escrow",
    header: "use_escrow",
    headerClassName: ENG_HEADER_CLASS,
    cell: (row) => <span className="text-xs text-gray-600">{row.use_escrow}</span>,
    width: "w-12",
  },
  {
    key: "group_no_when_ordering",
    header: "group_no_when_ordering",
    headerClassName: ENG_HEADER_CLASS,
    cell: (row) => <span className="text-xs text-gray-600">{row.group_no_when_ordering ?? "-"}</span>,
    width: "w-12",
  },
  // initial_order_amount
  {
    key: "initial_order_price_amount",
    header: "initial_order_amount.order_price_amount",
    headerClassName: ENG_HEADER_CLASS,
    cell: (row) => <span className="text-xs">{nestedAmountCell(row, "initial_order_amount", "order_price_amount")}</span>,
    width: "w-16",
  },
  {
    key: "initial_shipping_fee",
    header: "initial_order_amount.shipping_fee",
    headerClassName: ENG_HEADER_CLASS,
    cell: (row) => <span className="text-xs">{nestedAmountCell(row, "initial_order_amount", "shipping_fee")}</span>,
    width: "w-16",
  },
  {
    key: "initial_points_spent",
    header: "initial_order_amount.points_spent_amount",
    headerClassName: ENG_HEADER_CLASS,
    cell: (row) => <span className="text-xs">{nestedAmountCell(row, "initial_order_amount", "points_spent_amount")}</span>,
    width: "w-16",
  },
  {
    key: "initial_credits_spent",
    header: "initial_order_amount.credits_spent_amount",
    headerClassName: ENG_HEADER_CLASS,
    cell: (row) => <span className="text-xs">{nestedAmountCell(row, "initial_order_amount", "credits_spent_amount")}</span>,
    width: "w-16",
  },
  {
    key: "initial_coupon_discount",
    header: "initial_order_amount.coupon_discount_price",
    headerClassName: ENG_HEADER_CLASS,
    cell: (row) => <span className="text-xs">{nestedAmountCell(row, "initial_order_amount", "coupon_discount_price")}</span>,
    width: "w-16",
  },
  {
    key: "initial_coupon_shipping",
    header: "initial_order_amount.coupon_shipping_fee_amount",
    headerClassName: ENG_HEADER_CLASS,
    cell: (row) => <span className="text-xs">{nestedAmountCell(row, "initial_order_amount", "coupon_shipping_fee_amount")}</span>,
    width: "w-16",
  },
  {
    key: "initial_membership_discount",
    header: "initial_order_amount.membership_discount_amount",
    headerClassName: ENG_HEADER_CLASS,
    cell: (row) => <span className="text-xs">{nestedAmountCell(row, "initial_order_amount", "membership_discount_amount")}</span>,
    width: "w-16",
  },
  {
    key: "initial_shipping_discount",
    header: "initial_order_amount.shipping_fee_discount_amount",
    headerClassName: ENG_HEADER_CLASS,
    cell: (row) => <span className="text-xs">{nestedAmountCell(row, "initial_order_amount", "shipping_fee_discount_amount")}</span>,
    width: "w-16",
  },
  {
    key: "initial_set_product_discount",
    header: "initial_order_amount.set_product_discount_amount",
    headerClassName: ENG_HEADER_CLASS,
    cell: (row) => <span className="text-xs">{nestedAmountCell(row, "initial_order_amount", "set_product_discount_amount")}</span>,
    width: "w-16",
  },
  {
    key: "initial_app_discount",
    header: "initial_order_amount.app_discount_amount",
    headerClassName: ENG_HEADER_CLASS,
    cell: (row) => <span className="text-xs">{nestedAmountCell(row, "initial_order_amount", "app_discount_amount")}</span>,
    width: "w-16",
  },
  {
    key: "initial_point_incentive",
    header: "initial_order_amount.point_incentive_amount",
    headerClassName: ENG_HEADER_CLASS,
    cell: (row) => <span className="text-xs">{nestedAmountCell(row, "initial_order_amount", "point_incentive_amount")}</span>,
    width: "w-16",
  },
  {
    key: "initial_total_amount_due",
    header: "initial_order_amount.total_amount_due",
    headerClassName: ENG_HEADER_CLASS,
    cell: (row) => <span className="text-xs">{nestedAmountCell(row, "initial_order_amount", "total_amount_due")}</span>,
    width: "w-16",
  },
  {
    key: "initial_payment_amount",
    header: "initial_order_amount.payment_amount",
    headerClassName: ENG_HEADER_CLASS,
    cell: (row) => <span className="text-xs font-medium">{nestedAmountCell(row, "initial_order_amount", "payment_amount")}</span>,
    width: "w-16",
  },
  {
    key: "initial_market_discount",
    header: "initial_order_amount.market_other_discount_amount",
    headerClassName: ENG_HEADER_CLASS,
    cell: (row) => <span className="text-xs">{nestedAmountCell(row, "initial_order_amount", "market_other_discount_amount")}</span>,
    width: "w-16",
  },
  {
    key: "initial_tax",
    header: "initial_order_amount.tax",
    headerClassName: ENG_HEADER_CLASS,
    cell: (row) => <span className="text-xs">{nestedAmountCell(row, "initial_order_amount", "tax")}</span>,
    width: "w-16",
  },
  // actual_order_amount
  {
    key: "actual_order_price_amount",
    header: "actual_order_amount.order_price_amount",
    headerClassName: ENG_HEADER_CLASS,
    cell: (row) => <span className="text-xs">{nestedAmountCell(row, "actual_order_amount", "order_price_amount")}</span>,
    width: "w-16",
  },
  {
    key: "actual_shipping_fee",
    header: "actual_order_amount.shipping_fee",
    headerClassName: ENG_HEADER_CLASS,
    cell: (row) => <span className="text-xs">{nestedAmountCell(row, "actual_order_amount", "shipping_fee")}</span>,
    width: "w-16",
  },
  {
    key: "actual_points_spent",
    header: "actual_order_amount.points_spent_amount",
    headerClassName: ENG_HEADER_CLASS,
    cell: (row) => <span className="text-xs">{nestedAmountCell(row, "actual_order_amount", "points_spent_amount")}</span>,
    width: "w-16",
  },
  {
    key: "actual_credits_spent",
    header: "actual_order_amount.credits_spent_amount",
    headerClassName: ENG_HEADER_CLASS,
    cell: (row) => <span className="text-xs">{nestedAmountCell(row, "actual_order_amount", "credits_spent_amount")}</span>,
    width: "w-16",
  },
  {
    key: "actual_coupon_discount",
    header: "actual_order_amount.coupon_discount_price",
    headerClassName: ENG_HEADER_CLASS,
    cell: (row) => <span className="text-xs">{nestedAmountCell(row, "actual_order_amount", "coupon_discount_price")}</span>,
    width: "w-16",
  },
  {
    key: "actual_coupon_shipping",
    header: "actual_order_amount.coupon_shipping_fee_amount",
    headerClassName: ENG_HEADER_CLASS,
    cell: (row) => <span className="text-xs">{nestedAmountCell(row, "actual_order_amount", "coupon_shipping_fee_amount")}</span>,
    width: "w-16",
  },
  {
    key: "actual_membership_discount",
    header: "actual_order_amount.membership_discount_amount",
    headerClassName: ENG_HEADER_CLASS,
    cell: (row) => <span className="text-xs">{nestedAmountCell(row, "actual_order_amount", "membership_discount_amount")}</span>,
    width: "w-16",
  },
  {
    key: "actual_shipping_discount",
    header: "actual_order_amount.shipping_fee_discount_amount",
    headerClassName: ENG_HEADER_CLASS,
    cell: (row) => <span className="text-xs">{nestedAmountCell(row, "actual_order_amount", "shipping_fee_discount_amount")}</span>,
    width: "w-16",
  },
  {
    key: "actual_set_product_discount",
    header: "actual_order_amount.set_product_discount_amount",
    headerClassName: ENG_HEADER_CLASS,
    cell: (row) => <span className="text-xs">{nestedAmountCell(row, "actual_order_amount", "set_product_discount_amount")}</span>,
    width: "w-16",
  },
  {
    key: "actual_app_discount",
    header: "actual_order_amount.app_discount_amount",
    headerClassName: ENG_HEADER_CLASS,
    cell: (row) => <span className="text-xs">{nestedAmountCell(row, "actual_order_amount", "app_discount_amount")}</span>,
    width: "w-16",
  },
  {
    key: "actual_point_incentive",
    header: "actual_order_amount.point_incentive_amount",
    headerClassName: ENG_HEADER_CLASS,
    cell: (row) => <span className="text-xs">{nestedAmountCell(row, "actual_order_amount", "point_incentive_amount")}</span>,
    width: "w-16",
  },
  {
    key: "actual_total_amount_due",
    header: "actual_order_amount.total_amount_due",
    headerClassName: ENG_HEADER_CLASS,
    cell: (row) => <span className="text-xs">{nestedAmountCell(row, "actual_order_amount", "total_amount_due")}</span>,
    width: "w-16",
  },
  {
    key: "actual_payment_amount",
    header: "actual_order_amount.payment_amount",
    headerClassName: ENG_HEADER_CLASS,
    cell: (row) => <span className="text-xs font-medium">{nestedAmountCell(row, "actual_order_amount", "payment_amount")}</span>,
    width: "w-16",
  },
  {
    key: "actual_market_discount",
    header: "actual_order_amount.market_other_discount_amount",
    headerClassName: ENG_HEADER_CLASS,
    cell: (row) => <span className="text-xs">{nestedAmountCell(row, "actual_order_amount", "market_other_discount_amount")}</span>,
    width: "w-16",
  },
  {
    key: "actual_tax",
    header: "actual_order_amount.tax",
    headerClassName: ENG_HEADER_CLASS,
    cell: (row) => <span className="text-xs">{nestedAmountCell(row, "actual_order_amount", "tax")}</span>,
    width: "w-16",
  },
  // 날짜
  {
    key: "order_date",
    header: "주문일",
    cell: (row) => <span className="text-xs text-gray-500">{formatCafe24Date(row.order_date)}</span>,
    width: "w-24",
  },
  {
    key: "payment_date",
    header: "결제일",
    cell: (row) => <span className="text-xs text-gray-500">{formatCafe24Date(row.payment_date)}</span>,
    width: "w-24",
  },
];

export default function Cafe24OrderListPage() {
  const defaults = getDefaultDates();
  const [startDate, setStartDate] = useState(defaults.start);
  const [endDate, setEndDate] = useState(defaults.end);
  const [queryDates, setQueryDates] = useState(defaults);

  const { data, isLoading } = useQuery({
    queryKey: ["cafe24-orders", queryDates.start, queryDates.end],
    queryFn: () => cafe24API.getOrders(queryDates.start, queryDates.end),
  });

  const orders = data?.orders ?? [];

  const handleSearch = () => {
    setQueryDates({ start: startDate, end: endDate });
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <PageHeader
        left={<span className="text-sm text-gray-500">총 {orders.length}건</span>}
      />

      {/* 날짜 필터 */}
      <div className="flex items-end gap-3 px-5 py-3 border-b border-gray-200 bg-white">
        <div>
          <Label className="text-xs text-gray-500">시작일</Label>
          <Input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="mt-1 w-36"
          />
        </div>
        <div>
          <Label className="text-xs text-gray-500">종료일</Label>
          <Input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="mt-1 w-36"
          />
        </div>
        <Button size="sm" onClick={handleSearch} disabled={isLoading}>
          조회
        </Button>
        <span className="text-xs text-gray-400">최대 3개월</span>
      </div>

      <div className="flex-1 min-h-0 overflow-auto">
        <DataTable
          columns={columns}
          data={orders}
          getRowId={(row) => row.order_id}
          isLoading={isLoading}
          emptyMessage="Cafe24 주문이 없습니다."
        />
      </div>
    </div>
  );
}
