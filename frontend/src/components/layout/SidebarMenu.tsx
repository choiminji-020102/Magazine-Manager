import React from "react";
import { ChevronDown, ChevronRight, LucideIcon } from "lucide-react";

import { cn } from "../../utils/cn";

interface SubSubItem {
  label: string;
  key: string;
  isSubSub?: boolean;
}

interface SubItem {
  label: string;
  key: string;
  subSubItems?: SubSubItem[];
  isSubSub?: boolean;
}

interface ExpandedMenus {
  [key: string]: boolean;
}

interface SidebarMenuProps {
  icon: LucideIcon;
  title: string;
  menuKey: string;
  activeMenu: string;
  activeSubMenu: string;
  expandedMenus: ExpandedMenus;
  onMenuClick: (menuKey: string, subMenuKey?: string) => void;
  onToggleMenu: (menuKey: string) => void;
  subItems?: SubItem[];
}

const SidebarMenu: React.FC<SidebarMenuProps> = ({
  icon: Icon,
  title,
  menuKey,
  activeMenu,
  activeSubMenu,
  expandedMenus,
  onMenuClick,
  onToggleMenu,
  subItems,
}) => {
  const isExpanded = expandedMenus[menuKey];
  const isActive = activeMenu === menuKey;

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    // 서브메뉴가 있는 경우에만 토글
    if (subItems && subItems.length > 0) {
      onToggleMenu(menuKey);
    }
    // 항상 메뉴 클릭 처리 (활성 메뉴 설정)
    onMenuClick(menuKey);
  };

  const handleSubMenuClick = (submenuKey: string) => {
    onMenuClick(menuKey, submenuKey);
  };

  return (
    <div>
      <button
        onClick={handleClick}
        className={cn(
          "w-full text-left px-3 py-2 rounded flex items-center justify-between text-sm transition-colors duration-150",
          isActive && !activeSubMenu
            ? "bg-blue-50 text-blue-600 font-semibold"
            : "hover:bg-gray-100 text-gray-700"
        )}
        aria-expanded={isExpanded}
        aria-current={isActive ? "page" : undefined}
      >
        <div className="flex items-center space-x-2">
          <Icon className="w-4 h-4" aria-hidden="true" />
          <span>{title}</span>
        </div>
        {subItems &&
          (isExpanded ? (
            <ChevronDown className="w-4 h-4 transition-transform duration-150" />
          ) : (
            <ChevronRight className="w-4 h-4 transition-transform duration-150" />
          ))}
      </button>

      {subItems && isExpanded && (
        <div className="ml-4 mt-1 space-y-1 border-l border-gray-200 pl-2">
          {subItems.map((item) => (
            <React.Fragment key={item.key}>
              <button
                onClick={() => handleSubMenuClick(item.key)}
                className={cn(
                  "w-full text-left px-3 py-1.5 rounded text-xs transition-colors duration-150",
                  activeSubMenu === item.key && isActive
                    ? "bg-blue-100 text-blue-700 font-medium"
                    : "hover:bg-gray-50 text-gray-600",
                  item.isSubSub && "ml-4"
                )}
                aria-current={
                  activeSubMenu === item.key && isActive ? "page" : undefined
                }
              >
                {item.isSubSub ? "• " : ""}
                {item.label}
              </button>
              {item.subSubItems?.map((subSub) => (
                <button
                  key={subSub.key}
                  onClick={() => handleSubMenuClick(subSub.key)}
                  className={cn(
                    "w-full text-left px-3 py-1.5 rounded text-xs transition-colors duration-150 ml-4",
                    activeSubMenu === subSub.key && isActive
                      ? "bg-blue-100 text-blue-700 font-medium"
                      : "hover:bg-gray-50 text-gray-600"
                  )}
                  aria-current={
                    activeSubMenu === subSub.key && isActive
                      ? "page"
                      : undefined
                  }
                >
                  • {subSub.label}
                </button>
              ))}
            </React.Fragment>
          ))}
        </div>
      )}
    </div>
  );
};

export default SidebarMenu;
