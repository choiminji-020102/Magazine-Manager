import { useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQueries, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useDebounce } from "@/hooks/useDebounce";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FilterBar } from "@/components/common/FilterBar";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { Pagination } from "@/components/common/Pagination";
import { SlidingPanel } from "@/components/common/SlidingPanel";
import { ConfirmModal } from "@/components/common/ConfirmModal";
import OrderListCard from "@/components/order/OrderListCard";
import { ordersApi } from "@/api/ordersApi";
import { orderItemsApi } from "@/api/orderItemsApi";
import { vipSlotsApi } from "@/api/vipSlotsApi";
import { toast } from "@/hooks/use-toast";
import { PAYMENT_METHOD_LABEL, PAYMENT_METHOD_OPTIONS } from "@/utils/constants";
import OrderDetailPanel from "./order/OrderDetailPanel";
import type { OrderItemDetailResponse } from "@/types/orderItem";

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
  { value: "UNPAID_CANCELLED", label: "미결제 취소" },
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
  const [sortBy, setSortBy] = useState("created_at");
  const [sortOrder, setSortOrder] = useState("desc");

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
      sortBy,
      sortOrder,
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
          sort_by: sortBy,
          sort_order: sortOrder,
        })
        .then((r) => r.data),
  });

  const orders = useMemo(() => data?.items ?? [], [data]);

  // 카드별 OrderItem 병렬 호출 — OrderDetailPanel 의 useQuery (queryKey ["order", id]) 와는
  // 다른 키 사용. 카드는 OrderItem 만 필요 (다른 detail 필드는 카드에 없음).
  const itemQueries = useQueries({
    queries: orders.map((o) => ({
      queryKey: ["order-items-by-order", o.order_id],
      queryFn: () => orderItemsApi.getItemsByOrder(o.order_id).then((r) => r.data.data ?? []),
      staleTime: 60 * 1000,
    })),
  });
  const itemsByOrderId = useMemo(() => {
    const map = new Map<number, OrderItemDetailResponse[]>();
    itemQueries.forEach((q, i) => {
      if (q.data) map.set(orders[i].order_id, q.data);
    });
    return map;
  }, [itemQueries, orders]);
  const itemsErrorByOrderId = useMemo(() => {
    const set = new Set<number>();
    itemQueries.forEach((q, i) => {
      if (q.isError) set.add(orders[i].order_id);
    });
    return set;
  }, [itemQueries, orders]);

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

  const { data: vipSlots = [] } = useQuery({
    queryKey: ["vip-slots"],
    queryFn: () => vipSlotsApi.getVipSlots().then((res) => res.data.data ?? []),
    staleTime: 5 * 60 * 1000,
  });

  const handleCardClick = useCallback((orderId: number) => {
    setSelectedOrderId(orderId);
    setPanelOpen(true);
  }, []);

  const handlePanelClose = useCallback(() => {
    setPanelOpen(false);
    setTimeout(() => setSelectedOrderId(null), 250);
  }, []);

  return (
    <div className="flex-1 min-h-0 flex flex-col">
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
            <Select
              value={paymentMethod}
              onValueChange={(v) => { setPaymentMethod(v === "_all" ? "" : v); setPage(1); }}
            >
              <SelectTrigger className="w-32">
                <SelectValue placeholder="결제 방법" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">전체 결제 방법</SelectItem>
                {PAYMENT_METHOD_OPTIONS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              className="w-44"
              placeholder="주문자 이름/뒤4자리"
              value={customerSearch}
              onChange={(e) => { setCustomerSearch(e.target.value); setPage(1); }}
            />
            <Input
              className="w-40"
              placeholder="수령인 이름/뒤4자리"
              value={recipientSearch}
              onChange={(e) => { setRecipientSearch(e.target.value); setPage(1); }}
            />
            <Input
              className="w-32"
              placeholder="관리자 메모"
              value={adminMemo}
              onChange={(e) => { setAdminMemo(e.target.value); setPage(1); }}
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
            <Select value={sortBy} onValueChange={(v) => { setSortBy(v); setPage(1); }}>
              <SelectTrigger className="w-28">
                <SelectValue placeholder="정렬" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="created_at">등록일</SelectItem>
                <SelectItem value="order_at">주문일</SelectItem>
                <SelectItem value="payment_at">결제일</SelectItem>
                <SelectItem value="updated_at">수정일</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortOrder} onValueChange={(v) => { setSortOrder(v); setPage(1); }}>
              <SelectTrigger className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="desc">최신순</SelectItem>
                <SelectItem value="asc">오래된순</SelectItem>
              </SelectContent>
            </Select>
          </>
        }
        alwaysExpanded
        actions={
          <Button variant="secondary" size="sm" onClick={() => navigate("/orders/new")}>
            <Plus className="h-3.5 w-3.5 mr-1" />
            오프라인 주문 등록
          </Button>
        }
        hasActiveFilters={!!(channel || status || customerSearch || recipientSearch || startDate || endDate || externalOrderId || paymentMethod || adminMemo)}
        onReset={() => {
          setChannel(""); setStatus(""); setCustomerSearch(""); setRecipientSearch("");
          setStartDate(""); setEndDate(""); setExternalOrderId(""); setPaymentMethod(""); setAdminMemo("");
          setSortBy("created_at"); setSortOrder("desc");
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

      {/* 카드 그리드 */}
      <div className="flex-1 overflow-auto bg-gray-50 px-5 py-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <LoadingSpinner size="lg" />
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-16 text-sm text-gray-500">주문이 없습니다.</div>
        ) : (
          <div className="space-y-3">
            {orders.map((order) => (
              <OrderListCard
                key={order.order_id}
                order={order}
                items={itemsByOrderId.get(order.order_id)}
                itemsError={itemsErrorByOrderId.has(order.order_id)}
                vipSlots={vipSlots}
                onCardClick={() => handleCardClick(order.order_id)}
                onPaymentComplete={() => setPaymentConfirmId(order.order_id)}
              />
            ))}
          </div>
        )}
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
