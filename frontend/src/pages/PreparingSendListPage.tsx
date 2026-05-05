import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DataTable, type ColumnDef } from "@/components/common/DataTable";
import { Pagination } from "@/components/common/Pagination";
import RegeneratePreparingConfirmModal from "@/components/dispatch/RegeneratePreparingConfirmModal";
import TransitionToDeliveredModal from "@/components/dispatch/TransitionToDeliveredModal";
import MonthlyExcelDialog from "@/components/dispatch-excel/MonthlyExcelDialog";
import YearlyExcelDialog from "@/components/dispatch-excel/YearlyExcelDialog";
import { sendsApi } from "@/api/sendsApi";
import { dispatchApi } from "@/api/dispatchApi";
import { formatDate, formatPhone } from "@/utils/format";
import type { SendResponse } from "@/types/send";
import type { PaidNotPreparedCountResponse } from "@/types/dispatch";

// PR6.3 골격 — 단품/정기 탭 + 박스 목록 + 카운트 배너 + 액션 버튼 (placeholder).
// VIP 동적 탭은 PR6.4, 모달 4종은 PR6.3 후속 커밋에서 와이어링.

type ScopeTab = "monthly" | "yearly";

const LIMIT = 50;

export default function PreparingSendListPage() {
  const queryClient = useQueryClient();
  const [scope, setScope] = useState<ScopeTab>("monthly");
  const [issueInput, setIssueInput] = useState("");
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string | number>>(new Set());
  const [regenerateOpen, setRegenerateOpen] = useState(false);
  const [excelOpen, setExcelOpen] = useState<
    null | "monthly" | "yearly-gichulyu" | "yearly-postoffice"
  >(null);
  const [transitionOpen, setTransitionOpen] = useState(false);

  const issueValid = /^\d{6}$/.test(issueInput);

  // 발송 박스 목록 (PREPARING)
  const { data: sendsData, isLoading } = useQuery({
    queryKey: ["preparing-sends", scope, issueInput, page],
    queryFn: () =>
      sendsApi
        .getSends({
          page,
          limit: LIMIT,
          send_status: "PREPARING",
          product_kind: scope === "monthly" ? "MONTHLY" : "YEARLY",
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
    setScope(next as ScopeTab);
    setPage(1);
    setSelectedIds(new Set());
  };

  const columns: ColumnDef<SendResponse>[] = [
    {
      key: "send_id",
      header: "발송ID",
      cell: (r) => <span className="font-mono text-xs text-gray-400">#{r.send_id}</span>,
      width: "w-20",
    },
    {
      key: "recipient",
      header: "수령인",
      cell: (r) => (
        <div>
          <div className="text-sm">{r.recipient_name}</div>
          <div className="text-xs text-gray-500">{formatPhone(r.recipient_phone)}</div>
        </div>
      ),
      width: "w-36",
    },
    {
      key: "address",
      header: "배송지",
      cell: (r) => (
        <div>
          <div className="text-xs text-gray-500 font-mono">{r.postal_code}</div>
          <div className="text-sm">{r.recipient_address}</div>
        </div>
      ),
    },
    {
      key: "related",
      header: "묶인 주문",
      cell: (r) => (
        <div className="flex flex-wrap gap-1">
          {r.related_orders.map((ro) => (
            <span
              key={ro.order_id}
              className="text-xs px-1.5 py-0.5 bg-sky-50 text-sky-700 rounded"
              title={`${ro.customer_name} · ${formatPhone(ro.customer_phone)}`}
            >
              #{ro.order_id}
            </span>
          ))}
        </div>
      ),
      width: "w-40",
    },
    {
      key: "created_at",
      header: "생성일",
      cell: (r) => <span className="text-xs text-gray-500">{formatDate(r.created_at)}</span>,
      width: "w-28",
    },
  ];

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      {/* 탭 */}
      <Tabs value={scope} onValueChange={handleTabChange} className="bg-white border-b border-gray-200">
        <TabsList className="ml-5 mt-2">
          <TabsTrigger value="monthly">단품</TabsTrigger>
          <TabsTrigger value="yearly">정기</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* 카운트 배너 + 필터 / 액션 */}
      <div className="px-5 py-3 bg-white border-b border-gray-200 flex items-center gap-4 flex-wrap">
        {/* 호 입력 */}
        <div className="flex items-center gap-2">
          <Label className="text-xs text-gray-500">발송 호</Label>
          <Input
            className="w-32 font-mono"
            placeholder="YYYYMM"
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

        {/* 카운트 배너 */}
        <div className="flex items-center text-xs text-gray-600 gap-2">
          <span>
            📦 박스 처리 <span className="font-semibold text-gray-900">{counts.preparing}</span> /{" "}
            <span className="font-semibold text-gray-900">{counts.preparing + counts.count}</span>건
          </span>
          <span className="text-gray-300">·</span>
          <span>
            🔔 신규 결제 <span className="font-semibold text-orange-600">{counts.count}</span>건
          </span>
        </div>

        {/* 액션 버튼 */}
        <div className="flex items-center gap-2 ml-auto">
          <Button size="sm" variant="outline" onClick={() => setRegenerateOpen(true)}>
            발송 생성
          </Button>
          {scope === "monthly" && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setExcelOpen("monthly")}
              disabled={!issueValid}
              title={!issueValid ? "엑셀 다운로드는 발송 호 입력 필요" : undefined}
            >
              엑셀 다운로드
            </Button>
          )}
          {scope === "yearly" && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setExcelOpen("yearly-gichulyu")}
                disabled={!issueValid}
                title={!issueValid ? "엑셀 다운로드는 발송 호 입력 필요" : undefined}
              >
                기출유 엑셀
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setExcelOpen("yearly-postoffice")}
                disabled={!issueValid}
                title={!issueValid ? "엑셀 다운로드는 발송 호 입력 필요" : undefined}
              >
                우체국 엑셀
              </Button>
            </>
          )}
          <Button
            size="sm"
            disabled={selectedIds.size === 0}
            onClick={() => setTransitionOpen(true)}
          >
            배송완료 처리 ({selectedIds.size}건)
          </Button>
        </div>
      </div>

      {/* 발송 생성 모달 */}
      <RegeneratePreparingConfirmModal
        open={regenerateOpen}
        onClose={() => setRegenerateOpen(false)}
        scope={scope}
        initialIssue={issueInput}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["preparing-sends"] });
          queryClient.invalidateQueries({ queryKey: ["paid-not-prepared-count"] });
          setSelectedIds(new Set());
        }}
      />

      {/* 엑셀 다운로드 모달 */}
      <MonthlyExcelDialog
        open={excelOpen === "monthly"}
        onClose={() => setExcelOpen(null)}
        issue={issueInput}
      />
      <YearlyExcelDialog
        open={excelOpen === "yearly-gichulyu" || excelOpen === "yearly-postoffice"}
        onClose={() => setExcelOpen(null)}
        issue={issueInput}
        variant={excelOpen === "yearly-gichulyu" ? "gichulyu" : "postoffice"}
      />

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

      {/* 박스 목록 */}
      <div className="flex-1 overflow-auto bg-white">
        <DataTable
          columns={columns}
          data={sends}
          getRowId={(r) => r.send_id}
          isLoading={isLoading}
          emptyMessage="조건에 맞는 PREPARING 박스가 없습니다."
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
        />
      </div>

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

// 탭별 카운트 추출 (16+2 키 응답에서 scope 별 1쌍 꺼내기)
function extractCounts(
  data: PaidNotPreparedCountResponse | undefined,
  scope: ScopeTab,
): { count: number; preparing: number } {
  if (!data) return { count: 0, preparing: 0 };
  if (scope === "monthly") return { count: data.monthly_count, preparing: data.monthly_preparing };
  return { count: data.yearly_count, preparing: data.yearly_preparing };
}
