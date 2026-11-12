import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useDebounce } from "@/hooks/useDebounce";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { ProgressBar } from "@/components/common/ProgressBar";
import { EmptyState } from "@/components/common/EmptyState";
import { FilterBar } from "@/components/common/FilterBar";
import { PageHeader } from "@/components/common/PageHeader";
import { Pagination } from "@/components/common/Pagination";
import { SlidingPanel } from "@/components/common/SlidingPanel";
import { FileDown, Package, RefreshCw, X } from "lucide-react";
import RegeneratePreparingConfirmModal from "@/components/dispatch/RegeneratePreparingConfirmModal";
import TransitionToDeliveredModal from "@/components/dispatch/TransitionToDeliveredModal";
import SendDetailPanel from "@/components/dispatch/SendDetailPanel";
import PreparingSendCard from "@/components/dispatch/PreparingSendCard";
import MonthlyExcelDialog from "@/components/dispatch-excel/MonthlyExcelDialog";
import YearlyExcelDialog from "@/components/dispatch-excel/YearlyExcelDialog";
import VipExcelDialog from "@/components/dispatch-excel/VipExcelDialog";
import { sendsApi } from "@/api/sendsApi";
import { dispatchApi } from "@/api/dispatchApi";
import { vipSlotsApi } from "@/api/vipSlotsApi";
import { toast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/utils/errorHandler";
import type { DispatchScope, SendListScope, PaidNotPreparedCountResponse } from "@/types/dispatch";
import type { SendListQuery, SendResponse } from "@/types/send";

const LIMIT = 20;
// 필터 결과 전체 선택 시 페이지 순회에 쓰는 조회 건수 (백엔드 SendListQuery.limit 상한)
const SELECT_ALL_FETCH_LIMIT = 100;

// scope 가 vipN 이면 그룹 번호 반환, 그 외 null
function vipSlotOf(scope: SendListScope): number | null {
  if (scope.startsWith("vip")) {
    const n = Number(scope.slice(3));
    if (n >= 1 && n <= 6) return n;
  }
  return null;
}

export default function PreparingSendListPage() {
  const queryClient = useQueryClient();
  const [scope, setScope] = useState<SendListScope>("all");
  const [issueInput, setIssueInput] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [recipientPhone, setRecipientPhone] = useState("");
  const [addressSearch, setAddressSearch] = useState("");
  const debouncedAddressSearch = useDebounce(addressSearch, 300);
  const [page, setPage] = useState(1);
  // send_id → 선택된 항목의 전체 데이터. "필터 결과 전체 선택"으로 다른 페이지의 항목이
  // 선택될 수 있어, 현재 페이지에 로드된 sends 배열만으로는 선택 항목 전체를 복원할 수 없음
  // (id만 저장하면 모달에 넘길 때 현재 페이지에 없는 선택 항목이 누락됨).
  const [selectedItems, setSelectedItems] = useState<Map<number, SendResponse>>(new Map());
  // 전체 선택 순회 진행 상태 — 실 데이터(수천 건)는 페이지당 왕복이 눈에 띄게 걸릴 수 있어
  // "불러오는 중…" 정적 텍스트만으로는 멈춘 것처럼 보임. 모달로 몇 건째인지 표시.
  // null이 아니면 곧 "진행 중" — isSelectingAll을 별도 state로 두지 않고 이 값에서 파생.
  const [selectAllProgress, setSelectAllProgress] = useState<{ done: number; total: number } | null>(null);
  const isSelectingAll = selectAllProgress !== null;
  // selectAllFiltered 진행 중 탭 전환/선택 해제 등으로 세대가 바뀌면, 뒤늦게 도착한
  // stale 결과가 setSelectedItems를 덮어쓰지 않도록 막는 가드 (아래 filterLocked로
  // 탭·필터 조작 자체를 막지만, 방어적으로 이중 체크).
  const selectionGenerationRef = useRef(0);
  // "필터 결과 전체 선택" 진행 중엔 탭/필터/선택 조작을 잠금 (Cafe24OrderListPage의
  // filterLocked 컨벤션과 동일) — 스코프가 바뀌면 진행 중이던 순회가 엉뚱한 결과를 만듦.
  const filterLocked = isSelectingAll;
  const [regenerateOpen, setRegenerateOpen] = useState(false);
  const [excelOpen, setExcelOpen] = useState<
    null | "monthly" | "yearly-gichulyu" | "yearly-postoffice" | "vip"
  >(null);
  const [transitionOpen, setTransitionOpen] = useState(false);
  // 패널 열림 상태와 대상 ID 를 분리한다 — 하나로 묶으면 닫는 순간 자식이 언마운트돼
  // 빈 패널이 슬라이드된다. 애니메이션이 끝난 뒤 ID 를 비운다
  // (OrderListPage·CustomerListPage·ProductListPage 와 동일한 패턴).
  const [detailSendId, setDetailSendId] = useState<number | null>(null);
  const [detailPanelOpen, setDetailPanelOpen] = useState(false);

  const openDetailPanel = (sendId: number) => {
    setDetailSendId(sendId);
    setDetailPanelOpen(true);
  };

  const handleDetailPanelClose = useCallback(() => {
    setDetailPanelOpen(false);
    setTimeout(() => setDetailSendId(null), 250);
  }, []);

  const issueValid = /^\d{6}$/.test(issueInput);
  const vipSlot = vipSlotOf(scope);
  const isVip = vipSlot !== null;

  // 활성 VIP 그룹 (동적 탭 렌더링용)
  const { data: vipSlots = [] } = useQuery({
    queryKey: ["vip-slots"],
    queryFn: () => vipSlotsApi.getVipSlots().then((r) => r.data.data ?? []),
    staleTime: 5 * 60 * 1000,
  });
  const activeVipSlots = useMemo(() => vipSlots.filter((s) => s.is_enabled), [vipSlots]);

  // 현재 scope 가 vipN 인데 그 그룹이 비활성으로 바뀌었으면 전체 탭으로 fallback (탭 자체가 사라지므로).
  useEffect(() => {
    if (vipSlot === null) return;
    if (vipSlots.length === 0) return; // 그룹 데이터 로드 전엔 판단 보류
    const slotMeta = vipSlots.find((s) => s.slot_number === vipSlot);
    if (!slotMeta || !slotMeta.is_enabled) {
      setScope("all");
      setSelectedItems(new Map());
      setPage(1);
      setIssueInput("");
      setRecipientName("");
      setRecipientPhone("");
      setAddressSearch("");
    }
  }, [vipSlot, vipSlots]);

  // 발송 박스 목록 (PREPARING).
  // VIP 탭: vip_slot_number 필터 (product_kind 무관, 정기+단품 혼합 가능)
  // monthly/yearly: product_kind 필터 (KR 강제는 백엔드 그룹핑 단계에서 보장)
  // 전체 탭: product_kind·vip_slot_number 모두 null → 백엔드가 필터 없이 모든 PREPARING 박스 반환
  // 페이지네이션(page/limit)을 제외한 필터 조건 — 메인 목록 쿼리와 "필터 결과 전체 선택" 순회 조회가 공유
  const baseParams: Omit<SendListQuery, "page" | "limit"> = useMemo(
    () => ({
      send_status: "PREPARING",
      product_kind: isVip || scope === "all" ? null : scope === "monthly" ? "MONTHLY" : "YEARLY",
      vip_slot_number: vipSlot,
      issue: issueValid ? issueInput : null,
      recipient_name: recipientName || null,
      recipient_phone: recipientPhone || null,
      address_search: debouncedAddressSearch || null,
      sort_by: "created_at",
      sort_order: "desc",
    }),
    [isVip, scope, vipSlot, issueValid, issueInput, recipientName, recipientPhone, debouncedAddressSearch],
  );

  const { data: sendsData, isLoading } = useQuery({
    queryKey: ["preparing-sends", scope, issueInput, recipientName, recipientPhone, debouncedAddressSearch, page],
    queryFn: () =>
      sendsApi.getSends({ ...baseParams, page, limit: LIMIT }).then((r) => r.data),
  });

  const sends = sendsData?.items ?? [];
  const totalPages = sendsData?.total_pages ?? 1;
  const total = sendsData?.total ?? 0;

  // 카드 표시용 SendItem 은 list 응답에 인라인으로 함께 옴 (N+1 제거).
  // SendDetailPanel / TransitionToDeliveredModal 의 ["send-detail", id] 캐시도
  // 함께 채워 두면 패널·모달 열 때 즉시 표시 (staleTime 60s 적용).
  useEffect(() => {
    if (!sendsData) return;
    sendsData.items.forEach((s) => {
      queryClient.setQueryData(["send-detail", s.send_id], s);
    });
  }, [sendsData, queryClient]);

  // 카운트 배너 (16+2 응답)
  const { data: countData } = useQuery({
    queryKey: ["paid-not-prepared-count"],
    queryFn: () => dispatchApi.getPaidNotPreparedCount().then((r) => r.data.data!),
    refetchInterval: 30 * 1000,
  });

  // 전체 탭은 조회 전용이라 카운트 안내를 쓰지 않는다 (정기 카운트는 신뢰 불가라 합산도 부적절)
  const counts = useMemo(
    () => (scope === "all" ? { count: 0, preparing: 0 } : extractCounts(countData, scope)),
    [countData, scope],
  );

  // 정기(yearly): 카운트 신뢰 불가(첫 발송 이후엔 갱신 안 됨) → 고정 안내 문구로 대체
  // 단품/VIP: 카운트는 정확하지만 "건" 단위가 품목 수인지 박스 수인지 모호 → 존재 여부만 표시
  const noticeBanner = useMemo(() => {
    if (scope === "yearly") {
      return { text: "🔔 기출유에 명단을 보내기 전에 발송 생성을 먼저 해주세요", active: true };
    }
    return { text: `🔔 미생성 결제건 ${counts.count > 0 ? "있음" : "없음"}`, active: counts.count > 0 };
  }, [scope, counts.count]);

  // 탭 전환 시 페이지·선택 초기화
  const handleTabChange = (next: string) => {
    selectionGenerationRef.current += 1;
    setScope(next as SendListScope);
    setPage(1);
    setSelectedItems(new Map());
    setIssueInput("");
    setRecipientName("");
    setRecipientPhone("");
    setAddressSearch("");
  };

  // 체크박스 헬퍼
  const toggleOne = (item: SendResponse) => {
    setSelectedItems((prev) => {
      const next = new Map(prev);
      if (next.has(item.send_id)) next.delete(item.send_id);
      else next.set(item.send_id, item);
      return next;
    });
  };
  const allSelected = sends.length > 0 && sends.every((s) => selectedItems.has(s.send_id));
  // "페이지 전체 선택 (N/20)" 라벨용 — selectedItems.size(전체 선택 건수, 필터 결과 전체
  // 선택 시 수천 건일 수 있음)를 그대로 쓰면 "(2924/20)" 처럼 말이 안 되는 표시가 되므로
  // 반드시 현재 페이지에 실제로 표시된 항목 중 선택된 것만 센다.
  const selectedOnPageCount = sends.filter((s) => selectedItems.has(s.send_id)).length;
  const toggleAllOnPage = () => {
    if (allSelected) {
      // 현재 페이지 박스만 해제 (다른 페이지 선택은 보존)
      setSelectedItems((prev) => {
        const next = new Map(prev);
        sends.forEach((s) => next.delete(s.send_id));
        return next;
      });
    } else {
      setSelectedItems((prev) => {
        const next = new Map(prev);
        sends.forEach((s) => next.set(s.send_id, s));
        return next;
      });
    }
  };

  // 필터 결과 전체 선택 — 현재 탭+필터 조건에 맞는 전체 항목을 페이지 순회로 모아 한 번에 선택.
  // 백엔드 GET /sends의 limit 상한(100)만큼씩 조회하며, 각 항목을 send-detail 캐시에도 시딩해
  // 발송완료 처리 모달에서 개별 상세 재조회 없이 즉시 표시되게 함.
  // 전체 데이터를 selectedItems에 직접 저장 — 현재 페이지(sends)에 없는 항목도 모달에 전달 가능해야 함.
  const selectAllFiltered = async () => {
    const myGeneration = ++selectionGenerationRef.current;
    setSelectAllProgress({ done: 0, total });
    try {
      const collected = new Map<number, SendResponse>();
      let currentPage = 1;
      let totalPages = 1;
      do {
        const { data } = await sendsApi.getSends({
          ...baseParams,
          page: currentPage,
          limit: SELECT_ALL_FETCH_LIMIT,
        });
        data.items.forEach((item) => {
          collected.set(item.send_id, item);
          queryClient.setQueryData(["send-detail", item.send_id], item);
        });
        totalPages = data.total_pages;
        currentPage += 1;
        // 실제 백엔드 total(정확도 우선) 기준으로 진행 건수 갱신 — 페이지별 왕복마다 즉시 반영
        if (selectionGenerationRef.current === myGeneration) {
          setSelectAllProgress({ done: collected.size, total: data.total });
        }
      } while (currentPage <= totalPages);
      // 순회 도중 탭 전환 등으로 세대가 바뀌었으면 이 결과는 stale — 반영하지 않음
      if (selectionGenerationRef.current !== myGeneration) return;
      setSelectedItems(collected);
      toast.success(`${collected.size}건 선택되었습니다.`);
    } catch (err) {
      if (selectionGenerationRef.current === myGeneration) toast.error(getErrorMessage(err));
    } finally {
      setSelectAllProgress(null);
    }
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      {/* 탭 — 전체(조회 전용) / 단품 / 정기 + 활성 VIP 그룹만 동적 렌더링 */}
      <Tabs value={scope} onValueChange={handleTabChange}>
        <div className="px-5 py-3 bg-white border-b border-gray-200">
          <TabsList>
            <TabsTrigger value="all" disabled={filterLocked}>전체</TabsTrigger>
            <TabsTrigger value="monthly" disabled={filterLocked}>단품</TabsTrigger>
            <TabsTrigger value="yearly" disabled={filterLocked}>정기</TabsTrigger>
            {activeVipSlots.map((s) => (
              <TabsTrigger key={s.slot_number} value={`vip${s.slot_number}`} disabled={filterLocked}>
                {s.label || `VIP ${s.slot_number}`}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
      </Tabs>

      {/* 카운트 + 액션 */}
      <PageHeader
        left={
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">총 {total}건</span>
            {scope !== "all" && (
              <>
                <span className="text-gray-300">·</span>
                <span className={`text-sm ${noticeBanner.active ? "text-orange-600" : "text-gray-400"}`}>
                  {noticeBanner.text}
                </span>
              </>
            )}
          </div>
        }
        actions={
          <div className="flex items-center gap-2">
            {/* 전체 탭은 조회 전용 — 발송 생성·엑셀은 단품·정기·VIP 중 한 범위(scope)를 전제로 하고,
                발송 완료 처리는 선택한 박스 전체에 발송 방법·택배사를 하나만 적용해 종류가 섞이면 잘못 기록된다 */}
            {scope !== "all" && (
              <Button size="sm" variant="outline" onClick={() => setRegenerateOpen(true)}>
                <RefreshCw className="h-3.5 w-3.5 mr-1" />
                발송 생성
              </Button>
            )}
            {scope === "monthly" && (
              <Button size="sm" variant="success" onClick={() => setExcelOpen("monthly")}>
                <FileDown className="h-3.5 w-3.5" />
                기출유택배 엑셀
              </Button>
            )}
            {scope === "yearly" && (
              <>
                <Button size="sm" variant="success" onClick={() => setExcelOpen("yearly-gichulyu")}>
                  <FileDown className="h-3.5 w-3.5" />
                  기출유우편 엑셀
                </Button>
                <Button size="sm" variant="success" onClick={() => setExcelOpen("yearly-postoffice")}>
                  <FileDown className="h-3.5 w-3.5" />
                  일반우편 엑셀
                </Button>
              </>
            )}
            {isVip && (
              <Button size="sm" variant="success" onClick={() => setExcelOpen("vip")}>
                <FileDown className="h-3.5 w-3.5" />
                일반우편 엑셀
              </Button>
            )}
            {scope !== "all" && (
              <Button
                size="sm"
                disabled={selectedItems.size === 0}
                onClick={() => setTransitionOpen(true)}
              >
                발송 완료 처리 ({selectedItems.size}건)
              </Button>
            )}
          </div>
        }
      />

      {/* 필터 — 호·수령인 필터링만 담당. 발송 생성/엑셀 다운로드 시 호는 각 모달·다이얼로그 안에서 별도 입력 */}
      <FilterBar
        basic={
          <>
            <Input
              className="w-32 font-mono"
              placeholder="발송 호 (YYYYMM)"
              value={issueInput}
              maxLength={6}
              disabled={filterLocked}
              onChange={(e) => { setIssueInput(e.target.value.replace(/\D/g, "")); setPage(1); }}
            />
            {issueInput && !issueValid && (
              <span className="text-xs text-red-500">6자리 입력</span>
            )}
            <Input
              className="w-32"
              placeholder="수령인 이름"
              value={recipientName}
              disabled={filterLocked}
              onChange={(e) => { setRecipientName(e.target.value); setPage(1); }}
            />
            <Input
              className="w-36 font-mono"
              placeholder="수령인 연락처"
              value={recipientPhone}
              disabled={filterLocked}
              onChange={(e) => { setRecipientPhone(e.target.value.replace(/\D/g, "")); setPage(1); }}
            />
            <Input
              className="w-52"
              placeholder="주소 / 우편번호 검색"
              value={addressSearch}
              disabled={filterLocked}
              onChange={(e) => { setAddressSearch(e.target.value); setPage(1); }}
            />
            {filterLocked && (
              <span className="text-xs text-amber-600">전체 선택 중: 필터/탭 변경 불가</span>
            )}
          </>
        }
        actions={
          scope === "all" ? undefined : (
            <div className="flex items-center gap-2.5 text-xs text-gray-600">
              {/* 주 동작: 전체 선택 — 실사용 빈도가 훨씬 높아 기본으로 승격. 네트워크 순회(수 초)가
                  걸리는 "동작"이라 체크박스가 아니라 버튼으로 (기존 뮤테이션 버튼과 동일한
                  로딩 스피너+비활성화+라벨 전환 패턴). */}
              <Button
                size="sm"
                variant="outline"
                disabled={isSelectingAll || total === 0}
                onClick={selectAllFiltered}
              >
                {isSelectingAll && <LoadingSpinner size="sm" className="mr-1" />}
                {isSelectingAll ? "불러오는 중…" : `전체 선택 (총 ${total.toLocaleString()}건)`}
              </Button>

              {/* 보조 동작: 이 페이지만 선택 — 로컬 즉시 토글이라 체크박스 문법이 맞는 드문 케이스 */}
              <div className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  id="select-all-page"
                  className="h-4 w-4"
                  checked={allSelected}
                  ref={(el) => { if (el) el.indeterminate = !allSelected && selectedOnPageCount > 0; }}
                  disabled={sends.length === 0 || filterLocked}
                  onChange={toggleAllOnPage}
                />
                <label htmlFor="select-all-page" className="cursor-pointer select-none text-gray-500">
                  이 페이지만 선택
                </label>
              </div>

              {/* 선택 현황 — 개수의 유일한 표시처(단일 소스). FilterBar의 활성 필터 칩과 동일한 스타일로 통일 */}
              {selectedItems.size > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs font-medium border border-blue-200">
                  {selectedItems.size.toLocaleString()}건 선택됨
                  <button
                    type="button"
                    className="hover:text-blue-900 flex-shrink-0 disabled:text-blue-300 disabled:cursor-not-allowed"
                    disabled={filterLocked}
                    onClick={() => {
                      selectionGenerationRef.current += 1;
                      setSelectedItems(new Map());
                    }}
                    aria-label="선택 해제"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
            </div>
          )
        }
        hasActiveFilters={!!(issueInput || recipientName || recipientPhone || addressSearch)}
        onReset={() => { setIssueInput(""); setRecipientName(""); setRecipientPhone(""); setAddressSearch(""); setPage(1); }}
        chips={[
          ...(issueInput && issueValid ? [{ label: `호: ${issueInput}`, onRemove: () => { setIssueInput(""); setPage(1); } }] : []),
          ...(recipientName ? [{ label: `이름: ${recipientName}`, onRemove: () => { setRecipientName(""); setPage(1); } }] : []),
          ...(recipientPhone ? [{ label: `연락처: ${recipientPhone}`, onRemove: () => { setRecipientPhone(""); setPage(1); } }] : []),
          ...(addressSearch ? [{ label: `주소: ${addressSearch}`, onRemove: () => { setAddressSearch(""); setPage(1); } }] : []),
        ]}
      />

      {/* 전체 선택 진행 상태 모달 — 실 데이터는 페이지 왕복이 눈에 띄게 걸릴 수 있어
          정적 "불러오는 중…" 텍스트만으로는 멈춘 것처럼 보임. 몇 건째인지 실시간으로 표시.
          onOpenChange를 넘기지 않아 controlled 상태로 고정 — Radix는 onChange 없는 controlled
          컴포넌트에서 ESC/바깥클릭/닫기버튼 클릭을 이미 no-op 처리하므로 별도 방어 불필요
          (TransitionToDeliveredModal의 처리-중-닫기-방지와 동일한 원리, 공용 Dialog 컴포넌트는 무변경). */}
      <Dialog open={isSelectingAll}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>전체 선택 중…</DialogTitle>
            <DialogDescription>완료될 때까지 잠시 기다려주세요.</DialogDescription>
          </DialogHeader>
          <div className="py-2">
            {selectAllProgress && (
              <ProgressBar
                done={selectAllProgress.done}
                total={selectAllProgress.total}
                label="불러오는 중"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* 발송 생성 모달 — 단품/정기/VIP 모두 전체 재계산(해당 scope+issue의 PREPARING만 삭제 후 재생성).
          호 입력은 모달 안에서 직접 받음 (페이지 상단 '발송 호 필터'와 무관). */}
      {scope !== "all" && (
        <RegeneratePreparingConfirmModal
          open={regenerateOpen}
          onClose={() => setRegenerateOpen(false)}
          scope={scope}
          slotLabel={activeVipSlots.find((s) => s.slot_number === vipSlotOf(scope))?.label ?? null}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ["preparing-sends"] });
            queryClient.invalidateQueries({ queryKey: ["paid-not-prepared-count"] });
            selectionGenerationRef.current += 1;
            setSelectedItems(new Map());
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

      {/* 발송 완료 처리 모달 */}
      <TransitionToDeliveredModal
        open={transitionOpen}
        onClose={() => setTransitionOpen(false)}
        sends={Array.from(selectedItems.values())}
        onSuccess={(_count, allSucceeded) => {
          queryClient.invalidateQueries({ queryKey: ["preparing-sends"] });
          queryClient.invalidateQueries({ queryKey: ["paid-not-prepared-count"] });
          // 일부 실패가 남아 모달이 재시도 대기 중으로 열려있으면 선택 상태를 비우지 않음
          if (allSucceeded) {
            selectionGenerationRef.current += 1;
            setSelectedItems(new Map());
          }
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
            message="발송 후보 항목이 없습니다"
            description="결제 완료 시 자동으로 생성됩니다. 필터를 사용 중이라면 변경해 보세요."
          />
        ) : (
          <div className="space-y-3">
            {sends.map((s) => (
              <PreparingSendCard
                key={s.send_id}
                send={s}
                detail={s}
                detailError={false}
                selectable={scope !== "all"}
                checked={selectedItems.has(s.send_id)}
                onToggleCheck={() => toggleOne(s)}
                onCardClick={() => openDetailPanel(s.send_id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* 박스 상세 패널 — #11 약점 보강: TransitionToDeliveredModal 진입 전 박스 안 책 종류 확인 가능 */}
      <SlidingPanel open={detailPanelOpen} onClose={handleDetailPanelClose}>
        {detailSendId !== null && (
          <SendDetailPanel sendId={detailSendId} onClose={handleDetailPanelClose} />
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
