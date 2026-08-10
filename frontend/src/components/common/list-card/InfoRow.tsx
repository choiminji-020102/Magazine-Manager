export function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-2 leading-tight">
      {/* w-20 — text-xs 기준 한글 6자(배송 요청사항)까지 한 줄에 들어가는 폭.
          w-14 시절엔 '관리자메모'(5자)도 칸을 넘겼다. nowrap 으로 공백 줄바꿈도 막는다. */}
      <span className="text-gray-400 w-20 shrink-0 whitespace-nowrap">{label}</span>
      <span className="text-gray-700 break-all flex-1">{value}</span>
    </div>
  );
}
