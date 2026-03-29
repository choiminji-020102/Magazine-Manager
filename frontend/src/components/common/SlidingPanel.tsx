import { useEffect, ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/utils/cn";

interface SlidingPanelProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  width?: number;
  children: ReactNode;
  className?: string;
}

export function SlidingPanel({
  open,
  onClose,
  title,
  width = 480,
  children,
  className,
}: SlidingPanelProps) {
  // ESC 키로 닫기
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  return (
    <>
      {/* 오버레이 */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/30 transition-opacity duration-200",
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
        onClick={onClose}
      />

      {/* 패널 */}
      <div
        className={cn(
          "fixed right-0 top-0 z-50 h-full bg-white shadow-panel border-l border-gray-200 flex flex-col",
          "transform transition-transform duration-250 ease-out",
          open ? "translate-x-0" : "translate-x-full",
          className
        )}
        style={{ width }}
      >
        {/* 패널 헤더 */}
        {title && (
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 flex-shrink-0">
            <h2 className="text-base font-semibold text-gray-900">{title}</h2>
            <button
              onClick={onClose}
              className="rounded-md p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* 패널 콘텐츠 */}
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </div>
    </>
  );
}
