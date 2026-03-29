import { LogOut, User, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/contexts/AuthContext";
import { ADMIN_ROLE_LABEL } from "@/utils/constants";

interface HeaderProps {
  title?: string;
}

export function Header({ title }: HeaderProps) {
  const { currentAdmin, logout } = useAuth();

  return (
    <header className="h-14 flex items-center justify-between px-5 border-b border-gray-200 bg-white flex-shrink-0">
      {/* 페이지 제목 */}
      <h1 className="text-base font-semibold text-gray-900">
        {title ?? ""}
      </h1>

      {/* 우측: 프로필 */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-2 text-sm text-gray-700 hover:text-gray-900 focus:outline-none">
            <div className="h-7 w-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-semibold">
              {currentAdmin?.admin_name?.slice(0, 1) ?? "A"}
            </div>
            <span className="hidden sm:block font-medium">
              {currentAdmin?.admin_name ?? "관리자"}
            </span>
            <ChevronDown className="h-3.5 w-3.5 opacity-60" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuLabel className="pb-1">
            <div className="font-medium text-gray-900">{currentAdmin?.admin_name}</div>
            <div className="text-xs text-gray-500 font-normal">{currentAdmin?.email}</div>
            <div className="text-xs text-gray-400 font-normal mt-0.5">
              {currentAdmin ? ADMIN_ROLE_LABEL[currentAdmin.admin_role] ?? currentAdmin.admin_role : ""}
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => window.location.href = "/settings"}
          >
            <User className="h-4 w-4 mr-2" />
            내 계정
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={logout}
            className="text-red-600 focus:text-red-600 focus:bg-red-50"
          >
            <LogOut className="h-4 w-4 mr-2" />
            로그아웃
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
