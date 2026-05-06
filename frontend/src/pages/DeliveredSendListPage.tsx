import { useState, useMemo, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Check, X as XIcon } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DataTable, type ColumnDef } from "@/components/common/DataTable";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { Pagination } from "@/components/common/Pagination";
import { sendsApi } from "@/api/sendsApi";
import { vipSlotsApi } from "@/api/vipSlotsApi";
import { formatDate, formatPhone } from "@/utils/format";
import { toast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/utils/errorHandler";
import {
  SEND_METHOD_OPTIONS,
  COURIER_COMPANY_OPTIONS,
  SEND_METHOD_TO_COURIER,
} from "@/utils/constants";
import type { SendResponse, SendMethod, CourierCompany } from "@/types/send";
import type { DispatchScope } from "@/types/dispatch";

interface EditDraft {
  tracking_no: string;
  send_method: SendMethod | "";
  courier_company: CourierCompany | "";
}

const LIMIT = 50;

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
  const [page, setPage] = useState(1);

  // 한 번에 한 행만 inline 편집 (운송장/배송방법/배송업체)
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<EditDraft>({
    tracking_no: "",
    send_method: "",
    courier_company: "",
  });

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
    setEditingId(null);
  };

  // 편집 진입 — 그 행의 현재 값으로 draft 초기화
  const startEdit = (s: SendResponse) => {
    setEditingId(s.send_id);
    setEditDraft({
      tracking_no: s.tracking_no ?? "",
      send_method: (s.send_method as SendMethod | null) ?? "",
      courier_company: (s.courier_company as CourierCompany | null) ?? "",
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const updateMutation = useMutation({
    mutationFn: (sendId: number) =>
      sendsApi
        .updateTracking(sendId, {
          tracking_no: editDraft.tracking_no.trim() || null,
          send_method: editDraft.send_method || null,
          courier_company: editDraft.courier_company || null,
        })
        .then((r) => r.data),
    onSuccess: (res) => {
      toast.success(res.message ?? "운송장 정보가 수정되었습니다.");
      queryClient.invalidateQueries({ queryKey: ["delivered-sends"] });
      setEditingId(null);
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const handleSave = () => {
    if (editingId == null) return;
    // 셋 다 비어있으면 백엔드 422 — 미리 차단해 토스트로 안내
    const allEmpty =
      editDraft.tracking_no.trim() === "" &&
      editDraft.send_method === "" &&
      editDraft.courier_company === "";
    if (allEmpty) {
      toast.error("운송장·배송방법·배송업체 중 최소 1개를 입력해주세요.");
      return;
    }
    updateMutation.mutate(editingId);
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
      cell: (r) => {
        if (editingId === r.send_id) {
          return (
            <div className="space-y-1">
              <div className="flex items-center gap-1">
                <Select
                  value={editDraft.send_method}
                  onValueChange={(v) => {
                    const sm = v as SendMethod;
                    const derivedCourier = SEND_METHOD_TO_COURIER[sm] as CourierCompany | undefined;
                    setEditDraft((prev) => ({
                      ...prev,
                      send_method: sm,
                      // 운영자가 courier 를 이미 다른 값으로 지정한 상태라면 덮지 않음
                      courier_company: prev.courier_company || derivedCourier || "",
                    }));
                  }}
                >
                  <SelectTrigger className="h-7 text-xs w-24">
                    <SelectValue placeholder="방법" />
                  </SelectTrigger>
                  <SelectContent>
                    {SEND_METHOD_OPTIONS.map((m) => (
                      <SelectItem key={m.value} value={m.value} className="text-xs">
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={editDraft.courier_company}
                  onValueChange={(v) =>
                    setEditDraft((prev) => ({ ...prev, courier_company: v as CourierCompany }))
                  }
                >
                  <SelectTrigger className="h-7 text-xs w-24">
                    <SelectValue placeholder="업체" />
                  </SelectTrigger>
                  <SelectContent>
                    {COURIER_COMPANY_OPTIONS.map((c) => (
                      <SelectItem key={c.value} value={c.value} className="text-xs">
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Input
                className="h-7 text-xs font-mono"
                placeholder="운송장 번호"
                value={editDraft.tracking_no}
                onChange={(e) =>
                  setEditDraft((prev) => ({ ...prev, tracking_no: e.target.value }))
                }
              />
            </div>
          );
        }
        return (
          <div>
            <div className="text-xs text-gray-500">
              {r.send_method ?? "-"}
              {r.courier_company && (
                <span className="text-gray-400"> · {r.courier_company}</span>
              )}
            </div>
            <div className="text-sm font-mono">{r.tracking_no ?? "-"}</div>
          </div>
        );
      },
      width: "w-56",
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
    {
      key: "actions",
      header: "",
      cell: (r) => {
        if (editingId === r.send_id) {
          return (
            <div className="flex items-center gap-1">
              <Button
                size="icon-sm"
                variant="ghost"
                onClick={handleSave}
                disabled={updateMutation.isPending}
                title="저장"
              >
                {updateMutation.isPending ? (
                  <LoadingSpinner size="sm" />
                ) : (
                  <Check className="h-4 w-4 text-green-600" />
                )}
              </Button>
              <Button
                size="icon-sm"
                variant="ghost"
                onClick={cancelEdit}
                disabled={updateMutation.isPending}
                title="취소"
              >
                <XIcon className="h-4 w-4 text-gray-500" />
              </Button>
            </div>
          );
        }
        return (
          <Button
            size="icon-sm"
            variant="ghost"
            onClick={() => startEdit(r)}
            disabled={editingId !== null}
            title={editingId !== null ? "다른 행 편집 중" : "운송장/배송방법/배송업체 수정"}
          >
            <Pencil className="h-3.5 w-3.5 text-gray-400" />
          </Button>
        );
      },
      width: "w-20",
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
