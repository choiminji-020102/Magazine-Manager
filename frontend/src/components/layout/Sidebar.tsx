import React from "react";
import { Globe, BookOpen } from "lucide-react";

import { MENU_STRUCTURE, ROLE_CONFIG } from "../../utils/constants";
import { AdminResponse } from "../../api/adminsApi";
import SidebarMenu from "./SidebarMenu";

interface ExpandedMenus {
  [key: string]: boolean;
}

interface SidebarProps {
  activeMenu: string;
  activeSubMenu: string;
  expandedMenus: ExpandedMenus;
  onMenuClick: (menuKey: string, subMenuKey?: string) => void;
  onToggleMenu: (menuKey: string) => void;
  currentUser: AdminResponse | null;
  onNavigateToProfile: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  activeMenu,
  activeSubMenu,
  expandedMenus,
  onMenuClick,
  onToggleMenu,
  currentUser,
  onNavigateToProfile,
}) => {
  const handleLogoClick = () => {
    onMenuClick("dashboard", "");
  };

  return (
    <div className="w-56 bg-white border-r border-line flex flex-col z-20 flex-shrink-0">
      {/* 로고 영역 */}
      <div className="p-5 border-b border-line bg-gradient-to-r from-paper to-white">
        <button
          onClick={handleLogoClick}
          className="cursor-pointer hover:opacity-80 transition-opacity text-left w-full flex items-center gap-3"
          aria-label="대시보드로 이동"
        >
          <img
            src="/logo.png"
            alt="목자의 지혜"
            className="h-14 w-auto object-contain"
            onError={(e) => {
              // 이미지가 없을 경우 기본 아이콘 표시
              const target = e.target as HTMLImageElement;
              target.style.display = "none";
              const parent = target.parentElement;
              if (parent) {
                const fallback = parent.querySelector(
                  ".logo-fallback"
                ) as HTMLElement;
                if (fallback) fallback.style.display = "flex";
              }
            }}
          />
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-accent to-accent-light flex items-center justify-center shadow-sm hidden logo-fallback">
            <BookOpen className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-ink">목자의 지혜</h1>
            <p className="text-xs text-muted">매거진 관리 시스템</p>
          </div>
        </button>
      </div>

      {/* 관리자 프로필 */}
      {currentUser && (
        <div className="p-4 border-b border-line">
          <button
            onClick={onNavigateToProfile}
            className="w-full flex items-center space-x-3 p-3 rounded-lg hover:bg-paper transition-colors group"
          >
            <div className="w-10 h-10 bg-gradient-to-br from-accent to-accent-light rounded-full flex items-center justify-center text-white font-semibold text-sm flex-shrink-0 shadow-sm group-hover:shadow-md transition-shadow">
              {currentUser.admin_name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0 text-left">
              <p className="text-sm font-semibold text-ink truncate">
                {currentUser.admin_name}
              </p>
              <p className="text-xs text-muted truncate">
                {ROLE_CONFIG[currentUser.admin_role]?.label ||
                  currentUser.admin_role}
              </p>
            </div>
          </button>
        </div>
      )}

      {/* 메뉴 */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto custom-scrollbar">
        <div className="pb-2 px-3 text-[11px] text-muted font-semibold uppercase tracking-wider">
          메인 메뉴
        </div>

        {MENU_STRUCTURE.map((menu) => (
          <SidebarMenu
            key={menu.key}
            icon={menu.icon}
            title={menu.title}
            menuKey={menu.key}
            activeMenu={activeMenu}
            activeSubMenu={activeSubMenu}
            expandedMenus={expandedMenus}
            onMenuClick={onMenuClick}
            onToggleMenu={onToggleMenu}
            subItems={menu.subItems}
          />
        ))}
      </nav>

      {/* 하단 */}
      <div className="p-4 border-t border-line bg-paper/50">
        <button className="w-full text-left px-3 py-2 rounded-lg hover:bg-white flex items-center space-x-3 text-sm font-medium text-muted transition-colors">
          <Globe className="w-4 h-4 text-accent" />
          <span>한국어 (KOR)</span>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
