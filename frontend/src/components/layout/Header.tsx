import React, { useState, useRef, useEffect } from "react";
import { ChevronDown, ExternalLink, Bell, StickyNote, X } from "lucide-react";

import { MENU_TITLES, MENU_STRUCTURE } from "../../utils/constants";
import { AdminResponse } from "../../api/adminsApi";
import ProfileMenu from "./ProfileMenu";

interface HeaderProps {
  activeMenu: string;
  activeSubMenu?: string;
  currentUser: AdminResponse | null;
  onLogout: () => void;
  onNavigateToProfile: () => void;
  onNavigateToDashboard: () => void;
}

const Header: React.FC<HeaderProps> = ({
  activeMenu,
  activeSubMenu = "",
  currentUser,
  onLogout,
  onNavigateToProfile,
}) => {
  // 세부 메뉴 이름 찾기
  const getDisplayTitle = () => {
    if (activeSubMenu) {
      const menu = MENU_STRUCTURE.find((m) => m.key === activeMenu);
      if (menu) {
        const subItem = menu.subItems?.find((s) => s.key === activeSubMenu);
        if (subItem) {
          return subItem.label;
        }
      }
    }
    return MENU_TITLES[activeMenu] || "대시보드";
  };
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showMemo, setShowMemo] = useState(false);
  const [memoContent, setMemoContent] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const memoRef = useRef<HTMLDivElement>(null);

  // 로컬 스토리지에서 메모 불러오기
  useEffect(() => {
    const savedMemo = localStorage.getItem("admin_memo");
    if (savedMemo) {
      setMemoContent(savedMemo);
    }
  }, []);

  // 메모 저장
  useEffect(() => {
    if (memoContent !== undefined) {
      localStorage.setItem("admin_memo", memoContent);
    }
  }, [memoContent]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowProfileMenu(false);
      }
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
      if (memoRef.current && !memoRef.current.contains(event.target as Node)) {
        setShowMemo(false);
      }
    };

    if (showProfileMenu || showNotifications || showMemo) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showProfileMenu, showNotifications, showMemo]);

  const handleProfileClick = () => {
    if (currentUser) {
      onNavigateToProfile();
      setShowProfileMenu(false);
    }
  };

  // 임시 알림 데이터
  const notifications = [
    { id: 1, title: "신규 주문 3건", time: "5분 전", type: "order" },
    { id: 2, title: "재고 부족 알림", time: "1시간 전", type: "warning" },
    { id: 3, title: "미처리 문의 2건", time: "2시간 전", type: "inquiry" },
  ];

  return (
    <header className="bg-white border-b border-line px-6 py-3 flex items-center justify-between flex-shrink-0 z-10">
      <div className="flex items-center gap-6">
        <h2 className="text-xl font-bold text-ink">
          {getDisplayTitle()}
        </h2>
      </div>

      <div className="flex items-center gap-2">
        {/* 외부 링크 */}
        <a
          href="https://말씀함께.com"
          target="_blank"
          rel="noopener noreferrer"
          className="hidden lg:flex items-center gap-2 px-3 py-2 text-sm text-muted hover:text-ink hover:bg-paper rounded-lg transition-colors"
        >
          <span>말씀함께</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
        <a
          href="https://www.godpeople.com"
          target="_blank"
          rel="noopener noreferrer"
          className="hidden lg:flex items-center gap-2 px-3 py-2 text-sm text-muted hover:text-ink hover:bg-paper rounded-lg transition-colors"
        >
          <span>갓피플몰</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </a>

        <div className="w-px h-6 bg-line mx-2 hidden lg:block" />

        {/* 메모장 */}
        <div className="relative" ref={memoRef}>
          <button
            onClick={() => setShowMemo(!showMemo)}
            className={`relative p-2 hover:bg-paper rounded-lg transition-colors ${
              memoContent ? "text-accent" : "text-muted"
            }`}
            title="개인 메모장"
          >
            <StickyNote className="w-5 h-5" />
            {memoContent && (
              <span className="absolute top-1 right-1 w-2 h-2 bg-accent rounded-full" />
            )}
          </button>

          {showMemo && (
            <div className="absolute right-0 mt-2 w-96 bg-white rounded-xl shadow-modal border border-line overflow-hidden z-50 anim-fade-in">
              <div className="px-4 py-3 bg-paper border-b border-line flex items-center justify-between">
                <h3 className="font-semibold text-ink">개인 메모장</h3>
                <button
                  onClick={() => setShowMemo(false)}
                  className="p-1 hover:bg-white rounded transition-colors"
                >
                  <X className="w-4 h-4 text-muted" />
                </button>
              </div>
              <div className="p-4">
                <textarea
                  value={memoContent}
                  onChange={(e) => setMemoContent(e.target.value)}
                  placeholder="메모를 입력하세요..."
                  className="w-full h-64 p-3 text-sm border border-line rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent resize-none font-mono"
                  autoFocus
                />
                <div className="mt-3 flex items-center justify-between text-xs text-muted">
                  <span>자동 저장됩니다</span>
                  {memoContent && (
                    <button
                      onClick={() => {
                        if (confirm("메모를 삭제하시겠습니까?")) {
                          setMemoContent("");
                          localStorage.removeItem("admin_memo");
                        }
                      }}
                      className="text-red-500 hover:text-red-600 transition-colors"
                    >
                      전체 삭제
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 알림 */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative p-2 hover:bg-paper rounded-lg transition-colors"
          >
            <Bell className="w-5 h-5 text-muted" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-danger-500 rounded-full" />
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-modal border border-line overflow-hidden z-50 anim-fade-in">
              <div className="px-4 py-3 bg-paper border-b border-line">
                <h3 className="font-semibold text-ink">알림</h3>
              </div>
              <div className="max-h-80 overflow-y-auto">
                {notifications.map((notif) => (
                  <div
                    key={notif.id}
                    className="px-4 py-3 hover:bg-paper/50 cursor-pointer border-b border-line last:border-0 transition-colors"
                  >
                    <p className="text-sm font-medium text-ink">{notif.title}</p>
                    <p className="text-xs text-muted mt-0.5">{notif.time}</p>
                  </div>
                ))}
              </div>
              <div className="px-4 py-2 bg-paper/50 border-t border-line">
                <button className="text-sm text-accent hover:text-accent-hover font-medium">
                  모든 알림 보기
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 프로필 */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            className="flex items-center gap-2 hover:bg-paper rounded-lg p-2 transition-colors focus:outline-none"
            aria-expanded={showProfileMenu}
            aria-haspopup="true"
          >
            <div className="w-8 h-8 bg-gradient-to-br from-accent to-accent-light rounded-full flex items-center justify-center text-white font-semibold text-sm shadow-sm">
              {currentUser ? currentUser.admin_name.charAt(0).toUpperCase() : "U"}
            </div>
            <span className="hidden md:block text-sm font-medium text-ink">
              {currentUser?.name || "사용자"}
            </span>
            <ChevronDown
              className={`w-4 h-4 text-muted transition-transform duration-200 ${
                showProfileMenu ? "rotate-180" : "rotate-0"
              }`}
            />
          </button>

          {showProfileMenu && (
            <ProfileMenu
              currentUser={currentUser}
              onProfileClick={handleProfileClick}
              onLogout={onLogout}
            />
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
