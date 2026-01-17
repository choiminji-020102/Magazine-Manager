import React, { useState, useEffect } from "react";
import {
  Routes,
  Route,
  Navigate,
  useNavigate,
  useParams,
  useLocation,
} from "react-router-dom";

import { useAuth } from "./contexts/AuthContext";
import LoadingSpinner from "./components/common/LoadingSpinner";
import Header from "./components/layout/Header";
import Sidebar from "./components/layout/Sidebar";

// Pages
import LoginPage from "./pages/LoginPage";
import InitAdminPage from "./pages/InitAdminPage";
import AdminListPage from "./pages/AdminListPage";
import AdminDetailPage from "./pages/AdminDetailPage";
import DashboardPage from "./pages/DashboardPage";
import CustomerListPage from "./pages/CustomerListPage";
import CustomerRegisterPage from "./pages/CustomerRegisterPage";
import ProductListPage from "./pages/ProductListPage";
import ProductRegisterPage from "./pages/ProductRegisterPage";
import OrderListPage from "./pages/OrderListPage";
import OrderRegisterPage from "./pages/OrderRegisterPage";
import SubscriptionListPage from "./pages/SubscriptionListPage";
import SubscriptionDetailPage from "./pages/SubscriptionDetailPage";
import DuplicateSubscriptionPage from "./pages/DuplicateSubscriptionPage";
import PauseManagementPage from "./pages/PauseManagementPage";
import ShippingPage from "./pages/ShippingPage";
import SupportListPage from "./pages/SupportListPage";
import MessageTemplatePage from "./pages/MessageTemplatePage";
import SettingsPage from "./pages/SettingsPage";
import StatisticsPage from "./pages/StatisticsPage";

interface ExpandedMenus {
  [key: string]: boolean;
}

// 보호된 라우트 컴포넌트
interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

// 메인 레이아웃 컴포넌트
const MainLayout: React.FC = () => {
  const { currentAdmin, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [activeMenu, setActiveMenu] = useState("dashboard");
  const [activeSubMenu, setActiveSubMenu] = useState("");
  const [expandedMenus, setExpandedMenus] = useState<ExpandedMenus>({});

  // 경로 변경 시 메뉴 상태 업데이트
  useEffect(() => {
    const path = location.pathname;
    
    // 경로에 따라 메뉴와 서브메뉴 설정
    if (path.startsWith("/dashboard")) {
      setActiveMenu("dashboard");
      setActiveSubMenu("");
    } else if (path.startsWith("/customer")) {
      setActiveMenu("customer");
      if (path.includes("/register")) {
        setActiveSubMenu("register");
      } else {
        setActiveSubMenu("list");
      }
    } else if (path.startsWith("/product")) {
      setActiveMenu("product");
      if (path.includes("/register")) {
        setActiveSubMenu("register");
      } else {
        setActiveSubMenu("list");
      }
    } else if (path.startsWith("/order")) {
      setActiveMenu("order");
      if (path.includes("/register")) {
        setActiveSubMenu("register");
      } else {
        setActiveSubMenu("list");
      }
    } else if (path.startsWith("/subscription")) {
      setActiveMenu("subscription");
      if (path.includes("/pause")) {
        setActiveSubMenu("pause");
      } else if (path.includes("/duplicate")) {
        setActiveSubMenu("duplicate");
      } else {
        setActiveSubMenu("list");
      }
    } else if (path.startsWith("/shipping")) {
      setActiveMenu("shipping");
      if (path.includes("/today-courier")) {
        setActiveSubMenu("today-courier");
      } else if (path.includes("/courier-status")) {
        setActiveSubMenu("courier-status");
      } else {
        setActiveSubMenu("today-courier");
      }
    } else if (path.startsWith("/support")) {
      setActiveMenu("support");
      if (path.includes("/message-template")) {
        setActiveSubMenu("message-template");
      } else {
        setActiveSubMenu("list");
      }
    } else if (path.startsWith("/settings")) {
      setActiveMenu("settings");
      if (path.includes("/cafe24")) {
        setActiveSubMenu("cafe24");
      } else if (path.includes("/profile")) {
        setActiveSubMenu("profile");
      } else {
        setActiveSubMenu("admin");
      }
    } else if (path.startsWith("/statistics")) {
      setActiveMenu("statistics");
      if (path.includes("/product")) {
        setActiveSubMenu("product");
      } else if (path.includes("/subscription")) {
        setActiveSubMenu("subscription");
      } else if (path.includes("/shipping")) {
        setActiveSubMenu("shipping");
      } else {
        setActiveSubMenu("sales");
      }
    }
  }, [location.pathname]);

  const handleMenuClick = (menuKey: string, subMenuKey?: string) => {
    setActiveMenu(menuKey);
    setActiveSubMenu(subMenuKey || "");

    // 메뉴에 따른 라우팅
    const routes: Record<string, Record<string, string>> = {
      dashboard: { "": "/dashboard" },
      customer: {
        "": "/customer/list",
        list: "/customer/list",
        register: "/customer/register",
      },
      product: {
        "": "/product/list",
        list: "/product/list",
        register: "/product/register",
      },
      order: {
        "": "/order/list",
        list: "/order/list",
        register: "/order/register",
      },
      subscription: {
        "": "/subscription/list",
        list: "/subscription/list",
        pause: "/subscription/pause",
        duplicate: "/subscription/duplicate",
      },
      shipping: {
        "": "/shipping/today-courier",
        "today-courier": "/shipping/today-courier",
        "courier-status": "/shipping/courier-status",
      },
      support: {
        "": "/support/list",
        list: "/support/list",
        "message-template": "/support/message-template",
      },
      settings: {
        "": "/settings/admin",
        admin: "/settings/admin",
        cafe24: "/settings/cafe24",
        profile: "/settings/profile",
      },
      statistics: {
        "": "/statistics/sales",
        sales: "/statistics/sales",
        product: "/statistics/product",
        subscription: "/statistics/subscription",
        shipping: "/statistics/shipping",
      },
    };

    const menuRoutes = routes[menuKey];
    if (menuRoutes) {
      const route = subMenuKey ? menuRoutes[subMenuKey] : menuRoutes[""];
      if (route) {
        navigate(route);
      }
    }
  };

  const handleToggleMenu = (menuKey: string) => {
    setExpandedMenus((prev) => ({
      ...prev,
      [menuKey]: !prev[menuKey],
    }));
  };

  const handleNavigateToProfile = () => {
    if (currentAdmin) {
      navigate(`/admin/${currentAdmin.id}`);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar
        activeMenu={activeMenu}
        activeSubMenu={activeSubMenu}
        expandedMenus={expandedMenus}
        onMenuClick={handleMenuClick}
        onToggleMenu={handleToggleMenu}
        currentUser={currentAdmin}
        onNavigateToProfile={handleNavigateToProfile}
      />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header
          activeMenu={activeMenu}
          activeSubMenu={activeSubMenu}
          currentUser={currentAdmin}
          onLogout={handleLogout}
          onNavigateToProfile={handleNavigateToProfile}
          onNavigateToDashboard={() => {
            setActiveMenu("dashboard");
            setActiveSubMenu("");
            navigate("/dashboard");
          }}
        />
        <main className="flex-1 overflow-auto p-6">
          <Routes>
            {/* 대시보드 */}
            <Route path="/dashboard" element={<DashboardPage />} />

            {/* 고객 관리 */}
            <Route
              path="/customer"
              element={<Navigate to="/customer/list" replace />}
            />
            <Route path="/customer/list" element={<CustomerListPage />} />
            <Route
              path="/customer/register"
              element={
                <CustomerRegisterPage
                  onBack={() => navigate("/customer/list")}
                />
              }
            />

            {/* 상품 관리 */}
            <Route
              path="/product"
              element={<Navigate to="/product/list" replace />}
            />
            <Route
              path="/product/list"
              element={
                <ProductListPage
                  onNavigateToRegister={() => navigate("/product/register")}
                />
              }
            />
            <Route
              path="/product/register"
              element={
                <ProductRegisterPage onBack={() => navigate("/product/list")} />
              }
            />

            {/* 주문 관리 */}
            <Route
              path="/order"
              element={<Navigate to="/order/list" replace />}
            />
            <Route path="/order/list" element={<OrderListPage />} />
            <Route path="/order/register" element={<OrderRegisterPage />} />

            {/* 구독 관리 */}
            <Route
              path="/subscription"
              element={<Navigate to="/subscription/list" replace />}
            />
            <Route
              path="/subscription/list"
              element={<SubscriptionListPage />}
            />
            <Route
              path="/subscription/detail/:orderItemId"
              element={<SubscriptionDetailPage />}
            />
            <Route
              path="/subscription/pause"
              element={<PauseManagementPage />}
            />
            <Route
              path="/subscription/duplicate"
              element={<DuplicateSubscriptionPage />}
            />

            {/* 발송 관리 */}
            <Route
              path="/shipping"
              element={<Navigate to="/shipping/today-courier" replace />}
            />
            <Route
              path="/shipping/today-courier"
              element={<ShippingPage />}
            />
            <Route
              path="/shipping/courier-status"
              element={<ShippingPage />}
            />

            {/* 고객 지원 */}
            <Route
              path="/support"
              element={<Navigate to="/support/list" replace />}
            />
            <Route path="/support/list" element={<SupportListPage />} />
            <Route
              path="/support/message-template"
              element={<MessageTemplatePage />}
            />

            {/* 설정 */}
            <Route
              path="/settings"
              element={<Navigate to="/settings/admin" replace />}
            />
            <Route
              path="/settings/admin"
              element={<SettingsPage initialTab="admin" />}
            />
            <Route
              path="/settings/cafe24"
              element={<SettingsPage initialTab="cafe24" />}
            />
            <Route
              path="/settings/profile"
              element={<SettingsPage initialTab="profile" />}
            />

            {/* 통계 */}
            <Route
              path="/statistics"
              element={<Navigate to="/statistics/sales" replace />}
            />
            <Route
              path="/statistics/sales"
              element={<StatisticsPage initialTab="sales" />}
            />
            <Route
              path="/statistics/product"
              element={<StatisticsPage initialTab="product" />}
            />
            <Route
              path="/statistics/subscription"
              element={<StatisticsPage initialTab="subscription" />}
            />
            <Route
              path="/statistics/shipping"
              element={<StatisticsPage initialTab="shipping" />}
            />

            {/* 관리자 (기존) */}
            <Route
              path="/admin"
              element={
                <AdminListPage
                  onSelectAdmin={(id) => navigate(`/admin/${id}`)}
                  onNewAdmin={() => navigate("/admin/new")}
                />
              }
            />
            <Route
              path="/admin/new"
              element={
                <AdminDetailPage
                  adminId="new"
                  onBack={() => navigate("/admin")}
                  onSave={() => navigate("/admin")}
                />
              }
            />
            <Route path="/admin/:id" element={<AdminDetailPageWrapper />} />

            {/* 기본 리다이렉트 */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
};

// AdminDetailPage 래퍼 (URL 파라미터 처리)
const AdminDetailPageWrapper: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  return (
    <AdminDetailPage
      adminId={id === "new" ? "new" : parseInt(id || "0", 10)}
      onBack={() => navigate("/admin")}
      onSave={() => navigate("/admin")}
    />
  );
};

// 앱 컴포넌트
const App: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();
  const [showInitAdmin, setShowInitAdmin] = useState(false);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={
          isAuthenticated ? (
            <Navigate to="/dashboard" replace />
          ) : showInitAdmin ? (
            <InitAdminPage onBackToLogin={() => setShowInitAdmin(false)} />
          ) : (
            <LoginPage onShowInitAdmin={() => setShowInitAdmin(true)} />
          )
        }
      />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <MainLayout />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
};

export default App;
