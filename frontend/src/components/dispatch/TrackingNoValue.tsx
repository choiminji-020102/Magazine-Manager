import { ExternalLink } from "lucide-react";
import type { CourierCompany } from "@/types/send";

// 송장 번호 표시 — 발송 완료 카드(DeliveredSendCard) / 발송 상세 패널(SendDetailPanel) 공용.
//
// CJ대한통운 조회 링크는 courier_company 가 'CJ대한통운' 일 때만 건다.
// 실 데이터는 자체배송(기출유우편·일반우편·찾아가기)이 99% 이고 그 번호는 CJ 조회 페이지에
// 존재하지 않는다 — 운송사를 보지 않고 tracking_no 만으로 링크를 걸면 대부분이
// '조회 결과 없음' 으로 떨어지는 죽은 링크가 된다.
//
// 카드 안에서도 쓰이므로 링크 클릭이 카드 onClick(상세 패널 열기)까지 번지지 않게 막는다.
// 두 필드 모두 SendResponse 에서 Optional(`?`) 이라 undefined 를 함께 받는다.
// courierCompany 를 string 이 아니라 CourierCompany 로 받는 이유 — 아래 리터럴 비교가
// 타입으로 묶여 있어야 백엔드 Enum 값이 바뀔 때 tsc 가 이 자리를 짚어준다.
export function TrackingNoValue({
  trackingNo,
  courierCompany,
}: {
  trackingNo?: string | null;
  courierCompany?: CourierCompany | null;
}) {
  // font-mono 는 값이 있을 때만 — 숫자 자릿수를 맞춰 읽기 쉬우라고 쓰는 것이라
  // 빈 값 '-' 에까지 씌우면 모노스페이스 고정폭 때문에 하이픈만 길어 보인다.
  if (!trackingNo) return <>-</>;

  if (courierCompany !== "CJ대한통운") {
    return <span className="font-mono text-gray-700">{trackingNo}</span>;
  }

  return (
    <a
      href={`https://www.cjlogistics.com/ko/tool/parcel/tracking?gnbInvcNo=${encodeURIComponent(trackingNo)}`}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      title="CJ대한통운에서 조회"
      className="font-mono text-gray-700 inline-flex items-center gap-1 group hover:underline"
    >
      {trackingNo}
      <ExternalLink className="h-3 w-3 text-gray-400 group-hover:text-gray-700" />
    </a>
  );
}
