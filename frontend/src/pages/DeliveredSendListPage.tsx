import { useState, useMemo, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { EmptyState } from "@/components/common/EmptyState";
import { FilterBar } from "@/components/common/FilterBar";
import { PageHeader } from "@/components/common/PageHeader";
import { Pagination } from "@/components/common/Pagination";
import { SlidingPanel } from "@/components/common/SlidingPanel";
import { CheckCircle2 } from "lucide-react";
import SendDetailPanel from "@/components/dispatch/SendDetailPanel";
import DeliveredSendCard from "@/components/dispatch/DeliveredSendCard";
import { sendsApi } from "@/api/sendsApi";
import { vipSlotsApi } from "@/api/vipSlotsApi";
import { activityLogsApi } from "@/api/activityLogsApi";
import type { DispatchScope } from "@/types/dispatch";
import type { ActivityLogResponse } from "@/types/activityLog";

const LIMIT = 20;

function vipSlotOf(scope: DispatchScope): number | null {
  if (scope.startsWith("vip")) {
    const n = Number(scope.slice(3));
    if (n >= 1 && n <= 6) return n;
  }
  return null;
}

export default function DeliveredSendListPage() {
  const queryClient = useQueryClient();
  const [scope, setScope] = useState<DispatchScope>("monthly");
  const [issueInput, setIssueInput] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [recipientPhone, setRecipientPhone] = useState("");
  const [page, setPage] = useState(1);

  // 박스 상세 패널 — 운송장/메모 편집은 패널에서 처리 (PR-C2 에서 신설)
  const [detailSendId, setDetailSendId] = useState<number | null>(null);

  const issueValid = /^\d{6}$/.test(issueInput);
  const vipSlot = vipSlotOf(scope);
  const isVip = vipSlot !== null;

  // 활성 VIP 그룹
  const { data: vipSlots = [] } = useQuery({
    queryKey: ["vip-slots"],
    queryFn: () => vipSlotsApi.getVipSlots().then((r) => r.data.data ?? []),
    staleTime: 5 * 60 * 1000,
  });
  const activeVipSlots = useMemo(() => vipSlots.filter((s) => s.is_enabled), [vipSlots]);

  // 비활성 vip 탭에 머무르면 monthly fallback
  useEffect(() => {
    if (vipSlot === null || vipSlots.length === 0) return;
    const slotMeta = vipSlots.find((s) => s.slot_number === vipSlot);
    if (!slotMeta || !slotMeta.is_enabled) {
      setScope("monthly");
      setPage(1);
      setIssueInput("");
      setRecipientName("");
      setRecipientPhone("");
    }
  }, [vipSlot, vipSlots]);

  // DELIVERED 박스 목록
  const { data: sendsData, isLoading } = useQuery({
    queryKey: ["delivered-sends", scope, issueInput, recipientName, recipientPhone, page],
    queryFn: () =>
      sendsApi
        .getSends({
          page,
          limit: LIMIT,
          send_status: "DELIVERED",
          product_kind: isVip ? null : scope === "monthly" ? "MONTHLY" : "YEARLY",
          vip_slot_number: vipSlot,
          issue: issueValid ? issueInput : null,
          recipient_name: recipientName || null,
          recipient_phone: recipientPhone || null,
          sort_by: "delivered_at",
          sort_order: "desc",
        })
        .then((r) => r.data),
  });

  const sends = sendsData?.items ?? [];
  const totalPages = sendsData?.total_pages ?? 1;
  const total = sendsData?.total ?? 0;

  // 카드 표시용 SendItem 은 list 응답에 인라인으로 함께 옴 (N+1 제거).
  // SendDetailPanel 의 ["send-detail", id] 캐시도 함께 채워 둠 (패널 즉시 표시).
  useEffect(() => {
    if (!sendsData) return;
    sendsData.items.forEach((s) => {
      queryClient.setQueryData(["send-detail", s.send_id], s);
    });
  }, [sendsData, queryClient]);

  // 보이는 박스들의 RESEND 활동 로그 — target_ids 로 좁혀 한 번 조회
  const sendIdsOnPage = useMemo(() => sends.map((s) => s.send_id), [sends]);
  const { data: resendLogs = [] } = useQuery({
    queryKey: ["delivered-resend-logs", sendIdsOnPage],
    queryFn: () =>
      activityLogsApi
        .getActivityLogs({
          page: 1,
          limit: 100,
          target_type: "SEND",
          action: "RESEND",
          target_ids: sendIdsOnPage,
        })
        .then((r) => r.data.items ?? []),
    enabled: sendIdsOnPage.length > 0,
  });
  const resendsBySendId = useMemo(() => {
    const map = new Map<number, ActivityLogResponse[]>();
    for (const log of resendLogs) {
      if (log.target_id == null) continue;
      const arr = map.get(log.target_id) ?? [];
      arr.push(log);
      map.set(log.target_id, arr);
    }
    for (const arr of map.values()) {
      // created_at ASC 정렬 — DeliveredSendCard 가 resendLogs[length-1] 로 '가장 최근'
      // 도출하는 데 의존. 백엔드 활동 로그 API 는 DESC 반환이라 여기서 재정렬 필수.
      arr.sort((a, b) => a.created_at.localeCompare(b.created_at));
    }
    return map;
  }, [resendLogs]);

  const handleTabChange = (next: string) => {
    setScope(next as DispatchScope);
    setPage(1);
    setIssueInput("");
    setRecipientName("");
    setRecipientPhone("");
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      {/* 탭 */}
      <Tabs value={scope} onValueChange={handleTabChange}>
        <div className="px-5 py-3 bg-white border-b border-gray-200">
          <TabsList>
            <TabsTrigger value="monthly">단품</TabsTrigger>
            <TabsTrigger value="yearly">정기</TabsTrigger>
            {activeVipSlots.map((s) => (
              <TabsTrigger key={s.slot_number} value={`vip${s.slot_number}`}>
                {s.label || `VIP ${s.slot_number}`}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
      </Tabs>

      <PageHeader
        left={<span className="text-sm text-gray-500">총 {total}건</span>}
      />

      <FilterBar
        basic={
          <>
            <Input
              className="w-32 font-mono"
              placeholder="발송 호 (YYYYMM)"
              value={issueInput}
              maxLength={6}
              onChange={(e) => { setIssueInput(e.target.value.replace(/\D/g, "")); setPage(1); }}
            />
            {issueInput && !issueValid && (
              <span className="text-xs text-red-500">6자리 입력</span>
            )}
            <Input
              className="w-32"
              placeholder="수령인 이름"
              value={recipientName}
              onChange={(e) => { setRecipientName(e.target.value); setPage(1); }}
            />
            <Input
              className="w-36 font-mono"
              placeholder="수령인 연락처"
              value={recipientPhone}
              onChange={(e) => { setRecipientPhone(e.target.value.replace(/\D/g, "")); setPage(1); }}
            />
          </>
        }
        hasActiveFilters={!!(issueInput || recipientName || recipientPhone)}
        onReset={() => { setIssueInput(""); setRecipientName(""); setRecipientPhone(""); setPage(1); }}
        chips={[
          ...(issueInput && issueValid ? [{ label: `호: ${issueInput}`, onRemove: () => { setIssueInput(""); setPage(1); } }] : []),
          ...(recipientName ? [{ label: `이름: ${recipientName}`, onRemove: () => { setRecipientName(""); setPage(1); } }] : []),
          ...(recipientPhone ? [{ label: `연락처: ${recipientPhone}`, onRemove: () => { setRecipientPhone(""); setPage(1); } }] : []),
        ]}
      />

      {/* 박스 목록 — 카드 그리드 */}
      <div className="flex-1 overflow-auto bg-gray-50 px-5 py-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <LoadingSpinner size="lg" />
          </div>
        ) : sends.length === 0 ? (
          <EmptyState
            icon={<CheckCircle2 className="h-10 w-10 mb-2 opacity-40" />}
            message="발송 완료 항목이 없습니다"
            description="발송 처리 후 여기에 표시됩니다. 필터를 사용 중이라면 변경해 보세요."
          />
        ) : (
          <div className="space-y-3">
            {sends.map((s) => (
              <DeliveredSendCard
                key={s.send_id}
                send={s}
                detail={s}
                detailError={false}
                resendLogs={resendsBySendId.get(s.send_id) ?? []}
                onCardClick={() => setDetailSendId(s.send_id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* 박스 상세 패널 — 운송장 / admin_memo 편집은 여기서 */}
      <SlidingPanel open={detailSendId !== null} onClose={() => setDetailSendId(null)}>
        {detailSendId !== null && (
          <SendDetailPanel
            sendId={detailSendId}
            onClose={() => setDetailSendId(null)}
          />
        )}
      </SlidingPanel>

      {/* 페이지네이션 */}
      {sendsData && (
        <div className="bg-white border-t border-gray-200">
          <Pagination
            page={page}
            totalPages={totalPages}
            total={total}
            limit={LIMIT}
            onPageChange={setPage}
          />
        </div>
      )}
    </div>
  );
}
