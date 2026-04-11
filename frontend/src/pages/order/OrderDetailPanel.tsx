import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useDebounce } from "@/hooks/useDebounce";
import { X, MoreHorizontal, Edit2, Plus } from "lucide-react";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { StatusBadge } from "@/components/common/StatusBadge";
import { ConfirmModal } from "@/components/common/ConfirmModal";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { SlidingPanel } from "@/components/common/SlidingPanel";
import { ordersApi } from "@/api/ordersApi";
import { orderItemsApi } from "@/api/orderItemsApi";
import { sendsApi } from "@/api/sendsApi";
import { productsApi } from "@/api/productsApi";
import { toast } from "@/hooks/use-toast";
import { formatAmount, formatDate, formatDateTime, formatPhone, formatPhoneInput, formatIssue } from "@/utils/format";
import { getErrorMessage } from "@/utils/errorHandler";
import { PAYMENT_METHOD_LABEL, PAYMENT_METHOD_OPTIONS, CHANNEL_LABEL, CHANNEL_OPTIONS } from "@/utils/constants";
import { addressesApi } from "@/api/addressesApi";
import { AddressSearchField } from "@/components/common/AddressSearchField";
import type { OrderItemDetailResponse } from "@/types/orderItem";
import { PaymentMethod } from "@/types/order";
import SubscriptionDetailPanel from "../subscription/SubscriptionDetailPanel";
import { AddressChangeModal } from "./modals/AddressChangeModal";
import { OrderItemEditModal } from "./modals/OrderItemEditModal";
import { OrderItemCancelModal } from "./modals/OrderItemCancelModal";

interface OrderDetailPanelProps {
  orderId: number;
  onClose: () => void;
}

type ModalType = "addressChange" | "cancelItem" | "editItem" | null;
type ActiveItem = OrderItemDetailResponse;


export default function OrderDetailPanel({ orderId, onClose }: OrderDetailPanelProps) {
  const queryClient = useQueryClient();
  const [cancelConfirm, setCancelConfirm] = useState(false);
  const [cancelMemo, setCancelMemo] = useState("");
  const [cancelRefundManual, setCancelRefundManual] = useState(false);
  const [cancelRefundAmount, setCancelRefundAmount] = useState<string>("");
  const [cancelRefundBank, setCancelRefundBank] = useState("");
  const [cancelRefundAccount, setCancelRefundAccount] = useState("");
  const [paymentConfirm, setPaymentConfirm] = useState(false);
  const [paymentMethodInput, setPaymentMethodInput] = useState("");
  const [paymentMethodError, setPaymentMethodError] = useState(false);

  // 주문 수정 모드
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState({
    order_channel: "" as string,
    payment_method: "" as string,
    refund_amount: 0,
    send_fee: 0,
    payment_at: "" as string,
    customer_memo: "",
    admin_memo: "",
  });
  // 배송지 변경
  const [addressChangeOpen, setAddressChangeOpen] = useState(false);
  const [addressMode, setAddressMode] = useState<"existing" | "new">("existing");
  const [selectedAddressId, setSelectedAddressId] = useState<number | null>(null);
  const [newAddr, setNewAddr] = useState({
    recipient_name: "",
    recipient_phone: "",
    postal_code: "",
    recipient_address: "",
    customer_memo: "",
    admin_memo: "",
  });
  const [addressConfirmOpen, setAddressConfirmOpen] = useState(false);

  // 품목별 모달 상태
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [activeItem, setActiveItem] = useState<ActiveItem | null>(null);

  // 구독 상세 패널
  const [subscriptionItem, setSubscriptionItem] = useState<ActiveItem | null>(null);

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
        order_channel: order.order_channel ?? "",
        payment_method: order.payment_method ?? "",
        refund_amount: order.refund_amount,
        send_fee: order.send_fee,
        payment_at: order.payment_at ? order.payment_at.slice(0, 16) : "",
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
    onError: (err) => toast.error(getErrorMessage(err)),
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
        order_channel: editForm.order_channel || undefined,
        payment_method: (editForm.payment_method || null) as PaymentMethod | null,
        refund_amount: editForm.refund_amount,
        send_fee: editForm.send_fee,
        payment_at: editForm.payment_at || null,
        customer_memo: editForm.customer_memo || null,
        admin_memo: editForm.admin_memo || null,
      }),
    onSuccess: () => {
      toast.success("주문이 수정되었습니다.");
      queryClient.invalidateQueries({ queryKey: ["order", orderId] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      setEditMode(false);
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  // 고객 배송지 목록 조회
  const { data: customerAddresses } = useQuery({
    queryKey: ["customerAddresses", order?.customer_id],
    queryFn: () => addressesApi.getAddressesByCustomer(order!.customer_id).then((r) => r.data),
    enabled: !!order?.customer_id && addressChangeOpen,
  });

  // 배송지 변경 mutation
  const addressChangeMutation = useMutation({
    mutationFn: async () => {
      let addressId: number;
      if (addressMode === "existing") {
        addressId = selectedAddressId!;
      } else {
        // 신규 배송지 생성 후 address_id 사용
        const res = await addressesApi.createAddress({
          customer_id: order!.customer_id,
          recipient_name: newAddr.recipient_name,
          recipient_phone: newAddr.recipient_phone,
          postal_code: newAddr.postal_code,
          recipient_address: newAddr.recipient_address,
          customer_memo: newAddr.customer_memo || undefined,
          admin_memo: newAddr.admin_memo || undefined,
        });
        addressId = res.data.data!.address_id;
      }
      return ordersApi.updateOrder(orderId, { address_id: addressId });
    },
    onSuccess: () => {
      toast.success("배송지가 변경되었습니다. (모든 품목 일괄 변경)");
      queryClient.invalidateQueries({ queryKey: ["order", orderId] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      handleAddressClose();
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const handleAddressClose = () => {
    setAddressChangeOpen(false);
    setAddressConfirmOpen(false);
    setSelectedAddressId(null);
    setAddressMode("existing");
    setNewAddr({ recipient_name: "", recipient_phone: "", postal_code: "", recipient_address: "", customer_memo: "", admin_memo: "" });
  };

  const canSubmitAddress =
    addressMode === "existing"
      ? !!selectedAddressId && selectedAddressId !== order?.address_id
      : !!newAddr.recipient_name && !!newAddr.recipient_phone && !!newAddr.postal_code && !!newAddr.recipient_address;

  // 취소 환불 계산 미리보기
  const cancelCalcQuery = useQuery({
    queryKey: ["cancelCalculate", orderId],
    queryFn: async () => {
      const res = await ordersApi.cancelCalculate(orderId);
      return res.data.data;
    },
    enabled: cancelConfirm,
  });

  const cancelMutation = useMutation({
    mutationFn: () =>
      ordersApi.cancelOrder(orderId, {
        admin_memo: cancelMemo,
        ...(cancelRefundManual && cancelRefundAmount !== ""
          ? { refund_amount: parseInt(cancelRefundAmount, 10) }
          : {}),
        ...(cancelRefundBank && cancelRefundAccount
          ? { refund_bank: cancelRefundBank, refund_account: cancelRefundAccount }
          : {}),
      }),
    onSuccess: () => {
      toast.success("주문이 취소되었습니다.");
      queryClient.invalidateQueries({ queryKey: ["order", orderId] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      setCancelConfirm(false);
      setCancelMemo("");
      setCancelRefundManual(false);
      setCancelRefundAmount("");
      setCancelRefundBank("");
      setCancelRefundAccount("");
      queryClient.removeQueries({ queryKey: ["cancelCalculate", orderId] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  // 발송 액션 상태
  const [sendTrackingTarget, setSendTrackingTarget] = useState<number | null>(null);
  const [trackingForm, setTrackingForm] = useState({ tracking_no: "", courier_company: "CJ대한통운" });
  const [sendCancelTarget, setSendCancelTarget] = useState<number | null>(null);

  const sendShippingMutation = useMutation({
    mutationFn: (sendId: number) => sendsApi.batchShipping([sendId]),
    onSuccess: () => {
      toast.success("배송중으로 전환되었습니다.");
      queryClient.invalidateQueries({ queryKey: ["order", orderId] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const sendDeliveredMutation = useMutation({
    mutationFn: (sendId: number) => sendsApi.batchDelivered([sendId]),
    onSuccess: () => {
      toast.success("배송완료로 전환되었습니다.");
      queryClient.invalidateQueries({ queryKey: ["order", orderId] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const sendTrackingMutation = useMutation({
    mutationFn: (sendId: number) => sendsApi.updateTracking(sendId, {
      tracking_no: trackingForm.tracking_no,
      courier_company: trackingForm.courier_company,
    }),
    onSuccess: () => {
      toast.success("운송장이 등록되었습니다.");
      queryClient.invalidateQueries({ queryKey: ["order", orderId] });
      setSendTrackingTarget(null);
      setTrackingForm({ tracking_no: "", courier_company: "CJ대한통운" });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const sendCancelMutation = useMutation({
    mutationFn: (sendId: number) => sendsApi.cancelSend(sendId),
    onSuccess: () => {
      toast.success("발송이 취소되었습니다.");
      queryClient.invalidateQueries({ queryKey: ["order", orderId] });
      setSendCancelTarget(null);
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const invalidateOrder = () => {
    queryClient.invalidateQueries({ queryKey: ["order", orderId] });
  };

  // 품목 추가
  const [addItemOpen, setAddItemOpen] = useState(false);
  const [addItemForm, setAddItemForm] = useState({
    product_code: "",
    subscribe_start_issue: "",
    subscribe_period: 12,
    order_num: 1,
    sale_price: "" as string | number,
    admin_memo: "",
  });
  const [productSearch, setProductSearch] = useState("");
  const [productDropdownOpen, setProductDropdownOpen] = useState(false);
  const productSearchDebounced = useDebounce(productSearch, 300);
  const productDropdownRef = useRef<HTMLDivElement>(null);

  const { data: productSearchRes } = useQuery({
    queryKey: ["products-search", productSearchDebounced],
    queryFn: () => productsApi.getProducts({ page: 1, limit: 10, search: productSearchDebounced || null }).then((r) => r.data),
    enabled: productDropdownOpen && productSearchDebounced.length >= 1,
  });

  const addItemMutation = useMutation({
    mutationFn: () =>
      orderItemsApi.createOrderItem({
        order_id: orderId,
        address_id: order!.address_id,
        product_code: addItemForm.product_code,
        order_num: addItemForm.order_num,
        sale_price: addItemForm.sale_price !== "" ? Number(addItemForm.sale_price) : null,
        subscribe_start_issue: addItemForm.subscribe_start_issue,
        subscribe_period: addItemForm.subscribe_period,
        admin_memo: addItemForm.admin_memo || null,
      }),
    onSuccess: () => {
      toast.success("품목이 추가되었습니다.");
      queryClient.invalidateQueries({ queryKey: ["order", orderId] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      setAddItemOpen(false);
      setAddItemForm({ product_code: "", subscribe_start_issue: "", subscribe_period: 12, order_num: 1, sale_price: "", admin_memo: "" });
      setProductSearch("");
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const openModal = (type: ModalType, item: ActiveItem) => {
    setActiveItem(item);
    setActiveModal(type);
  };

  const closeModal = () => {
    setActiveModal(null);
    setActiveItem(null);
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
              {order.customer?.admin_memo && (
                <InfoRow label="관리자메모" value={order.customer.admin_memo} />
              )}
            </Section>

            {/* 배송지 정보 */}
            <Section title="배송지" action={editMode ? (
              <Button variant="outline" size="sm" className="h-6 text-xs px-2" onClick={() => setAddressChangeOpen(true)}>
                배송지 변경
              </Button>
            ) : undefined}>
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
              {order.address?.admin_memo && (
                <InfoRow label="관리자메모" value={order.address.admin_memo} />
              )}
            </Section>

            {/* 금액 정보 */}
            <Section title="금액">
              <InfoRow label="상품금액" value={formatAmount(order.total_amount)} />
              {editMode ? (
                <EditRow label="배송비">
                  <Input
                    type="number"
                    min={0}
                    className="h-7 text-xs flex-1"
                    value={editForm.send_fee}
                    onChange={(e) => setEditForm((f) => ({ ...f, send_fee: parseInt(e.target.value) || 0 }))}
                  />
                </EditRow>
              ) : (
                order.send_fee > 0 && (
                  <InfoRow label="배송비" value={formatAmount(order.send_fee)} />
                )
              )}
              <InfoRow
                label="결제금액"
                value={
                  <span className="font-semibold text-gray-900">
                    {formatAmount(order.payment_amount)}
                  </span>
                }
              />
              {editMode ? (
                <EditRow label="환불금액">
                  <Input
                    type="number"
                    min={0}
                    className="h-7 text-xs flex-1"
                    value={editForm.refund_amount}
                    onChange={(e) => setEditForm((f) => ({ ...f, refund_amount: parseInt(e.target.value) || 0 }))}
                  />
                </EditRow>
              ) : (
                order.refund_amount > 0 && (
                  <InfoRow
                    label="환불금액"
                    value={<span className="text-red-600">-{formatAmount(order.refund_amount)}</span>}
                  />
                )
              )}
            </Section>

            {/* 결제 정보 */}
            <Section title="결제 정보">
              {editMode ? (
                <EditRow label="주문채널">
                  <Select
                    value={editForm.order_channel}
                    onValueChange={(v) => setEditForm((f) => ({ ...f, order_channel: v }))}
                  >
                    <SelectTrigger className="h-7 text-xs flex-1">
                      <SelectValue placeholder="선택" />
                    </SelectTrigger>
                    <SelectContent>
                      {CHANNEL_OPTIONS.map((c) => (
                        <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </EditRow>
              ) : (
                <InfoRow label="주문채널" value={CHANNEL_LABEL[order.order_channel] ?? order.order_channel} />
              )}
              {editMode ? (
                <EditRow label="결제방법">
                  <Select
                    value={editForm.payment_method}
                    onValueChange={(v) => setEditForm((f) => ({ ...f, payment_method: v }))}
                  >
                    <SelectTrigger className="h-7 text-xs flex-1">
                      <SelectValue placeholder="선택" />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_METHOD_OPTIONS.map((m) => (
                        <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </EditRow>
              ) : (
                <InfoRow label="결제방법" value={order.payment_method ? PAYMENT_METHOD_LABEL[order.payment_method] ?? order.payment_method : undefined} />
              )}
              <InfoRow label="주문일시" value={formatDateTime(order.order_at)} />
              {editMode ? (
                <EditRow label="결제일시">
                  <Input
                    type="datetime-local"
                    className="h-7 text-xs flex-1"
                    value={editForm.payment_at}
                    onChange={(e) => setEditForm((f) => ({ ...f, payment_at: e.target.value }))}
                  />
                </EditRow>
              ) : (
                order.payment_at && (
                  <InfoRow label="결제일시" value={formatDateTime(order.payment_at)} />
                )
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
                <EditRow label="고객메모">
                  <Input
                    className="h-7 text-xs flex-1"
                    value={editForm.customer_memo}
                    onChange={(e) => setEditForm((f) => ({ ...f, customer_memo: e.target.value }))}
                    placeholder="고객 메모"
                  />
                </EditRow>
                <EditRow label="관리자메모">
                  <Input
                    className="h-7 text-xs flex-1"
                    value={editForm.admin_memo}
                    onChange={(e) => setEditForm((f) => ({ ...f, admin_memo: e.target.value }))}
                    placeholder="관리자 메모"
                  />
                </EditRow>
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
                      order_channel: order.order_channel ?? "",
                      payment_method: order.payment_method ?? "",
                      refund_amount: order.refund_amount,
                      send_fee: order.send_fee,
                      payment_at: order.payment_at ? order.payment_at.slice(0, 16) : "",
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
            {order.order_status !== "CANCELLED" && (
              <div className="flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1 text-xs"
                  onClick={() => setAddItemOpen(true)}
                >
                  <Plus className="h-3 w-3" />
                  품목 추가
                </Button>
              </div>
            )}
            {order.items?.map((item) => (
              <OrderItemCard
                key={item.order_item_id}
                item={item}
                onAction={openModal}
                onSubscriptionDetail={setSubscriptionItem}
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
                  <div className="flex items-center gap-2">
                    <StatusBadge type="send_status" value={send.send_status} />
                    <span className="text-xs text-gray-400 font-mono">#{send.send_id}</span>
                  </div>
                  {send.send_status !== "CANCELLED" && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon-sm">
                          <MoreHorizontal className="h-3.5 w-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {send.send_status === "PREPARING" && (
                          <DropdownMenuItem
                            onClick={() => sendShippingMutation.mutate(send.send_id)}
                            disabled={sendShippingMutation.isPending}
                          >
                            배송중 전환
                          </DropdownMenuItem>
                        )}
                        {send.send_status === "SHIPPING" && (
                          <DropdownMenuItem
                            onClick={() => sendDeliveredMutation.mutate(send.send_id)}
                            disabled={sendDeliveredMutation.isPending}
                          >
                            배송완료 전환
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          onClick={() => {
                            setSendTrackingTarget(send.send_id);
                            setTrackingForm({
                              tracking_no: send.tracking_no ?? "",
                              courier_company: send.courier_company ?? "CJ대한통운",
                            });
                          }}
                        >
                          운송장 등록
                        </DropdownMenuItem>
                        {send.send_status === "PREPARING" && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-red-600 focus:text-red-600 focus:bg-red-50"
                              onClick={() => setSendCancelTarget(send.send_id)}
                            >
                              발송 취소
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
                <div className="px-3.5 py-3 space-y-2">
                  {/* 수령인 정보 */}
                  <div className="flex items-start gap-3">
                    <span className="text-xs text-gray-400 w-24 flex-shrink-0">수령인</span>
                    <span className="text-xs text-gray-700">{send.recipient_name} / {formatPhone(send.recipient_phone)}</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="text-xs text-gray-400 w-24 flex-shrink-0">주소</span>
                    <span className="text-xs text-gray-700">({send.postal_code}) {send.recipient_address}</span>
                  </div>
                  {send.customer_memo && (
                    <div className="flex items-start gap-3">
                      <span className="text-xs text-gray-400 w-24 flex-shrink-0">배송메모</span>
                      <span className="text-xs text-gray-700">{send.customer_memo}</span>
                    </div>
                  )}
                  {send.admin_memo && (
                    <div className="flex items-start gap-3">
                      <span className="text-xs text-gray-400 w-24 flex-shrink-0">관리자메모</span>
                      <span className="text-xs text-gray-700">{send.admin_memo}</span>
                    </div>
                  )}
                  {/* 운송장 */}
                  {send.tracking_no ? (
                    <div className="flex items-start gap-3">
                      <span className="text-xs text-gray-400 w-24 flex-shrink-0">운송장</span>
                      <span className="text-xs text-gray-700 font-mono">{send.courier_company} {send.tracking_no}</span>
                    </div>
                  ) : (
                    <div className="text-xs text-gray-300">운송장 미등록</div>
                  )}
                  {/* 타임스탬프 */}
                  {send.official_send_date && (
                    <div className="flex items-start gap-3">
                      <span className="text-xs text-gray-400 w-24 flex-shrink-0">발송예정일</span>
                      <span className="text-xs text-gray-700">{formatDate(send.official_send_date)}</span>
                    </div>
                  )}
                  {send.prepared_at && (
                    <div className="flex items-start gap-3">
                      <span className="text-xs text-gray-400 w-24 flex-shrink-0">준비완료</span>
                      <span className="text-xs text-gray-700">{formatDateTime(send.prepared_at)}</span>
                    </div>
                  )}
                  {send.shipped_at && (
                    <div className="flex items-start gap-3">
                      <span className="text-xs text-gray-400 w-24 flex-shrink-0">배송시작</span>
                      <span className="text-xs text-gray-700">{formatDateTime(send.shipped_at)}</span>
                    </div>
                  )}
                  {send.delivered_at && (
                    <div className="flex items-start gap-3">
                      <span className="text-xs text-gray-400 w-24 flex-shrink-0">배송완료</span>
                      <span className="text-xs text-gray-700">{formatDateTime(send.delivered_at)}</span>
                    </div>
                  )}
                  {send.cancelled_at && (
                    <div className="flex items-start gap-3">
                      <span className="text-xs text-gray-400 w-24 flex-shrink-0">취소일시</span>
                      <span className="text-xs text-red-600">{formatDateTime(send.cancelled_at)}</span>
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

      {/* 배송지 변경 다이얼로그 */}
      <Dialog open={addressChangeOpen} onOpenChange={(o) => { if (!o) handleAddressClose(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>배송지 변경</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            {/* 현재 배송지 */}
            {order?.address && (
              <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-600 space-y-1">
                <div className="text-xs font-medium text-gray-500 mb-1">현재 배송지</div>
                <div className="flex justify-between">
                  <span>{order.address.recipient_name}</span>
                  <span className="font-mono">{formatPhone(order.address.recipient_phone)}</span>
                </div>
                <div className="text-gray-500">
                  ({order.address.postal_code}) {order.address.recipient_address}
                </div>
              </div>
            )}

            {/* 모드 선택 */}
            <div className="flex gap-2">
              <button
                className={`px-3 py-1.5 text-xs rounded-md border transition-colors ${
                  addressMode === "existing"
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-gray-600 border-gray-300"
                }`}
                onClick={() => setAddressMode("existing")}
              >
                기존 배송지
              </button>
              <button
                className={`px-3 py-1.5 text-xs rounded-md border transition-colors ${
                  addressMode === "new"
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-gray-600 border-gray-300"
                }`}
                onClick={() => setAddressMode("new")}
              >
                신규 입력
              </button>
            </div>

            {/* 기존 배송지 목록 */}
            {addressMode === "existing" && (
              <div className="space-y-1.5 max-h-52 overflow-y-auto">
                {customerAddresses?.data?.length ? (
                  customerAddresses.data.map((addr) => (
                    <button
                      key={addr.address_id}
                      onClick={() => setSelectedAddressId(addr.address_id)}
                      className={`w-full text-left border rounded-lg p-2.5 text-xs transition-colors ${
                        selectedAddressId === addr.address_id
                          ? "border-blue-500 bg-blue-50"
                          : addr.address_id === order?.address_id
                          ? "border-gray-300 bg-gray-50"
                          : "border-gray-200 hover:bg-gray-50"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="font-medium text-gray-900">{addr.recipient_name}</span>
                        <span className="font-mono text-gray-500">{formatPhone(addr.recipient_phone)}</span>
                      </div>
                      <div className="text-gray-500">
                        ({addr.postal_code}) {addr.recipient_address}
                      </div>
                      {addr.customer_memo && (
                        <div className="text-gray-400 mt-0.5">{addr.customer_memo}</div>
                      )}
                      {addr.address_id === order?.address_id && (
                        <span className="text-xs text-blue-600 mt-1 inline-block">현재 배송지</span>
                      )}
                    </button>
                  ))
                ) : (
                  <p className="text-sm text-gray-500 text-center py-4">등록된 배송지가 없습니다.</p>
                )}
              </div>
            )}

            {/* 신규 배송지 입력 */}
            {addressMode === "new" && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">수령인 *</Label>
                    <Input
                      className="mt-1"
                      value={newAddr.recipient_name}
                      onChange={(e) => setNewAddr((p) => ({ ...p, recipient_name: e.target.value }))}
                      placeholder="수령인"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">연락처 *</Label>
                    <Input
                      className="mt-1"
                      value={newAddr.recipient_phone}
                      onChange={(e) => setNewAddr((p) => ({ ...p, recipient_phone: formatPhoneInput(e.target.value) }))}
                      placeholder="010-0000-0000"
                    />
                  </div>
                </div>
                <AddressSearchField
                  postalCode={newAddr.postal_code}
                  address={newAddr.recipient_address}
                  onChange={(postal_code, recipient_address) =>
                    setNewAddr((p) => ({ ...p, postal_code, recipient_address }))
                  }
                  required
                />
                <div>
                  <Label className="text-xs">배송 메모</Label>
                  <Input
                    className="mt-1"
                    value={newAddr.customer_memo}
                    onChange={(e) => setNewAddr((p) => ({ ...p, customer_memo: e.target.value }))}
                    placeholder="(선택)"
                  />
                </div>
                <div>
                  <Label className="text-xs">관리자 메모</Label>
                  <Input
                    className="mt-1"
                    value={newAddr.admin_memo}
                    onChange={(e) => setNewAddr((p) => ({ ...p, admin_memo: e.target.value }))}
                    placeholder="(선택)"
                  />
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleAddressClose}>취소</Button>
            <Button
              disabled={!canSubmitAddress}
              onClick={() => setAddressConfirmOpen(true)}
            >
              변경
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 배송지 변경 경고 모달 */}
      <ConfirmModal
        open={addressConfirmOpen}
        onClose={() => setAddressConfirmOpen(false)}
        onConfirm={() => addressChangeMutation.mutate()}
        title="배송지 일괄 변경"
        description="이 주문의 모든 품목 배송지가 선택한 배송지로 일괄 변경됩니다. 계속하시겠습니까?"
        confirmLabel="일괄 변경"
        variant="destructive"
        isLoading={addressChangeMutation.isPending}
      />

      {/* 주문 취소 확인 모달 */}
      <ConfirmModal
        open={cancelConfirm}
        onClose={() => {
          setCancelConfirm(false);
          setCancelMemo("");
          setCancelRefundManual(false);
          setCancelRefundAmount("");
          setCancelRefundBank("");
          setCancelRefundAccount("");
          queryClient.removeQueries({ queryKey: ["cancelCalculate", orderId] });
        }}
        onConfirm={() => {
          if (!cancelMemo.trim()) {
            toast.error("취소 사유를 입력해주세요.");
            return;
          }
          cancelMutation.mutate();
        }}
        title="주문 취소"
        description={
          <div className="space-y-3">
            <p>이 주문을 취소합니다. 취소 후에는 되돌릴 수 없습니다.</p>

            {/* 1. 환불 계산 내역 — 테이블 형태 */}
            {cancelCalcQuery.data && (
              <div className="bg-gray-50 rounded-md overflow-hidden text-xs">
                <div className="px-3 py-2 font-medium text-gray-700 border-b border-gray-200">
                  환불 계산 내역
                </div>
                {cancelCalcQuery.data.order_status === "ORDERED" ? (
                  <div className="px-3 py-3 text-gray-500">결제 전 주문이므로 환불금 없음</div>
                ) : (
                  <>
                    {/* 품목 헤더 */}
                    <div className="grid grid-cols-[1fr_auto_auto] gap-2 px-3 py-1.5 text-gray-400 border-b border-gray-100">
                      <span>품목</span>
                      <span className="text-right w-8">수량</span>
                      <span className="text-right w-20">환불금</span>
                    </div>
                    {/* 품목 목록 */}
                    {cancelCalcQuery.data.items.map((item) => (
                      <div key={item.order_item_id} className="px-3 py-1.5 border-b border-gray-100">
                        <div className="grid grid-cols-[1fr_auto_auto] gap-2 text-gray-700">
                          <span className="truncate">{item.product_name}</span>
                          <span className="text-right w-8">{item.order_num}</span>
                          <span className="text-right w-20">{formatAmount(item.item_refund)}</span>
                        </div>
                        {item.product_kind === "YEARLY" && item.total_period != null && (
                          <div className="text-gray-400 mt-0.5 pl-2 space-y-0.5">
                            <p>└ {item.total_period}개월 중 {item.delivered_count}개월 배송, 잔여 {item.remaining_period}개월</p>
                            {item.unit_price != null && item.delivered_count > 0 && (
                              <p className="pl-3">
                                {formatAmount(item.unit_price)}/월 × {item.remaining_period}개월{item.order_num > 1 ? ` × ${item.order_num}` : ""}
                              </p>
                            )}
                          </div>
                        )}
                        {item.product_kind === "MONTHLY" && item.delivered_count === 0 && (
                          <p className="text-gray-400 mt-0.5 pl-2">└ 미배송 (전액 환불)</p>
                        )}
                      </div>
                    ))}
                    {/* 배송비 */}
                    {cancelCalcQuery.data.send_fee > 0 && (
                      <div className="px-3 py-1.5 border-b border-gray-200">
                        <div className="flex justify-between text-gray-600">
                          <span>배송비 환불</span>
                          <span>+{formatAmount(cancelCalcQuery.data.send_fee)}</span>
                        </div>
                      </div>
                    )}
                    {/* 합계 */}
                    <div className="px-3 py-2 space-y-1">
                      <div className="flex justify-between font-medium text-gray-900">
                        <span>예상 환불금</span>
                        <span>{formatAmount(cancelCalcQuery.data.total_refund)}</span>
                      </div>
                      <div className="flex justify-between text-gray-400">
                        <span>결제금</span>
                        <span>{formatAmount(cancelCalcQuery.data.payment_amount)}</span>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
            {cancelCalcQuery.isLoading && (
              <p className="text-xs text-gray-400">환불 계산 중...</p>
            )}

            {/* 2. 환불금액 직접 입력 */}
            <div className="border-t border-gray-200 pt-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-gray-600">환불금액</span>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    className="rounded border-gray-300"
                    checked={cancelRefundManual}
                    onChange={(e) => {
                      setCancelRefundManual(e.target.checked);
                      if (!e.target.checked) setCancelRefundAmount("");
                    }}
                  />
                  <span className="text-xs text-gray-500">직접 입력</span>
                </label>
              </div>
              {cancelRefundManual ? (
                <Input
                  type="number"
                  min={0}
                  className="h-8 text-sm mt-1.5"
                  placeholder="환불금액을 입력하세요"
                  value={cancelRefundAmount}
                  onChange={(e) => setCancelRefundAmount(e.target.value)}
                />
              ) : (
                <p className="text-xs text-gray-400 mt-1">위 계산 금액으로 자동 적용됩니다</p>
              )}
            </div>

            {/* 3. 환불 계좌 */}
            <div className="border-t border-gray-200 pt-3 space-y-2">
              <span className="text-xs font-medium text-gray-600">환불 계좌</span>
              <div className="flex gap-2">
                <Input
                  className="h-8 text-sm flex-[1]"
                  placeholder="은행명"
                  value={cancelRefundBank}
                  onChange={(e) => setCancelRefundBank(e.target.value)}
                />
                <Input
                  className="h-8 text-sm flex-[2]"
                  placeholder="계좌번호"
                  value={cancelRefundAccount}
                  onChange={(e) => setCancelRefundAccount(e.target.value)}
                />
              </div>
            </div>

            {/* 4. 취소 사유 */}
            <div className="border-t border-gray-200 pt-3 space-y-2">
              <span className="text-xs font-medium text-gray-600">취소 사유</span>
              <textarea
                className="w-full border border-gray-300 rounded-md p-2 text-sm resize-none h-20 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="취소 사유를 입력해주세요."
                value={cancelMemo}
                onChange={(e) => setCancelMemo(e.target.value)}
              />
            </div>
          </div>
        }
        confirmLabel="주문 취소"
        variant="destructive"
        isLoading={cancelMutation.isPending}
      />

      {/* 품목 취소 모달 */}
      {activeItem && (
        <OrderItemCancelModal
          open={activeModal === "cancelItem"}
          onClose={closeModal}
          item={activeItem}
          onSuccess={invalidateOrder}
        />
      )}

      {/* 배송지 변경 모달 */}
      {activeItem && (
        <AddressChangeModal
          open={activeModal === "addressChange"}
          onClose={closeModal}
          item={activeItem}
          customerId={customerId}
          onSuccess={invalidateOrder}
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

      {/* 운송장 등록 다이얼로그 */}
      <Dialog open={sendTrackingTarget !== null} onOpenChange={(o) => { if (!o) { setSendTrackingTarget(null); setTrackingForm({ tracking_no: "", courier_company: "CJ대한통운" }); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>운송장 등록</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div>
              <Label className="text-xs font-medium text-gray-600">택배사</Label>
              <Select
                value={trackingForm.courier_company}
                onValueChange={(v) => setTrackingForm((f) => ({ ...f, courier_company: v }))}
              >
                <SelectTrigger className="mt-1 h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CJ대한통운">CJ대한통운</SelectItem>
                  <SelectItem value="자체배송">자체배송</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-medium text-gray-600">
                운송장 번호 <span className="text-red-500 ml-0.5">*</span>
              </Label>
              <Input
                className="mt-1 h-8 text-sm font-mono"
                placeholder="운송장 번호 입력"
                value={trackingForm.tracking_no}
                onChange={(e) => setTrackingForm((f) => ({ ...f, tracking_no: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => { setSendTrackingTarget(null); setTrackingForm({ tracking_no: "", courier_company: "CJ대한통운" }); }}>
              취소
            </Button>
            <Button
              size="sm"
              onClick={() => sendTrackingTarget && sendTrackingMutation.mutate(sendTrackingTarget)}
              disabled={!trackingForm.tracking_no || sendTrackingMutation.isPending}
            >
              {sendTrackingMutation.isPending && <LoadingSpinner size="sm" className="mr-1" />}
              등록
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 발송 취소 확인 모달 */}
      <ConfirmModal
        open={sendCancelTarget !== null}
        onClose={() => setSendCancelTarget(null)}
        onConfirm={() => sendCancelTarget && sendCancelMutation.mutate(sendCancelTarget)}
        title="발송 취소"
        description="이 발송을 취소합니다. 취소 후에는 되돌릴 수 없습니다."
        confirmLabel="발송 취소"
        variant="destructive"
        isLoading={sendCancelMutation.isPending}
      />

      {/* 품목 추가 다이얼로그 */}
      <Dialog open={addItemOpen} onOpenChange={(o) => {
        if (!o) {
          setAddItemOpen(false);
          setAddItemForm({ product_code: "", subscribe_start_issue: "", subscribe_period: 12, order_num: 1, sale_price: "", admin_memo: "" });
          setProductSearch("");
          setProductDropdownOpen(false);
        }
      }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>품목 추가</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            {/* 상품 검색 */}
            <div>
              <Label className="text-xs font-medium text-gray-600">
                상품 코드 <span className="text-red-500 ml-0.5">*</span>
              </Label>
              <div className="relative mt-1" ref={productDropdownRef}>
                <Input
                  className="h-8 text-sm"
                  placeholder="상품코드 또는 이름 검색"
                  value={productSearch || addItemForm.product_code}
                  onChange={(e) => {
                    setProductSearch(e.target.value);
                    setAddItemForm((f) => ({ ...f, product_code: e.target.value }));
                    setProductDropdownOpen(true);
                  }}
                  onFocus={() => setProductDropdownOpen(true)}
                />
                {productDropdownOpen && productSearchRes?.items && productSearchRes.items.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-40 overflow-y-auto">
                    {productSearchRes.items.map((p) => (
                      <button
                        key={p.product_id}
                        className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 border-b border-gray-50 last:border-0"
                        onClick={() => {
                          setAddItemForm((f) => ({
                            ...f,
                            product_code: p.product_code,
                            sale_price: p.sale_price,
                          }));
                          setProductSearch("");
                          setProductDropdownOpen(false);
                        }}
                      >
                        <div className="font-medium text-gray-900">{p.product_code}</div>
                        <div className="text-gray-400">{p.product_name}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {addItemForm.product_code && !productDropdownOpen && (
                <p className="text-xs text-blue-600 mt-0.5">선택됨: {addItemForm.product_code}</p>
              )}
            </div>

            {/* 구독 시작 호 */}
            <div>
              <Label className="text-xs font-medium text-gray-600">
                구독 시작 호 <span className="text-red-500 ml-0.5">*</span>
              </Label>
              <Input
                className="mt-1 h-8 text-sm font-mono"
                placeholder="YYYYMM (예: 202604)"
                maxLength={6}
                value={addItemForm.subscribe_start_issue}
                onChange={(e) => setAddItemForm((f) => ({ ...f, subscribe_start_issue: e.target.value.replace(/\D/g, "") }))}
              />
            </div>

            {/* 구독 기간 */}
            <div>
              <Label className="text-xs font-medium text-gray-600">구독 기간 (개월)</Label>
              <Input
                className="mt-1 h-8 text-sm"
                type="number"
                min={1}
                value={addItemForm.subscribe_period}
                onChange={(e) => setAddItemForm((f) => ({ ...f, subscribe_period: parseInt(e.target.value) || 1 }))}
              />
            </div>

            {/* 수량 */}
            <div>
              <Label className="text-xs font-medium text-gray-600">수량</Label>
              <Input
                className="mt-1 h-8 text-sm"
                type="number"
                min={1}
                value={addItemForm.order_num}
                onChange={(e) => setAddItemForm((f) => ({ ...f, order_num: parseInt(e.target.value) || 1 }))}
              />
            </div>

            {/* 판매가 */}
            <div>
              <Label className="text-xs font-medium text-gray-600">판매가 (선택, 미입력 시 정가)</Label>
              <Input
                className="mt-1 h-8 text-sm"
                type="number"
                min={0}
                placeholder="원 단위"
                value={addItemForm.sale_price}
                onChange={(e) => setAddItemForm((f) => ({ ...f, sale_price: e.target.value }))}
              />
            </div>

            {/* 관리자 메모 */}
            <div>
              <Label className="text-xs font-medium text-gray-600">관리자 메모</Label>
              <Input
                className="mt-1 h-8 text-sm"
                placeholder="내부 메모 (선택)"
                value={addItemForm.admin_memo}
                onChange={(e) => setAddItemForm((f) => ({ ...f, admin_memo: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => {
              setAddItemOpen(false);
              setProductSearch("");
              setProductDropdownOpen(false);
            }}>
              취소
            </Button>
            <Button
              size="sm"
              onClick={() => addItemMutation.mutate()}
              disabled={!addItemForm.product_code || addItemForm.subscribe_start_issue.length !== 6 || addItemMutation.isPending}
            >
              {addItemMutation.isPending && <LoadingSpinner size="sm" className="mr-1" />}
              추가
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 구독 상세 패널 */}
      <SlidingPanel open={!!subscriptionItem} onClose={() => setSubscriptionItem(null)}>
        {subscriptionItem && (
          <SubscriptionDetailPanel
            item={subscriptionItem as any}
            onClose={() => {
              setSubscriptionItem(null);
              invalidateOrder();
            }}
          />
        )}
      </SlidingPanel>
    </div>
  );
}

// 섹션 컴포넌트
function Section({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="border border-gray-100 rounded-lg overflow-hidden">
      <div className="px-3.5 py-2 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{title}</h3>
        {action}
      </div>
      <div className="px-3.5 py-3 space-y-2.5">{children}</div>
    </div>
  );
}

// 편집 행 컴포넌트 (InfoRow와 동일한 레이아웃)
function EditRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-gray-400 w-24 flex-shrink-0">{label}</span>
      {children}
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
  onSubscriptionDetail,
}: {
  item: ActiveItem;
  onAction: (type: ModalType, item: ActiveItem) => void;
  onSubscriptionDetail?: (item: ActiveItem) => void;
}) {
  const isYearly = item.product_kind === "YEARLY";
  const isCancelled = !!item.cancelled_at;

  return (
    <div className={`border rounded-lg p-3.5 ${isCancelled ? "border-gray-100 bg-gray-50/60" : "border-gray-200"}`}>
      {/* 상단: 상품 정보 + 수정/취소 버튼 */}
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
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              className="text-xs text-gray-500 hover:text-gray-700 hover:underline"
              onClick={() => onAction("editItem", item)}
            >
              수정
            </button>
            <button
              className="text-xs text-red-500 hover:text-red-700 hover:underline"
              onClick={() => onAction("cancelItem", item)}
            >
              취소
            </button>
          </div>
        )}
      </div>

      {/* 품목 정보 */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
        <div className="text-gray-400">수량 / 판매가</div>
        <div className="text-gray-700">
          {item.order_num}개 / {formatAmount(item.sale_price)}
        </div>

        {isYearly && (
          <>
            <div className="text-gray-400">원래 시작호</div>
            <div className="text-gray-700">{formatIssue(item.subscribe_start_issue)}</div>

            <div className="text-gray-400">구독 기간</div>
            <div className="text-gray-700">
              {formatIssue(item.final_subscribe_start_issue)} ~{" "}
              {formatIssue(item.final_subscribe_end_issue)}
              <span className="text-gray-400 ml-1">({item.subscribe_period}개월)</span>
            </div>
            {item.last_send_issue && (
              <>
                <div className="text-gray-400">마지막 발송</div>
                <div className="text-gray-700">{formatIssue(item.last_send_issue)}</div>
              </>
            )}
          </>
        )}

        {item.sended_at && (
          <>
            <div className="text-gray-400">발송일시</div>
            <div className="text-gray-700">{formatDateTime(item.sended_at)}</div>
          </>
        )}

        {isCancelled && item.refund_amount > 0 && (
          <>
            <div className="text-gray-400">환불금액</div>
            <div className="text-red-600">-{formatAmount(item.refund_amount)}</div>
          </>
        )}
      </div>

      {/* 구독 상세 링크 (YEARLY만) */}
      {isYearly && !isCancelled && onSubscriptionDetail && (
        <div className="mt-2">
          <button
            className="text-xs text-blue-600 hover:text-blue-800 hover:underline"
            onClick={() => onSubscriptionDetail(item)}
          >
            구독 상세 →
          </button>
        </div>
      )}

      {/* 품목별 배송지 */}
      {item.address && (
        <div className="mt-2.5 pt-2.5 border-t border-gray-100 text-xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="font-medium text-gray-500">배송지</span>
            {!isCancelled && (
              <button
                className="text-xs text-blue-600 hover:text-blue-800 hover:underline"
                onClick={() => onAction("addressChange", item)}
              >
                변경
              </button>
            )}
          </div>
          <div className="text-gray-700">
            {item.address.recipient_name} / {formatPhone(item.address.recipient_phone)}
          </div>
          <div className="text-gray-700">
            ({item.address.postal_code}) {item.address.recipient_address}
          </div>
          {item.address.customer_memo && (
            <div className="text-gray-400">배송메모: {item.address.customer_memo}</div>
          )}
        </div>
      )}

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
