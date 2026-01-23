import React, { useState, useRef, useEffect, ReactNode } from "react";
import {
  Filter,
  Search,
  ChevronDown,
  ArrowUpDown,
  RotateCcw,
  X,
} from "lucide-react";
import Card from "./Card";

export interface FilterField {
  key: string;
  label: string;
  type: "select" | "date" | "dateRange" | "text";
  options?: { value: string; label: string }[];
  placeholder?: string;
}

export interface SortOption {
  key: string;
  direction: "asc" | "desc";
  label: string;
}

export interface ActiveFilter {
  key: string;
  label: string;
  value: string;
  onRemove: () => void;
}

interface SearchFilterBarProps {
  // 검색
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;

  // 필터
  showFilters: boolean;
  onToggleFilters: () => void;
  filterFields?: FilterField[];
  filterValues: Record<string, any>;
  onFilterChange: (key: string, value: any) => void;
  activeFilters?: ActiveFilter[];

  // 정렬
  sortOptions?: SortOption[];
  currentSort?: { key: string; direction: "asc" | "desc" };
  onSortChange?: (key: string, direction: "asc" | "desc") => void;

  // 초기화
  onReset?: () => void;
  hasActiveFilters?: boolean;

  // 커스텀 필터 UI
  customFilterContent?: ReactNode;
}

const SearchFilterBar: React.FC<SearchFilterBarProps> = ({
  searchValue,
  onSearchChange,
  searchPlaceholder = "검색어를 입력하세요",
  showFilters,
  onToggleFilters,
  filterFields = [],
  filterValues,
  onFilterChange,
  activeFilters = [],
  sortOptions = [],
  currentSort,
  onSortChange,
  onReset,
  hasActiveFilters = false,
  customFilterContent,
}) => {
  const [showSortMenu, setShowSortMenu] = useState(false);
  const sortButtonRef = useRef<HTMLDivElement>(null);
  const [sortMenuPosition, setSortMenuPosition] = useState({ top: 0, left: 0 });

  // 외부 클릭 시 정렬 메뉴 닫기 및 위치 계산
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (
        !target.closest(".sort-menu-container") &&
        !target.closest(".sort-menu-dropdown")
      ) {
        setShowSortMenu(false);
      }
    };
    if (showSortMenu && sortButtonRef.current) {
      const rect = sortButtonRef.current.getBoundingClientRect();
      const cardRect = sortButtonRef.current
        .closest(".relative")
        ?.getBoundingClientRect();
      if (cardRect) {
        setSortMenuPosition({
          top: rect.bottom - cardRect.top + 8,
          left: rect.left - cardRect.left,
        });
      }
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showSortMenu]);

  const handleSortClick = (key: string, direction: "asc" | "desc") => {
    onSortChange?.(key, direction);
    setShowSortMenu(false);
  };

  return (
    <div className="relative">
      <Card className="unified-card mb-6 overflow-hidden" padding="none">
        <div className="p-4 bg-gradient-to-r from-paper to-white">
          {/* 상단: 검색 바, 필터 버튼, 정렬 버튼 */}
          <div className="flex items-center gap-3 mb-4">
            {filterFields.length > 0 && (
              <button
                onClick={onToggleFilters}
                className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-md font-medium text-sm transition-all ${
                  showFilters
                    ? "bg-accent text-white"
                    : "bg-white text-ink border border-line hover:border-accent/30"
                }`}
              >
                <Filter className="w-4 h-4" />
                필터
                <ChevronDown
                  className={`w-4 h-4 transition-transform ${
                    showFilters ? "rotate-180" : ""
                  }`}
                />
              </button>
            )}

            {sortOptions.length > 0 && (
              <div
                className="relative sort-menu-container"
                ref={sortButtonRef}
              >
                <button
                  onClick={() => setShowSortMenu(!showSortMenu)}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-md font-medium text-sm bg-white text-ink border border-line hover:border-accent/30 transition-all"
                >
                  <ArrowUpDown className="w-4 h-4" />
                  정렬
                </button>
              </div>
            )}

            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted" />
              <input
                type="text"
                placeholder={searchPlaceholder}
                value={searchValue}
                onChange={(e) => onSearchChange(e.target.value)}
                className="unified-input pl-10 w-full"
              />
            </div>

            {hasActiveFilters && onReset && (
              <button
                onClick={onReset}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-md font-medium text-sm bg-accent text-white hover:bg-accent/90 transition-all"
              >
                <RotateCcw className="w-4 h-4" />
                필터&정렬 초기화
              </button>
            )}
          </div>

          {/* 선택된 필터 태그들 */}
          {activeFilters.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap mb-4">
              {activeFilters.map((filter) => (
                <div
                  key={filter.key}
                  className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-md text-sm font-medium"
                >
                  {filter.label}: {filter.value}
                  <button
                    onClick={filter.onRemove}
                    className="hover:text-blue-900"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* 필터 옵션 */}
          {showFilters && (
            <div className="pt-4 border-t border-line">
              {customFilterContent ? (
                customFilterContent
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {filterFields.map((field) => (
                    <div key={field.key}>
                      <label className="unified-label">{field.label}</label>
                      {field.type === "select" && (
                        <select
                          value={filterValues[field.key] || ""}
                          onChange={(e) =>
                            onFilterChange(field.key, e.target.value)
                          }
                          className="unified-input w-full"
                        >
                          <option value="">전체</option>
                          {field.options?.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      )}
                      {field.type === "date" && (
                        <input
                          type="date"
                          value={filterValues[field.key] || ""}
                          onChange={(e) =>
                            onFilterChange(field.key, e.target.value)
                          }
                          className="unified-input w-full"
                        />
                      )}
                      {field.type === "dateRange" && (
                        <div className="flex gap-2">
                          <input
                            type="date"
                            placeholder="시작일"
                            value={filterValues[`${field.key}_start`] || ""}
                            onChange={(e) =>
                              onFilterChange(`${field.key}_start`, e.target.value)
                            }
                            className="unified-input flex-1"
                          />
                          <input
                            type="date"
                            placeholder="종료일"
                            value={filterValues[`${field.key}_end`] || ""}
                            onChange={(e) =>
                              onFilterChange(`${field.key}_end`, e.target.value)
                            }
                            className="unified-input flex-1"
                          />
                        </div>
                      )}
                      {field.type === "text" && (
                        <input
                          type="text"
                          placeholder={field.placeholder}
                          value={filterValues[field.key] || ""}
                          onChange={(e) =>
                            onFilterChange(field.key, e.target.value)
                          }
                          className="unified-input w-full"
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </Card>

      {/* 정렬 메뉴 */}
      {showSortMenu && sortOptions.length > 0 && (
        <div
          className="absolute sort-menu-dropdown bg-white border border-line rounded-md shadow-lg z-[100] min-w-[200px]"
          style={{
            top: `${sortMenuPosition.top}px`,
            left: `${sortMenuPosition.left}px`,
          }}
        >
          {sortOptions.map((option) => (
            <button
              key={`${option.key}-${option.direction}`}
              onClick={() => handleSortClick(option.key, option.direction)}
              className={`w-full text-left px-4 py-2 hover:bg-paper text-sm ${
                currentSort?.key === option.key &&
                currentSort?.direction === option.direction
                  ? "bg-paper font-medium"
                  : ""
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default SearchFilterBar;
