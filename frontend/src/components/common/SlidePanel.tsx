import React, { useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "../../utils/cn";

interface SlidePanelProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  footer?: React.ReactNode;
}

const SlidePanel: React.FC<SlidePanelProps> = ({
  isOpen,
  onClose,
  title,
  children,
  size = "md",
  footer,
}) => {
  const sizeClasses = {
    sm: "w-96",
    md: "w-[600px]",
    lg: "w-[800px]",
    xl: "w-[1000px]",
  };

  const widthMap: Record<string, string> = {
    sm: "384px",
    md: "600px",
    lg: "800px",
    xl: "1000px",
  };

  const panelWidth = sizeClasses[size];

  useEffect(() => {
    const mainContent = document.querySelector("main");
    if (mainContent) {
      if (isOpen) {
        mainContent.style.marginRight = widthMap[size];
        mainContent.style.transition = "margin-right 0.3s ease-out";
      } else {
        mainContent.style.marginRight = "0";
      }
    }
  }, [isOpen, size, widthMap]);

  if (!isOpen) return null;

  return (
    <div
      className={cn(
        "fixed right-0 top-0 h-full bg-panel shadow-2xl z-50 flex flex-col transform transition-all duration-300 ease-out border-l border-line",
        panelWidth,
        isOpen ? "translate-x-0" : "translate-x-full"
      )}
    >
      {/* 헤더 */}
      {(title !== undefined || onClose !== undefined) && (
        <div className="flex items-center justify-between px-6 py-4 border-b border-line bg-gradient-to-r from-paper to-white">
          {title && <h2 className="text-lg font-semibold text-ink">{title}</h2>}
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-chip transition-colors"
            aria-label="닫기"
          >
            <X className="w-5 h-5 text-muted" />
          </button>
        </div>
      )}

      {/* 내용 */}
      <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
        {children}
      </div>

      {/* 푸터 */}
      {footer && (
        <div className="px-6 py-4 border-t border-line bg-gradient-to-r from-paper to-white">
          {footer}
        </div>
      )}
    </div>
  );
};

export default SlidePanel;
