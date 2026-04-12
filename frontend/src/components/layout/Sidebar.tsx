import { useState, useEffect } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  ShoppingCart,
  Truck,
  Users,
  Box,
  BookOpen,
  MessageSquare,
  Shield,
  Activity,
  Settings,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/utils/cn";
import { useAuth } from "@/contexts/AuthContext";

interface NavItem {
  label: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  requireSuperAdmin?: boolean;
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
    group: "업무",
    items: [
      { label: "주문 목록", path: "/orders", icon: ShoppingCart },
      { label: "구독 목록", path: "/subscriptions", icon: BookOpen },
      { label: "발송 관리", path: "/shipping", icon: Truck },
    ],
  },
  {
    group: "데이터",
    items: [
      { label: "고객 목록", path: "/customers", icon: Users },
      { label: "상품 목록", path: "/products", icon: Box },
    ],
  },
  {
    group: "운영",
    items: [
      { label: "문의 관리", path: "/inquiries", icon: MessageSquare },
      {
        label: "관리자 관리",
        path: "/admins",
        icon: Shield,
        requireSuperAdmin: true,
      },
      { label: "활동 로그", path: "/activity-logs", icon: Activity },
    ],
  },
  {
    items: [
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
            <span className="text-sm font-semibold text-gray-800">M</span>
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
                const isActive =
                  item.path === "/"
                    ? location.pathname === "/"
                    : location.pathname.startsWith(item.path);

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
