import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ShoppingCart, Package, TrendingUp, Users } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { statsApi } from "@/api/statsApi";
import { ordersApi } from "@/api/ordersApi";
import { formatAmount, formatDate, formatIssue } from "@/utils/format";
import { StatusBadge } from "@/components/common/StatusBadge";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";

// 오늘 날짜 (YYYY-MM-DD)
function today() {
  return new Date().toISOString().slice(0, 10);
}

// 이번 달 첫날 (YYYY-MM-DD)
function monthStart() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

// N개월 전 첫날 (YYYY-MM-DD)
function nMonthsAgoStart(n: number) {
  const d = new Date();
  d.setMonth(d.getMonth() - n + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

export default function DashboardPage() {
  const [periodType, setPeriodType] = useState<"monthly" | "daily">("monthly");

  const { data: summaryRes, isLoading: summaryLoading } = useQuery({
    queryKey: ["stats-summary"],
    queryFn: () =>
      statsApi
        .getOrdersSummary({ start_date: monthStart(), end_date: today() })
        .then((r) => r.data),
  });

  const { data: channelRes } = useQuery({
    queryKey: ["stats-channel"],
    queryFn: () => statsApi.getCustomersByChannel().then((r) => r.data),
  });

  const { data: activeSubRes } = useQuery({
    queryKey: ["stats-active-subs"],
    queryFn: () => statsApi.getActiveSubscriptions().then((r) => r.data),
  });

  const { data: subsByIssueRes } = useQuery({
    queryKey: ["stats-subs-by-issue"],
    queryFn: () => statsApi.getSubscriptionsByIssue({}).then((r) => r.data),
  });

  const { data: channelOrderRes } = useQuery({
    queryKey: ["stats-orders-by-channel"],
    queryFn: () =>
      statsApi
        .getOrdersByChannel({ start_date: monthStart(), end_date: today() })
        .then((r) => r.data),
  });

  const { data: recentOrdersRes } = useQuery({
    queryKey: ["orders-recent"],
    queryFn: () =>
      ordersApi.getOrders({ page: 1, limit: 10 }).then((r) => r.data),
  });

  const periodMonths = periodType === "monthly" ? 6 : 1;
  const { data: periodRes } = useQuery({
    queryKey: ["stats-by-period", periodType],
    queryFn: () =>
      statsApi
        .getOrdersByPeriod({
          period: periodType,
          start_date: nMonthsAgoStart(periodMonths),
          end_date: today(),
        })
        .then((r) => r.data),
  });

  const summary = summaryRes?.data;
  const channelData = channelRes?.data;
  const channelOrderData = channelOrderRes?.data;
  const activeSubData = activeSubRes?.data;
  const subsByIssue = subsByIssueRes?.data;
  const recentOrders = recentOrdersRes?.items ?? [];
  const periodData = periodRes?.data?.data ?? [];

  if (summaryLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
    <div className="p-6 space-y-6 max-w-5xl">
      {/* 이번달 요약 카드 */}
      <div>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
          이번달 현황
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard
            icon={<ShoppingCart className="h-4 w-4" />}
            label="총 주문"
            value={`${summary?.summary.total_orders ?? 0}건`}
            color="blue"
          />
          <StatCard
            icon={<TrendingUp className="h-4 w-4" />}
            label="결제완료"
            value={`${summary?.summary.completed_orders ?? 0}건`}
            color="green"
          />
          <StatCard
            icon={<Package className="h-4 w-4" />}
            label="취소"
            value={`${summary?.summary.cancelled_orders ?? 0}건`}
            color="red"
          />
          <StatCard
            icon={<TrendingUp className="h-4 w-4" />}
            label="매출"
            value={formatAmount(summary?.summary.total_revenue ?? 0)}
            color="purple"
          />
        </div>
      </div>

      {/* 이번달 일별 주문 추이 + 채널별 분포 */}
      {summary && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* 일별 주문 Bar 차트 */}
          <div className="lg:col-span-2 bg-white border border-gray-200 rounded-lg p-4">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
              일별 주문 추이
            </h2>
            {summary.daily_trend.length > 0 ? (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={summary.daily_trend} margin={{ top: 0, right: 8, left: -20, bottom: 0 }}>
                  <XAxis
                    dataKey="date"
                    tickFormatter={(v) => v.slice(8)}
                    tick={{ fontSize: 11, fill: "#9ca3af" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 11, fill: "#9ca3af" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    formatter={(value: number) => [`${value}건`, "주문"]}
                    labelFormatter={(label) => label}
                    contentStyle={{ fontSize: 12, borderRadius: 6, border: "1px solid #e5e7eb" }}
                  />
                  <Bar dataKey="orders" fill="#2563eb" radius={[3, 3, 0, 0]} maxBarSize={24} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[180px] text-sm text-gray-400">
                이번달 주문 데이터가 없습니다.
              </div>
            )}
          </div>

          {/* 채널별 주문 Pie 차트 */}
          {channelOrderData && channelOrderData.by_channel.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                채널별 주문
              </h2>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie
                    data={channelOrderData.by_channel.map((ch) => ({
                      name: ch.order_channel === "CAFE24" ? "Cafe24" : ch.order_channel === "GPMALL" ? "갓피플몰" : "오프라인",
                      value: ch.valid_orders,
                    }))}
                    cx="50%"
                    cy="45%"
                    outerRadius={60}
                    dataKey="value"
                    label={({ percent }) => percent > 0.05 ? `${(percent * 100).toFixed(0)}%` : ""}
                    labelLine={false}
                  >
                    {channelOrderData.by_channel.map((ch, i) => (
                      <Cell
                        key={ch.order_channel}
                        fill={["#2563eb", "#16a34a", "#d97706"][i % 3]}
                      />
                    ))}
                  </Pie>
                  <Legend
                    iconType="circle"
                    iconSize={8}
                    wrapperStyle={{ fontSize: 11 }}
                  />
                  <Tooltip
                    formatter={(value: number) => [`${value}건`]}
                    contentStyle={{ fontSize: 12, borderRadius: 6, border: "1px solid #e5e7eb" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* 활성 구독 현황 */}
      {activeSubData && (
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            활성 구독 현황
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard
              icon={<Users className="h-4 w-4" />}
              label="전체 활성 구독"
              value={`${activeSubData.total.total_subscriptions ?? 0}건`}
              color="blue"
            />
            {activeSubData.by_kind?.map((p) => (
              <StatCard
                key={p.product_kind}
                icon={<Package className="h-4 w-4" />}
                label={p.product_kind === "YEARLY" ? "정기구독" : "월간지"}
                value={`${p.count}건`}
                color="green"
              />
            ))}
          </div>
        </div>
      )}

      {/* 호수별 구독자 수 */}
      {(subsByIssue?.issues?.length ?? 0) > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            호수별 구독 현황
          </h2>
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase">호수</th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-gray-500 uppercase">구독자 수</th>
                </tr>
              </thead>
              <tbody>
                {subsByIssue!.issues.slice(0, 6).map((row) => (
                  <tr key={row.issue} className="border-b border-gray-50">
                    <td className="px-4 py-2.5 text-sm text-gray-700">{formatIssue(row.issue)}</td>
                    <td className="px-4 py-2.5 text-sm font-medium text-gray-900 text-right">{row.subscription_count?.toLocaleString()}건</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 기간별 주문 통계 */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
            기간별 주문 통계
          </h2>
          <div className="flex rounded-md overflow-hidden border border-gray-300">
            <button
              className={`px-3 py-1 text-xs font-medium transition-colors ${
                periodType === "monthly" ? "bg-blue-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"
              }`}
              onClick={() => setPeriodType("monthly")}
            >
              월별
            </button>
            <button
              className={`px-3 py-1 text-xs font-medium border-l border-gray-300 transition-colors ${
                periodType === "daily" ? "bg-blue-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"
              }`}
              onClick={() => setPeriodType("daily")}
            >
              일별
            </button>
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          {periodData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={periodData} margin={{ top: 0, right: 8, left: -20, bottom: 0 }}>
                <XAxis
                  dataKey="period"
                  tickFormatter={(v: string) => periodType === "monthly" ? v.slice(0, 7) : v.slice(5)}
                  tick={{ fontSize: 11, fill: "#9ca3af" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  yAxisId="orders"
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: "#9ca3af" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  yAxisId="revenue"
                  orientation="right"
                  tickFormatter={(v: number) => v >= 1000000 ? `${(v / 1000000).toFixed(0)}M` : `${(v / 1000).toFixed(0)}K`}
                  tick={{ fontSize: 11, fill: "#9ca3af" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  formatter={(value: number, name: string) =>
                    name === "주문" ? [`${value}건`, name] : [formatAmount(value), name]
                  }
                  contentStyle={{ fontSize: 12, borderRadius: 6, border: "1px solid #e5e7eb" }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar yAxisId="orders" dataKey="total_orders" name="주문" fill="#2563eb" radius={[3, 3, 0, 0]} maxBarSize={32} />
                <Bar yAxisId="revenue" dataKey="revenue" name="매출" fill="#10b981" radius={[3, 3, 0, 0]} maxBarSize={32} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[200px] text-sm text-gray-400">
              데이터가 없습니다.
            </div>
          )}
        </div>
      </div>

      {/* 유입 채널 현황 */}
      {channelData && (
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            고객 유입 채널
          </h2>
          <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100">
            {channelData.by_channel.map((ch) => (
              <div key={ch.create_channel} className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-2">
                  <StatusBadge type="channel" value={ch.create_channel} />
                </div>
                <div className="text-sm text-gray-700">
                  <span className="font-medium">{ch.total_customers.toLocaleString()}</span>
                  <span className="text-gray-400 ml-1">명</span>
                  <span className="ml-2 text-xs text-gray-400">
                    (주문 {ch.customers_with_orders.toLocaleString()}명)
                  </span>
                </div>
              </div>
            ))}
            <div className="flex items-center justify-between px-4 py-3 bg-gray-50">
              <span className="text-sm font-medium text-gray-700">합계</span>
              <span className="text-sm font-semibold text-gray-900">
                {channelData.total.total.toLocaleString()}명
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 최근 주문 */}
      <div>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
          최근 주문
        </h2>
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          {recentOrders.length === 0 ? (
            <div className="text-sm text-gray-400 text-center py-8">주문이 없습니다.</div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase">
                    주문번호
                  </th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase">
                    고객
                  </th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase">
                    채널
                  </th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase">
                    금액
                  </th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase">
                    상태
                  </th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase">
                    일시
                  </th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((order) => (
                  <tr key={order.order_id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-2.5 text-xs font-mono text-gray-400">
                      #{order.order_id}
                    </td>
                    <td className="px-4 py-2.5 text-sm text-gray-700">
                      {order.customer_name ?? "-"}
                    </td>
                    <td className="px-4 py-2.5">
                      <StatusBadge type="channel" value={order.order_channel} />
                    </td>
                    <td className="px-4 py-2.5 text-sm font-medium text-gray-900">
                      {formatAmount(order.payment_amount)}
                    </td>
                    <td className="px-4 py-2.5">
                      <StatusBadge type="order_status" value={order.order_status} />
                    </td>
                    <td className="px-4 py-2.5 text-xs text-gray-400">
                      {formatDate(order.order_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
    </div>
  );
}

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: "blue" | "green" | "red" | "purple";
}

const COLOR_MAP = {
  blue: "bg-blue-50 text-blue-600",
  green: "bg-green-50 text-green-600",
  red: "bg-red-50 text-red-500",
  purple: "bg-purple-50 text-purple-600",
};

function StatCard({ icon, label, value, color }: StatCardProps) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <div className={`inline-flex p-2 rounded-lg ${COLOR_MAP[color]} mb-2`}>{icon}</div>
      <div className="text-xs text-gray-500 mb-0.5">{label}</div>
      <div className="text-lg font-semibold text-gray-900">{value}</div>
    </div>
  );
}
