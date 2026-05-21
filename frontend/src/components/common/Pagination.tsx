import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PaginationProps {
  page: number;
  totalPages: number;
  total: number;
  limit: number;
  onPageChange: (page: number) => void;
}

export function Pagination({
  page,
  totalPages,
  total,
  limit,
  onPageChange,
}: PaginationProps) {
  const start = total === 0 ? 0 : (page - 1) * limit + 1;
  const end = Math.min(page * limit, total);
  const effectiveTotalPages = Math.max(1, totalPages);

  // 페이지 번호 범위 계산 (최대 5개). totalPages=1 이어도 "1" 버튼 한 개 노출.
  const getPageNumbers = () => {
    const delta = 2;
    const pages: (number | "...")[] = [];
    const left = Math.max(1, page - delta);
    const right = Math.min(effectiveTotalPages, page + delta);

    if (left > 1) {
      pages.push(1);
      if (left > 2) pages.push("...");
    }
    for (let i = left; i <= right; i++) pages.push(i);
    if (right < effectiveTotalPages) {
      if (right < effectiveTotalPages - 1) pages.push("...");
      pages.push(effectiveTotalPages);
    }
    return pages;
  };

  return (
    <div className="flex items-center justify-between px-3 py-2.5 border-t border-gray-200">
      <span className="text-xs text-gray-500">
        {total === 0
          ? "총 0건"
          : `${start.toLocaleString()}–${end.toLocaleString()} / ${total.toLocaleString()}건`}
      </span>
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        {getPageNumbers().map((p, i) =>
          p === "..." ? (
            <span key={i} className="px-1 text-xs text-gray-400">
              ...
            </span>
          ) : (
            <button
              key={p}
              onClick={() => onPageChange(p as number)}
              className={
                p === page
                  ? "h-7 w-7 rounded-md text-xs font-medium bg-blue-600 text-white"
                  : "h-7 w-7 rounded-md text-xs text-gray-600 hover:bg-gray-100"
              }
            >
              {p}
            </button>
          )
        )}
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= effectiveTotalPages}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
