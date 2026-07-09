import { LoadingSpinner } from "./LoadingSpinner";

interface ProgressBarProps {
  done: number;
  total: number;
  label: string;
}

// 대량 작업(필터 결과 전체 선택, 발송완료 처리 등) 진행 상황 표시 — 스피너 + "N/M건 {label}" + 진행률 바.
export function ProgressBar({ done, total, label }: ProgressBarProps) {
  const pct = total > 0 ? Math.min(100, (done / total) * 100) : 5;
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm text-gray-600">
        <LoadingSpinner size="sm" />
        {done.toLocaleString()} / {total.toLocaleString()}건 {label}
      </div>
      <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
        <div
          className="h-full bg-blue-600 transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
