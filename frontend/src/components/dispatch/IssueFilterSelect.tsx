import { useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { formatIssue } from "@/utils/format";

// 발송 후보/발송 완료 목록의 '발송 호' 필터 — YYYYMM 6자리를 직접 입력하는 대신
// 연도를 넘기며 월을 고르는 월 선택 달력. 값은 이전처럼 YYYYMM 문자열이라
// 서버로 보내는 형식과 호출부는 그대로다.
const MIN_YEAR = 2000;
const MAX_YEAR = 2100;
const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

interface Props {
  // 선택된 호(YYYYMM). 빈 문자열이면 '전체 호'
  value: string;
  onChange: (issue: string) => void;
  disabled?: boolean;
}

export default function IssueFilterSelect({ value, onChange, disabled }: Props) {
  const currentYear = new Date().getFullYear();

  const selectedYear = /^\d{6}$/.test(value) ? Number(value.slice(0, 4)) : null;
  const selectedMonth = /^\d{6}$/.test(value) ? Number(value.slice(4, 6)) : null;

  const [open, setOpen] = useState(false);
  // 달력에 보이는 연도 — 열 때마다 선택된 호의 연도(없으면 올해)로 되돌린다
  const [viewYear, setViewYear] = useState(selectedYear ?? currentYear);

  const handleOpenChange = (next: boolean) => {
    if (next) setViewYear(selectedYear ?? currentYear);
    setOpen(next);
  };

  const pick = (month: number) => {
    onChange(`${viewYear}${String(month).padStart(2, "0")}`);
    setOpen(false);
  };

  const clear = () => {
    onChange("");
    setOpen(false);
  };

  return (
    <Popover.Root open={open} onOpenChange={handleOpenChange}>
      <Popover.Trigger asChild>
        <button
          type="button"
          disabled={disabled}
          aria-label={value ? `발송 호: ${formatIssue(value)}` : "발송 호: 전체"}
          className="flex h-8 w-40 items-center justify-between gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-0 focus:border-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <CalendarDays className="h-3.5 w-3.5 flex-shrink-0 text-gray-400" />
          <span className={`flex-1 text-left truncate ${value ? "text-gray-900" : "text-gray-400"}`}>
            {value ? formatIssue(value) : "전체 호"}
          </span>
          <ChevronDown className="h-3.5 w-3.5 flex-shrink-0 opacity-50" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={4}
          className="z-50 w-60 rounded-md border border-gray-200 bg-white p-3 text-gray-900 shadow-md data-[state=open]:animate-fade-in"
        >
          {/* 연도 이동 */}
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              aria-label="이전 연도"
              disabled={viewYear <= MIN_YEAR}
              onClick={() => setViewYear((y) => y - 1)}
              className="rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-900 disabled:opacity-30 disabled:hover:bg-transparent"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm font-semibold">{viewYear}년</span>
            <button
              type="button"
              aria-label="다음 연도"
              disabled={viewYear >= MAX_YEAR}
              onClick={() => setViewYear((y) => y + 1)}
              className="rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-900 disabled:opacity-30 disabled:hover:bg-transparent"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* 월 선택 — 선택된 호만 파란 채움으로 표시 (이번 달 표시는 두지 않는다) */}
          <div className="grid grid-cols-4 gap-1">
            {MONTHS.map((m) => {
              const isSelected = selectedYear === viewYear && selectedMonth === m;
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => pick(m)}
                  className={`h-8 rounded text-sm transition-colors ${
                    isSelected
                      ? "bg-blue-600 font-semibold text-white hover:bg-blue-700"
                      : "text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  {m}월
                </button>
              );
            })}
          </div>

          {/* 필터 해제 */}
          <div className="mt-2 border-t border-gray-100 pt-2">
            <button
              type="button"
              onClick={clear}
              className={`w-full rounded py-1 text-xs hover:bg-gray-100 ${
                value ? "text-gray-600" : "font-semibold text-blue-600"
              }`}
            >
              전체 호
            </button>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
