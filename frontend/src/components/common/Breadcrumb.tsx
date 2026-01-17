import React from "react";
import { ChevronRight, Home } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface BreadcrumbItem {
  label: string;
  path?: string;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
}

const Breadcrumb: React.FC<BreadcrumbProps> = ({ items }) => {
  const navigate = useNavigate();

  const handleClick = (path?: string) => {
    if (path) {
      navigate(path);
    }
  };

  return (
    <nav className="flex items-center gap-2 text-sm mb-6">
      <button
        onClick={() => handleClick("/dashboard")}
        className="flex items-center gap-1 text-muted hover:text-accent transition-colors"
      >
        <Home className="w-4 h-4" />
        <span>홈</span>
      </button>
      {items.map((item, index) => (
        <React.Fragment key={index}>
          <ChevronRight className="w-4 h-4 text-muted" />
          {item.path && index < items.length - 1 ? (
            <button
              onClick={() => handleClick(item.path)}
              className="text-muted hover:text-accent transition-colors"
            >
              {item.label}
            </button>
          ) : (
            <span className="text-ink font-medium">{item.label}</span>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
};

export default Breadcrumb;
