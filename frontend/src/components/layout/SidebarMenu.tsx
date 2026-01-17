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
    if (subItems && subItems.length > 0) {
      onToggleMenu(menuKey);
    }
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
          "w-full text-left px-3 py-2.5 rounded-lg flex items-center justify-between text-sm transition-all duration-200",
          isActive && !activeSubMenu
            ? "bg-gradient-to-r from-info-50 to-paper text-accent font-semibold shadow-sm"
            : "hover:bg-paper text-muted hover:text-ink"
        )}
        aria-expanded={isExpanded}
        aria-current={isActive ? "page" : undefined}
      >
        <div className="flex items-center space-x-3">
          <Icon
            className={cn(
              "w-[18px] h-[18px] transition-colors",
              isActive && !activeSubMenu ? "text-accent" : "text-muted"
            )}
            aria-hidden="true"
          />
          <span>{title}</span>
        </div>
        {subItems &&
          subItems.length > 0 &&
          (isExpanded ? (
            <ChevronDown className="w-4 h-4 text-muted transition-transform duration-200" />
          ) : (
            <ChevronRight className="w-4 h-4 text-muted transition-transform duration-200" />
          ))}
      </button>

      {subItems && isExpanded && (
        <div className="ml-4 mt-1 space-y-0.5 border-l-2 border-line pl-3">
          {subItems.map((item) => (
            <React.Fragment key={item.key}>
              <button
                onClick={() => handleSubMenuClick(item.key)}
                className={cn(
                  "w-full text-left px-3 py-2 rounded-md text-[13px] transition-all duration-200",
                  activeSubMenu === item.key && isActive
                    ? "bg-info-50/80 text-accent font-medium"
                    : "hover:bg-paper text-muted hover:text-ink",
                  item.isSubSub && "ml-4"
                )}
                aria-current={
                  activeSubMenu === item.key && isActive ? "page" : undefined
                }
              >
                {item.label}
              </button>
              {item.subSubItems?.map((subSub) => (
                <button
                  key={subSub.key}
                  onClick={() => handleSubMenuClick(subSub.key)}
                  className={cn(
                    "w-full text-left px-3 py-1.5 rounded-md text-xs transition-all duration-200 ml-4",
                    activeSubMenu === subSub.key && isActive
                      ? "bg-info-50/80 text-accent font-medium"
                      : "hover:bg-paper text-muted hover:text-ink"
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
