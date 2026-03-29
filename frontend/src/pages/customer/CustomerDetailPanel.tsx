import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { X, Plus, Edit2 } from "lucide-react";
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
import { StatusBadge } from "@/components/common/StatusBadge";
import { ConfirmModal } from "@/components/common/ConfirmModal";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { SlidingPanel } from "@/components/common/SlidingPanel";
import { AddressSearchField } from "@/components/common/AddressSearchField";
import OrderDetailPanel from "@/pages/order/OrderDetailPanel";
import { customersApi } from "@/api/customersApi";
import { ordersApi } from "@/api/ordersApi";
import { inquiriesApi } from "@/api/inquiriesApi";
import { addressesApi } from "@/api/addressesApi";
import { toast } from "@/hooks/use-toast";
import { formatDate, formatPhone, formatAmount } from "@/utils/format";
import { PAYMENT_METHOD_LABEL } from "@/utils/constants";
import type { AddressResponse } from "@/types/address";
import type { OrderResponse } from "@/types/order";
import type { InquiryResponse } from "@/types/inquiry";

const EMPTY_ADDRESS_FORM = {
  recipient_name: "",
  recipient_phone: "",
  postal_code: "",
  recipient_address: "",
  customer_memo: "",
  admin_memo: "",
};

interface CustomerDetailPanelProps {
  customerId: number;
  onClose: () => void;
}

export default function CustomerDetailPanel({ customerId, onClose }: CustomerDetailPanelProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [deactivateConfirm, setDeactivateConfirm] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState({
    customer_name: "",
    customer_phone: "",
    customer_email: "",
    create_channel: "OFFLINE" as string,
    admin_memo: "",
  });
  const [addAddressMode, setAddAddressMode] = useState(false);
  const [addressForm, setAddressForm] = useState(EMPTY_ADDRESS_FORM);
  const [deleteAddressId, setDeleteAddressId] = useState<number | null>(null);

  const { data: res, isLoading } = useQuery({
    queryKey: ["customer", customerId],
    queryFn: () => customersApi.getCustomer(customerId).then((r) => r.data),
    enabled: !!customerId,
  });

  const { data: inquiryRes } = useQuery({
    queryKey: ["customer-inquiries", customerId],
    queryFn: () => inquiriesApi.getCustomerInquiries(customerId, 20).then((r) => r.data),
    enabled: !!customerId,
  });

  const { data: ordersRes, isLoading: ordersLoading } = useQuery({
    queryKey: ["customer-orders", customerId],
    queryFn: () => ordersApi.getOrdersByCustomer(customerId).then((r) => r.data),
    enabled: !!customerId,
  });

  const customer = res?.data;
  const inquiries = inquiryRes?.data ?? [];

  // 수정 폼 초기화 (customer 로드 시)
  useEffect(() => {
    if (customer && editMode) {
      setEditForm({
        customer_name: customer.customer_name,
        customer_phone: customer.customer_phone,
        customer_email: customer.customer_email ?? "",
        create_channel: customer.create_channel,
        admin_memo: customer.admin_memo ?? "",
      });
    }
  }, [customer, editMode]);

  const updateMutation = useMutation({
    mutationFn: () =>
      customersApi.updateCustomer(customerId, {
        customer_name: editForm.customer_name || undefined,
        customer_phone: editForm.customer_phone || undefined,
        customer_email: editForm.customer_email || null,
        create_channel: editForm.create_channel as "CAFE24" | "GPMALL" | "OFFLINE",
        admin_memo: editForm.admin_memo || null,
      }),
    onSuccess: () => {
      toast.success("고객 정보가 수정되었습니다.");
      queryClient.invalidateQueries({ queryKey: ["customer", customerId] });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      setEditMode(false);
    },
    onError: () => toast.error("수정 실패"),
  });

  const deactivateMutation = useMutation({
    mutationFn: () =>
      customer?.is_active
        ? customersApi.deactivateCustomer(customerId)
        : customersApi.activateCustomer(customerId),
    onSuccess: () => {
      toast.success(customer?.is_active ? "고객이 비활성화되었습니다." : "고객이 활성화되었습니다.");
      queryClient.invalidateQueries({ queryKey: ["customer", customerId] });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      setDeactivateConfirm(false);
    },
    onError: () => toast.error("처리 실패"),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (customer?.is_deleted) {
        return customersApi.restoreCustomer(customerId);
      }
      return customersApi.deleteCustomer(customerId);
    },
    onSuccess: () => {
      toast.success(customer?.is_deleted ? "고객이 복구되었습니다." : "고객이 삭제되었습니다.");
      queryClient.invalidateQueries({ queryKey: ["customer", customerId] });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      setDeleteConfirm(false);
      if (!customer?.is_deleted) onClose();
    },
    onError: () => toast.error("처리 실패"),
  });

  const createAddressMutation = useMutation({
    mutationFn: () =>
      addressesApi.createAddress({
        customer_id: customerId,
        recipient_name: addressForm.recipient_name,
        recipient_phone: addressForm.recipient_phone,
        postal_code: addressForm.postal_code,
        recipient_address: addressForm.recipient_address,
        customer_memo: addressForm.customer_memo || null,
        admin_memo: addressForm.admin_memo || null,
      }),
    onSuccess: () => {
      toast.success("배송지가 추가되었습니다.");
      queryClient.invalidateQueries({ queryKey: ["customer", customerId] });
      setAddAddressMode(false);
      setAddressForm(EMPTY_ADDRESS_FORM);
    },
    onError: () => toast.error("배송지 추가 실패"),
  });

  const deleteAddressMutation = useMutation({
    mutationFn: (addressId: number) => addressesApi.deleteAddress(addressId),
    onSuccess: () => {
      toast.success("배송지가 삭제되었습니다.");
      queryClient.invalidateQueries({ queryKey: ["customer", customerId] });
      setDeleteAddressId(null);
    },
    onError: () => toast.error("배송지 삭제 실패"),
  });

  const updateAddressMemoMutation = useMutation({
    mutationFn: ({ addressId, memo }: { addressId: number; memo: string | null }) =>
      addressesApi.updateAddress(addressId, { admin_memo: memo }),
    onSuccess: () => {
      toast.success("메모가 저장되었습니다.");
      queryClient.invalidateQueries({ queryKey: ["customer", customerId] });
    },
    onError: () => toast.error("메모 저장 실패"),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner />
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-gray-400">
        고객 정보를 불러올 수 없습니다.
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* 패널 헤더 */}
      <div className="px-5 py-4 border-b border-gray-200 bg-white">
        <div className="flex items-start justify-between mb-3">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 mb-1">
              <StatusBadge type="channel" value={customer.create_channel} />
              {!customer.is_active && (
                <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">비활성</span>
              )}
              {customer.is_deleted && (
                <span className="text-xs text-red-500 bg-red-50 px-1.5 py-0.5 rounded">삭제됨</span>
              )}
            </div>
            <div className="font-semibold text-gray-900 text-base leading-tight">
              {customer.customer_name}
            </div>
            <div className="text-xs text-gray-400 font-mono mt-0.5">{formatPhone(customer.customer_phone)}</div>
            {customer.customer_email && (
              <div className="text-xs text-gray-400 mt-0.5">{customer.customer_email}</div>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1 rounded-md hover:bg-gray-100 flex-shrink-0 ml-2"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* 액션 버튼 */}
        <div className="flex items-center gap-2 mt-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (!editMode && customer) {
                setEditForm({
                  customer_name: customer.customer_name,
                  customer_phone: customer.customer_phone,
                  customer_email: customer.customer_email ?? "",
                  create_channel: customer.create_channel,
                  admin_memo: customer.admin_memo ?? "",
                });
              }
              setEditMode(!editMode);
            }}
            className={`gap-1 ${editMode ? "bg-blue-50 border-blue-300 text-blue-700" : ""}`}
          >
            <Edit2 className="h-3 w-3" />
            {editMode ? "취소" : "수정"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDeactivateConfirm(true)}
            className={customer.is_active ? "text-amber-600 border-amber-200 hover:bg-amber-50" : ""}
          >
            {customer.is_active ? "비활성화" : "활성화"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDeleteConfirm(true)}
            className={customer.is_deleted ? "" : "text-red-600 border-red-200 hover:bg-red-50"}
          >
            {customer.is_deleted ? "복구" : "삭제"}
          </Button>
        </div>
      </div>

      {/* 탭 */}
      <Tabs defaultValue="info" className="flex-1 overflow-hidden flex flex-col">
        <TabsList className="px-5 bg-white flex-shrink-0">
          <TabsTrigger value="info">기본정보</TabsTrigger>
          <TabsTrigger value="orders">
            주문내역
            {customer.recent_orders?.length ? (
              <span className="ml-1 text-xs text-gray-400">{customer.recent_orders.length}</span>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="addresses">
            배송지
            {customer.addresses?.length ? (
              <span className="ml-1 text-xs text-gray-400">{customer.addresses.length}</span>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="inquiries">
            문의내역
            {inquiries.length ? (
              <span className="ml-1 text-xs text-gray-400">{inquiries.length}</span>
            ) : null}
          </TabsTrigger>
        </TabsList>

        <div className="flex-1 overflow-y-auto">
          {/* 기본정보 탭 */}
          <TabsContent value="info" className="m-0 p-4 space-y-3">
            {/* 수정 폼 */}
            {editMode && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3.5 space-y-3">
                <div className="text-xs font-semibold text-blue-700">고객 정보 수정</div>
                <div className="space-y-2">
                  <div>
                    <Label className="text-xs text-gray-600">이름</Label>
                    <Input
                      className="mt-1 h-8 text-sm"
                      value={editForm.customer_name}
                      onChange={(e) => setEditForm((f) => ({ ...f, customer_name: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-gray-600">연락처</Label>
                    <Input
                      className="mt-1 h-8 text-sm"
                      value={editForm.customer_phone}
                      onChange={(e) => setEditForm((f) => ({ ...f, customer_phone: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-gray-600">이메일</Label>
                    <Input
                      className="mt-1 h-8 text-sm"
                      type="email"
                      value={editForm.customer_email}
                      onChange={(e) => setEditForm((f) => ({ ...f, customer_email: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-gray-600">유입 채널</Label>
                    <Select
                      value={editForm.create_channel}
                      onValueChange={(v) => setEditForm((f) => ({ ...f, create_channel: v }))}
                    >
                      <SelectTrigger className="mt-1 h-8 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="OFFLINE">오프라인</SelectItem>
                        <SelectItem value="CAFE24">Cafe24</SelectItem>
                        <SelectItem value="GPMALL">갓피플몰</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-600">관리자 메모</Label>
                    <textarea
                      className="mt-1 w-full border border-gray-300 rounded-md p-2 text-sm resize-none h-16 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                      value={editForm.admin_memo}
                      onChange={(e) => setEditForm((f) => ({ ...f, admin_memo: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending}>
                    {updateMutation.isPending && <LoadingSpinner size="sm" className="mr-1" />}
                    저장
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditMode(false)}>취소</Button>
                </div>
              </div>
            )}
            <Section title="고객 정보">
              <InfoRow label="고객명" value={customer.customer_name} />
              <InfoRow label="연락처" value={formatPhone(customer.customer_phone)} />
              {customer.customer_email && (
                <InfoRow label="이메일" value={customer.customer_email} />
              )}
              <InfoRow label="채널" value={<StatusBadge type="channel" value={customer.create_channel} />} />
              <InfoRow label="최근 주문" value={customer.last_order_at ? formatDate(customer.last_order_at) : "-"} />
            </Section>
            <Section title="시스템">
              <InfoRow label="등록일" value={formatDate(customer.created_at)} />
              <InfoRow label="수정일" value={formatDate(customer.updated_at)} />
              {customer.deleted_at && (
                <InfoRow label="삭제일" value={formatDate(customer.deleted_at)} />
              )}
            </Section>
            {customer.admin_memo && (
              <Section title="관리자 메모">
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{customer.admin_memo}</p>
              </Section>
            )}
          </TabsContent>

          {/* 주문내역 탭 */}
          <TabsContent value="orders" className="m-0 p-5 space-y-2">
            <div className="flex justify-end mb-1">
              <Button
                variant="outline"
                size="sm"
                className="gap-1"
                onClick={() =>
                  navigate("/orders/new", {
                    state: { prefilledCustomer: customer },
                  })
                }
              >
                <Plus className="h-3 w-3" />
                주문 등록
              </Button>
            </div>
            {ordersLoading ? (
              <div className="flex justify-center py-8"><LoadingSpinner /></div>
            ) : ordersRes?.data?.length ? (
              ordersRes.data.map((order) => (
                <OrderRow
                  key={order.order_id}
                  order={order}
                  onClick={() => setSelectedOrderId(order.order_id)}
                />
              ))
            ) : (
              <p className="text-sm text-gray-400 text-center py-8">주문 내역이 없습니다.</p>
            )}
          </TabsContent>

          {/* 배송지 탭 */}
          <TabsContent value="addresses" className="m-0 p-5 space-y-3">
            <div className="flex justify-end mb-1">
              <Button
                variant="outline"
                size="sm"
                className="gap-1"
                onClick={() => setAddAddressMode((v) => !v)}
              >
                <Plus className="h-3 w-3" />
                {addAddressMode ? "취소" : "배송지 추가"}
              </Button>
            </div>

            {/* 배송지 추가 폼 */}
            {addAddressMode && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3.5 space-y-2.5">
                <div className="text-xs font-semibold text-blue-700">새 배송지</div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs text-gray-600">수령인 <span className="text-red-500">*</span></Label>
                    <Input
                      className="mt-1 h-8 text-sm"
                      placeholder="홍길동"
                      value={addressForm.recipient_name}
                      onChange={(e) => setAddressForm((f) => ({ ...f, recipient_name: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-gray-600">연락처 <span className="text-red-500">*</span></Label>
                    <Input
                      className="mt-1 h-8 text-sm font-mono"
                      placeholder="01012345678"
                      value={addressForm.recipient_phone}
                      onChange={(e) => setAddressForm((f) => ({ ...f, recipient_phone: e.target.value }))}
                    />
                  </div>
                </div>
                <AddressSearchField
                  postalCode={addressForm.postal_code}
                  address={addressForm.recipient_address}
                  onChange={(postal_code, recipient_address) =>
                    setAddressForm((f) => ({ ...f, postal_code, recipient_address }))
                  }
                  required
                />
                <div>
                  <Label className="text-xs text-gray-600">배송 메모</Label>
                  <Input
                    className="mt-1 h-8 text-sm"
                    placeholder="문 앞에 놔주세요 (선택)"
                    value={addressForm.customer_memo}
                    onChange={(e) => setAddressForm((f) => ({ ...f, customer_memo: e.target.value }))}
                  />
                </div>
                <div>
                  <Label className="text-xs text-gray-600">관리자 메모</Label>
                  <Input
                    className="mt-1 h-8 text-sm"
                    placeholder="(선택)"
                    value={addressForm.admin_memo}
                    onChange={(e) => setAddressForm((f) => ({ ...f, admin_memo: e.target.value }))}
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => createAddressMutation.mutate()}
                    disabled={
                      !addressForm.recipient_name ||
                      !addressForm.recipient_phone ||
                      !addressForm.postal_code ||
                      !addressForm.recipient_address ||
                      createAddressMutation.isPending
                    }
                  >
                    {createAddressMutation.isPending && <LoadingSpinner size="sm" className="mr-1" />}
                    저장
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => { setAddAddressMode(false); setAddressForm(EMPTY_ADDRESS_FORM); }}>
                    취소
                  </Button>
                </div>
              </div>
            )}

            {customer.addresses?.length ? (
              customer.addresses.map((address) => (
                <AddressCard
                  key={address.address_id}
                  address={address}
                  onDelete={() => setDeleteAddressId(address.address_id)}
                  onUpdateMemo={(memo) =>
                    updateAddressMemoMutation.mutate({ addressId: address.address_id, memo })
                  }
                />
              ))
            ) : (
              <p className="text-sm text-gray-400 text-center py-8">등록된 배송지가 없습니다.</p>
            )}
          </TabsContent>

          {/* 문의내역 탭 */}
          <TabsContent value="inquiries" className="m-0 p-5 space-y-2">
            {inquiries.length ? (
              inquiries.map((inquiry) => (
                <InquiryRow key={inquiry.inquiry_id} inquiry={inquiry} />
              ))
            ) : (
              <p className="text-sm text-gray-400 text-center py-8">문의 내역이 없습니다.</p>
            )}
          </TabsContent>
        </div>
      </Tabs>

      {/* 비활성화/활성화 확인 모달 */}
      <ConfirmModal
        open={deactivateConfirm}
        onClose={() => setDeactivateConfirm(false)}
        onConfirm={() => deactivateMutation.mutate()}
        title={customer.is_active ? "고객 비활성화" : "고객 활성화"}
        description={
          customer.is_active
            ? "이 고객을 비활성화합니다. 비활성 고객은 목록에서 필터링될 수 있습니다."
            : "이 고객을 활성화합니다."
        }
        confirmLabel={customer.is_active ? "비활성화" : "활성화"}
        variant={customer.is_active ? "destructive" : "default"}
        isLoading={deactivateMutation.isPending}
      />

      {/* 삭제/복구 확인 모달 */}
      <ConfirmModal
        open={deleteConfirm}
        onClose={() => setDeleteConfirm(false)}
        onConfirm={() => deleteMutation.mutate()}
        title={customer.is_deleted ? "고객 복구" : "고객 삭제"}
        description={
          customer.is_deleted
            ? "삭제된 고객을 복구합니다."
            : "이 고객을 삭제합니다. 삭제 후에는 목록에서 조회되지 않습니다."
        }
        confirmLabel={customer.is_deleted ? "복구" : "삭제"}
        variant={customer.is_deleted ? "default" : "destructive"}
        isLoading={deleteMutation.isPending}
      />

      {/* 배송지 삭제 확인 모달 */}
      <ConfirmModal
        open={deleteAddressId !== null}
        onClose={() => setDeleteAddressId(null)}
        onConfirm={() => deleteAddressId !== null && deleteAddressMutation.mutate(deleteAddressId)}
        title="배송지 삭제"
        description="이 배송지를 삭제합니다. 삭제 후에는 복구할 수 없습니다."
        confirmLabel="삭제"
        variant="destructive"
        isLoading={deleteAddressMutation.isPending}
      />

      {/* 주문 상세 패널 */}
      <SlidingPanel
        open={selectedOrderId !== null}
        onClose={() => setSelectedOrderId(null)}
        width={520}
      >
        {selectedOrderId !== null && (
          <OrderDetailPanel
            orderId={selectedOrderId}
            onClose={() => setSelectedOrderId(null)}
          />
        )}
      </SlidingPanel>
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
function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  if (!value && value !== 0) return null;
  return (
    <div className="flex items-start gap-3">
      <span className="text-xs text-gray-400 w-24 flex-shrink-0 pt-0.5">{label}</span>
      <span className="text-sm text-gray-700 flex-1">{value}</span>
    </div>
  );
}

// 주문 행
function OrderRow({ order, onClick }: { order: OrderResponse; onClick: () => void }) {
  return (
    <div
      className="border border-gray-200 rounded-lg p-3 hover:bg-gray-50 hover:border-gray-300 transition-colors cursor-pointer"
      onClick={onClick}
    >
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-gray-400">#{order.order_id}</span>
          <StatusBadge type="order_status" value={order.order_status} />
          <StatusBadge type="channel" value={order.order_channel} />
        </div>
        <span className="text-xs text-gray-400">{formatDate(order.order_at)}</span>
      </div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-gray-500">{order.payment_method ? (PAYMENT_METHOD_LABEL[order.payment_method] ?? order.payment_method) : "결제방법 미지정"}</span>
        <span className="font-medium text-gray-900">{formatAmount(order.payment_amount)}</span>
      </div>
    </div>
  );
}

// 배송지 카드
function AddressCard({
  address,
  onDelete,
  onUpdateMemo,
}: {
  address: AddressResponse;
  onDelete: () => void;
  onUpdateMemo: (memo: string | null) => void;
}) {
  const [editingMemo, setEditingMemo] = useState(false);
  const [memoValue, setMemoValue] = useState(address.admin_memo ?? "");

  const handleSaveMemo = () => {
    onUpdateMemo(memoValue.trim() || null);
    setEditingMemo(false);
  };

  const handleCancelMemo = () => {
    setMemoValue(address.admin_memo ?? "");
    setEditingMemo(false);
  };

  return (
    <div className="border border-gray-200 rounded-lg p-3.5">
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-1 min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm text-gray-900">{address.recipient_name}</span>
            <span className="text-xs text-gray-500 font-mono">
              {formatPhone(address.recipient_phone)}
            </span>
          </div>
          <div className="text-xs text-gray-500">
            ({address.postal_code}) {address.recipient_address}
          </div>
          {address.customer_memo && (
            <div className="text-xs text-gray-400">배송 메모: {address.customer_memo}</div>
          )}
          {/* 관리자 메모 인라인 편집 */}
          {editingMemo ? (
            <div className="pt-1 space-y-1">
              <Input
                className="h-7 text-xs"
                value={memoValue}
                onChange={(e) => setMemoValue(e.target.value)}
                placeholder="관리자 메모"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveMemo();
                  if (e.key === "Escape") handleCancelMemo();
                }}
              />
              <div className="flex gap-1">
                <Button size="sm" className="h-6 text-xs px-2" onClick={handleSaveMemo}>저장</Button>
                <Button size="sm" variant="ghost" className="h-6 text-xs px-2" onClick={handleCancelMemo}>취소</Button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setEditingMemo(true)}
              className="text-xs text-gray-400 hover:text-blue-500 transition-colors"
            >
              {address.admin_memo ? `관리자 메모: ${address.admin_memo}` : "+ 관리자 메모 추가"}
            </button>
          )}
        </div>
        <button
          onClick={onDelete}
          className="text-gray-300 hover:text-red-400 flex-shrink-0 p-0.5 rounded transition-colors"
          title="배송지 삭제"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

// 문의 행
function InquiryRow({ inquiry }: { inquiry: InquiryResponse }) {
  const isUnhandled = inquiry.inquiry_status === "RECEIVED";
  return (
    <div
      className={`border rounded-lg p-3 ${
        isUnhandled ? "border-amber-200 bg-amber-50" : "border-gray-200"
      }`}
    >
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <StatusBadge type="inquiry_status" value={inquiry.inquiry_status} />
          <StatusBadge type="inquiry_type" value={inquiry.inquiry_type} />
        </div>
        <span className="text-xs text-gray-400">{formatDate(inquiry.created_at)}</span>
      </div>
      {inquiry.title && (
        <div className="text-sm text-gray-700 truncate">{inquiry.title}</div>
      )}
      {inquiry.content && !inquiry.title && (
        <div className="text-sm text-gray-600 truncate">{inquiry.content}</div>
      )}
    </div>
  );
}
