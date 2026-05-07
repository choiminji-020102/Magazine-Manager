import { useState, useMemo, useEffect } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { Pagination } from "@/components/common/Pagination";
import SendDetailPanel from "@/components/dispatch/SendDetailPanel";
import DeliveredSendCard from "@/components/dispatch/DeliveredSendCard";
import { sendsApi } from "@/api/sendsApi";
import { vipSlotsApi } from "@/api/vipSlotsApi";
import { activityLogsApi } from "@/api/activityLogsApi";
import type { SendDetailResponse } from "@/types/send";
import type { DispatchScope } from "@/types/dispatch";
import type { ActivityLogResponse } from "@/types/activityLog";

const LIMIT = 50;

function vipSlotOf(scope: DispatchScope): number | null {
  if (scope.startsWith("vip")) {
    const n = Number(scope.slice(3));
    if (n >= 1 && n <= 6) return n;
  }
  return null;
}

export default function DeliveredSendListPage() {
  const [scope, setScope] = useState<DispatchScope>("monthly");
  const [issueInput, setIssueInput] = useState("");
  const [page, setPage] = useState(1);

  // 박스 상세 패널 — 운송장/메모 편집은 패널에서 처리 (PR-C2 에서 신설)
  const [detailSendId, setDetailSendId] = useState<number | null>(null);

  const issueValid = /^\d{6}$/.test(issueInput);
  const vipSlot = vipSlotOf(scope);
  const isVip = vipSlot !== null;

  // 활성 VIP 슬롯
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
    }
  }, [vipSlot, vipSlots]);

  // DELIVERED 박스 목록
  const { data: sendsData, isLoading } = useQuery({
    queryKey: ["delivered-sends", scope, issueInput, page],
    queryFn: () =>
      sendsApi
        .getSends({
          page,
          limit: LIMIT,
          send_status: "DELIVERED",
          product_kind: isVip ? null : scope === "monthly" ? "MONTHLY" : "YEARLY",
          vip_slot_number: vipSlot,
          issue: issueValid ? issueInput : null,
          sort_by: "delivered_at",
          sort_order: "desc",
        })
        .then((r) => r.data),
  });

  const sends = sendsData?.items ?? [];
  const totalPages = sendsData?.total_pages ?? 1;
  const total = sendsData?.total ?? 0;

  // 박스마다 detail 병렬 호출 — TransitionToDeliveredModal 와 queryKey 공유 (캐시 재사용)
  const detailQueries = useQueries({
    queries: sends.map((s) => ({
      queryKey: ["send-detail", s.send_id],
      queryFn: () => sendsApi.getSend(s.send_id).then((r) => r.data.data!),
      staleTime: 60 * 1000,
    })),
  });
  const detailBySendId = useMemo(() => {
    const map = new Map<number, SendDetailResponse>();
    detailQueries.forEach((q, i) => {
      if (q.data) map.set(sends[i].send_id, q.data);
    });
    return map;
  }, [detailQueries, sends]);
  const errorBySendId = useMemo(() => {
    const set = new Set<number>();
    detailQueries.forEach((q, i) => {
      if (q.isError) set.add(sends[i].send_id);
    });
    return set;
  }, [detailQueries, sends]);

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
      arr.sort((a, b) => a.created_at.localeCompare(b.created_at));
    }
    return map;
  }, [resendLogs]);

  const handleTabChange = (next: string) => {
    setScope(next as DispatchScope);
    setPage(1);
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      {/* 탭 */}
      <Tabs value={scope} onValueChange={handleTabChange} className="bg-white border-b border-gray-200">
        <TabsList className="ml-5 mt-2">
          <TabsTrigger value="monthly">단품</TabsTrigger>
          <TabsTrigger value="yearly">정기</TabsTrigger>
          {activeVipSlots.map((s) => (
            <TabsTrigger key={s.slot_number} value={`vip${s.slot_number}`}>
              {s.label || `VIP ${s.slot_number}`}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* 호 필터 */}
      <div className="px-5 py-3 bg-white border-b border-gray-200 flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Label className="text-xs text-gray-500">발송 호</Label>
          <Input
            className="w-32 font-mono"
            placeholder="YYYYMM (전체)"
            value={issueInput}
            maxLength={6}
            onChange={(e) => {
              setIssueInput(e.target.value.replace(/\D/g, ""));
              setPage(1);
            }}
          />
          {issueInput && !issueValid && (
            <span className="text-xs text-red-500">6자리 입력</span>
          )}
        </div>
      </div>

      {/* 박스 목록 — 카드 그리드 */}
      <div className="flex-1 overflow-auto bg-gray-50 px-5 py-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <LoadingSpinner size="lg" />
          </div>
        ) : sends.length === 0 ? (
          <div className="text-center py-16 text-sm text-gray-500">
            조건에 맞는 DELIVERED 박스가 없습니다.
          </div>
        ) : (
          <div className="space-y-3">
            {sends.map((s) => (
              <DeliveredSendCard
                key={s.send_id}
                send={s}
                detail={detailBySendId.get(s.send_id)}
                detailError={errorBySendId.has(s.send_id)}
                resendLogs={resendsBySendId.get(s.send_id) ?? []}
                onCardClick={() => setDetailSendId(s.send_id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* 박스 상세 패널 — 운송장 / admin_memo 편집은 여기서 */}
      <SendDetailPanel
        open={detailSendId !== null}
        onClose={() => setDetailSendId(null)}
        sendId={detailSendId}
      />

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <div className="px-5 py-2 bg-white border-t border-gray-200">
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
