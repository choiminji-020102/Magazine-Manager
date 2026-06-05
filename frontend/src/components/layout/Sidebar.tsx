import { useState, useEffect } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  LayoutDashboard,
  ShoppingCart,
  Users,
  Box,
  BookOpen,
  MessageSquare,
  Shield,
  Activity,
  Settings,
  Store,
  Truck,
  Star,
  ChevronLeft,
  ChevronRight,
  Link,
} from "lucide-react";
import { cn } from "@/utils/cn";
import { useAuth } from "@/contexts/AuthContext";
import { cafe24API } from "@/api/cafe24Api";
import { toast } from "@/hooks/use-toast";

interface NavItem {
  label: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  requireSuperAdmin?: boolean;
  // 활성화될 경로 목록(완전 일치). 미지정 시 [path]로 동작(=path와 정확히 일치할 때만 활성).
  activeOn?: string[];
}

interface NavGroup {
  group?: string;
  items: NavItem[];
}

const navigation: NavGroup[] = [
  {
    items: [
      { label: "대시보드", path: "/", icon: LayoutDashboard },
    ],
  },
  {
    group: "가져오기",
    items: [
      { label: "Cafe24 상품", path: "/cafe24/products", icon: Store },
      { label: "Cafe24 주문", path: "/cafe24/orders", icon: ShoppingCart },
    ],
  },
  {
    group: "주문·발송",
    items: [
      { label: "전체 주문 조회", path: "/orders", icon: ShoppingCart, activeOn: ["/orders", "/orders/new"] },
      { label: "배송 준비중", path: "/sends/preparing", icon: Truck },
      { label: "배송 완료", path: "/sends/delivered", icon: Truck },
    ],
  },
  {
    group: "마스터",
    items: [
      { label: "고객 목록", path: "/customers", icon: Users },
      { label: "상품 목록", path: "/products", icon: Box },
      { label: "구독 목록", path: "/subscriptions", icon: BookOpen },
      { label: "VIP 그룹", path: "/vip-slots", icon: Star },
    ],
  },
  {
    group: "응대",
    items: [
      { label: "문의 목록", path: "/inquiries", icon: MessageSquare },
    ],
  },
  {
    group: "시스템",
    items: [
      {
        label: "관리자 목록",
        path: "/admins",
        icon: Shield,
        requireSuperAdmin: true,
      },
      { label: "활동 로그", path: "/activity-logs", icon: Activity },
      { label: "설정", path: "/settings", icon: Settings },
    ],
  },
];

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(() => {
    return localStorage.getItem("sidebar_collapsed") === "true";
  });
  const { currentAdmin } = useAuth();
  const location = useLocation();

  useEffect(() => {
    localStorage.setItem("sidebar_collapsed", String(collapsed));
  }, [collapsed]);

  const isSuperAdmin = currentAdmin?.admin_role === "SUPER_ADMIN";

  const { data: cafe24Status } = useQuery({
    queryKey: ["cafe24-status"],
    queryFn: () => cafe24API.getStatus(),
    retry: false,
    staleTime: 1000 * 60 * 5, // 5분간 캐시 유지
  });

  const [connecting, setConnecting] = useState(false);
  const handleConnect = async () => {
    setConnecting(true);
    try {
      const res = await cafe24API.startOAuth();
      window.location.href = res.authorize_url;
    } catch {
      setConnecting(false);
      toast.error("Cafe24 연결 실패");
    }
  };

  // Cafe24 토큰 상태 판단 (3단계)
  // - access_token 만료는 백엔드가 자동 재발급 처리하므로 UI에 노출하지 않음
  // - refresh_token 만료 시에만 사용자 개입(재연결) 필요
  const cafe24TokenStatus = (() => {
    if (!cafe24Status) return null;
    const authorized = cafe24Status.authorized ?? false;
    if (!authorized) return "not_connected";
    const refreshExpired = cafe24Status.refresh_token_expires_at
      ? new Date(cafe24Status.refresh_token_expires_at) < new Date()
      : false;
    return refreshExpired ? "reconnect_required" : "active";
  })();

  return (
    <aside
      className={cn(
        "flex flex-col h-screen bg-slate-50 border-r border-gray-200 transition-all duration-200 flex-shrink-0",
        collapsed ? "w-[52px]" : "w-[220px]"
      )}
    >
      {/* 로고 */}
      <div className={cn("flex items-center h-14 border-b border-gray-200 px-3", !collapsed && "px-4")}>
        <a href="/" className="truncate">
          {!collapsed ? (
            <span className="text-sm font-semibold text-gray-800">목자의 지혜</span>
          ) : (
            <span className="text-sm">📖</span>
          )}
        </a>
      </div>

      {/* 네비게이션 */}
      <nav className="flex-1 overflow-y-auto py-2">
        {navigation.map((group, gi) => {
          const visibleItems = group.items.filter(
            (item) => !item.requireSuperAdmin || isSuperAdmin
          );
          if (visibleItems.length === 0) return null;

          return (
            <div key={gi} className="mb-1">
              {group.group && !collapsed && (
                <div className="px-3 py-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                  {group.group}
                </div>
              )}
              {group.group && collapsed && gi > 0 && (
                <div className="my-1 mx-2 h-px bg-gray-200" />
              )}
              {visibleItems.map((item) => {
                const Icon = item.icon;
                const matchPaths = item.activeOn ?? [item.path];
                const isActive = matchPaths.includes(location.pathname);

                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    className={cn(
                      "flex items-center gap-2.5 px-3 py-2 mx-1.5 rounded-md text-sm transition-colors",
                      collapsed && "justify-center px-0 mx-1",
                      isActive
                        ? "bg-blue-50 text-blue-700 font-medium"
                        : "text-gray-600 hover:bg-gray-100 hover:text-gray-800"
                    )}
                    title={collapsed ? item.label : undefined}
                  >
                    <Icon className={cn("flex-shrink-0", collapsed ? "h-4.5 w-4.5" : "h-4 w-4")} />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                  </NavLink>
                );
              })}
            </div>
          );
        })}
      </nav>

      {/* Cafe24 연결 상태 */}
      {cafe24TokenStatus && (
        <div className="border-t border-gray-200 px-2 py-2">
          {collapsed ? (
            <div className="flex justify-center" title={
              cafe24TokenStatus === "active" ? "Cafe24 연결됨"
                : cafe24TokenStatus === "reconnect_required" ? "Cafe24 재연결 필요"
                : "Cafe24 미연동"
            }>
              <span className={cn(
                "inline-block w-2 h-2 rounded-full",
                cafe24TokenStatus === "active" && "bg-green-500",
                cafe24TokenStatus === "reconnect_required" && "bg-red-500",
                cafe24TokenStatus === "not_connected" && "bg-gray-300",
              )} />
            </div>
          ) : (
            <div className="px-1">
              <div className="flex items-center gap-1.5">
                <span className={cn(
                  "inline-block w-1.5 h-1.5 rounded-full flex-shrink-0",
                  cafe24TokenStatus === "active" && "bg-green-500",
                  cafe24TokenStatus === "reconnect_required" && "bg-red-500",
                  cafe24TokenStatus === "not_connected" && "bg-gray-300",
                )} />
                <span className="text-[11px] text-gray-500">
                  {cafe24TokenStatus === "active" && "Cafe24 연결됨"}
                  {cafe24TokenStatus === "reconnect_required" && "Cafe24 재연결 필요"}
                  {cafe24TokenStatus === "not_connected" && "Cafe24 미연동"}
                </span>
                {(cafe24TokenStatus === "reconnect_required" || cafe24TokenStatus === "not_connected") && (
                  <button
                    onClick={handleConnect}
                    disabled={connecting}
                    className={cn(
                      "ml-auto disabled:opacity-50",
                      cafe24TokenStatus === "reconnect_required"
                        ? "text-red-500 hover:text-red-600"
                        : "text-gray-400 hover:text-gray-500"
                    )}
                    title="Cafe24 연결"
                  >
                    <Link className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 접기/펼치기 버튼 */}
      <div className="border-t border-gray-200 py-2 px-2">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={cn(
            "flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-xs text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors",
            collapsed && "justify-center"
          )}
        >
          {collapsed ? (
            <ChevronRight className="h-3.5 w-3.5" />
          ) : (
            <>
              <ChevronLeft className="h-3.5 w-3.5" />
              <span>접기</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
