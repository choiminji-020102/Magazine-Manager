import React, { useState } from "react";
import {
  Users,
  AlertCircle,
  Package,
  Pin,
  Plus,
  X,
  Clock,
  CheckCircle,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  Truck,
  ArrowDown,
  TrendingUp,
  DollarSign,
  ShoppingCart,
} from "lucide-react";
import Card from "../components/common/Card";
import Badge from "../components/common/Badge";
import Button from "../components/common/Button";
import Breadcrumb from "../components/common/Breadcrumb";
import { useAuth } from "../contexts/AuthContext";
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  AreaChart,
  Area,
} from "recharts";

// 목업 데이터
const mockInquiries = [
  {
    id: 1,
    channel: "채널톡",
    customer: "김민수",
    title: "배송 언제 되나요?",
    createdAt: "10분 전",
    isUrgent: true,
    status: "미처리",
  },
  {
    id: 2,
    channel: "Cafe24",
    customer: "이영희",
    title: "구독 휴지 요청드립니다",
    createdAt: "30분 전",
    isUrgent: false,
    status: "처리중",
  },
  {
    id: 3,
    channel: "갓피플몰",
    customer: "박철수",
    title: "주소 변경 요청",
    createdAt: "1시간 전",
    isUrgent: false,
    status: "미처리",
  },
];

const mockMemos = [
  {
    id: 1,
    content: "12월 31일까지 연말 프로모션 진행 - 전 상품 10% 할인",
    author: "관리자",
    createdAt: "2024-12-10 09:00",
    isPinned: true,
  },
  {
    id: 2,
    content: "1월호 발송 일정: 12월 28일부터 순차 발송 예정",
    author: "김매니저",
    createdAt: "2024-12-09 14:30",
    isPinned: false,
  },
];

const mockAlerts = [
  {
    id: 1,
    type: "warning",
    title: "재고 부족",
    message: "말씀함께 1월호 - 현재 재고 45개",
    time: "1시간 전",
  },
  {
    id: 2,
    type: "danger",
    title: "발송 지연",
    message: "3일 이상 미발송 주문 5건",
    time: "30분 전",
  },
  {
    id: 3,
    type: "info",
    title: "신규 주문",
    message: "오늘 신규 주문 12건 접수",
    time: "방금",
  },
];

const todayStats = {
  orders: { value: 28, change: 12, isUp: true },
  revenue: { value: 1250000, change: 8.5, isUp: true },
  shipping: { value: 45, change: -3, isUp: false },
  inquiries: { value: 8, change: 2, isUp: true },
};

// 통계 그래프용 데이터
const monthlySalesData = [
  { month: "7월", sales: 8500000, orders: 68 },
  { month: "8월", sales: 9200000, orders: 75 },
  { month: "9월", sales: 8800000, orders: 71 },
  { month: "10월", sales: 10500000, orders: 85 },
  { month: "11월", sales: 12300000, orders: 98 },
  { month: "12월", sales: 15800000, orders: 125 },
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

const recentOrders = [
  {
    id: "ORD-2024-12015",
    customer: "홍길동",
    product: "말씀함께 12개월",
    amount: 144000,
    status: "결제완료",
    time: "5분 전",
  },
  {
    id: "ORD-2024-12014",
    customer: "김영수",
    product: "꿀땅 6개월",
    amount: 72000,
    status: "발송준비",
    time: "15분 전",
  },
  {
    id: "ORD-2024-12013",
    customer: "이민정",
    product: "말씀함께 1월호",
    amount: 12000,
    status: "배송중",
    time: "30분 전",
  },
];

const DashboardPage: React.FC = () => {
  const { currentAdmin } = useAuth();
  const [memos, setMemos] = useState(mockMemos);
  const [newMemo, setNewMemo] = useState("");
  const [isAddingMemo, setIsAddingMemo] = useState(false);
  
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "좋은 아침입니다";
    if (hour < 18) return "좋은 오후입니다";
    return "좋은 저녁입니다";
  };

  const handleAddMemo = () => {
    if (!newMemo.trim()) return;
    const memo = {
      id: Date.now(),
      content: newMemo,
      author: "나",
      createdAt: new Date().toLocaleString("ko-KR"),
      isPinned: false,
    };
    setMemos([memo, ...memos]);
    setNewMemo("");
    setIsAddingMemo(false);
  };

  const handleDeleteMemo = (id: number) => {
    setMemos(memos.filter((m) => m.id !== id));
  };

  const handleTogglePin = (id: number) => {
    setMemos(
      memos.map((m) => (m.id === id ? { ...m, isPinned: !m.isPinned } : m))
    );
  };

  const sortedMemos = [...memos].sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    return 0;
  });

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "success" | "info" | "warning" | "default"> = {
      "결제완료": "success",
      "발송준비": "info",
      "배송중": "warning",
    };
    return <Badge variant={variants[status] || "default"}>{status}</Badge>;
  };

  return (
    <div className="min-h-screen">
      <div className="max-w-[1600px] mx-auto px-6 py-6">
        <Breadcrumb items={[{ label: "대시보드" }]} />
        {/* 헤더 */}
        <div className="anim-rise" style={{ animationDelay: "0ms" }}>
          <div className="mb-6">
            <h1 className="text-2xl font-semibold text-ink mb-1">
              {getGreeting()}, {currentAdmin?.admin_name || "관리자"}님
            </h1>
            <p className="text-sm text-muted">
              {new Date().toLocaleDateString("ko-KR", {
                year: "numeric",
                month: "long",
                day: "numeric",
                weekday: "long",
              })}
            </p>
          </div>
        </div>

        {/* 핵심 통계 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 anim-rise" style={{ animationDelay: "50ms" }}>
          <Card className="unified-card p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm text-muted mb-1">이번 달 매출</p>
                <p className="text-3xl font-bold text-ink">6,510만원</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-success-100 flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-success-600" />
              </div>
            </div>
            <div className="flex items-center gap-1">
              <ArrowUpRight className="w-4 h-4 text-success-500" />
              <span className="text-sm font-medium text-success-600">28.5%</span>
              <span className="text-xs text-muted">전월 대비</span>
            </div>
          </Card>

          <Card className="unified-card p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm text-muted mb-1">이번 달 주문</p>
                <p className="text-3xl font-bold text-ink">522건</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-info-100 flex items-center justify-center">
                <ShoppingCart className="w-6 h-6 text-info-600" />
              </div>
            </div>
            <div className="flex items-center gap-1">
              <ArrowUpRight className="w-4 h-4 text-success-500" />
              <span className="text-sm font-medium text-success-600">15.2%</span>
              <span className="text-xs text-muted">전월 대비</span>
            </div>
          </Card>

          <Card className="unified-card p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm text-muted mb-1">활성 구독</p>
                <p className="text-3xl font-bold text-ink">520건</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-warning-100 flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-warning-600" />
              </div>
            </div>
            <div className="flex items-center gap-1">
              <ArrowUpRight className="w-4 h-4 text-success-500" />
              <span className="text-sm font-medium text-success-600">32.1%</span>
              <span className="text-xs text-muted">전월 대비</span>
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 통계 그래프 */}
          <div className="lg:col-span-2 anim-rise" style={{ animationDelay: "100ms" }}>
            <Card className="unified-card p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-semibold text-ink mb-1">월별 매출 추이</h2>
                  <p className="text-sm text-muted">최근 6개월</p>
                </div>
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
          </div>

          {/* 주문 처리 현황 */}
          <div className="anim-rise" style={{ animationDelay: "100ms" }}>
            <Card className="unified-card p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-semibold text-ink mb-1">주문 처리 현황</h2>
                  <p className="text-sm text-muted">실시간 주문 상태</p>
                </div>
                <Button variant="ghost" size="sm" icon={RefreshCw}>
                  새로고침
                </Button>
              </div>

              <div className="space-y-3">
                {[
                  { icon: Clock, label: "결제 대기", count: 12, change: "+3" },
                  { icon: Package, label: "발송 대기", count: 45, change: "-8" },
                  { icon: Truck, label: "배송 중", count: 128, change: "+15" },
                  { icon: CheckCircle, label: "배송 완료", count: 892, change: "+24" },
                ].map((item, index) => (
                  <div key={item.label}>
                    <div className="flex items-center gap-4 p-4 border border-line rounded-lg hover:bg-paper/50 transition-colors">
                      <div className="flex items-center gap-3 flex-1">
                        <item.icon className="w-5 h-5 text-muted" />
                        <span className="text-sm font-medium text-ink">{item.label}</span>
                      </div>
                      <p className="text-lg font-semibold text-ink">{item.count}</p>
                      <p className="text-xs text-muted">{item.change} (1시간)</p>
                    </div>
                    {index < 3 && (
                      <div className="flex justify-center py-1">
                        <ArrowDown className="w-4 h-4 text-muted" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          </div>
          {/* 최근 주문 */}
          <div className="lg:col-span-2 anim-rise" style={{ animationDelay: "150ms" }}>
            <Card className="unified-card">
              <div className="p-5 border-b border-line flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-ink">최근 주문</h2>
                  <p className="text-sm text-muted mt-0.5">실시간 주문 현황</p>
                </div>
                <Button variant="ghost" size="sm">
                  전체보기
                </Button>
              </div>
              <div className="divide-y divide-line">
                {recentOrders.map((order) => (
                  <div
                    key={order.id}
                    className="p-4 hover:bg-neutral-50 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div>
                          <p className="font-medium text-ink">{order.customer}</p>
                          <p className="text-sm text-muted">{order.product}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-ink">
                          {order.amount.toLocaleString()}원
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          {getStatusBadge(order.status)}
                          <span className="text-xs text-muted">{order.time}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* 알림 */}
          <div className="anim-rise" style={{ animationDelay: "200ms" }}>
            <Card className="unified-card">
              <div className="p-5 border-b border-line">
                <h2 className="text-lg font-semibold text-ink mb-1">알림</h2>
                <p className="text-sm text-muted">즉시 대응이 필요한 알림</p>
              </div>
              <div className="p-4 space-y-3">
                {mockAlerts.map((alert) => (
                  <div
                    key={alert.id}
                    className={`p-3 rounded-lg border ${
                      alert.type === "danger"
                        ? "bg-danger-50 border-danger-200"
                        : alert.type === "warning"
                        ? "bg-warning-50 border-warning-200"
                        : "bg-info-50 border-info-200"
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <AlertCircle
                        className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
                          alert.type === "danger"
                            ? "text-danger-500"
                            : alert.type === "warning"
                            ? "text-warning-500"
                            : "text-info-500"
                        }`}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-ink">{alert.title}</p>
                        <p className="text-xs text-muted mt-0.5">{alert.message}</p>
                        <p className="text-xs text-muted mt-1">{alert.time}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 고객 문의 */}
          <div className="lg:col-span-2 anim-rise" style={{ animationDelay: "250ms" }}>
            <Card className="unified-card">
              <div className="p-5 border-b border-line flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-ink mb-1">고객 문의</h2>
                  <p className="text-sm text-muted">최근 문의 및 처리 현황</p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="w-2 h-2 rounded-full bg-danger-500" />
                    <span className="text-muted">미처리 <strong className="text-ink">8</strong></span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="w-2 h-2 rounded-full bg-warning-500" />
                    <span className="text-muted">처리중 <strong className="text-ink">5</strong></span>
                  </div>
                </div>
              </div>
              <div className="divide-y divide-line">
                {mockInquiries.map((inquiry) => (
                  <div
                    key={inquiry.id}
                    className={`p-4 hover:bg-paper/50 transition-colors cursor-pointer ${
                      inquiry.status === "미처리" ? "bg-danger-50/30" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {inquiry.isUrgent && (
                          <AlertCircle className="w-4 h-4 text-danger-500 flex-shrink-0" />
                        )}
                        <Badge
                          variant={
                            inquiry.channel === "채널톡"
                              ? "info"
                              : inquiry.channel === "Cafe24"
                              ? "success"
                              : "default"
                          }
                          size="sm"
                        >
                          {inquiry.channel}
                        </Badge>
                        <span className="font-medium text-ink">{inquiry.customer}</span>
                        <span className="text-muted text-sm">{inquiry.title}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={inquiry.status === "미처리" ? "danger" : "warning"}
                          size="sm"
                        >
                          {inquiry.status}
                        </Badge>
                        <span className="text-xs text-muted">{inquiry.createdAt}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* 관리자 메모 */}
          <div className="anim-rise" style={{ animationDelay: "300ms" }}>
            <Card className="unified-card">
              <div className="p-5 border-b border-line flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Users className="w-5 h-5 text-accent" />
                    <h2 className="text-lg font-bold text-ink">공유 메모</h2>
                  </div>
                  <p className="text-sm text-muted">팀 공유 메모</p>
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  icon={Plus}
                  onClick={() => setIsAddingMemo(true)}
                >
                  추가
                </Button>
              </div>
              <div className="p-4 space-y-3">
                {isAddingMemo && (
                  <div className="p-3 bg-info-50 border border-info-200 rounded-lg">
                    <textarea
                      value={newMemo}
                      onChange={(e) => setNewMemo(e.target.value)}
                      placeholder="메모를 입력하세요..."
                      className="unified-textarea w-full"
                      rows={3}
                      autoFocus
                    />
                    <div className="flex justify-end gap-2 mt-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setIsAddingMemo(false);
                          setNewMemo("");
                        }}
                      >
                        취소
                      </Button>
                      <Button size="sm" onClick={handleAddMemo}>
                        저장
                      </Button>
                    </div>
                  </div>
                )}

                {sortedMemos.map((memo) => (
                  <div
                    key={memo.id}
                    className={`p-3 rounded-lg border ${
                      memo.isPinned
                        ? "bg-neutral-50 border-neutral-200"
                        : "bg-white border-line"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-ink">{memo.content}</p>
                        <div className="flex items-center gap-2 mt-2 text-xs text-muted">
                          <span>{memo.author}</span>
                          <span>•</span>
                          <span>{memo.createdAt}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleTogglePin(memo.id)}
                          className={`p-1.5 rounded transition-colors ${
                            memo.isPinned
                              ? "text-accent bg-neutral-100"
                              : "text-muted hover:bg-neutral-50"
                          }`}
                          title={memo.isPinned ? "고정 해제" : "고정"}
                        >
                          <Pin className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteMemo(memo.id)}
                          className="p-1.5 text-muted hover:text-danger-500 hover:bg-danger-50 rounded transition-colors"
                          title="삭제"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
