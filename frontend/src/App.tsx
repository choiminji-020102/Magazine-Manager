import React, { useState } from "react";
import {
  Routes,
  Route,
  Navigate,
  useNavigate,
  useParams,
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

  const [activeMenu, setActiveMenu] = useState("dashboard");
  const [activeSubMenu, setActiveSubMenu] = useState("");
  const [expandedMenus, setExpandedMenus] = useState<ExpandedMenus>({});

  const handleMenuClick = (menuKey: string, subMenuKey?: string) => {
    setActiveMenu(menuKey);
    setActiveSubMenu(subMenuKey || "");

    // 메뉴에 따른 라우팅
    if (menuKey === "system" && subMenuKey === "admin") {
      navigate("/admin");
    } else if (menuKey === "dashboard") {
      navigate("/dashboard");
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
          currentUser={currentAdmin}
          onLogout={handleLogout}
          onNavigateToProfile={handleNavigateToProfile}
          onNavigateToDashboard={() => {
            setActiveMenu("dashboard");
            navigate("/dashboard");
          }}
        />
        <main className="flex-1 overflow-auto p-6">
          <Routes>
            <Route path="/dashboard" element={<DashboardPage />} />
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

// 대시보드 페이지 (임시)
const DashboardPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">대시보드</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
          <h3 className="text-sm font-medium text-gray-500">오늘 주문</h3>
          <p className="text-3xl font-bold text-gray-900 mt-2">0</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
          <h3 className="text-sm font-medium text-gray-500">발송 대기</h3>
          <p className="text-3xl font-bold text-gray-900 mt-2">0</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
          <h3 className="text-sm font-medium text-gray-500">신규 고객</h3>
          <p className="text-3xl font-bold text-gray-900 mt-2">0</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
          <h3 className="text-sm font-medium text-gray-500">예외 주문</h3>
          <p className="text-3xl font-bold text-gray-900 mt-2">0</p>
        </div>
      </div>
    </div>
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
