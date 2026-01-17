import React, { useState } from "react";
import {
  TrendingUp,
  DollarSign,
  ShoppingCart,
  Users,
  Package,
  Truck,
  Calendar,
  Download,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
  BarChart3,
  LineChart,
} from "lucide-react";
import Card from "../components/common/Card";
import Button from "../components/common/Button";
import Badge from "../components/common/Badge";
import Tabs from "../components/common/Tabs";
import Breadcrumb from "../components/common/Breadcrumb";
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  Legend,
  AreaChart,
  Area,
} from "recharts";

interface StatisticsPageProps {
  initialTab?: string;
}

// 목업 데이터
const monthlySalesData = [
  { month: "7월", sales: 8500000, orders: 68, subscriptions: 45 },
  { month: "8월", sales: 9200000, orders: 75, subscriptions: 52 },
  { month: "9월", sales: 8800000, orders: 71, subscriptions: 48 },
  { month: "10월", sales: 10500000, orders: 85, subscriptions: 60 },
  { month: "11월", sales: 12300000, orders: 98, subscriptions: 72 },
  { month: "12월", sales: 15800000, orders: 125, subscriptions: 95 },
];

const productSalesData = [
  { name: "말씀함께 12개월", value: 8500000, count: 65 },
  { name: "말씀함께 6개월", value: 3200000, count: 45 },
  { name: "꿀땅 12개월", value: 2800000, count: 35 },
  { name: "꿀땅 6개월", value: 1500000, count: 28 },
  { name: "단품(말씀함께)", value: 1200000, count: 85 },
  { name: "단품(꿀땅)", value: 600000, count: 42 },
];

const channelData = [
  { name: "Cafe24", value: 45, color: "#748DA6" },
  { name: "갓피플몰", value: 30, color: "#93B5C6" },
  { name: "오프라인", value: 15, color: "#D3CEDF" },
  { name: "기타", value: 10, color: "#F2D7D9" },
];

const subscriptionStatusData = [
  { name: "활성", value: 520, color: "#22C55E" },
  { name: "휴지중", value: 45, color: "#F59E0B" },
  { name: "종료", value: 180, color: "#6B7280" },
];

const shippingData = [
  { month: "7월", completed: 285, delayed: 12 },
  { month: "8월", completed: 312, delayed: 8 },
  { month: "9월", completed: 298, delayed: 15 },
  { month: "10월", completed: 345, delayed: 10 },
  { month: "11월", completed: 402, delayed: 18 },
  { month: "12월", completed: 489, delayed: 22 },
];

const dailyOrderData = [
  { date: "12/04", orders: 8, revenue: 960000 },
  { date: "12/05", orders: 12, revenue: 1440000 },
  { date: "12/06", orders: 15, revenue: 1800000 },
  { date: "12/07", orders: 10, revenue: 1200000 },
  { date: "12/08", orders: 18, revenue: 2160000 },
  { date: "12/09", orders: 22, revenue: 2640000 },
  { date: "12/10", orders: 28, revenue: 3360000 },
];

// Colors are defined inline in channelData and subscriptionStatusData

const StatisticsPage: React.FC<StatisticsPageProps> = ({ initialTab = "sales" }) => {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [dateRange, setDateRange] = useState({ start: "2024-07-01", end: "2024-12-31" });

  const tabs = [
    { key: "sales", label: "매출/주문", icon: <DollarSign className="w-4 h-4" /> },
    { key: "product", label: "상품별", icon: <Package className="w-4 h-4" /> },
    { key: "subscription", label: "구독 현황", icon: <Users className="w-4 h-4" /> },
    { key: "shipping", label: "발송 현황", icon: <Truck className="w-4 h-4" /> },
  ];

  const formatCurrency = (value: number) => {
    if (value >= 100000000) return `${(value / 100000000).toFixed(1)}억`;
    if (value >= 10000) return `${(value / 10000).toFixed(0)}만`;
    return value.toLocaleString();
  };

  return (
    <div className="min-h-screen">
      <div className="max-w-[1600px] mx-auto px-6 py-6">
        <Breadcrumb
          items={[
            { label: "통계", path: "/statistics/sales" },
            { label: "매출/주문 통계" },
          ]}
        />
        {/* 헤더 */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 bg-white border border-line rounded-lg px-3 py-2">
                <Calendar className="w-4 h-4 text-muted" />
                <input
                  type="date"
                  value={dateRange.start}
                  onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                  className="text-sm border-none focus:outline-none"
                />
                <span className="text-muted">~</span>
                <input
                  type="date"
                  value={dateRange.end}
                  onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                  className="text-sm border-none focus:outline-none"
                />
              </div>
              <Button variant="outline" size="sm" icon={Download}>
                리포트 다운로드
              </Button>
              <Button variant="outline" size="sm" icon={RefreshCw}>
                새로고침
              </Button>
            </div>
          </div>
        </div>

        {/* 탭 */}
        <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} className="mb-6" />

        {/* 매출/주문 탭 */}
        {activeTab === "sales" && (
          <div className="space-y-6">
            {/* 요약 카드 */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card className="unified-card p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-muted mb-1">총 매출</p>
                    <p className="text-2xl font-bold text-ink">6,510만</p>
                    <div className="flex items-center gap-1 mt-2">
                      <ArrowUpRight className="w-4 h-4 text-success-500" />
                      <span className="text-sm font-medium text-success-600">28.5%</span>
                      <span className="text-xs text-muted">전월 대비</span>
                    </div>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-success-100 flex items-center justify-center">
                    <DollarSign className="w-5 h-5 text-success-600" />
                  </div>
                </div>
              </Card>

              <Card className="unified-card p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-muted mb-1">총 주문</p>
                    <p className="text-2xl font-bold text-ink">522건</p>
                    <div className="flex items-center gap-1 mt-2">
                      <ArrowUpRight className="w-4 h-4 text-success-500" />
                      <span className="text-sm font-medium text-success-600">15.2%</span>
                      <span className="text-xs text-muted">전월 대비</span>
                    </div>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-info-100 flex items-center justify-center">
                    <ShoppingCart className="w-5 h-5 text-info-600" />
                  </div>
                </div>
              </Card>

              <Card className="unified-card p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-muted mb-1">평균 주문액</p>
                    <p className="text-2xl font-bold text-ink">12.5만</p>
                    <div className="flex items-center gap-1 mt-2">
                      <ArrowUpRight className="w-4 h-4 text-success-500" />
                      <span className="text-sm font-medium text-success-600">5.8%</span>
                      <span className="text-xs text-muted">전월 대비</span>
                    </div>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-info-50 flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-accent" />
                  </div>
                </div>
              </Card>

              <Card className="unified-card p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-muted mb-1">신규 구독</p>
                    <p className="text-2xl font-bold text-ink">372건</p>
                    <div className="flex items-center gap-1 mt-2">
                      <ArrowUpRight className="w-4 h-4 text-success-500" />
                      <span className="text-sm font-medium text-success-600">32.1%</span>
                      <span className="text-xs text-muted">전월 대비</span>
                    </div>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-warning-100 flex items-center justify-center">
                    <Users className="w-5 h-5 text-warning-600" />
                  </div>
                </div>
              </Card>
            </div>

            {/* 차트 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="unified-card p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="font-semibold text-ink">월별 매출 추이</h3>
                    <p className="text-sm text-muted">최근 6개월</p>
                  </div>
                  <Badge variant="info" size="sm">
                    <LineChart className="w-3 h-3 mr-1" />
                    라인 차트
                  </Badge>
                </div>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={monthlySalesData}>
                    <defs>
                      <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#748DA6" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#748DA6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E4D8DC" />
                    <XAxis dataKey="month" stroke="#6B7280" fontSize={12} />
                    <YAxis stroke="#6B7280" fontSize={12} tickFormatter={(value) => `${value / 10000}만`} />
                    <Tooltip
                      formatter={(value: number) => [`₩${value.toLocaleString()}`, "매출"]}
                      contentStyle={{ borderRadius: "8px", border: "1px solid #E4D8DC" }}
                    />
                    <Area type="monotone" dataKey="sales" stroke="#748DA6" strokeWidth={2} fill="url(#colorSales)" />
                  </AreaChart>
                </ResponsiveContainer>
              </Card>

              <Card className="unified-card p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="font-semibold text-ink">일별 주문 현황</h3>
                    <p className="text-sm text-muted">최근 7일</p>
                  </div>
                  <Badge variant="info" size="sm">
                    <BarChart3 className="w-3 h-3 mr-1" />
                    바 차트
                  </Badge>
                </div>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={dailyOrderData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E4D8DC" />
                    <XAxis dataKey="date" stroke="#6B7280" fontSize={12} />
                    <YAxis stroke="#6B7280" fontSize={12} />
                    <Tooltip
                      formatter={(value: number, name: string) => [
                        name === "orders" ? `${value}건` : `₩${value.toLocaleString()}`,
                        name === "orders" ? "주문" : "매출"
                      ]}
                      contentStyle={{ borderRadius: "8px", border: "1px solid #E4D8DC" }}
                    />
                    <Bar dataKey="orders" fill="#748DA6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            </div>

            {/* 채널별 분포 */}
            <Card className="unified-card p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="font-semibold text-ink">유입 채널별 분포</h3>
                  <p className="text-sm text-muted">주문 기준</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <ResponsiveContainer width="100%" height={250}>
                  <RechartsPieChart>
                    <Pie
                      data={channelData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {channelData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => [`${value}%`, "비율"]} />
                    <Legend />
                  </RechartsPieChart>
                </ResponsiveContainer>
                <div className="flex flex-col justify-center space-y-4">
                  {channelData.map((channel) => (
                    <div key={channel.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-4 h-4 rounded" style={{ backgroundColor: channel.color }} />
                        <span className="text-ink">{channel.name}</span>
                      </div>
                      <div className="text-right">
                        <span className="font-semibold text-ink">{channel.value}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* 상품별 탭 */}
        {activeTab === "product" && (
          <div className="space-y-6">
            <Card className="unified-card p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="font-semibold text-ink">상품별 매출</h3>
                  <p className="text-sm text-muted">기간 내 상품별 매출 현황</p>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={productSalesData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#E4D8DC" />
                  <XAxis type="number" stroke="#6B7280" fontSize={12} tickFormatter={(value) => `${value / 10000}만`} />
                  <YAxis type="category" dataKey="name" stroke="#6B7280" fontSize={12} width={120} />
                  <Tooltip
                    formatter={(value: number) => [`₩${value.toLocaleString()}`, "매출"]}
                    contentStyle={{ borderRadius: "8px", border: "1px solid #E4D8DC" }}
                  />
                  <Bar dataKey="value" fill="#748DA6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {productSalesData.map((product, index) => (
                <Card key={product.name} className="unified-card p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium text-ink">{product.name}</p>
                      <p className="text-2xl font-bold text-ink mt-2">
                        {formatCurrency(product.value)}원
                      </p>
                      <p className="text-sm text-muted mt-1">{product.count}건</p>
                    </div>
                    <Badge variant={index < 2 ? "success" : "default"} size="sm">
                      #{index + 1}
                    </Badge>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* 구독 현황 탭 */}
        {activeTab === "subscription" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="unified-card p-5 border border-line">
                <div>
                  <p className="text-sm text-muted mb-2">활성 구독</p>
                  <p className="text-xl font-semibold text-ink mb-1">520</p>
                  <p className="text-xs text-muted">총 구독자</p>
                </div>
              </Card>
              <Card className="unified-card p-5 border border-line">
                <div>
                  <p className="text-sm text-muted mb-2">휴지 중</p>
                  <p className="text-xl font-semibold text-ink mb-1">45</p>
                  <p className="text-xs text-muted">일시 중단</p>
                </div>
              </Card>
              <Card className="unified-card p-5 border border-line">
                <div>
                  <p className="text-sm text-muted mb-2">이번달 종료 예정</p>
                  <p className="text-xl font-semibold text-ink mb-1">28</p>
                  <p className="text-xs text-muted">갱신 필요</p>
                </div>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="unified-card p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="font-semibold text-ink">구독 상태 분포</h3>
                    <p className="text-sm text-muted">전체 구독자 기준</p>
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={300}>
                  <RechartsPieChart>
                    <Pie
                      data={subscriptionStatusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={70}
                      outerRadius={110}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {subscriptionStatusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => [`${value}명`, "구독자"]} />
                    <Legend />
                  </RechartsPieChart>
                </ResponsiveContainer>
              </Card>

              <Card className="unified-card p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="font-semibold text-ink">월별 신규 구독</h3>
                    <p className="text-sm text-muted">최근 6개월</p>
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={monthlySalesData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E4D8DC" />
                    <XAxis dataKey="month" stroke="#6B7280" fontSize={12} />
                    <YAxis stroke="#6B7280" fontSize={12} />
                    <Tooltip
                      formatter={(value: number) => [`${value}건`, "신규 구독"]}
                      contentStyle={{ borderRadius: "8px", border: "1px solid #E4D8DC" }}
                    />
                    <Bar dataKey="subscriptions" fill="#93B5C6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            </div>
          </div>
        )}

        {/* 발송 현황 탭 */}
        {activeTab === "shipping" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card className="unified-card p-5 border border-line">
                <div>
                  <p className="text-sm text-muted mb-2">총 발송</p>
                  <p className="text-xl font-semibold text-ink mb-1">2,131</p>
                  <p className="text-xs text-muted">기간 내 총 발송</p>
                </div>
              </Card>
              <Card className="unified-card p-5 border border-line">
                <div>
                  <p className="text-sm text-muted mb-2">발송 대기</p>
                  <p className="text-xl font-semibold text-ink mb-1">45</p>
                  <p className="text-xs text-muted">현재 대기 중</p>
                </div>
              </Card>
              <Card className="unified-card p-5 border border-line">
                <div>
                  <p className="text-sm text-muted mb-2">지연 건수</p>
                  <p className="text-xl font-semibold text-ink mb-1">85</p>
                  <p className="text-xs text-muted">기간 내 지연</p>
                </div>
              </Card>
              <Card className="unified-card p-5 border border-line">
                <div>
                  <p className="text-sm text-muted mb-2">지연율</p>
                  <p className="text-xl font-semibold text-ink mb-1">3.9%</p>
                  <div className="flex items-center gap-1 mt-1">
                    <ArrowDownRight className="w-4 h-4 text-success-500" />
                    <span className="text-sm text-success-600">-0.5%</span>
                  </div>
                </div>
              </Card>
            </div>

            <Card className="unified-card p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="font-semibold text-ink">월별 발송 현황</h3>
                  <p className="text-sm text-muted">완료 vs 지연</p>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={shippingData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E4D8DC" />
                  <XAxis dataKey="month" stroke="#6B7280" fontSize={12} />
                  <YAxis stroke="#6B7280" fontSize={12} />
                  <Tooltip
                    contentStyle={{ borderRadius: "8px", border: "1px solid #E4D8DC" }}
                  />
                  <Legend />
                  <Bar dataKey="completed" fill="#22C55E" name="발송 완료" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="delayed" fill="#EF4444" name="지연" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};

export default StatisticsPage;
