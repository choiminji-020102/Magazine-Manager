import React from "react";
import { cn } from "../../utils/cn";

interface Tab {
  key: string;
  label: string;
  count?: number;
  icon?: React.ReactNode;
}

interface TabsProps {
  tabs: Tab[];
  activeTab: string;
  onChange: (key: string) => void;
  className?: string;
}

const Tabs: React.FC<TabsProps> = ({
  tabs,
  activeTab,
  onChange,
  className,
}) => {
  return (
    <div className={cn("border-b border-gray-200", className)}>
      <nav className="-mb-px flex gap-6" aria-label="Tabs">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => onChange(tab.key)}
            className={cn(
              "py-3 px-1 border-b-2 font-medium text-sm transition-colors whitespace-nowrap flex items-center gap-2",
              activeTab === tab.key
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            )}
          >
            {tab.icon}
            {tab.label}
            {tab.count !== undefined && (
              <span
                className={cn(
                  "px-2 py-0.5 rounded-full text-xs",
                  activeTab === tab.key
                    ? "bg-blue-100 text-blue-600"
                    : "bg-gray-100 text-gray-600"
                )}
              >
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </nav>
    </div>
  );
};

export default Tabs;

