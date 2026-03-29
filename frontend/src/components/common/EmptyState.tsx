import { Inbox } from "lucide-react";
import { cn } from "@/utils/cn";

interface EmptyStateProps {
  message?: string;
  description?: string;
  icon?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  message = "데이터가 없습니다.",
  description,
  icon,
  className,
}: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-10 text-gray-400", className)}>
      {icon ?? <Inbox className="h-8 w-8 mb-2 opacity-40" />}
      <p className="text-sm">{message}</p>
      {description && <p className="text-xs mt-1 opacity-70">{description}</p>}
    </div>
  );
}
