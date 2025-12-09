import React, { useState, useRef, useEffect } from "react";
import { ChevronDown, ExternalLink } from "lucide-react";

import { MENU_TITLES } from "../../utils/constants";
import { AdminResponse } from "../../api/adminApi";
import ProfileMenu from "./ProfileMenu";

interface HeaderProps {
  activeMenu: string;
  currentUser: AdminResponse | null;
  onLogout: () => void;
  onNavigateToProfile: () => void;
  onNavigateToDashboard: () => void;
}

const Header: React.FC<HeaderProps> = ({
  activeMenu,
  currentUser,
  onLogout,
  onNavigateToProfile,
}) => {
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowProfileMenu(false);
      }
    };

    if (showProfileMenu) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showProfileMenu]);

  const handleProfileClick = () => {
    if (currentUser) {
      onNavigateToProfile();
      setShowProfileMenu(false);
    }
  };

  return (
    <header className="bg-white border-b border-gray-200 shadow-sm p-4 flex items-center justify-between flex-shrink-0 z-10">
      <div className="flex items-center space-x-4">
        <h2 className="text-xl font-semibold text-gray-900">
          {MENU_TITLES[activeMenu] || "대시보드"}
        </h2>
      </div>
      <div className="flex items-center space-x-3">
        <a
          href="https://말씀함께.com"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center space-x-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium text-sm shadow-sm"
        >
          <span>말씀함께</span>
          <ExternalLink className="w-4 h-4" />
        </a>
        <a
          href="https://www.godpeople.com"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center space-x-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium text-sm shadow-sm"
        >
          <span>갓피플몰</span>
          <ExternalLink className="w-4 h-4" />
        </a>

        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            className="flex items-center space-x-2 hover:bg-gray-100 rounded-full p-2 transition-colors focus:outline-none"
            aria-expanded={showProfileMenu}
            aria-haspopup="true"
          >
            <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white font-semibold text-sm">
              {currentUser ? currentUser.name.charAt(0).toUpperCase() : "U"}
            </div>
            <ChevronDown
              className={`w-4 h-4 text-gray-600 transition-transform duration-200 ${
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
