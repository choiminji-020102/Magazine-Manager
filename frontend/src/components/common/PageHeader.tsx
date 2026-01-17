import React from "react";
import { ChevronRight, RefreshCw } from "lucide-react";
import { cn } from "../../utils/cn";

interface Breadcrumb {
  label: string;
  onClick?: () => void;
}

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  breadcrumbs?: Breadcrumb[];
  actions?: React.ReactNode;
  onRefresh?: () => void;
  className?: string;
}

const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  breadcrumbs,
  actions,
  onRefresh,
  className,
}) => {
  return (
    <div className={cn("mb-6", className)}>
      {/* Breadcrumbs */}
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav className="flex items-center gap-1 text-sm text-gray-500 mb-2">
          {breadcrumbs.map((crumb, index) => (
            <React.Fragment key={index}>
              {index > 0 && <ChevronRight className="w-4 h-4" />}
              {crumb.onClick ? (
                <button
                  onClick={crumb.onClick}
                  className="hover:text-gray-700 transition-colors"
                >
                  {crumb.label}
                </button>
              ) : (
                <span
                  className={
                    index === breadcrumbs.length - 1
                      ? "text-gray-900 font-medium"
                      : ""
                  }
                >
                  {crumb.label}
                </span>
              )}
            </React.Fragment>
          ))}
        </nav>
      )}

      {/* Title and Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              title="새로고침"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
          )}
        </div>
        {actions && <div className="flex items-center gap-3">{actions}</div>}
      </div>

      {subtitle && <p className="text-gray-500 mt-1">{subtitle}</p>}
    </div>
  );
};

export default PageHeader;

