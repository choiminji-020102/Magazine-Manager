import { Outlet, useLocation } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";

const PAGE_TITLES: Record<string, string> = {
  "/": "대시보드",
  "/orders": "전체 주문 조회",
  "/orders/unpaid": "입금전 관리",
  "/orders/new": "주문 등록",
  "/subscriptions": "구독 목록",
  "/sends/preparing": "배송 준비 중 관리",
  "/sends/delivered": "배송 완료 조회",
  "/customers": "고객 목록",
  "/products": "상품 목록",
  "/inquiries": "문의 관리",
  "/admins": "관리자 관리",
  "/activity-logs": "활동 로그",
  "/settings": "설정",
};

export function AppLayout() {
  const location = useLocation();
  const title = PAGE_TITLES[location.pathname] ?? "";

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0">
        <Header title={title} />
        <main className="flex-1 min-h-0 flex flex-col bg-[#EEF0F5] p-3">
          <div className="flex-1 min-h-0 flex flex-col bg-white rounded-xl shadow-sm overflow-hidden">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
