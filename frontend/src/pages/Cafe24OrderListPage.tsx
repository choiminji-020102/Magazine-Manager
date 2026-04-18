import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cafe24API } from "@/api/cafe24Api";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import type { Cafe24Order, Cafe24OrderDetail } from "@/types/cafe24";

function formatPrice(value: string | number | null | undefined): string {
  if (value == null) return "-";
  const num = Math.floor(Number(value));
  return num.toLocaleString("ko-KR") + "원";
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  return d.toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" });
}

function getOrderStatus(row: Cafe24Order): { label: string; className: string } {
  if (row.canceled === "T") return { label: "취소", className: "text-red-500" };
  if (row.paid === "T") return { label: "결제완료", className: "text-green-600" };
  return { label: "미결제", className: "text-gray-400" };
}

function getDefaultDates() {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 3);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { start: fmt(start), end: fmt(end) };
}

// ── 주문 상세 펼침 영역 ─────────────────────────────────────────────────────

function OrderDetailRow({ orderId }: { orderId: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["cafe24-order-detail", orderId],
    queryFn: () => cafe24API.getOrderDetail(orderId),
  });

  if (isLoading) return (
    <tr><td colSpan={100} className="px-6 py-4 bg-gray-50">
      <LoadingSpinner size="sm" />
    </td></tr>
  );

  if (error || !data) return (
    <tr><td colSpan={100} className="px-6 py-4 bg-gray-50 text-xs text-red-500">
      상세 조회 실패
    </td></tr>
  );

  const buyer = data.buyer;
  const receiver = data.receivers?.[0];
  const items = data.items ?? [];

  return (
    <tr>
      <td colSpan={100} className="px-6 py-4 bg-gray-50 border-b border-gray-200">
        <div className="grid grid-cols-3 gap-6">
          {/* 고객 (Buyer) */}
          <div>
            <h4 className="text-xs font-semibold text-gray-500 mb-2">고객 (Buyer)</h4>
            {buyer ? (
              <div className="space-y-1 text-xs">
                <div><span className="text-gray-400 w-16 inline-block">이름</span> {buyer.name}</div>
                <div><span className="text-gray-400 w-16 inline-block">휴대폰</span> {buyer.cellphone || "-"}</div>
                <div><span className="text-gray-400 w-16 inline-block">이메일</span> {buyer.email || "-"}</div>
              </div>
            ) : <span className="text-xs text-gray-400">정보 없음</span>}
          </div>

          {/* 배송지 (Receiver) */}
          <div>
            <h4 className="text-xs font-semibold text-gray-500 mb-2">배송지 (Receiver)</h4>
            {receiver ? (
              <div className="space-y-1 text-xs">
                <div><span className="text-gray-400 w-16 inline-block">수령인</span> {receiver.name}</div>
                <div><span className="text-gray-400 w-16 inline-block">휴대폰</span> {receiver.cellphone || "-"}</div>
                <div><span className="text-gray-400 w-16 inline-block">우편번호</span> {receiver.zipcode || "-"}</div>
                <div><span className="text-gray-400 w-16 inline-block">주소</span> {receiver.address_full || `${receiver.address1} ${receiver.address2}`}</div>
                <div><span className="text-gray-400 w-16 inline-block">배송메모</span> {receiver.shipping_message || "-"}</div>
              </div>
            ) : <span className="text-xs text-gray-400">정보 없음</span>}
          </div>

          {/* 품목 (Items) */}
          <div>
            <h4 className="text-xs font-semibold text-gray-500 mb-2">품목 ({items.length}개)</h4>
            {items.length > 0 ? (
              <div className="space-y-2">
                {items.map((item, idx) => (
                  <div key={idx} className="text-xs border border-gray-200 rounded p-2 bg-white">
                    <div className="font-medium text-gray-900">{item.product_name}</div>
                    <div className="text-gray-500 mt-0.5">
                      코드: <span className="font-mono">{item.product_code}</span>
                      {" · "}수량: {item.quantity}
                      {" · "}가격: {formatPrice(item.product_price)}
                    </div>
                    {item.option_value && (
                      <div className="text-gray-400 mt-0.5">옵션: {item.option_value}</div>
                    )}
                  </div>
                ))}
              </div>
            ) : <span className="text-xs text-gray-400">품목 없음</span>}
          </div>
        </div>
      </td>
    </tr>
  );
}

// ── 메인 페이지 ─────────────────────────────────────────────────────────────

export default function Cafe24OrderListPage() {
  const defaults = getDefaultDates();
  const [startDate, setStartDate] = useState(defaults.start);
  const [endDate, setEndDate] = useState(defaults.end);
  const [queryDates, setQueryDates] = useState(defaults);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const { data, isLoading } = useQuery({
    queryKey: ["cafe24-orders", queryDates.start, queryDates.end],
    queryFn: () => cafe24API.getOrders(queryDates.start, queryDates.end),
  });

  const orders = data?.orders ?? [];

  const handleSearch = () => {
    setQueryDates({ start: startDate, end: endDate });
    setExpandedIds(new Set());
  };

  const toggleExpand = (orderId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(orderId)) next.delete(orderId);
      else next.add(orderId);
      return next;
    });
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

      {/* 테이블 */}
      <div className="flex-1 min-h-0 overflow-auto">
        <table className="w-full text-left">
          <thead className="bg-gray-50 sticky top-0 z-10">
            <tr className="border-b border-gray-200">
              <th className="px-3 py-2 w-8"></th>
              <th className="px-3 py-2 text-xs font-medium text-gray-500 w-40">주문번호</th>
              <th className="px-3 py-2 text-xs font-medium text-gray-500 w-24">주문자명</th>
              <th className="px-3 py-2 text-xs font-medium text-gray-500 w-20">주문상태</th>
              <th className="px-3 py-2 text-xs font-medium text-gray-500 w-24">결제수단</th>
              <th className="px-3 py-2 text-xs font-medium text-gray-500 w-24">상품금액</th>
              <th className="px-3 py-2 text-xs font-medium text-gray-500 w-20">배송비</th>
              <th className="px-3 py-2 text-xs font-medium text-gray-500 w-24">결제금액</th>
              <th className="px-3 py-2 text-xs font-medium text-gray-500 w-24">주문일</th>
              <th className="px-3 py-2 text-xs font-medium text-gray-500 w-24">결제일</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={10} className="px-3 py-8 text-center">
                <LoadingSpinner size="sm" />
              </td></tr>
            ) : orders.length === 0 ? (
              <tr><td colSpan={10} className="px-3 py-8 text-center text-sm text-gray-400">
                Cafe24 주문이 없습니다.
              </td></tr>
            ) : (
              orders.map((order) => {
                const status = getOrderStatus(order);
                const isExpanded = expandedIds.has(order.order_id);
                return (
                  <>
                    <tr
                      key={order.order_id}
                      className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                      onClick={() => toggleExpand(order.order_id)}
                    >
                      <td className="px-3 py-2 text-gray-400">
                        {isExpanded
                          ? <ChevronDown className="h-3.5 w-3.5" />
                          : <ChevronRight className="h-3.5 w-3.5" />}
                      </td>
                      <td className="px-3 py-2 text-xs font-mono text-gray-700">{order.order_id}</td>
                      <td className="px-3 py-2 text-[13px] font-medium text-gray-900">{order.billing_name}</td>
                      <td className="px-3 py-2">
                        <span className={`text-xs font-medium ${status.className}`}>{status.label}</span>
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-600">
                        {Array.isArray(order.payment_method_name) ? order.payment_method_name.join(", ") : "-"}
                      </td>
                      <td className="px-3 py-2 text-xs">{formatPrice(order.initial_order_amount?.order_price_amount)}</td>
                      <td className="px-3 py-2 text-xs">{formatPrice(order.initial_order_amount?.shipping_fee)}</td>
                      <td className="px-3 py-2 text-[13px] font-medium">{formatPrice(order.payment_amount)}</td>
                      <td className="px-3 py-2 text-xs text-gray-500">{formatDate(order.order_date)}</td>
                      <td className="px-3 py-2 text-xs text-gray-500">{formatDate(order.payment_date)}</td>
                    </tr>
                    {isExpanded && (
                      <OrderDetailRow key={`${order.order_id}-detail`} orderId={order.order_id} />
                    )}
                  </>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
