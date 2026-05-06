import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DataTable, type ColumnDef } from "@/components/common/DataTable";
import { Pagination } from "@/components/common/Pagination";
import { sendsApi } from "@/api/sendsApi";
import { vipSlotsApi } from "@/api/vipSlotsApi";
import { formatDate, formatPhone } from "@/utils/format";
import type { SendResponse } from "@/types/send";
import type { DispatchScope } from "@/types/dispatch";

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

  const handleTabChange = (next: string) => {
    setScope(next as DispatchScope);
    setPage(1);
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
          <div className="text-xs text-gray-500 font-mono flex items-center gap-1">
            {r.country_code !== "KR" && (
              <span className="px-1 py-0.5 bg-amber-100 text-amber-700 rounded text-[10px] font-semibold">
                🌐 {r.country_code}
              </span>
            )}
            <span>{r.postal_code}</span>
          </div>
          <div className="text-sm">{r.recipient_address}</div>
        </div>
      ),
    },
    {
      key: "tracking",
      header: "운송장",
      cell: (r) => (
        <div>
          <div className="text-xs text-gray-500">
            {r.send_method ?? "-"}
            {r.courier_company && (
              <span className="text-gray-400"> · {r.courier_company}</span>
            )}
          </div>
          <div className="text-sm font-mono">{r.tracking_no ?? "-"}</div>
        </div>
      ),
      width: "w-44",
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
      key: "delivered_at",
      header: "완료일",
      cell: (r) => (
        <span className="text-xs text-gray-500">
          {r.delivered_at ? formatDate(r.delivered_at) : "-"}
        </span>
      ),
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

      {/* 박스 목록 */}
      <div className="flex-1 overflow-auto bg-white">
        <DataTable
          columns={columns}
          data={sends}
          getRowId={(r) => r.send_id}
          isLoading={isLoading}
          emptyMessage="조건에 맞는 DELIVERED 박스가 없습니다."
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
