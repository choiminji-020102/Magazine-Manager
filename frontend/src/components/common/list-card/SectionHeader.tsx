import React from "react";

export function SectionHeader({
  title,
  children,
}: {
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="h-9 px-3 bg-gray-100 flex items-center gap-1.5">
      <span className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
        {title}
      </span>
      {children}
    </div>
  );
}
