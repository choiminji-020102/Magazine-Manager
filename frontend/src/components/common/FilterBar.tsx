import { useState } from "react";
import { SlidersHorizontal, X, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface FilterChip {
  label: string;
  onRemove: () => void;
}

interface FilterBarProps {
  basic: React.ReactNode;
  advanced?: React.ReactNode;
  advancedActiveCount?: number;
  hasActiveFilters?: boolean;
  onReset?: () => void;
  chips?: FilterChip[];
  // true이면 토글 버튼을 숨기고 고급 필터를 항상 펼친 상태로 표시
  alwaysExpanded?: boolean;
  // 우측에 노출할 페이지 액션(예: 등록 버튼). 토글 버튼 자리에 함께 배치됨
  actions?: React.ReactNode;
}

export function FilterBar({
  basic,
  advanced,
  advancedActiveCount = 0,
  hasActiveFilters = false,
  onReset,
  chips = [],
  alwaysExpanded = false,
  actions,
}: FilterBarProps) {
  const [expanded, setExpanded] = useState(false);
  const showAdvanced = alwaysExpanded || expanded;

  return (
    <div className="bg-white border-b border-gray-200">
      {/* 기본 필터 행 */}
      <div className="flex items-center gap-2 px-5 py-2.5 flex-wrap">
        {basic}
        <div className="flex items-center gap-1.5 ml-auto">
          {advanced && !alwaysExpanded && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setExpanded((v) => !v)}
              className={`gap-1.5 ${
                expanded || advancedActiveCount > 0
                  ? "border-blue-300 text-blue-600 bg-blue-50 hover:bg-blue-100"
                  : ""
              }`}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              상세 필터
              {advancedActiveCount > 0 && (
                <span className="flex items-center justify-center w-4 h-4 rounded-full bg-blue-600 text-white text-[10px] font-bold">
                  {advancedActiveCount}
                </span>
              )}
              {expanded ? (
                <ChevronUp className="h-3 w-3" />
              ) : (
                <ChevronDown className="h-3 w-3" />
              )}
            </Button>
          )}
          {hasActiveFilters && onReset && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onReset}
              className="gap-1 text-gray-400 hover:text-gray-700"
            >
              <X className="h-3.5 w-3.5" />
              초기화
            </Button>
          )}
          {actions}
        </div>
      </div>

      {/* 고급 필터 행 */}
      {showAdvanced && advanced && (
        <div
          className={`flex items-center gap-2 px-5 py-2.5 flex-wrap border-t border-gray-100 ${
            alwaysExpanded ? "bg-white" : "bg-gray-50"
          }`}
        >
          {advanced}
        </div>
      )}

      {/* 활성 필터 칩 행 */}
      {chips.length > 0 && (
        <div className="flex items-center gap-1.5 px-5 py-2 flex-wrap border-t border-gray-100">
          {chips.map((chip, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs font-medium border border-blue-200"
            >
              {chip.label}
              <button
                onClick={chip.onRemove}
                className="hover:text-blue-900 flex-shrink-0"
                aria-label="필터 제거"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
