import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { X, MoreHorizontal, Edit2 } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StatusBadge } from "@/components/common/StatusBadge";
import { ConfirmModal } from "@/components/common/ConfirmModal";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { ordersApi } from "@/api/ordersApi";
import { orderItemsApi } from "@/api/orderItemsApi";
import { toast } from "@/hooks/use-toast";
import { formatAmount, formatDate, formatDateTime, formatPhone, formatIssue } from "@/utils/format";
import { PAYMENT_METHOD_LABEL, PAYMENT_METHOD_OPTIONS } from "@/utils/constants";
import type { OrderItemDetailResponse } from "@/types/orderItem";
import { PaymentMethod } from "@/types/order";
import { SubscriptionExtendModal } from "./modals/SubscriptionExtendModal";
import { SubscriptionShortenModal } from "./modals/SubscriptionShortenModal";
import { SubscriptionChangePeriodModal } from "./modals/SubscriptionChangePeriodModal";
import { PauseCreateModal } from "./modals/PauseCreateModal";
import { AddressChangeModal } from "./modals/AddressChangeModal";
import { OrderItemEditModal } from "./modals/OrderItemEditModal";

interface OrderDetailPanelProps {
  orderId: number;
  onClose: () => void;
}

type ModalType = "extend" | "shorten" | "changePeriod" | "pause" | "addressChange" | "cancelItem" | "editItem" | null;
type ActiveItem = OrderItemDetailResponse;


export default function OrderDetailPanel({ orderId, onClose }: OrderDetailPanelProps) {
  const queryClient = useQueryClient();
  const [cancelConfirm, setCancelConfirm] = useState(false);
  const [cancelMemo, setCancelMemo] = useState("");
  const [paymentConfirm, setPaymentConfirm] = useState(false);
  const [paymentMethodInput, setPaymentMethodInput] = useState("");
  const [paymentMethodError, setPaymentMethodError] = useState(false);

  // 주문 수정 모드
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState({
    payment_method: "" as string,
    discount_amount: 0,
    send_fee: 0,
    customer_memo: "",
    admin_memo: "",
  });

  // 품목별 모달 상태
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [activeItem, setActiveItem] = useState<ActiveItem | null>(null);

  const { data: res, isLoading } = useQuery({
    queryKey: ["order", orderId],
    queryFn: () => ordersApi.getOrder(orderId).then((r) => r.data),
    enabled: !!orderId,
  });

  const order = res?.data;

  // 주문 데이터 로드 시 editForm 초기화
  useEffect(() => {
    if (order) {
      setEditForm({
        payment_method: order.payment_method ?? "",
        discount_amount: order.discount_amount,
        send_fee: order.send_fee,
        customer_memo: order.customer_memo ?? "",
        admin_memo: order.admin_memo ?? "",
      });
      setPaymentMethodInput(order.payment_method ?? "");
    }
  }, [order]);

  const paymentMutation = useMutation({
    mutationFn: () =>
      ordersApi.completePayment(orderId, {
        payment_method: paymentMethodInput as PaymentMethod,
      }),
    onSuccess: () => {
      toast.success("결제완료 처리되었습니다.");
      queryClient.invalidateQueries({ queryKey: ["order", orderId] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      setPaymentConfirm(false);
      setPaymentMethodError(false);
    },
    onError: () => toast.error("결제 처리 실패"),
  });

  const handlePaymentConfirm = () => {
    if (!paymentMethodInput) {
      setPaymentMethodError(true);
      return;
    }
    paymentMutation.mutate();
  };

  const updateMutation = useMutation({
    mutationFn: () =>
      ordersApi.updateOrder(orderId, {
        payment_method: (editForm.payment_method || null) as PaymentMethod | null,
        discount_amount: editForm.discount_amount,
        send_fee: editForm.send_fee,
        customer_memo: editForm.customer_memo || null,
        admin_memo: editForm.admin_memo || null,
      }),
    onSuccess: () => {
      toast.success("주문이 수정되었습니다.");
      queryClient.invalidateQueries({ queryKey: ["order", orderId] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      setEditMode(false);
    },
    onError: () => toast.error("주문 수정 실패"),
  });

  const cancelMutation = useMutation({
    mutationFn: () =>
      ordersApi.cancelOrder(orderId, { admin_memo: cancelMemo }),
    onSuccess: () => {
      toast.success("주문이 취소되었습니다.");
      queryClient.invalidateQueries({ queryKey: ["order", orderId] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      setCancelConfirm(false);
    },
    onError: () => toast.error("주문 취소 실패"),
  });

  // 품목 취소
  const [cancelItemMemo, setCancelItemMemo] = useState("");
  const cancelItemMutation = useMutation({
    mutationFn: () =>
      orderItemsApi.cancelOrderItem(activeItem!.order_item_id, {
        admin_memo: cancelItemMemo,
      }),
    onSuccess: () => {
      toast.success("품목이 취소되었습니다.");
      queryClient.invalidateQueries({ queryKey: ["order", orderId] });
      setActiveModal(null);
      setActiveItem(null);
      setCancelItemMemo("");
    },
    onError: () => toast.error("품목 취소 실패"),
  });

  const openModal = (type: ModalType, item: ActiveItem) => {
    setActiveItem(item);
    setActiveModal(type);
  };

  const closeModal = () => {
    setActiveModal(null);
    setActiveItem(null);
    setCancelItemMemo("");
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-gray-400">
        주문을 불러올 수 없습니다.
      </div>
    );
  }

  const customerId = order.customer?.customer_id ?? 0;

  return (
    <div className="flex flex-col h-full">
      {/* 패널 헤더 */}
      <div className="px-5 py-4 border-b border-gray-200 bg-white">
        <div className="flex items-start justify-between mb-3">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="font-mono text-xs text-gray-400">#{order.order_id}</span>
              <StatusBadge type="order_status" value={order.order_status} />
              <StatusBadge type="channel" value={order.order_channel} />
            </div>
            <div className="font-semibold text-gray-900 text-base leading-tight">
              {order.customer?.customer_name}
            </div>
            <div className="text-xs text-gray-400 font-mono mt-0.5">
              {formatPhone(order.customer?.customer_phone)}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1 rounded-md hover:bg-gray-100 flex-shrink-0 ml-2"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* 액션 버튼 */}
        <div className="flex items-center gap-2">
          {order.order_status === "ORDERED" && (
            <Button size="sm" onClick={() => setPaymentConfirm(true)}>
              결제완료 처리
            </Button>
          )}
          {order.order_status !== "CANCELLED" && !editMode && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditMode(true)}
              className="gap-1"
            >
              <Edit2 className="h-3 w-3" />
              수정
            </Button>
          )}
          {order.order_status !== "CANCELLED" && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCancelConfirm(true)}
              className="text-red-600 border-red-200 hover:bg-red-50"
            >
              주문 취소
            </Button>
          )}
        </div>
      </div>

      {/* 탭 */}
      <Tabs defaultValue="info" className="flex-1 overflow-hidden flex flex-col">
        <TabsList className="px-5 bg-white flex-shrink-0">
          <TabsTrigger value="info">기본정보</TabsTrigger>
          <TabsTrigger value="items">
            주문품목
            {order.items?.length ? (
              <span className="ml-1 text-xs text-gray-400">{order.items.length}</span>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="sends">
            발송내역
            {order.sends?.length ? (
              <span className="ml-1 text-xs text-gray-400">{order.sends.length}</span>
            ) : null}
          </TabsTrigger>
        </TabsList>

        <div className="flex-1 overflow-y-auto">
          {/* 기본 정보 탭 */}
          <TabsContent value="info" className="m-0 p-4 space-y-3">
            {/* 고객 정보 */}
            <Section title="고객 정보">
              <InfoRow label="고객명" value={order.customer?.customer_name} />
              <InfoRow label="연락처" value={formatPhone(order.customer?.customer_phone)} />
              <InfoRow label="이메일" value={order.customer?.customer_email} />
            </Section>

            {/* 배송지 정보 */}
            <Section title="배송지">
              <InfoRow label="수령인" value={order.address?.recipient_name} />
              <InfoRow label="연락처" value={formatPhone(order.address?.recipient_phone)} />
              <InfoRow
                label="주소"
                value={
                  order.address
                    ? `(${order.address.postal_code}) ${order.address.recipient_address}`
                    : null
                }
              />
              {order.address?.customer_memo && (
                <InfoRow label="배송 메모" value={order.address.customer_memo} />
              )}
            </Section>

            {/* 금액 정보 */}
            <Section title="금액">
              <InfoRow label="상품금액" value={formatAmount(order.total_amount)} />
              {editMode ? (
                <>
                  <div className="flex items-center justify-between py-0.5">
                    <span className="text-xs text-gray-500 w-20 flex-shrink-0">할인금액</span>
                    <Input
                      type="number"
                      min={0}
                      className="h-7 text-xs w-32"
                      value={editForm.discount_amount}
                      onChange={(e) => setEditForm((f) => ({ ...f, discount_amount: parseInt(e.target.value) || 0 }))}
                    />
                  </div>
                  <div className="flex items-center justify-between py-0.5">
                    <span className="text-xs text-gray-500 w-20 flex-shrink-0">배송비</span>
                    <Input
                      type="number"
                      min={0}
                      className="h-7 text-xs w-32"
                      value={editForm.send_fee}
                      onChange={(e) => setEditForm((f) => ({ ...f, send_fee: parseInt(e.target.value) || 0 }))}
                    />
                  </div>
                </>
              ) : (
                <>
                  {order.discount_amount > 0 && (
                    <InfoRow label="할인금액" value={`-${formatAmount(order.discount_amount)}`} />
                  )}
                  {order.send_fee > 0 && (
                    <InfoRow label="배송비" value={formatAmount(order.send_fee)} />
                  )}
                </>
              )}
              <InfoRow
                label="결제금액"
                value={
                  <span className="font-semibold text-gray-900">
                    {formatAmount(order.payment_amount)}
                  </span>
                }
              />
              {order.refund_amount > 0 && (
                <InfoRow
                  label="환불금액"
                  value={<span className="text-red-600">-{formatAmount(order.refund_amount)}</span>}
                />
              )}
            </Section>

            {/* 결제 정보 */}
            <Section title="결제 정보">
              {editMode ? (
                <div className="flex items-center justify-between py-0.5">
                  <span className="text-xs text-gray-500 w-20 flex-shrink-0">결제방법</span>
                  <Select
                    value={editForm.payment_method}
                    onValueChange={(v) => setEditForm((f) => ({ ...f, payment_method: v }))}
                  >
                    <SelectTrigger className="h-7 text-xs w-32">
                      <SelectValue placeholder="선택" />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_METHOD_OPTIONS.map((m) => (
                        <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <InfoRow label="결제방법" value={order.payment_method ? PAYMENT_METHOD_LABEL[order.payment_method] ?? order.payment_method : undefined} />
              )}
              <InfoRow label="주문일시" value={formatDateTime(order.order_at)} />
              {order.payment_at && (
                <InfoRow label="결제일시" value={formatDateTime(order.payment_at)} />
              )}
              {order.cancelled_at && (
                <InfoRow label="취소일시" value={formatDateTime(order.cancelled_at)} />
              )}
              {order.external_order_id && (
                <InfoRow label="외부주문번호" value={order.external_order_id} />
              )}
            </Section>

            {/* 메모 */}
            {editMode ? (
              <Section title="메모">
                <div className="space-y-2">
                  <div>
                    <Label className="text-xs text-gray-500">고객 메모</Label>
                    <Input
                      className="mt-1 h-8 text-xs"
                      value={editForm.customer_memo}
                      onChange={(e) => setEditForm((f) => ({ ...f, customer_memo: e.target.value }))}
                      placeholder="고객 메모"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">관리자 메모</Label>
                    <Input
                      className="mt-1 h-8 text-xs"
                      value={editForm.admin_memo}
                      onChange={(e) => setEditForm((f) => ({ ...f, admin_memo: e.target.value }))}
                      placeholder="관리자 메모"
                    />
                  </div>
                </div>
              </Section>
            ) : (
              (order.customer_memo || order.admin_memo) && (
                <Section title="메모">
                  {order.customer_memo && (
                    <InfoRow label="고객메모" value={order.customer_memo} />
                  )}
                  {order.admin_memo && (
                    <InfoRow label="관리자메모" value={order.admin_memo} />
                  )}
                </Section>
              )
            )}

            {/* 편집 모드 저장/취소 버튼 */}
            {editMode && (
              <div className="flex gap-2 pt-1">
                <Button
                  size="sm"
                  onClick={() => updateMutation.mutate()}
                  disabled={updateMutation.isPending}
                >
                  {updateMutation.isPending && <LoadingSpinner size="sm" className="mr-1" />}
                  저장
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setEditMode(false);
                    setEditForm({
                      payment_method: order.payment_method ?? "",
                      discount_amount: order.discount_amount,
                      send_fee: order.send_fee,
                      customer_memo: order.customer_memo ?? "",
                      admin_memo: order.admin_memo ?? "",
                    });
                  }}
                >
                  취소
                </Button>
              </div>
            )}

            {/* 시스템 */}
            <Section title="시스템">
              <InfoRow label="등록일시" value={formatDateTime(order.created_at)} />
              <InfoRow label="수정일시" value={formatDateTime(order.updated_at)} />
            </Section>
          </TabsContent>

          {/* 주문품목 탭 */}
          <TabsContent value="items" className="m-0 p-4 space-y-3">
            {order.items?.map((item) => (
              <OrderItemCard
                key={item.order_item_id}
                item={item}
                onAction={openModal}
              />
            ))}
            {(!order.items || order.items.length === 0) && (
              <p className="text-sm text-gray-400 text-center py-8">
                주문 품목이 없습니다.
              </p>
            )}
          </TabsContent>

          {/* 발송내역 탭 */}
          <TabsContent value="sends" className="m-0 p-4 space-y-3">
            {order.sends?.map((send) => (
              <div key={send.send_id} className="border border-gray-100 rounded-lg overflow-hidden">
                <div className="flex items-center justify-between px-3.5 py-2 bg-gray-50 border-b border-gray-100">
                  <StatusBadge type="send_status" value={send.send_status} />
                  <span className="text-xs text-gray-400 font-mono">#{send.send_id}</span>
                </div>
                <div className="px-3.5 py-3 space-y-2">
                  {send.tracking_no ? (
                    <div className="flex items-start gap-3">
                      <span className="text-xs text-gray-400 w-24 flex-shrink-0">운송장</span>
                      <span className="text-xs text-gray-700 font-mono">{send.courier_company} {send.tracking_no}</span>
                    </div>
                  ) : (
                    <div className="text-xs text-gray-300">운송장 미등록</div>
                  )}
                  {send.official_send_date && (
                    <div className="flex items-start gap-3">
                      <span className="text-xs text-gray-400 w-24 flex-shrink-0">발송예정일</span>
                      <span className="text-xs text-gray-700">{formatDate(send.official_send_date)}</span>
                    </div>
                  )}
                  {send.shipped_at && (
                    <div className="flex items-start gap-3">
                      <span className="text-xs text-gray-400 w-24 flex-shrink-0">배송시작</span>
                      <span className="text-xs text-gray-700">{formatDate(send.shipped_at)}</span>
                    </div>
                  )}
                  {send.delivered_at && (
                    <div className="flex items-start gap-3">
                      <span className="text-xs text-gray-400 w-24 flex-shrink-0">배송완료</span>
                      <span className="text-xs text-gray-700">{formatDate(send.delivered_at)}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {(!order.sends || order.sends.length === 0) && (
              <p className="text-sm text-gray-400 text-center py-8">
                발송 내역이 없습니다.
              </p>
            )}
          </TabsContent>
        </div>
      </Tabs>

      {/* 결제완료 확인 모달 */}
      <ConfirmModal
        open={paymentConfirm}
        onClose={() => { setPaymentConfirm(false); setPaymentMethodError(false); }}
        onConfirm={handlePaymentConfirm}
        title="결제완료 처리"
        description={
          <div className="space-y-3">
            <p>주문 상태를 '결제완료'로 변경합니다.</p>
            <div>
              <Label className={`text-xs ${paymentMethodError ? "text-red-500" : "text-gray-600"}`}>
                결제 방법 <span className="text-red-500">*</span>
              </Label>
              <Select
                value={paymentMethodInput}
                onValueChange={(v) => { setPaymentMethodInput(v); setPaymentMethodError(false); }}
              >
                <SelectTrigger className={`mt-1 h-8 text-sm ${paymentMethodError ? "border-red-500" : ""}`}>
                  <SelectValue placeholder="선택해주세요" />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHOD_OPTIONS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {paymentMethodError && (
                <p className="text-xs text-red-500 mt-1">결제 방법을 선택해주세요.</p>
              )}
            </div>
          </div>
        }
        confirmLabel="결제완료"
        isLoading={paymentMutation.isPending}
      />

      {/* 주문 취소 확인 모달 */}
      <ConfirmModal
        open={cancelConfirm}
        onClose={() => setCancelConfirm(false)}
        onConfirm={() => cancelMutation.mutate()}
        title="주문 취소"
        description={
          <div className="space-y-3">
            <p>이 주문을 취소합니다. 취소 후에는 되돌릴 수 없습니다.</p>
            <textarea
              className="w-full border border-gray-300 rounded-md p-2 text-sm resize-none h-20 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="취소 사유를 입력해주세요."
              value={cancelMemo}
              onChange={(e) => setCancelMemo(e.target.value)}
            />
          </div>
        }
        confirmLabel="주문 취소"
        variant="destructive"
        isLoading={cancelMutation.isPending}
      />

      {/* 품목 취소 확인 모달 */}
      <ConfirmModal
        open={activeModal === "cancelItem"}
        onClose={closeModal}
        onConfirm={() => cancelItemMutation.mutate()}
        title="품목 취소"
        description={
          <div className="space-y-3">
            <p>
              <span className="font-medium">{activeItem?.product_name}</span> 품목을 취소합니다.
            </p>
            <textarea
              className="w-full border border-gray-300 rounded-md p-2 text-sm resize-none h-20 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="취소 사유를 입력해주세요."
              value={cancelItemMemo}
              onChange={(e) => setCancelItemMemo(e.target.value)}
            />
          </div>
        }
        confirmLabel="품목 취소"
        variant="destructive"
        isLoading={cancelItemMutation.isPending}
      />

      {/* 구독 연장 모달 */}
      {activeItem && (
        <SubscriptionExtendModal
          open={activeModal === "extend"}
          onClose={closeModal}
          item={activeItem}
          orderId={orderId}
        />
      )}

      {/* 구독 단축 모달 */}
      {activeItem && (
        <SubscriptionShortenModal
          open={activeModal === "shorten"}
          onClose={closeModal}
          item={activeItem}
          orderId={orderId}
        />
      )}

      {/* 기간 이동 모달 */}
      {activeItem && (
        <SubscriptionChangePeriodModal
          open={activeModal === "changePeriod"}
          onClose={closeModal}
          item={activeItem}
          orderId={orderId}
        />
      )}

      {/* 휴지 등록 모달 */}
      {activeItem && (
        <PauseCreateModal
          open={activeModal === "pause"}
          onClose={closeModal}
          item={activeItem}
          orderId={orderId}
        />
      )}

      {/* 배송지 변경 모달 */}
      {activeItem && (
        <AddressChangeModal
          open={activeModal === "addressChange"}
          onClose={closeModal}
          item={activeItem}
          orderId={orderId}
          customerId={customerId}
        />
      )}

      {/* 품목 수정 모달 */}
      {activeItem && (
        <OrderItemEditModal
          open={activeModal === "editItem"}
          onClose={closeModal}
          item={activeItem}
          orderId={orderId}
        />
      )}
    </div>
  );
}

// 섹션 컴포넌트
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border border-gray-100 rounded-lg overflow-hidden">
      <div className="px-3.5 py-2 bg-gray-50 border-b border-gray-100">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{title}</h3>
      </div>
      <div className="px-3.5 py-3 space-y-2.5">{children}</div>
    </div>
  );
}

// 정보 행 컴포넌트
function InfoRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3">
      <span className="text-xs text-gray-400 w-24 flex-shrink-0 pt-0.5">{label}</span>
      <span className="text-sm text-gray-700 flex-1">{value}</span>
    </div>
  );
}

// 주문품목 카드
function OrderItemCard({
  item,
  onAction,
}: {
  item: ActiveItem;
  onAction: (type: ModalType, item: ActiveItem) => void;
}) {
  const isYearly = item.product_kind === "YEARLY";
  const isCancelled = !!item.cancelled_at;

  return (
    <div className={`border rounded-lg p-3.5 ${isCancelled ? "border-gray-100 bg-gray-50/60" : "border-gray-200"}`}>
      <div className="flex items-start justify-between mb-2.5">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <StatusBadge type="product_kind" value={item.product_kind} />
            {isCancelled && (
              <span className="text-[11px] text-red-500 bg-red-50 px-1.5 py-0.5 rounded">취소됨</span>
            )}
          </div>
          <div className="font-medium text-sm text-gray-900">{item.product_name}</div>
          <div className="text-xs text-gray-400 font-mono">{item.product_code}</div>
        </div>
        {!isCancelled && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onAction("editItem", item)}>
                품목 수정
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onAction("addressChange", item)}>
                배송지 변경
              </DropdownMenuItem>
              {isYearly && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => onAction("extend", item)}>
                    구독 연장
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onAction("changePeriod", item)}>
                    기간 이동
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onAction("shorten", item)}>
                    기간 단축
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onAction("pause", item)}>
                    휴지 등록
                  </DropdownMenuItem>
                </>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-red-600 focus:text-red-600 focus:bg-red-50"
                onClick={() => onAction("cancelItem", item)}
              >
                품목 취소
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
        <div className="text-gray-400">수량 / 판매가</div>
        <div className="text-gray-700">
          {item.order_num}개 / {formatAmount(item.sale_price)}
        </div>

        {isYearly && (
          <>
            <div className="text-gray-400">구독 기간</div>
            <div className="text-gray-700">
              {formatIssue(item.final_subscribe_start_issue)} ~{" "}
              {formatIssue(item.final_subscribe_end_issue)}
            </div>
            {item.paid_subscribe_end_issue && item.paid_subscribe_end_issue !== item.subscribe_end_issue && (
              <>
                <div className="text-gray-400">유료 연장 종료</div>
                <div className="text-gray-700">{formatIssue(item.paid_subscribe_end_issue)}</div>
              </>
            )}
            {item.last_send_issue && (
              <>
                <div className="text-gray-400">마지막 발송</div>
                <div className="text-gray-700">{formatIssue(item.last_send_issue)}</div>
              </>
            )}
          </>
        )}

        {isCancelled && item.refund_amount > 0 && (
          <>
            <div className="text-gray-400">환불금액</div>
            <div className="text-red-600">-{formatAmount(item.refund_amount)}</div>
          </>
        )}
      </div>

      {/* 휴지 목록 */}
      {isYearly && item.pauses && item.pauses.length > 0 && (
        <div className="mt-2.5 pt-2.5 border-t border-gray-100 space-y-1">
          <div className="text-xs font-medium text-gray-500">휴지 내역</div>
          {item.pauses.map((pause) => (
            <div key={pause.pause_id} className="flex items-center justify-between text-xs">
              <span className="text-gray-700">{formatIssue(pause.pause_issue)}</span>
              {pause.reason && (
                <span className="text-gray-400 truncate ml-2 max-w-[160px]">{pause.reason}</span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 관리자 메모 */}
      {item.admin_memo && (
        <div className="mt-2.5 pt-2.5 border-t border-gray-100">
          <div className="text-xs text-gray-400">메모: <span className="text-gray-600">{item.admin_memo}</span></div>
        </div>
      )}
    </div>
  );
}
