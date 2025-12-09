import React from "react";
import { Globe } from "lucide-react";

import { MENU_STRUCTURE, ROLE_CONFIG } from "../../utils/constants";
import { AdminResponse } from "../../api/adminApi";
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
    <div className="w-64 bg-white border-r border-gray-200 flex flex-col shadow-sm z-20 flex-shrink-0">
      <div className="p-5 border-b border-gray-100">
        <button
          onClick={handleLogoClick}
          className="cursor-pointer hover:opacity-80 transition-opacity text-left w-full"
          aria-label="대시보드로 이동"
        >
          <h1 className="text-2xl font-extrabold text-blue-600">목자의 지혜</h1>
        </button>
      </div>

      {/* 관리자 프로필 */}
      {currentUser && (
        <div className="p-4 border-b border-gray-100">
          <button
            onClick={onNavigateToProfile}
            className="w-full flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-50 transition-colors group"
          >
            <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-semibold text-sm flex-shrink-0 group-hover:bg-blue-600 transition-colors">
              {currentUser.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0 text-left">
              <p className="text-sm font-medium text-gray-900 truncate">
                {currentUser.name}
              </p>
              <p className="text-xs text-gray-500 truncate">
                {ROLE_CONFIG[currentUser.role]?.label || currentUser.role}
              </p>
            </div>
          </button>
        </div>
      )}

      <nav className="flex-1 p-4 space-y-2 overflow-y-auto custom-scrollbar">
        <div className="pt-2 pb-2 text-xs text-gray-500 font-bold uppercase tracking-wider">
          사이트 관리 메뉴
        </div>

        {/* Main Menu Items */}
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

      <div className="p-4 border-t border-gray-200">
        <button className="w-full text-left px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center space-x-3 text-sm font-medium text-gray-700 transition-colors">
          <Globe className="w-4 h-4 text-blue-600" />
          <span>한국어 (KOR)</span>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
