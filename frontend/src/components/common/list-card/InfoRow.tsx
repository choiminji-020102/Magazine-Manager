import React from "react";

export function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-2 leading-tight">
      <span className="text-gray-400 w-14 shrink-0">{label}</span>
      <span className="text-gray-700 break-all flex-1">{value}</span>
    </div>
  );
}
