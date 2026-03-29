import { ReactNode } from "react";
import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/utils/cn";
import { EmptyState } from "./EmptyState";

export interface ColumnDef<T> {
  key: string;
  header: string | ReactNode;
  cell: (row: T) => ReactNode;
  width?: string;
  className?: string;
  headerClassName?: string;
  /** 헤더 클릭으로 정렬 가능 여부 */
  sortable?: boolean;
}

interface DataTableProps<T> {
  columns: ColumnDef<T>[];
  data: T[];
  getRowId: (row: T) => string | number;
  onRowClick?: (row: T) => void;
  selectedIds?: Set<string | number>;
  onSelectionChange?: (ids: Set<string | number>) => void;
  isLoading?: boolean;
  emptyMessage?: string;
  activeRowId?: string | number | null;
  rowClassName?: (row: T) => string | undefined;
  /** 현재 정렬 컬럼 key */
  sortBy?: string;
  /** 현재 정렬 방향 */
  sortOrder?: "asc" | "desc";
  /** 정렬 변경 콜백 */
  onSortChange?: (sortBy: string, sortOrder: "asc" | "desc") => void;
}

/** 로딩 중 표시할 shimmer 스켈레톤 행 */
function TableSkeleton({ colCount, rows = 8 }: { colCount: number; rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <tr
          key={i}
          className={cn(
            "border-b border-gray-100",
            i % 2 === 1 && "bg-gray-50/40"
          )}
        >
          {Array.from({ length: colCount }).map((_, j) => (
            <td key={j} className="px-3 py-2.5" style={{ height: "44px" }}>
              <div
                className={cn(
                  "h-3 rounded-full bg-gray-200 animate-pulse",
                  j === 0 ? "w-2/3" : j === colCount - 1 ? "w-1/4" : "w-1/2"
                )}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

export function DataTable<T>({
  columns,
  data,
  getRowId,
  onRowClick,
  selectedIds,
  onSelectionChange,
  isLoading,
  emptyMessage = "데이터가 없습니다.",
  activeRowId,
  rowClassName,
  sortBy,
  sortOrder,
  onSortChange,
}: DataTableProps<T>) {
  const hasSelection = !!onSelectionChange;
  const allSelected =
    data.length > 0 && data.every((row) => selectedIds?.has(getRowId(row)));
  const someSelected =
    !allSelected && data.some((row) => selectedIds?.has(getRowId(row)));

  const toggleAll = () => {
    if (!onSelectionChange) return;
    if (allSelected) {
      const next = new Set(selectedIds);
      data.forEach((row) => next.delete(getRowId(row)));
      onSelectionChange(next);
    } else {
      const next = new Set(selectedIds);
      data.forEach((row) => next.add(getRowId(row)));
      onSelectionChange(next);
    }
  };

  const toggleRow = (id: string | number) => {
    if (!onSelectionChange || !selectedIds) return;
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    onSelectionChange(next);
  };

  const handleSortClick = (col: ColumnDef<T>) => {
    if (!col.sortable || !onSortChange) return;
    if (sortBy === col.key) {
      onSortChange(col.key, sortOrder === "asc" ? "desc" : "asc");
    } else {
      onSortChange(col.key, "desc");
    }
  };

  const totalCols = columns.length + (hasSelection ? 1 : 0);

  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-200 bg-white">
            {hasSelection && (
              <th className="w-10 px-3 py-2.5 text-left">
                <Checkbox
                  checked={allSelected ? true : someSelected ? "indeterminate" : false}
                  onCheckedChange={toggleAll}
                />
              </th>
            )}
            {columns.map((col) => {
              const isSortActive = sortBy === col.key;
              return (
                <th
                  key={col.key}
                  onClick={() => handleSortClick(col)}
                  className={cn(
                    "px-3 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wide",
                    col.sortable && onSortChange && "cursor-pointer select-none hover:text-gray-700",
                    isSortActive && "text-gray-700",
                    col.width,
                    col.headerClassName
                  )}
                >
                  {col.sortable && onSortChange ? (
                    <span className="inline-flex items-center gap-1">
                      {col.header}
                      {isSortActive ? (
                        sortOrder === "asc" ? (
                          <ChevronUp className="h-3 w-3 text-blue-600" />
                        ) : (
                          <ChevronDown className="h-3 w-3 text-blue-600" />
                        )
                      ) : (
                        <ChevronsUpDown className="h-3 w-3 opacity-30" />
                      )}
                    </span>
                  ) : (
                    col.header
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {isLoading ? (
            <TableSkeleton colCount={totalCols} />
          ) : data.length === 0 ? (
            <tr>
              <td colSpan={totalCols} className="py-12">
                <EmptyState message={emptyMessage} />
              </td>
            </tr>
          ) : (
            data.map((row, index) => {
              const id = getRowId(row);
              const isActive = activeRowId != null && activeRowId === id;
              const isSelected = selectedIds?.has(id);
              const isEvenRow = index % 2 === 1;

              return (
                <tr
                  key={id}
                  onClick={() => onRowClick?.(row)}
                  className={cn(
                    "border-b border-gray-100 transition-colors",
                    onRowClick && "cursor-pointer",
                    isActive
                      ? "bg-blue-50"
                      : isSelected
                      ? "bg-blue-50/50"
                      : isEvenRow
                      ? "bg-gray-50/40 hover:bg-gray-100/60"
                      : "hover:bg-gray-50",
                    rowClassName?.(row)
                  )}
                >
                  {hasSelection && (
                    <td
                      className="w-10 px-3 py-2.5"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleRow(id);
                      }}
                    >
                      <Checkbox checked={isSelected ?? false} />
                    </td>
                  )}
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={cn("px-3 py-2.5 text-sm text-gray-700", col.className)}
                      style={{ height: "44px" }}
                    >
                      {col.cell(row)}
                    </td>
                  ))}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
