import React, { useState } from "react";
import {
  Search,
  Filter,
  ChevronDown,
} from "lucide-react";
import Button from "./Button";
import Card from "./Card";
import { cn } from "../../utils/cn";

interface FilterField {
  key: string;
  label: string;
  type: "text" | "select" | "date" | "dateRange";
  placeholder?: string;
  options?: { value: string; label: string }[];
}

interface SearchFilterProps {
  searchPlaceholder?: string;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  filters?: FilterField[];
  filterValues?: Record<string, string>;
  onFilterChange?: (key: string, value: string) => void;
  onReset?: () => void;
  onApply?: () => void;
  collapsible?: boolean;
  className?: string;
}

const SearchFilter: React.FC<SearchFilterProps> = ({
  searchPlaceholder = "검색어를 입력하세요",
  searchValue = "",
  onSearchChange,
  filters = [],
  filterValues = {},
  onFilterChange,
  onReset,
  onApply,
  collapsible = false, // 기본값을 false로 변경하여 항상 열려있도록
  className,
}) => {
  const [isExpanded, setIsExpanded] = useState(collapsible ? false : true);

  return (
    <Card className={cn("unified-card overflow-hidden mb-6", className)} padding="none">
      <div className="p-4 bg-gradient-to-r from-paper to-white">
        {/* Search Bar */}
        <div className="flex items-center gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted" />
            <input
              type="text"
              value={searchValue}
              onChange={(e) => onSearchChange?.(e.target.value)}
              placeholder={searchPlaceholder}
              className="unified-input pl-10 w-full"
            />
          </div>
          {filters.length > 0 && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-md font-medium transition-all ${
                isExpanded
                  ? "bg-accent text-white"
                  : "bg-white text-ink border border-line hover:border-accent/30"
              }`}
            >
              <Filter className="w-4 h-4" />
              필터
              <ChevronDown
                className={`w-4 h-4 transition-transform ${
                  isExpanded ? "rotate-180" : ""
                }`}
              />
            </button>
          )}
        </div>

        {/* Filters */}
        {isExpanded && filters.length > 0 && (
          <div className="mt-4 pt-4 border-t border-line">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {filters.map((filter) => (
                <div key={filter.key}>
                  <label className="unified-label">
                    {filter.label}
                  </label>
                  {filter.type === "select" ? (
                    <select
                      value={filterValues[filter.key] || ""}
                      onChange={(e) =>
                        onFilterChange?.(filter.key, e.target.value)
                      }
                      className="unified-input w-full"
                    >
                      <option value="">전체</option>
                      {filter.options?.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  ) : filter.type === "date" ? (
                    <input
                      type="date"
                      value={filterValues[filter.key] || ""}
                      onChange={(e) =>
                        onFilterChange?.(filter.key, e.target.value)
                      }
                      className="unified-input w-full"
                    />
                  ) : filter.type === "dateRange" ? (
                    <div className="flex items-center gap-3">
                      <input
                        type="date"
                        value={filterValues[`${filter.key}Start`] || ""}
                        onChange={(e) =>
                          onFilterChange?.(`${filter.key}Start`, e.target.value)
                        }
                        className="unified-input flex-1"
                      />
                      <span className="text-muted">~</span>
                      <input
                        type="date"
                        value={filterValues[`${filter.key}End`] || ""}
                        onChange={(e) =>
                          onFilterChange?.(`${filter.key}End`, e.target.value)
                        }
                        className="unified-input flex-1"
                      />
                    </div>
                  ) : (
                    <input
                      type="text"
                      value={filterValues[filter.key] || ""}
                      onChange={(e) =>
                        onFilterChange?.(filter.key, e.target.value)
                      }
                      placeholder={filter.placeholder}
                      className="unified-input w-full"
                    />
                  )}
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={onReset}
                className="unified-btn-ghost"
              >
                초기화
              </Button>
              <Button size="sm" onClick={onApply} className="unified-btn">
                검색
              </Button>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
};

export default SearchFilter;
