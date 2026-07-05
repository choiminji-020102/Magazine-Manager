import { useState, useEffect, useRef, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useDebounce } from "@/hooks/useDebounce";
import { X, Edit2, Plus, MapPin } from "lucide-react";
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
import { activityLogsApi } from "@/api/activityLogsApi";
import { getLogDisplay } from "@/utils/activityLogDisplay";
import { productsApi } from "@/api/productsApi";
import type { ProductResponse } from "@/types/product";
import { toast } from "@/hooks/use-toast";
import { formatAmount, formatDate, formatDateTime, formatPhone, formatIssue } from "@/utils/format";
import { getErrorMessage } from "@/utils/errorHandler";
import { PAYMENT_METHOD_LABEL, PAYMENT_METHOD_OPTIONS, CHANNEL_LABEL, CHANNEL_OPTIONS } from "@/utils/constants";
import { addressesApi } from "@/api/addressesApi";
import { vipSlotsApi } from "@/api/vipSlotsApi";
import { AddressList } from "@/components/common/AddressList";
import {
  NewAddressForm,
  EMPTY_NEW_ADDRESS,
  EMPTY_NEW_ADDRESS_ERRORS,
  validateNewAddress,
  type NewAddressValue,
  type NewAddressErrors,
} from "@/components/common/NewAddressForm";
import { VipFlagsDisplay } from "@/components/common/VipFlags";
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
  const [newAddr, setNewAddr] = useState<NewAddressValue>(EMPTY_NEW_ADDRESS);
  const [addressConfirmOpen, setAddressConfirmOpen] = useState(false);
  const [newAddrErrors, setNewAddrErrors] = useState<NewAddressErrors>(EMPTY_NEW_ADDRESS_ERRORS);

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

  // 주문 데이터 로드 시 editForm 초기화 (편집 중에는 덮어쓰지 않음)
  useEffect(() => {
    if (order && !editMode) {
      setEditForm({
        order_channel: order.order_channel ?? "",
        payment_method: order.payment_method ?? "",
        refund_amount: order.refund_amount,
        send_fee: order.send_fee,
        payment_at: order.payment_at ? order.payment_at.slice(0, 16) : "",
        customer_memo: order.customer_memo ?? "",
        admin_memo: order.admin_memo ?? "",
      });
    }
  }, [order]);

  // 결제완료 처리 모달용 — editMode와 무관하게 order 변경 시 항상 동기화
  useEffect(() => {
    if (order) {
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

  const { data: vipSlots = [] } = useQuery({
    queryKey: ["vip-slots"],
    queryFn: () => vipSlotsApi.getVipSlots().then((res) => res.data.data ?? []),
    staleTime: 5 * 60 * 1000,
  });

  // 재배송 이력 — 이 주문에 묶인 send_id 만 좁혀 한 번 조회 (target_ids 다중 필터).
  // limit=100 도 그대로 두지만 보통 박스가 100개를 넘지 않아 누락 없음.
  const sendIdsOfOrder = useMemo(
    () => (order?.sends ?? []).map((s) => s.send_id),
    [order?.sends],
  );
  const { data: resendLogs = [] } = useQuery({
    queryKey: ["resendLogs", "order", orderId, sendIdsOfOrder],
    queryFn: () =>
      activityLogsApi
        .getActivityLogs({
          page: 1,
          limit: 100,
          target_type: "SEND",
          action: "RESEND",
          target_ids: sendIdsOfOrder,
        })
        .then((r) => r.data.items ?? []),
    enabled: sendIdsOfOrder.length > 0,
  });

  const resendsBySendId = useMemo(() => {
    const map = new Map<number, typeof resendLogs>();
    for (const log of resendLogs) {
      if (log.target_id == null) continue;
      const arr = map.get(log.target_id) ?? [];
      arr.push(log);
      map.set(log.target_id, arr);
    }
    for (const arr of map.values()) {
      // created_at ASC 정렬 — '재배송 #N' 순번 의미 부여 (가장 오래된 = #1, 최신 = #N).
      // 백엔드 활동 로그 API 는 DESC 반환이라 여기서 재정렬 필수.
      arr.sort((a, b) => a.created_at.localeCompare(b.created_at));
    }
    return map;
  }, [resendLogs]);

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

      // 변경 전 활성 품목의 배송지 스냅샷 — 백엔드가 이미 발송 완료(DELIVERED)된 품목은
      // 건드리지 않고 스킵하므로, 실제 반영 결과와 비교해 스킵된 품목을 가려낸다.
      const beforeAddressByItemId = new Map(
        (order?.items ?? [])
          .filter((item) => !item.cancelled_at)
          .map((item) => [item.order_item_id, item.address_id])
      );

      // 주소 변경 자체는 여기서 이미 완료됨 — 이후 단계는 결과 안내용 부가 정보 수집일 뿐이다.
      await ordersApi.updateOrder(orderId, { address_id: addressId });

      let skippedItems: OrderItemDetailResponse[] = [];
      try {
        // fetchQuery로 캐시를 직접 채워 이후 invalidateQueries 로 인한 중복 재조회를 방지
        const freshRes = await queryClient.fetchQuery({
          queryKey: ["order", orderId],
          queryFn: () => ordersApi.getOrder(orderId).then((r) => r.data),
        });
        skippedItems = (freshRes?.data?.items ?? []).filter(
          (item) =>
            !item.cancelled_at &&
            beforeAddressByItemId.get(item.order_item_id) !== addressId &&
            item.address_id === beforeAddressByItemId.get(item.order_item_id)
        );
      } catch {
        // 안내 문구용 부가 정보 수집 실패 — 배송지 변경 자체는 성공했으므로 화면만 최신화
        queryClient.invalidateQueries({ queryKey: ["order", orderId] });
      }

      return { skippedItems, activeItemCount: beforeAddressByItemId.size };
    },
    onSuccess: ({ skippedItems, activeItemCount }) => {
      if (skippedItems.length > 0 && skippedItems.length >= activeItemCount) {
        const names = skippedItems.map((i) => i.product_name).join(", ");
        toast.warning(
          "배송지가 변경되지 않았습니다.",
          `선택한 품목(${names})이 모두 이미 발송 완료되어 기존 배송지가 유지됩니다.`
        );
      } else if (skippedItems.length > 0) {
        const names = skippedItems.map((i) => i.product_name).join(", ");
        toast.warning(
          "배송지가 변경되었습니다.",
          `이미 발송 완료된 ${skippedItems.length}건(${names})은 기존 배송지가 유지됩니다.`
        );
      } else {
        toast.success("배송지가 변경되었습니다. (모든 품목 일괄 변경)");
      }
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
    setNewAddr(EMPTY_NEW_ADDRESS);
    setNewAddrErrors(EMPTY_NEW_ADDRESS_ERRORS);
  };

  const handleAddressSubmit = () => {
    if (addressMode === "existing") {
      if (!selectedAddressId) {
        toast.error("변경할 배송지를 선택해주세요.");
        return;
      }
      if (selectedAddressId === order?.address_id) {
        toast.error("현재 배송지와 동일합니다. 다른 배송지를 선택해주세요.");
        return;
      }
      setAddressConfirmOpen(true);
      return;
    }

    const { errors, firstMessage } = validateNewAddress(newAddr);
    setNewAddrErrors(errors);
    if (firstMessage) {
      toast.error(firstMessage);
      return;
    }
    setAddressConfirmOpen(true);
  };

  // 취소 환불 계산 미리보기
  const cancelCalcQuery = useQuery({
    queryKey: ["cancelCalculate", orderId],
    queryFn: async () => {
      const res = await ordersApi.cancelCalculate(orderId);
      const data = res.data.data;
      if (data) setCancelRefundAmount(String(data.total_refund));
      return data;
    },
    enabled: cancelConfirm,
  });

  const cancelMutation = useMutation({
    mutationFn: () =>
      ordersApi.cancelOrder(orderId, {
        admin_memo: cancelMemo,
        ...(cancelRefundAmount !== ""
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
      setCancelRefundAmount("");
      setCancelRefundBank("");
      setCancelRefundAccount("");
      queryClient.removeQueries({ queryKey: ["cancelCalculate", orderId] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const invalidateOrder = () => {
    queryClient.invalidateQueries({ queryKey: ["order", orderId] });
  };

  // 모달에 전달할 fresh activeItem — order refetch 후 갱신된 items 에서 동일 ID 찾기
  const freshActiveItem = activeItem
    ? (order?.items?.find((i) => i.order_item_id === activeItem.order_item_id) as ActiveItem | undefined) ?? activeItem
    : null;

  // 품목 추가
  const [addItemOpen, setAddItemOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<ProductResponse | null>(null);
  const [addItemForm, setAddItemForm] = useState({
    order_num: 1,
    sale_price: "" as string | number,
    admin_memo: "",
  });
  const [productSearch, setProductSearch] = useState("");
  const [productDropdownOpen, setProductDropdownOpen] = useState(false);
  const [productKindFilter, setProductKindFilter] = useState<"" | "YEARLY" | "MONTHLY">("");
  const productSearchDebounced = useDebounce(productSearch, 300);
  const productDropdownRef = useRef<HTMLDivElement>(null);

  // 외부 클릭 시 드롭다운 닫기
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (productDropdownRef.current && !productDropdownRef.current.contains(e.target as Node)) {
        setProductDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const { data: productSearchRes, isLoading: productSearchLoading } = useQuery({
    queryKey: ["products-search", productSearchDebounced, productKindFilter],
    queryFn: () => productsApi.getProducts({
      page: 1, limit: 15,
      search: productSearchDebounced || null,
      product_kind: (productKindFilter || null) as import("@/types/product").ProductKind | null,
    }).then((r) => r.data),
    enabled: productDropdownOpen && (productSearchDebounced.length >= 1 || !!productKindFilter),
  });

  // 상품 코드에서 시작 호 추출 (MW+202604 → 202604, KT-202607 → 202607)
  const extractIssueFromCode = (code: string): string => {
    const match = code.match(/[+-](\d{6})$/);
    return match ? match[1] : "";
  };

  const addItemMutation = useMutation({
    mutationFn: () => {
      if (!selectedProduct) throw new Error("상품을 선택해주세요.");
      const startIssue = extractIssueFromCode(selectedProduct.product_code);
      if (!startIssue) throw new Error("상품 코드에서 시작 호를 추출할 수 없습니다.");
      return orderItemsApi.createOrderItem({
        order_id: orderId,
        address_id: order!.address_id,
        product_code: selectedProduct.product_code,
        order_num: addItemForm.order_num,
        sale_price: addItemForm.sale_price !== "" ? Number(addItemForm.sale_price) : null,
        subscribe_start_issue: startIssue,
        subscribe_period: selectedProduct.product_kind === "YEARLY" ? 12 : 1,
        admin_memo: addItemForm.admin_memo || null,
      });
    },
    onSuccess: () => {
      toast.success("품목이 추가되었습니다.");
      queryClient.invalidateQueries({ queryKey: ["order", orderId] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      setAddItemOpen(false);
      setSelectedProduct(null);
      setAddItemForm({ order_num: 1, sale_price: "", admin_memo: "" });
      setProductSearch("");
      setProductDropdownOpen(false);
      setProductKindFilter("");
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
          {!["CANCELLED", "UNPAID_CANCELLED"].includes(order.order_status) && !editMode && (
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
          {editMode && (
            <>
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
                variant="outline"
                onClick={() => {
                  updateMutation.reset();
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
            </>
          )}
          {!["CANCELLED", "UNPAID_CANCELLED"].includes(order.order_status) && !editMode && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1"
              onClick={() => setAddressChangeOpen(true)}
            >
              <MapPin className="h-3 w-3" />
              배송지 변경
            </Button>
          )}
          {!["CANCELLED", "UNPAID_CANCELLED"].includes(order.order_status) && !editMode && (
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
            <Section
              title="고객 정보"
              action={order.address ? (
                <VipFlagsDisplay address={order.address} slots={vipSlots} compact />
              ) : undefined}
            >
              <InfoRow label="고객명" value={order.customer?.customer_name} />
              <InfoRow label="연락처" value={formatPhone(order.customer?.customer_phone)} />
              <InfoRow label="이메일" value={order.customer?.customer_email} />
              {order.customer?.admin_memo && (
                <InfoRow label="관리자메모" value={order.customer.admin_memo} />
              )}
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
                <EditRow label="결제 방법">
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
                <InfoRow label="결제 방법" value={order.payment_method ? PAYMENT_METHOD_LABEL[order.payment_method] ?? order.payment_method : undefined} />
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

            {/* 시스템 */}
            <Section title="시스템">
              <InfoRow label="등록일시" value={formatDateTime(order.created_at)} />
              <InfoRow label="수정일시" value={formatDateTime(order.updated_at)} />
            </Section>
          </TabsContent>

          {/* 주문품목 탭 */}
          <TabsContent value="items" className="m-0 p-4 space-y-3">
            {!["CANCELLED", "UNPAID_CANCELLED"].includes(order.order_status) && (
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
                </div>
                <div className="px-3.5 py-3 space-y-2">
                  {/* 함께 묶인 주문 (자기 주문 제외) */}
                  {send.related_orders
                    .filter((ro) => ro.order_id !== orderId)
                    .map((ro) => (
                      <div key={ro.order_id} className="flex items-start gap-3">
                        <span className="text-xs text-gray-400 w-24 flex-shrink-0">묶인 주문</span>
                        <span className="text-xs text-gray-600">
                          <span className="font-mono text-gray-400">#{ro.order_id}</span>
                          <span className="mx-1.5 text-gray-300">·</span>
                          {ro.customer_name}
                          <span className="mx-1.5 text-gray-300">·</span>
                          <span className="font-mono">{formatPhone(ro.customer_phone)}</span>
                        </span>
                      </div>
                    ))}
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
                  {/* 배송 방법 */}
                  {send.send_method && (
                    <div className="flex items-start gap-3">
                      <span className="text-xs text-gray-400 w-24 flex-shrink-0">배송방법</span>
                      <span className="text-xs text-gray-700">
                        {send.send_method}
                        {send.courier_company && (
                          <span className="text-gray-400"> · {send.courier_company}</span>
                        )}
                      </span>
                    </div>
                  )}
                  {/* 운송장 */}
                  {send.tracking_no ? (
                    <div className="flex items-start gap-3">
                      <span className="text-xs text-gray-400 w-24 flex-shrink-0">운송장</span>
                      <span className="text-xs text-gray-700 font-mono">{send.tracking_no}</span>
                    </div>
                  ) : (
                    <div className="text-xs text-gray-300">운송장 미등록</div>
                  )}
                  {/* 타임스탬프 */}
                  {send.delivered_at && (
                    <div className="flex items-start gap-3">
                      <span className="text-xs text-gray-400 w-24 flex-shrink-0">발송 완료</span>
                      <span className="text-xs text-gray-700">{formatDateTime(send.delivered_at)}</span>
                    </div>
                  )}
                  {/* 재배송 이력 */}
                  {(resendsBySendId.get(send.send_id) ?? []).map((log, idx) => {
                    const d = log.details ?? {};
                    const parts: string[] = [];
                    if (d.reason) parts.push(d.reason);
                    if (Array.isArray(d.send_item_ids) && d.send_item_ids.length > 0) {
                      parts.push(`품목 ${d.send_item_ids.length}건`);
                    }
                    if (d.send_method) parts.push(d.send_method);
                    if (d.courier_company) parts.push(d.courier_company);
                    if (d.tracking_no) parts.push(`운송장 ${d.tracking_no}`);
                    if (d.memo) parts.push(d.memo);
                    return (
                      <div key={log.log_id} className="flex items-start gap-3">
                        <span className="text-xs text-gray-400 w-24 flex-shrink-0">재배송 #{idx + 1}</span>
                        <span className="text-xs text-orange-600">{parts.join(" · ")}</span>
                      </div>
                    );
                  })}
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
        <DialogContent className="max-w-lg">
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
                disabled={(customerAddresses?.data?.length ?? 0) === 0}
              >
                기존 배송지
                {(customerAddresses?.data?.length ?? 0) === 0 && (
                  <span className="ml-1 opacity-70">(없음)</span>
                )}
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
              <AddressList
                addresses={customerAddresses?.data ?? []}
                selectedAddressId={selectedAddressId}
                onSelect={setSelectedAddressId}
                currentAddressId={order?.address_id}
              />
            )}

            {/* 신규 배송지 입력 */}
            {addressMode === "new" && (
              <NewAddressForm
                value={newAddr}
                onChange={setNewAddr}
                errors={newAddrErrors}
                onErrorsChange={setNewAddrErrors}
              />
            )}

            <p className="text-xs text-gray-400">
              ※ 발송이 모두 완료된 품목은 기존 배송지가 유지되고, 발송 예정이 남은 품목은 새 배송지로 변경됩니다.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleAddressClose} disabled={addressChangeMutation.isPending}>취소</Button>
            <Button onClick={handleAddressSubmit} disabled={addressChangeMutation.isPending}>
              {addressChangeMutation.isPending && <LoadingSpinner size="sm" className="mr-1" />}
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
        description="이 주문의 발송 예정 품목 배송지가 선택한 배송지로 일괄 변경됩니다. 이미 발송 완료된 품목은 기존 배송지가 유지됩니다. 계속하시겠습니까?"
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
            <p className="text-xs text-gray-400">
              ※ 발송이 시작된 상품이 포함된 주문은 취소할 수 없습니다.
            </p>

            {/* 취소 상품 */}
            {cancelCalcQuery.data && cancelCalcQuery.data.items.length > 0 && (
              <div>
                <span className="text-xs font-medium text-gray-600">취소 상품</span>
                <div className="mt-1 border border-gray-200 rounded-lg overflow-hidden divide-y divide-gray-100">
                  {cancelCalcQuery.data.items.map((item) => (
                    <div key={item.order_item_id} className="flex items-center justify-between px-3 py-2 text-sm">
                      <div className="flex items-center gap-2 min-w-0">
                        <StatusBadge type="product_kind" value={item.product_kind} />
                        <span className="text-gray-800 truncate">{item.product_name}</span>
                      </div>
                      <span className="text-gray-500 flex-shrink-0 ml-2">{item.order_num}개</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 1. 환불 계산 (참고) */}
            {cancelCalcQuery.data && (
              <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-500 space-y-1">
                <div className="font-medium text-gray-600">환불 계산 (참고)</div>
                {cancelCalcQuery.data.order_status === "ORDERED" ? (
                  <p>결제 전 주문이므로 환불금 없음</p>
                ) : (
                  <>
                    {cancelCalcQuery.data.items.map((item) => (
                      <div key={item.order_item_id} className="space-y-0.5">
                        {item.product_kind === "MONTHLY" ? (
                          <div className="flex justify-between">
                            <span>{item.product_name} ({item.order_num}개)</span>
                            <span>{formatAmount(item.item_refund)}</span>
                          </div>
                        ) : (
                          <>
                            <div className="flex justify-between">
                              <span>판매가 ÷ 구독기간</span>
                              <span>{formatAmount(item.sale_price)} ÷ {item.total_period}개월 = {formatAmount(item.unit_price ?? 0)}/월</span>
                            </div>
                            <div className="flex justify-between">
                              <span>배송 {item.delivered_count}개월, 잔여 {item.remaining_period}개월</span>
                              <span>{formatAmount(item.unit_price ?? 0)} × {item.remaining_period}개월{item.order_num > 1 ? ` × ${item.order_num}` : ""}</span>
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                    {cancelCalcQuery.data.send_fee > 0 && (
                      <div className="flex justify-between">
                        <span>배송비 환불</span>
                        <span>+{formatAmount(cancelCalcQuery.data.send_fee)}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-medium text-gray-700 border-t border-gray-200 pt-1">
                      <span>예상 환불금</span>
                      <span>{formatAmount(cancelCalcQuery.data.total_refund)}</span>
                    </div>
                  </>
                )}
              </div>
            )}
            {cancelCalcQuery.isLoading && (
              <p className="text-xs text-gray-400">환불 계산 중...</p>
            )}

            {/* 2. 환불 금액 */}
            {cancelCalcQuery.data && cancelCalcQuery.data.order_status !== "ORDERED" && (
              <div>
                <span className="text-xs font-medium text-gray-600">환불 금액</span>
                <div className="flex items-center gap-1.5 mt-1">
                  <Input
                    type="number"
                    min={0}
                    className="h-8 text-sm"
                    value={cancelRefundAmount}
                    onChange={(e) => setCancelRefundAmount(e.target.value)}
                  />
                  <span className="text-sm text-gray-500 flex-shrink-0">원</span>
                </div>
              </div>
            )}

            {/* 3. 취소 사유 */}
            <div>
              <span className="text-xs font-medium text-gray-600">취소 사유</span>
              <textarea
                className="w-full border border-gray-300 rounded-md p-2 text-sm resize-none h-20 focus:outline-none focus:ring-2 focus:ring-blue-500 mt-1"
                placeholder="취소 사유를 입력해주세요."
                value={cancelMemo}
                onChange={(e) => setCancelMemo(e.target.value)}
              />
            </div>

            {/* 4. 환불 계좌 */}
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
          </div>
        }
        confirmLabel="주문 취소"
        variant="destructive"
        isLoading={cancelMutation.isPending}
      />

      {/* 품목 취소 모달 */}
      {freshActiveItem && (
        <OrderItemCancelModal
          open={activeModal === "cancelItem"}
          onClose={closeModal}
          item={freshActiveItem}
          onSuccess={invalidateOrder}
        />
      )}

      {/* 배송지 변경 모달 */}
      {freshActiveItem && (
        <AddressChangeModal
          open={activeModal === "addressChange"}
          onClose={closeModal}
          item={freshActiveItem}
          customerId={customerId}
          onSuccess={invalidateOrder}
        />
      )}

      {/* 품목 수정 모달 */}
      {freshActiveItem && (
        <OrderItemEditModal
          open={activeModal === "editItem"}
          onClose={closeModal}
          item={freshActiveItem}
          orderId={orderId}
        />
      )}

      {/* 품목 추가 다이얼로그 */}
      <Dialog open={addItemOpen} onOpenChange={(o) => {
        if (!o) {
          setAddItemOpen(false);
          setSelectedProduct(null);
          setAddItemForm({ order_num: 1, sale_price: "", admin_memo: "" });
          setProductSearch("");
          setProductDropdownOpen(false);
          setProductKindFilter("");
        }
      }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>품목 추가</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            {/* 상품 선택 */}
            {!selectedProduct ? (
              <div>
                <Label className="text-xs font-medium text-gray-600">
                  상품 선택 <span className="text-red-500 ml-0.5">*</span>
                </Label>
                {/* 종류 필터 */}
                <div className="flex gap-1 mt-1 mb-1.5">
                  {([
                    { value: "", label: "전체" },
                    { value: "YEARLY", label: "정기구독" },
                    { value: "MONTHLY", label: "단품" },
                  ] as const).map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      className={`px-2.5 py-1 rounded text-xs border transition-colors ${
                        productKindFilter === opt.value
                          ? "bg-blue-600 text-white border-blue-600"
                          : "bg-white text-gray-600 border-gray-300 hover:border-blue-400"
                      }`}
                      onClick={() => setProductKindFilter(opt.value)}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                {/* 검색 + 드롭다운 */}
                <div className="relative" ref={productDropdownRef}>
                  <Input
                    className="h-8 text-sm"
                    placeholder="상품코드 또는 이름 검색"
                    value={productSearch}
                    onChange={(e) => {
                      setProductSearch(e.target.value);
                      setProductDropdownOpen(true);
                    }}
                    onFocus={() => setProductDropdownOpen(true)}
                  />
                  {productDropdownOpen && (productSearchDebounced.length >= 1 || !!productKindFilter) && (
                    <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-48 overflow-y-auto">
                      {productSearchLoading && (
                        <div className="px-3 py-2 text-xs text-gray-400">검색 중...</div>
                      )}
                      {!productSearchLoading && productSearchRes?.items && productSearchRes.items.length === 0 && (
                        <div className="px-3 py-2 text-xs text-gray-400">검색 결과가 없습니다.</div>
                      )}
                      {!productSearchLoading && productSearchRes?.items?.map((p) => (
                        <button
                          key={p.product_id}
                          className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 border-b border-gray-50 last:border-0"
                          onClick={() => {
                            setSelectedProduct(p);
                            setAddItemForm((f) => ({ ...f, sale_price: p.sale_price }));
                            setProductSearch("");
                            setProductDropdownOpen(false);
                          }}
                        >
                          <div className="flex items-center gap-1.5">
                            <StatusBadge type="product_kind" value={p.product_kind} />
                            <span className="font-medium text-gray-900">{p.product_name}</span>
                          </div>
                          <div className="text-gray-400 mt-0.5">{p.product_code} · {formatAmount(p.sale_price)}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* 선택된 상품 정보 */
              <div className="border border-gray-200 rounded-lg p-3 text-xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <StatusBadge type="product_kind" value={selectedProduct.product_kind} />
                    <span className="font-medium text-gray-900">{selectedProduct.product_name}</span>
                  </div>
                  <button
                    className="text-gray-400 hover:text-blue-600 text-xs hover:underline"
                    onClick={() => { setSelectedProduct(null); setProductSearch(""); }}
                  >
                    변경
                  </button>
                </div>
                <div className="text-gray-400 font-mono">{selectedProduct.product_code}</div>
                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-gray-100">
                  <div>
                    <span className="text-gray-400">구독 시작 호</span>
                    <p className="font-medium text-gray-700">{formatIssue(extractIssueFromCode(selectedProduct.product_code))}</p>
                  </div>
                  <div>
                    <span className="text-gray-400">구독 기간</span>
                    <p className="font-medium text-gray-700">{selectedProduct.product_kind === "YEARLY" ? "12개월" : "1개월"}</p>
                  </div>
                </div>
              </div>
            )}

            {/* 수량 + 판매가 */}
            {selectedProduct && (
              <div className="grid grid-cols-2 gap-3">
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
                <div>
                  <Label className="text-xs font-medium text-gray-600">판매가</Label>
                  <div className="flex items-center gap-1 mt-1">
                    <Input
                      className="h-8 text-sm"
                      type="number"
                      min={0}
                      value={addItemForm.sale_price}
                      onChange={(e) => setAddItemForm((f) => ({ ...f, sale_price: e.target.value }))}
                    />
                    <span className="text-xs text-gray-500 flex-shrink-0">원</span>
                  </div>
                </div>
              </div>
            )}

            {/* 관리자 메모 */}
            {selectedProduct && (
              <div>
                <Label className="text-xs font-medium text-gray-600">관리자 메모 <span className="text-gray-400 font-normal">(선택)</span></Label>
                <Input
                  className="mt-1 h-8 text-sm"
                  placeholder="내부 메모"
                  value={addItemForm.admin_memo}
                  onChange={(e) => setAddItemForm((f) => ({ ...f, admin_memo: e.target.value }))}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => {
              setAddItemOpen(false);
              setSelectedProduct(null);
              setAddItemForm({ order_num: 1, sale_price: "", admin_memo: "" });
              setProductSearch("");
              setProductDropdownOpen(false);
              setProductKindFilter("");
            }}>
              취소
            </Button>
            <Button
              size="sm"
              onClick={() => addItemMutation.mutate()}
              disabled={!selectedProduct || addItemMutation.isPending}
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
            item={{
              ...subscriptionItem,
              customer_name: order?.customer?.customer_name ?? null,
              customer_phone: order?.customer?.customer_phone ?? null,
              order_channel: order?.order_channel ?? null,
            } as any}
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

// 편집 행 컴포넌트
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
      <span className="text-sm text-gray-700 flex-1 whitespace-pre-line">{value}</span>
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

            <div className="text-gray-400">현재 구독 기간</div>
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

        {item.delivered_at && (
          <>
            <div className="text-gray-400">발송일시</div>
            <div className="text-gray-700">{formatDateTime(item.delivered_at)}</div>
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

      {/* 변경 이력 (활동 로그) */}
      <OrderItemChangeLogs orderItemId={item.order_item_id} />

      {/* 관리자 메모 */}
      {item.admin_memo && (
        <div className="mt-2.5 pt-2.5 border-t border-gray-100">
          <div className="text-xs font-medium text-gray-500 mb-1">관리자 메모</div>
          <div className="text-xs text-gray-600 whitespace-pre-line">{item.admin_memo}</div>
        </div>
      )}

    </div>
  );
}


function OrderItemChangeLogs({ orderItemId }: { orderItemId: number }) {
  const { data: logs = [] } = useQuery({
    queryKey: ["order-item-change-logs", orderItemId],
    queryFn: () =>
      activityLogsApi
        .getActivityLogs({
          page: 1,
          limit: 50,
          target_type: "ORDER_ITEM",
          target_id: orderItemId,
        })
        .then((r) => r.data.items ?? []),
  });

  if (logs.length === 0) return null;

  return (
    <div className="mt-2.5 pt-2.5 border-t border-gray-100 space-y-1">
      <div className="text-xs font-medium text-gray-500 mb-1">변경 이력</div>
      {logs.map((log) => {
        const { label, color, summary } = getLogDisplay(log);
        return (
          <div key={log.log_id} className="text-xs text-gray-500 flex items-start gap-1.5">
            <span className="text-gray-400 flex-shrink-0">{formatDate(log.created_at).slice(5)}</span>
            <span className={`font-medium ${color}`}>{label}</span>
            {summary && <span className="text-gray-400">{summary}</span>}
          </div>
        );
      })}
    </div>
  );
}
