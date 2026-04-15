import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import LoginPage from "@/pages/LoginPage";
import InitAdminPage from "@/pages/InitAdminPage";
import DashboardPage from "@/pages/DashboardPage";
import OrderListPage from "@/pages/OrderListPage";
import OrderCreatePage from "@/pages/OrderCreatePage";
import SendManagementPage from "@/pages/SendManagementPage";
import CustomerListPage from "@/pages/CustomerListPage";
import ProductListPage from "@/pages/ProductListPage";
import InquiryListPage from "@/pages/InquiryListPage";
import AdminListPage from "@/pages/AdminListPage";
import ActivityLogPage from "@/pages/ActivityLogPage";
import SettingsPage from "@/pages/SettingsPage";
import SubscriptionListPage from "@/pages/SubscriptionListPage";
import Cafe24ProductListPage from "@/pages/Cafe24ProductListPage";

function PrivateRoute({ children }: { children: React.ReactNode }) {
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
}

export default function App() {
  return (
    <Routes>
        {/* 공개 라우트 */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/init-admin" element={<InitAdminPage />} />

        {/* 인증 필요 라우트 */}
        <Route
          element={
            <PrivateRoute>
              <AppLayout />
            </PrivateRoute>
          }
        >
          <Route path="/" element={<DashboardPage />} />
          <Route path="/orders" element={<OrderListPage />} />
          <Route path="/orders/new" element={<OrderCreatePage />} />
          <Route path="/shipping" element={<SendManagementPage />} />
          <Route path="/customers" element={<CustomerListPage />} />
          <Route path="/products" element={<ProductListPage />} />
          <Route path="/subscriptions" element={<SubscriptionListPage />} />
          <Route path="/inquiries" element={<InquiryListPage />} />
          <Route path="/admins" element={<AdminListPage />} />
          <Route path="/activity-logs" element={<ActivityLogPage />} />
          <Route path="/cafe24/products" element={<Cafe24ProductListPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>

        {/* 기타 → 대시보드로 */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
  );
}
