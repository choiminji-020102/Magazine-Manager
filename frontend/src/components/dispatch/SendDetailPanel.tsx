import { useQuery } from "@tanstack/react-query";
import { SlidingPanel } from "@/components/common/SlidingPanel";
import { StatusBadge } from "@/components/common/StatusBadge";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { sendsApi } from "@/api/sendsApi";
import { activityLogsApi } from "@/api/activityLogsApi";
import { formatDateTime, formatPhone, formatIssue } from "@/utils/format";

interface Props {
  open: boolean;
  onClose: () => void;
  sendId: number | null;
}

// 발송 박스 단위 상세 패널.
// PreparingSendListPage / DeliveredSendListPage 의 행 클릭 시 열림.
// 박스 안 SendItem 책 종류 확인용 (#11 약점 보강) + 재배송 이력 노출.
// 향후 PR6.5.5 에서 [재배송 입력] 섹션 추가 예정.

export default function SendDetailPanel({ open, onClose, sendId }: Props) {
  const { data: sendData, isLoading } = useQuery({
    queryKey: ["send-detail", sendId],
    queryFn: () => sendsApi.getSend(sendId!).then((r) => r.data.data!),
    enabled: open && sendId !== null,
  });

  const { data: resendLogs = [] } = useQuery({
    queryKey: ["send-resend-logs", sendId],
    queryFn: () =>
      activityLogsApi
        .getActivityLogs({
          page: 1,
          limit: 50,
          target_type: "SEND",
          target_id: sendId!,
          action: "RESEND",
        })
        .then((r) => r.data.items ?? []),
    enabled: open && sendId !== null,
  });

  const send = sendData;

  return (
    <SlidingPanel
      open={open}
      onClose={onClose}
      title={send ? `발송 #${send.send_id}` : "발송 상세"}
      width={520}
    >
      {isLoading || !send ? (
        <div className="flex items-center justify-center py-16">
          <LoadingSpinner size="lg" />
        </div>
      ) : (
        <div className="p-4 space-y-5 text-sm">
          {/* 상태 + ID */}
          <div className="flex items-center gap-2">
            <StatusBadge type="send_status" value={send.send_status} />
            <span className="font-mono text-xs text-gray-400">#{send.send_id}</span>
          </div>

          {/* 수령인 / 주소 */}
          <Section title="수령인">
            <Row label="이름">{send.recipient_name}</Row>
            <Row label="연락처">{formatPhone(send.recipient_phone)}</Row>
            <Row label="국가">
              {send.country_code === "KR" ? (
                <span>대한민국 (KR)</span>
              ) : (
                <span className="px-1 py-0.5 bg-amber-100 text-amber-700 rounded text-xs font-semibold">
                  🌐 {send.country_code}
                </span>
              )}
            </Row>
            <Row label="우편번호">
              <span className="font-mono">{send.postal_code}</span>
            </Row>
            <Row label="주소">{send.recipient_address}</Row>
            {send.customer_memo && <Row label="배송메모">{send.customer_memo}</Row>}
            {send.admin_memo && <Row label="관리자메모">{send.admin_memo}</Row>}
          </Section>

          {/* 묶인 주문 */}
          {send.related_orders.length > 0 && (
            <Section title="묶인 주문">
              <div className="space-y-1">
                {send.related_orders.map((ro) => (
                  <div key={ro.order_id} className="text-xs text-gray-700 flex items-center gap-2">
                    <span className="font-mono text-gray-400">#{ro.order_id}</span>
                    <span>·</span>
                    <span>{ro.customer_name}</span>
                    <span>·</span>
                    <span className="font-mono text-gray-500">{formatPhone(ro.customer_phone)}</span>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* 운송장 */}
          <Section title="운송장">
            <Row label="배송 방법">{send.send_method ?? "-"}</Row>
            <Row label="운송사">{send.courier_company ?? "-"}</Row>
            <Row label="송장 번호">
              <span className="font-mono">{send.tracking_no ?? "-"}</span>
            </Row>
          </Section>

          {/* 박스 안 SendItem 목록 — #11 약점 보강 */}
          <Section title={`박스 내용 (${send.items.length}건)`}>
            {send.items.length === 0 ? (
              <p className="text-xs text-gray-400">발송 품목이 없습니다.</p>
            ) : (
              <table className="w-full text-xs">
                <thead className="text-gray-400 border-b border-gray-100">
                  <tr>
                    <th className="text-left py-1 pr-2 font-normal">상품코드</th>
                    <th className="text-left py-1 pr-2 font-normal">발송호</th>
                    <th className="text-right py-1 font-normal">수량</th>
                  </tr>
                </thead>
                <tbody>
                  {send.items.map((it) => (
                    <tr key={it.send_item_id} className="border-b border-gray-50">
                      <td className="py-1 pr-2 font-mono text-gray-700">{it.product_code}</td>
                      <td className="py-1 pr-2 text-gray-600">{formatIssue(it.issue)}</td>
                      <td className="py-1 text-right font-semibold text-gray-700">{it.send_num}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Section>

          {/* 재배송 이력 */}
          <Section title={`재배송 이력 (${resendLogs.length}건)`}>
            {resendLogs.length === 0 ? (
              <p className="text-xs text-gray-400">재배송 이력이 없습니다.</p>
            ) : (
              <div className="space-y-2">
                {resendLogs.map((log) => {
                  const d = log.details ?? {};
                  return (
                    <div key={log.log_id} className="border border-orange-100 bg-orange-50/50 rounded p-2 space-y-0.5">
                      <div className="text-xs text-gray-500">{formatDateTime(log.created_at)}</div>
                      {d.reason && <div className="text-xs text-gray-700">사유: {d.reason}</div>}
                      {d.send_method && (
                        <div className="text-xs text-gray-700">
                          방법: {d.send_method}
                          {d.courier_company && <span className="text-gray-400"> · {d.courier_company}</span>}
                        </div>
                      )}
                      {d.tracking_no && (
                        <div className="text-xs text-gray-700 font-mono">운송장: {d.tracking_no}</div>
                      )}
                      {d.memo && <div className="text-xs text-gray-500">메모: {d.memo}</div>}
                    </div>
                  );
                })}
              </div>
            )}
          </Section>

          {/* 시스템 메타 */}
          <Section title="시스템">
            <Row label="생성">{formatDateTime(send.created_at)}</Row>
            <Row label="수정">{formatDateTime(send.updated_at)}</Row>
            {send.delivered_at && <Row label="배송완료">{formatDateTime(send.delivered_at)}</Row>}
            {send.cancelled_at && <Row label="취소">{formatDateTime(send.cancelled_at)}</Row>}
          </Section>
        </div>
      )}
    </SlidingPanel>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-1.5">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{title}</h3>
      <div>{children}</div>
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 text-xs">
      <span className="text-gray-400 w-20 shrink-0">{label}</span>
      <span className="text-gray-700">{children}</span>
    </div>
  );
}
