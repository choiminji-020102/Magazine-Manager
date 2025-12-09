import React from "react";
import { User, LogOut } from "lucide-react";

import { AdminResponse } from "../../api/adminApi";

interface ProfileMenuProps {
  currentUser: AdminResponse | null;
  onProfileClick: () => void;
  onLogout: () => void;
}

const ProfileMenu: React.FC<ProfileMenuProps> = ({
  currentUser,
  onProfileClick,
  onLogout,
}) => {
  return (
    <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-sm border border-gray-100 py-2 z-30 transform origin-top-right animate-fade-in">
      <div className="px-4 py-2 text-sm font-semibold border-b mb-1">
        {currentUser ? currentUser.name : "사용자"}
      </div>
      {currentUser && (
        <div className="px-4 py-1 text-xs text-gray-500 border-b mb-1">
          {currentUser.email}
        </div>
      )}
      <button
        onClick={onProfileClick}
        className="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center space-x-3 text-sm text-gray-700 transition-colors"
      >
        <User className="w-4 h-4 text-blue-500" />
        <span>마이페이지</span>
      </button>
      <div className="ml-5 space-y-0.5">
        <button
          onClick={onProfileClick}
          className="w-full text-left px-4 py-1.5 hover:bg-gray-50 text-xs text-gray-600"
        >
          내 정보 수정
        </button>
        <button
          onClick={onProfileClick}
          className="w-full text-left px-4 py-1.5 hover:bg-gray-50 text-xs text-gray-600"
        >
          비밀번호 변경
        </button>
      </div>
      <div className="border-t my-2"></div>
      <button
        onClick={onLogout}
        className="w-full text-left px-4 py-2 hover:bg-red-50 flex items-center space-x-3 text-sm text-red-600 transition-colors"
      >
        <LogOut className="w-4 h-4" />
        <span>로그아웃</span>
      </button>
    </div>
  );
};

export default ProfileMenu;
