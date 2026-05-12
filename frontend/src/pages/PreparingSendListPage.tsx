import { useState, useMemo, useEffect } from "react";
import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { EmptyState } from "@/components/common/EmptyState";
import { Pagination } from "@/components/common/Pagination";
import { Package } from "lucide-react";
import RegeneratePreparingConfirmModal from "@/components/dispatch/RegeneratePreparingConfirmModal";
import AddToPreparingYearlyModal from "@/components/dispatch/AddToPreparingYearlyModal";
import TransitionToDeliveredModal from "@/components/dispatch/TransitionToDeliveredModal";
import SendDetailPanel from "@/components/dispatch/SendDetailPanel";
import PreparingSendCard from "@/components/dispatch/PreparingSendCard";
import MonthlyExcelDialog from "@/components/dispatch-excel/MonthlyExcelDialog";
import YearlyExcelDialog from "@/components/dispatch-excel/YearlyExcelDialog";
import VipExcelDialog from "@/components/dispatch-excel/VipExcelDialog";
import { sendsApi } from "@/api/sendsApi";
import { dispatchApi } from "@/api/dispatchApi";
import { vipSlotsApi } from "@/api/vipSlotsApi";
import type { SendDetailResponse } from "@/types/send";
import type { DispatchScope, PaidNotPreparedCountResponse } from "@/types/dispatch";

const LIMIT = 50;

// scope 가 vipN 이면 슬롯 번호 반환, 그 외 null
function vipSlotOf(scope: DispatchScope): number | null {
  if (scope.startsWith("vip")) {
    const n = Number(scope.slice(3));
    if (n >= 1 && n <= 6) return n;
  }
  return null;
}

export default function PreparingSendListPage() {
  const queryClient = useQueryClient();
  const [scope, setScope] = useState<DispatchScope>("monthly");
  const [issueInput, setIssueInput] = useState("");
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [regenerateOpen, setRegenerateOpen] = useState(false);
  const [excelOpen, setExcelOpen] = useState<
    null | "monthly" | "yearly-gichulyu" | "yearly-postoffice" | "vip"
  >(null);
  const [transitionOpen, setTransitionOpen] = useState(false);
  const [detailSendId, setDetailSendId] = useState<number | null>(null);

  const issueValid = /^\d{6}$/.test(issueInput);
  const vipSlot = vipSlotOf(scope);
  const isVip = vipSlot !== null;

  // 활성 VIP 슬롯 (동적 탭 렌더링용)
  const { data: vipSlots = [] } = useQuery({
    queryKey: ["vip-slots"],
    queryFn: () => vipSlotsApi.getVipSlots().then((r) => r.data.data ?? []),
    staleTime: 5 * 60 * 1000,
  });
  const activeVipSlots = useMemo(() => vipSlots.filter((s) => s.is_enabled), [vipSlots]);

  // 현재 scope 가 vipN 인데 그 슬롯이 비활성으로 바뀌었으면 monthly 로 fallback (탭 자체가 사라지므로).
  useEffect(() => {
    if (vipSlot === null) return;
    if (vipSlots.length === 0) return; // 슬롯 데이터 로드 전엔 판단 보류
    const slotMeta = vipSlots.find((s) => s.slot_number === vipSlot);
    if (!slotMeta || !slotMeta.is_enabled) {
      setScope("monthly");
      setSelectedIds(new Set());
      setPage(1);
    }
  }, [vipSlot, vipSlots]);

  // 발송 박스 목록 (PREPARING).
  // VIP 탭: vip_slot_number 필터 (product_kind 무관, 정기+단품 혼합 가능)
  // monthly/yearly: product_kind 필터 (KR 강제는 백엔드 그룹핑 단계에서 보장)
  const { data: sendsData, isLoading } = useQuery({
    queryKey: ["preparing-sends", scope, issueInput, page],
    queryFn: () =>
      sendsApi
        .getSends({
          page,
          limit: LIMIT,
          send_status: "PREPARING",
          product_kind: isVip ? null : scope === "monthly" ? "MONTHLY" : "YEARLY",
          vip_slot_number: vipSlot,
          issue: issueValid ? issueInput : null,
          sort_by: "created_at",
          sort_order: "desc",
        })
        .then((r) => r.data),
  });

  const sends = sendsData?.items ?? [];
  const totalPages = sendsData?.total_pages ?? 1;
  const total = sendsData?.total ?? 0;

  // 카운트 배너 (16+2 응답)
  const { data: countData } = useQuery({
    queryKey: ["paid-not-prepared-count"],
    queryFn: () => dispatchApi.getPaidNotPreparedCount().then((r) => r.data.data!),
    refetchInterval: 30 * 1000,
  });

  const counts = useMemo(() => extractCounts(countData, scope), [countData, scope]);

  // 탭 전환 시 페이지·선택 초기화
  const handleTabChange = (next: string) => {
    setScope(next as DispatchScope);
    setPage(1);
    setSelectedIds(new Set());
  };

  // 카드 그리드용 — 박스마다 detail 병렬 호출 (SendItem 인라인 표시).
  // TransitionToDeliveredModal 와 동일 패턴, queryKey 공유로 캐시 재사용.
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

  // 체크박스 헬퍼
  const toggleOne = (sendId: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(sendId)) next.delete(sendId);
      else next.add(sendId);
      return next;
    });
  };
  const allSelected = sends.length > 0 && sends.every((s) => selectedIds.has(s.send_id));
  const toggleAllOnPage = () => {
    if (allSelected) {
      // 현재 페이지 박스만 해제 (다른 페이지 선택은 보존)
      setSelectedIds((prev) => {
        const next = new Set(prev);
        sends.forEach((s) => next.delete(s.send_id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        sends.forEach((s) => next.add(s.send_id));
        return next;
      });
    }
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      {/* 탭 — 단품 / 정기 + 활성 VIP 슬롯만 동적 렌더링 */}
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

      {/* 카운트 배너 + 필터 / 액션 */}
      <div className="px-5 py-3 bg-white border-b border-gray-200 flex items-center gap-4 flex-wrap">
        {/* 호 필터 — 카드 목록 필터링만 담당. 발송 생성/엑셀 다운로드 시 호는 각 모달·다이얼로그 안에서 별도 입력 */}
        <div className="flex items-center gap-2">
          <Label className="text-xs text-gray-500">발송 호 필터</Label>
          <Input
            className="w-32 font-mono"
            placeholder="YYYYMM (선택)"
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

        {/* 카운트 배너 — "총 N건" 은 다른 목록 페이지와 동일 (필터 적용된 PREPARING Send 박스 수).
            "발송 미생성 결제" 는 별도 라벨로 분리 — 단위(OrderItem)·필터(호 무관) 다르므로 괄호로 묶지 않음 */}
        <div className="flex items-center gap-2 text-sm">
          <span className="text-gray-500">총 {total}건</span>
          <span className="text-gray-300">·</span>
          <span className={counts.count > 0 ? "text-orange-600" : "text-gray-400"}>
            🔔 발송 미생성 결제 {counts.count}건
          </span>
        </div>

        {/* 액션 버튼 */}
        <div className="flex items-center gap-2 ml-auto">
          <Button size="sm" variant="outline" onClick={() => setRegenerateOpen(true)}>
            발송 생성
          </Button>
          {scope === "monthly" && (
            <Button size="sm" variant="outline" onClick={() => setExcelOpen("monthly")}>
              엑셀 다운로드
            </Button>
          )}
          {scope === "yearly" && (
            <>
              <Button size="sm" variant="outline" onClick={() => setExcelOpen("yearly-gichulyu")}>
                기출유 엑셀
              </Button>
              <Button size="sm" variant="outline" onClick={() => setExcelOpen("yearly-postoffice")}>
                우체국 엑셀
              </Button>
            </>
          )}
          {isVip && (
            <Button size="sm" variant="outline" onClick={() => setExcelOpen("vip")}>
              엑셀 다운로드
            </Button>
          )}
          {/* 페이지 전체 선택 토글 — 클릭 시 현재 페이지 박스만 토글 (다른 페이지 선택 보존) */}
          <button
            type="button"
            className="text-xs text-gray-500 hover:text-gray-700 underline-offset-2 hover:underline"
            onClick={toggleAllOnPage}
            disabled={sends.length === 0}
          >
            {allSelected ? "이 페이지 해제" : "이 페이지 선택"} ({selectedIds.size}/{sends.length})
          </button>
          <Button
            size="sm"
            disabled={selectedIds.size === 0}
            onClick={() => setTransitionOpen(true)}
          >
            배송완료 처리 ({selectedIds.size}건)
          </Button>
        </div>
      </div>

      {/* 발송 생성 모달 — 정기는 incremental(기존 박스 보존), 단품/VIP 는 전체 재계산.
          호 입력은 모달 안에서 직접 받음 (페이지 상단 '발송 호 필터'와 무관). */}
      {scope === "yearly" ? (
        <AddToPreparingYearlyModal
          open={regenerateOpen}
          onClose={() => setRegenerateOpen(false)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ["preparing-sends"] });
            queryClient.invalidateQueries({ queryKey: ["paid-not-prepared-count"] });
            setSelectedIds(new Set());
          }}
        />
      ) : (
        <RegeneratePreparingConfirmModal
          open={regenerateOpen}
          onClose={() => setRegenerateOpen(false)}
          scope={scope}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ["preparing-sends"] });
            queryClient.invalidateQueries({ queryKey: ["paid-not-prepared-count"] });
            setSelectedIds(new Set());
          }}
        />
      )}

      {/* 엑셀 다운로드 다이얼로그 — 호 입력은 다이얼로그 안에서 직접 받음 */}
      <MonthlyExcelDialog
        open={excelOpen === "monthly"}
        onClose={() => setExcelOpen(null)}
      />
      <YearlyExcelDialog
        open={excelOpen === "yearly-gichulyu" || excelOpen === "yearly-postoffice"}
        onClose={() => setExcelOpen(null)}
        variant={excelOpen === "yearly-gichulyu" ? "gichulyu" : "postoffice"}
      />
      {vipSlot !== null && (
        <VipExcelDialog
          open={excelOpen === "vip"}
          onClose={() => setExcelOpen(null)}
          slotNumber={vipSlot}
          slotLabel={activeVipSlots.find((s) => s.slot_number === vipSlot)?.label ?? null}
        />
      )}

      {/* 배송완료 처리 모달 */}
      <TransitionToDeliveredModal
        open={transitionOpen}
        onClose={() => setTransitionOpen(false)}
        sends={sends.filter((s) => selectedIds.has(s.send_id))}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["preparing-sends"] });
          queryClient.invalidateQueries({ queryKey: ["paid-not-prepared-count"] });
          setSelectedIds(new Set());
        }}
      />

      {/* 박스 목록 — 카드 그리드 */}
      <div className="flex-1 overflow-auto bg-gray-50 px-5 py-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <LoadingSpinner size="lg" />
          </div>
        ) : sends.length === 0 ? (
          <EmptyState
            icon={<Package className="h-10 w-10 mb-2 opacity-40" />}
            message="배송 준비 중인 발송이 없습니다"
            description="결제 완료 시 자동으로 생성됩니다. 호 필터를 사용 중이라면 변경해 보세요."
          />
        ) : (
          <div className="space-y-3">
            {sends.map((s) => (
              <PreparingSendCard
                key={s.send_id}
                send={s}
                detail={detailBySendId.get(s.send_id)}
                detailError={errorBySendId.has(s.send_id)}
                checked={selectedIds.has(s.send_id)}
                onToggleCheck={() => toggleOne(s.send_id)}
                onCardClick={() => setDetailSendId(s.send_id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* 박스 상세 패널 — #11 약점 보강: TransitionToDeliveredModal 진입 전 박스 안 책 종류 확인 가능 */}
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

// 탭별 카운트 추출 (16+2 키 응답에서 scope 별 1쌍 꺼내기, 8개 scope 모두 처리)
function extractCounts(
  data: PaidNotPreparedCountResponse | undefined,
  scope: DispatchScope,
): { count: number; preparing: number } {
  if (!data) return { count: 0, preparing: 0 };
  const countKey = `${scope}_count` as keyof PaidNotPreparedCountResponse;
  const preparingKey = `${scope}_preparing` as keyof PaidNotPreparedCountResponse;
  return {
    count: (data[countKey] as number | undefined) ?? 0,
    preparing: (data[preparingKey] as number | undefined) ?? 0,
  };
}
