import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useDebounce } from "@/hooks/useDebounce";
import { RefreshCw, Plus, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DataTable, type ColumnDef } from "@/components/common/DataTable";
import { FilterBar } from "@/components/common/FilterBar";
import { PageHeader } from "@/components/common/PageHeader";
import { Pagination } from "@/components/common/Pagination";
import { StatusBadge } from "@/components/common/StatusBadge";
import { SlidingPanel } from "@/components/common/SlidingPanel";
import { ConfirmModal } from "@/components/common/ConfirmModal";
import { ordersApi } from "@/api/ordersApi";
import { cafe24API } from "@/api/cafe24Api";
import { toast } from "@/hooks/use-toast";
import { formatAmount, formatDate, formatPhone } from "@/utils/format";
import { PAYMENT_METHOD_LABEL, PAYMENT_METHOD_OPTIONS } from "@/utils/constants";
import type { OrderListResponse } from "@/types/order";
import OrderDetailPanel from "./order/OrderDetailPanel";

const CHANNEL_OPTIONS = [
  { value: "", label: "전체 채널" },
  { value: "CAFE24", label: "Cafe24" },
  { value: "GPMALL", label: "갓피플몰" },
  { value: "OFFLINE", label: "오프라인" },
];

const STATUS_OPTIONS = [
  { value: "", label: "전체 상태" },
  { value: "ORDERED", label: "주문완료" },
  { value: "PAID", label: "결제완료" },
  { value: "CANCELLED", label: "취소" },
];

export default function OrderListPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [channel, setChannel] = useState("");
  const [status, setStatus] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [recipientSearch, setRecipientSearch] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [externalOrderId, setExternalOrderId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [adminMemo, setAdminMemo] = useState("");

  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [paymentConfirmId, setPaymentConfirmId] = useState<number | null>(null);

  const debouncedCustomerSearch = useDebounce(customerSearch, 300);
  const debouncedRecipientSearch = useDebounce(recipientSearch, 300);
  const debouncedExternalOrderId = useDebounce(externalOrderId, 300);
  const debouncedAdminMemo = useDebounce(adminMemo, 300);

  const limit = 20;

  const { data, isLoading } = useQuery({
    queryKey: [
      "orders",
      page,
      limit,
      channel,
      status,
      debouncedCustomerSearch,
      debouncedRecipientSearch,
      startDate,
      endDate,
      debouncedExternalOrderId,
      paymentMethod,
      debouncedAdminMemo,
    ],
    queryFn: () =>
      ordersApi
        .getOrders({
          page,
          limit,
          order_channel: channel || null,
          order_status: status || null,
          customer_search: debouncedCustomerSearch || null,
          recipient_search: debouncedRecipientSearch || null,
          start_date: startDate || null,
          end_date: endDate || null,
          external_order_id: debouncedExternalOrderId || null,
          payment_method: (paymentMethod || null) as import("@/types/order").PaymentMethod | null,
          admin_memo: debouncedAdminMemo || null,
        })
        .then((r) => r.data),
  });

  const importMutation = useMutation({
    mutationFn: () => cafe24API.importOrders(),
    onSuccess: (result) => {
      toast.success(
        `${result.imported_count}건 가져왔습니다.`,
        result.skipped_count > 0
          ? `중복 ${result.skipped_count}건 제외`
          : undefined
      );
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
    onError: () => {
      toast.error("Cafe24 주문 가져오기 실패", "잠시 후 다시 시도해주세요.");
    },
  });

  const paymentMutation = useMutation({
    mutationFn: (orderId: number) => ordersApi.completePayment(orderId),
    onSuccess: () => {
      toast.success("결제완료 처리되었습니다.");
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      setPaymentConfirmId(null);
    },
    onError: () => {
      toast.error("결제 처리 실패");
    },
  });

  const handleRowClick = useCallback((order: OrderListResponse) => {
    setSelectedOrderId(order.order_id);
    setPanelOpen(true);
  }, []);

  const handlePanelClose = useCallback(() => {
    setPanelOpen(false);
    setTimeout(() => setSelectedOrderId(null), 250);
  }, []);

  const columns: ColumnDef<OrderListResponse>[] = [
    {
      key: "order_id",
      header: "주문번호",
      cell: (row) => (
        <span className="font-mono text-xs text-gray-600">#{row.order_id}</span>
      ),
      width: "w-20",
    },
    {
      key: "customer",
      header: "고객",
      cell: (row) => (
        <div>
          <div className="font-medium text-gray-900 text-[13px]">
            {row.customer_name ?? "-"}
          </div>
          <div className="text-xs text-gray-400">
            {formatPhone(row.customer_phone)}
          </div>
        </div>
      ),
    },
    {
      key: "channel",
      header: "채널",
      cell: (row) => (
        <StatusBadge type="channel" value={row.order_channel} />
      ),
      width: "w-24",
    },
    {
      key: "items",
      header: "주문 내용",
      cell: (row) => (
        <span className="text-[13px] text-gray-600">
          {row.item_count}개 상품
          {row.external_order_id && (
            <span className="ml-1.5 text-xs text-gray-400 font-mono">
              {row.external_order_id}
            </span>
          )}
        </span>
      ),
    },
    {
      key: "amount",
      header: "결제금액",
      cell: (row) => (
        <span className="text-[13px] font-medium">
          {formatAmount(row.payment_amount)}
        </span>
      ),
      width: "w-28",
    },
    {
      key: "status",
      header: "상태",
      cell: (row) => (
        <StatusBadge type="order_status" value={row.order_status} />
      ),
      width: "w-24",
    },
    {
      key: "order_at",
      header: "주문일",
      cell: (row) => (
        <span className="text-xs text-gray-500">
          {formatDate(row.order_at)}
        </span>
      ),
      width: "w-24",
    },
    {
      key: "actions",
      header: "",
      cell: (row) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="icon-sm">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {row.order_status === "ORDERED" && (
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  setPaymentConfirmId(row.order_id);
                }}
              >
                결제완료 처리
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation();
                setSelectedOrderId(row.order_id);
                setPanelOpen(true);
              }}
            >
              상세 보기
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
      width: "w-12",
      className: "text-right",
    },
  ];

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      {/* 헤더 */}
      <PageHeader
        left={
          <div className="flex items-center gap-3">
            <Button
              variant="default"
              size="sm"
              onClick={() => importMutation.mutate()}
              disabled={importMutation.isPending}
              className="gap-1.5"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${importMutation.isPending ? "animate-spin" : ""}`} />
              Cafe24 주문 가져오기
            </Button>
            <span className="text-xs text-gray-400">마지막 동기화: —</span>
          </div>
        }
        actions={
          <Button variant="secondary" size="sm" onClick={() => navigate("/orders/new")}>
            <Plus className="h-3.5 w-3.5 mr-1" />
            오프라인 주문 등록
          </Button>
        }
      />

      {/* 필터 바 */}
      <FilterBar
        basic={
          <>
            <Select value={channel} onValueChange={(v) => { setChannel(v === "_all" ? "" : v); setPage(1); }}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="전체 채널" />
              </SelectTrigger>
              <SelectContent>
                {CHANNEL_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value || "_all"}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={(v) => { setStatus(v === "_all" ? "" : v); setPage(1); }}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="전체 상태" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value || "_all"}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              className="w-44"
              placeholder="주문자 검색"
              value={customerSearch}
              onChange={(e) => { setCustomerSearch(e.target.value); setPage(1); }}
            />
            <Input
              className="w-40"
              placeholder="수령인 검색"
              value={recipientSearch}
              onChange={(e) => { setRecipientSearch(e.target.value); setPage(1); }}
            />
          </>
        }
        advanced={
          <>
            <Input
              type="date"
              className="w-36"
              value={startDate}
              onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
              title="시작일"
            />
            <span className="text-xs text-gray-400">~</span>
            <Input
              type="date"
              className="w-36"
              value={endDate}
              onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
              title="종료일"
            />
            <Input
              className="w-36"
              placeholder="외부 주문번호"
              value={externalOrderId}
              onChange={(e) => { setExternalOrderId(e.target.value); setPage(1); }}
            />
            <Select
              value={paymentMethod}
              onValueChange={(v) => { setPaymentMethod(v === "_all" ? "" : v); setPage(1); }}
            >
              <SelectTrigger className="w-32">
                <SelectValue placeholder="결제방법" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">전체</SelectItem>
                {PAYMENT_METHOD_OPTIONS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              className="w-32"
              placeholder="관리자 메모"
              value={adminMemo}
              onChange={(e) => { setAdminMemo(e.target.value); setPage(1); }}
            />
          </>
        }
        advancedActiveCount={[startDate, endDate, externalOrderId, paymentMethod, adminMemo].filter(Boolean).length}
        hasActiveFilters={!!(channel || status || customerSearch || recipientSearch || startDate || endDate || externalOrderId || paymentMethod || adminMemo)}
        onReset={() => {
          setChannel(""); setStatus(""); setCustomerSearch(""); setRecipientSearch("");
          setStartDate(""); setEndDate(""); setExternalOrderId(""); setPaymentMethod(""); setAdminMemo("");
          setPage(1);
        }}
        chips={[
          ...(channel ? [{ label: `채널: ${CHANNEL_OPTIONS.find(o => o.value === channel)?.label}`, onRemove: () => { setChannel(""); setPage(1); } }] : []),
          ...(status ? [{ label: `상태: ${STATUS_OPTIONS.find(o => o.value === status)?.label}`, onRemove: () => { setStatus(""); setPage(1); } }] : []),
          ...(customerSearch ? [{ label: `주문자: ${customerSearch}`, onRemove: () => { setCustomerSearch(""); setPage(1); } }] : []),
          ...(recipientSearch ? [{ label: `수령인: ${recipientSearch}`, onRemove: () => { setRecipientSearch(""); setPage(1); } }] : []),
          ...(startDate || endDate ? [{ label: `기간: ${startDate || ""}~${endDate || ""}`, onRemove: () => { setStartDate(""); setEndDate(""); setPage(1); } }] : []),
          ...(externalOrderId ? [{ label: `외부번호: ${externalOrderId}`, onRemove: () => { setExternalOrderId(""); setPage(1); } }] : []),
          ...(paymentMethod ? [{ label: `결제: ${PAYMENT_METHOD_LABEL[paymentMethod] ?? paymentMethod}`, onRemove: () => { setPaymentMethod(""); setPage(1); } }] : []),
          ...(adminMemo ? [{ label: `메모: ${adminMemo}`, onRemove: () => { setAdminMemo(""); setPage(1); } }] : []),
        ]}
      />

      {/* 테이블 */}
      <div className="flex-1 overflow-hidden bg-white">
        <div className="h-full overflow-y-auto">
          <DataTable
            columns={columns}
            data={data?.items ?? []}
            getRowId={(row) => row.order_id}
            onRowClick={handleRowClick}
            isLoading={isLoading}
            emptyMessage="주문이 없습니다."
            activeRowId={selectedOrderId}
          />
        </div>
      </div>

      {/* 페이지네이션 */}
      {data && (
        <div className="bg-white border-t border-gray-200">
          <Pagination
            page={page}
            totalPages={data.total_pages}
            total={data.total}
            limit={limit}
            onPageChange={setPage}
          />
        </div>
      )}

      {/* 주문 상세 패널 */}
      <SlidingPanel
        open={panelOpen}
        onClose={handlePanelClose}
        width={520}
      >
        {selectedOrderId && (
          <OrderDetailPanel
            orderId={selectedOrderId}
            onClose={handlePanelClose}
          />
        )}
      </SlidingPanel>

      {/* 결제완료 확인 모달 */}
      <ConfirmModal
        open={paymentConfirmId != null}
        onClose={() => setPaymentConfirmId(null)}
        onConfirm={() =>
          paymentConfirmId != null && paymentMutation.mutate(paymentConfirmId)
        }
        title="결제완료 처리"
        description="주문 상태를 '결제완료'로 변경합니다."
        confirmLabel="결제완료 처리"
        isLoading={paymentMutation.isPending}
      />
    </div>
  );
}
