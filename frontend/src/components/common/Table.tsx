import React from "react";
import { ChevronDown, ChevronUp, ChevronsUpDown } from "lucide-react";

export interface Column<T = any> {
  key: string;
  label?: string;
  header?: string; // header도 label과 동일하게 처리
  width?: string;
  align?: "left" | "center" | "right";
  sortable?: boolean;
  render?: (value: any, row: T, index: number) => React.ReactNode;
}

export interface TableProps<T = any> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (row: T, index: number) => string | number;
  onSort?: (key: string, direction: "asc" | "desc") => void;
  sortKey?: string;
  sortDirection?: "asc" | "desc";
  emptyMessage?: string;
  hoverable?: boolean;
  onRowClick?: (row: T, index: number) => void;
  className?: string;
  selectable?: boolean;
  selectedRows?: (string | number)[];
  onSelectRow?: (id: string | number) => void;
  onSelectAll?: () => void;
  rowClassName?: (row: T) => string;
}

const Table = <T extends Record<string, any>>({
  columns,
  data,
  keyExtractor,
  onSort,
  sortKey,
  sortDirection,
  emptyMessage = "데이터가 없습니다",
  hoverable = true,
  onRowClick,
  className = "",
  selectable = false,
  selectedRows = [],
  onSelectRow,
  onSelectAll,
  rowClassName,
}: TableProps<T>) => {
  const handleSort = (key: string) => {
    if (!onSort) return;
    const newDirection =
      sortKey === key && sortDirection === "asc" ? "desc" : "asc";
    onSort(key, newDirection);
  };

  const getSortIcon = (key: string) => {
    if (sortKey !== key) {
      return <ChevronsUpDown className="w-4 h-4 text-neutral-400" />;
    }
    return sortDirection === "asc" ? (
      <ChevronUp className="w-4 h-4 text-accent" />
    ) : (
      <ChevronDown className="w-4 h-4 text-accent" />
    );
  };

  const getColumnLabel = (column: Column<T>) => {
    if (column.label !== undefined && column.label !== "") {
      return column.label;
    }
    if (column.header !== undefined && column.header !== "") {
      return column.header;
    }
    return null;
  };

  const allSelected = data.length > 0 && selectedRows.length === data.length;

  return (
    <div className={`overflow-x-auto ${className}`}>
      <table className="w-full border-collapse table-fixed">
        <thead>
          <tr className="border-b border-line bg-primary-50">
            {selectable && (
              <th className="px-4 py-3 w-12">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={onSelectAll}
                  className="w-4 h-4 text-accent border-line rounded focus:ring-accent"
                />
              </th>
            )}
            {columns.map((column) => (
              <th
                key={column.key}
                className={`px-4 py-3 text-xs font-semibold text-muted uppercase tracking-wider ${
                  column.align === "center"
                    ? "text-center"
                    : column.align === "right"
                    ? "text-right"
                    : "text-left"
                } ${column.sortable ? "cursor-pointer select-none" : ""}`}
                style={{ width: column.width }}
                onClick={
                  column.sortable ? () => handleSort(column.key) : undefined
                }
              >
                <div
                  className={`flex items-center gap-2 ${
                    column.align === "center"
                      ? "justify-center"
                      : column.align === "right"
                      ? "justify-end"
                      : "justify-start"
                  }`}
                >
                  {(() => {
                    const label = getColumnLabel(column);
                    return label ? <span>{label}</span> : null;
                  })()}
                  {column.sortable && getSortIcon(column.key)}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length + (selectable ? 1 : 0)}
                className="px-4 py-8 text-center text-sm text-muted"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((row, index) => {
              const rowId = keyExtractor(row, index);
              const isSelected = selectedRows.includes(rowId);
              const customRowClass = rowClassName ? rowClassName(row) : "";

              return (
                <tr
                  key={rowId}
                  className={`border-b border-line ${
                    hoverable ? "hover:bg-chip/50 transition-colors" : ""
                  } ${onRowClick ? "cursor-pointer" : ""} ${
                    isSelected ? "bg-accent/10" : ""
                  } ${customRowClass}`}
                  onClick={
                    onRowClick
                      ? (e) => {
                          // 체크박스나 버튼 클릭 시에는 행 클릭 이벤트 방지
                          const target = e.target as HTMLElement;
                          if (
                            target.closest("input[type='checkbox']") ||
                            target.closest("button") ||
                            target.closest("a")
                          ) {
                            return;
                          }
                          onRowClick(row, index);
                        }
                      : undefined
                  }
                >
                  {selectable && (
                    <td className="px-4 py-3 w-12">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => {
                          e.stopPropagation();
                          onSelectRow?.(rowId);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="w-4 h-4 text-accent border-line rounded focus:ring-accent"
                      />
                    </td>
                  )}
                  {columns.map((column) => {
                    const value = row[column.key];
                    return (
                      <td
                        key={column.key}
                        className={`px-4 py-3 text-sm text-ink ${
                          column.align === "center"
                            ? "text-center"
                            : column.align === "right"
                            ? "text-right"
                            : ""
                        }`}
                      >
                        {column.render
                          ? column.render(value, row, index)
                          : value}
                      </td>
                    );
                  })}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
};

export default Table;
