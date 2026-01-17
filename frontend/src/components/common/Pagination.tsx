import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
  pageSize?: number;
  onPageSizeChange?: (size: number) => void;
  totalItems?: number;
}

const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  onPageChange,
  className = "",
  pageSize,
  onPageSizeChange,
  totalItems,
}) => {
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisible = 7;

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (currentPage <= 3) {
        for (let i = 1; i <= 5; i++) {
          pages.push(i);
        }
        pages.push("...");
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1);
        pages.push("...");
        for (let i = totalPages - 4; i <= totalPages; i++) {
          pages.push(i);
        }
      } else {
        pages.push(1);
        pages.push("...");
        for (let i = currentPage - 1; i <= currentPage + 1; i++) {
          pages.push(i);
        }
        pages.push("...");
        pages.push(totalPages);
      }
    }

    return pages;
  };

  return (
    <div className={`flex items-center justify-between py-3 ${className}`}>
      <div className="flex items-center gap-4">
        <div className="text-sm text-muted">
          {totalItems !== undefined ? (
            <>총 {totalItems.toLocaleString()}건</>
          ) : (
            <>
              페이지 {currentPage} / {totalPages}
            </>
          )}
        </div>
        {pageSize !== undefined && onPageSizeChange && (
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="text-sm border border-line rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-accent"
          >
            <option value={10}>10개씩</option>
            <option value={20}>20개씩</option>
            <option value={50}>50개씩</option>
            <option value={100}>100개씩</option>
          </select>
        )}
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="p-2 rounded-md hover:bg-neutral-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          aria-label="이전 페이지"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        {getPageNumbers().map((page, index) =>
          typeof page === "number" ? (
            <button
              key={index}
              onClick={() => onPageChange(page)}
              className={`min-w-[32px] h-8 px-2 rounded-md text-sm font-medium transition-colors ${
                currentPage === page
                  ? "bg-accent text-white"
                  : "hover:bg-neutral-100 text-ink"
              }`}
            >
              {page}
            </button>
          ) : (
            <span
              key={index}
              className="min-w-[32px] h-8 flex items-center justify-center text-sm text-muted"
            >
              {page}
            </span>
          )
        )}

        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="p-2 rounded-md hover:bg-neutral-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          aria-label="다음 페이지"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default Pagination;
