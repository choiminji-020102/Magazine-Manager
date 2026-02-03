import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import * as XLSX from "xlsx";
import {
  Download,
  RefreshCw,
  Mail,
  Plus,
  Phone,
  ArrowRight,
  MessageSquare,
  Edit,
  Save,
  Trash2,
  AlertTriangle,
  RotateCcw,
  Users,
  Archive,
} from "lucide-react";
import Button from "../components/common/Button";
import SlidePanel from "../components/common/SlidePanel";
import Input from "../components/common/Input";
import Textarea from "../components/common/Textarea";
import Breadcrumb from "../components/common/Breadcrumb";
import SearchFilterBar, {
  FilterField,
  SortOption,
  ActiveFilter,
} from "../components/common/SearchFilterBar";
import ListPage from "../components/common/ListPage";
import Modal from "../components/common/Modal";
import Tabs from "../components/common/Tabs";
import Badge from "../components/common/Badge";
import { Column } from "../components/common/Table";
import { customersApi } from "../api/customersApi";
import { ordersApi } from "../api/ordersApi";
import type { 
  CustomerResponse, 
  CustomerUpdate, 
  CustomerListQuery
} from "../types/customer";
import { 
  getOrderStatusLabel, 
  getSendStatusLabel, 
  getChannelLabel,
  formatSubscriptionPeriod 
} from "../utils/customerUtils";

type Customer = CustomerResponse;

// DB 스키마 기반 인터페이스
interface Order {
  order_id: number;
  customer_id: number;
  external_order_id: string | null;
  order_channel: "CAFE24" | "GPMALL" | "OFFLINE";
  order_status: "ORDERED" | "PAID" | "CANCELLED" | "SHIPPING" | "COMPLETED";
  total_amount: number;
  discount_amount: number;
  send_fee: number;
  payment_amount: number;
  payment_method: string | null;
  address_id: number | null;
  request_memo: string | null;
  admin_memo: string | null;
  order_at: string;
  payment_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
  order_items?: OrderItem[];
}

interface OrderItem {
  order_item_id: number;
  external_order_item_id: string | null;
  order_id: number;
  product_code: string;
  product_kind: "YEARLY" | "MONTHLY" | "SINGLE";
  product_name: string;
  price: number;
  sale: number;
  order_num: number;
  subscribe_start_issue: string | null;
  subscribe_end_issue: string | null;
  last_send_issue: string | null;
  final_subscribe_end_issue: string | null;
  address_id: number;
  created_at: string;
  sended_at: string | null;
  cancelled_at: string | null;
  updated_at: string;
}

interface Send {
  send_id: number;
  order_id: number;
  address_id: number | null;
  send_date: string | null;
  courier_company:
    | "CJ대한통운"
    | "로젠택배"
    | "우체국택배"
    | "한진택배"
    | "롯데택배"
    | null;
  tracking_no: string | null;
  send_status: "PREPARING" | "SHIPPED" | "DELIVERED" | "CANCELLED";
  send_memo: string | null;
  address_name: string;
  phone: string;
  nation: string;
  postal_code: string;
  address: string;
  address_memo: string | null;
  created_at: string;
  updated_at: string;
  cancelled_at: string | null;
  send_items?: SendItem[];
}

interface Address {
  address_id: number;
  address_name: string;
  phone: string;
  nation: string;
  postal_code: string;
  address1: string;
  address2: string;
  address_memo: string | null;
  created_at: string;
  updated_at: string;
}

interface SendItem {
  send_item_id: number;
  send_id: number;
  order_item_id: number;
  product_code: string;
  product_kind: "YEARLY" | "MONTHLY" | "SINGLE";
  send_num: number;
  purchase: number;
  product_name: string;
  unit_weight: number;
  unit_width: number;
  unit_length: number;
  unit_height: number;
  created_at: string;
  updated_at: string;
  cancelled_at: string | null;
}


const SOURCE_OPTIONS = ["CAFE24", "GPMALL", "OFFLINE", "기타"];

// ============================================================================
// 메인 컴포넌트: CustomerListPage
// ============================================================================

// ============================================================================
// 내부 컴포넌트: CustomerInfoTab
// ============================================================================
interface CustomerInfoTabProps {
  customer: Customer;
  isEditMode: boolean;
  editForm: Partial<Customer>;
  onEditFormChange: (form: Partial<Customer>) => void;
}

const CustomerInfoTab: React.FC<CustomerInfoTabProps> = ({
  customer,
  isEditMode,
  editForm,
  onEditFormChange,
}) => {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div className="p-4 bg-paper rounded-lg">
          <div className="space-y-4">
            {isEditMode ? (
              <>
                <Input
                  label="이름"
                  value={editForm.customer_name || customer.customer_name}
                  onChange={(e) =>
                    onEditFormChange({
                      ...editForm,
                      customer_name: e.target.value,
                    })
                  }
                  required
                />
                <Input
                  label="전화번호"
                  type="tel"
                  value={editForm.customer_phone || customer.customer_phone}
                  onChange={(e) =>
                    onEditFormChange({
                      ...editForm,
                      customer_phone: e.target.value,
                    })
                  }
                  required
                />
                <Input
                  label="이메일"
                  type="email"
                  value={
                    editForm.customer_email !== undefined
                      ? editForm.customer_email || ""
                      : customer.customer_email || ""
                  }
                  onChange={(e) =>
                    onEditFormChange({
                      ...editForm,
                      customer_email: e.target.value || null,
                    })
                  }
                />
                <Textarea
                  label="관리자 메모"
                  value={editForm.admin_memo !== undefined ? editForm.admin_memo || "" : customer.admin_memo || ""}
                  onChange={(e) =>
                    onEditFormChange({
                      ...editForm,
                      admin_memo: e.target.value || null,
                    })
                  }
                  placeholder="관리자 메모를 입력하세요 (선택사항)"
                  rows={3}
                />
              </>
            ) : (
              <>
                <div>
                  <label className="text-xs text-muted uppercase tracking-wide">
                    이름
                  </label>
                  <p className="text-base font-medium text-ink mt-1">
                    {customer.customer_name}
                  </p>
                </div>
                <div>
                  <label className="text-xs text-muted uppercase tracking-wide">
                    전화번호
                  </label>
                  <p className="text-base text-ink mt-1">
                    {customer.customer_phone}
                  </p>
                </div>
                <div>
                  <label className="text-xs text-muted uppercase tracking-wide">
                    이메일
                  </label>
                  <p className="text-base text-ink mt-1">
                    {customer.customer_email || "-"}
                  </p>
                </div>
                <div>
                  <label className="text-xs text-muted uppercase tracking-wide">
                    관리자 메모
                  </label>
                  <p className="text-base text-ink mt-1 whitespace-pre-wrap">
                    {customer.admin_memo || "-"}
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
        <div className="p-4 bg-paper rounded-lg">
          <div className="space-y-4">
            <div>
              <label className="text-xs text-muted uppercase tracking-wide">
                유입채널
              </label>
              <p className="text-base text-ink mt-1">
                {customer.create_channel === "CAFE24"
                  ? "Cafe24"
                  : customer.create_channel === "GPMALL"
                  ? "갓피플몰"
                  : customer.create_channel}
              </p>
              {isEditMode && (
                <p className="text-xs text-muted mt-1">
                  유입 경로는 수정할 수 없습니다.
                </p>
              )}
            </div>
            <div>
              <label className="text-xs text-muted uppercase tracking-wide">
                마지막 주문일
              </label>
              <p className="text-base text-ink mt-1">
                {customer.last_order_at
                  ? new Date(customer.last_order_at).toLocaleDateString("ko-KR")
                  : "-"}
              </p>
            </div>
            <div>
              <label className="text-xs text-muted uppercase tracking-wide">
                가입일
              </label>
              <p className="text-base text-ink mt-1">
                {new Date(customer.created_at).toLocaleDateString("ko-KR")}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 내부 컴포넌트: CustomerOrdersTab
// ============================================================================
interface CustomerOrdersTabProps {
  orders: Order[];
  onOrderClick: (order: Order) => void;
}

const CustomerOrdersTab: React.FC<CustomerOrdersTabProps> = ({
  orders,
  onOrderClick,
}) => {
  if (orders.length === 0) {
    return (
      <div className="text-center py-8 text-muted">주문 내역이 없습니다.</div>
    );
  }

  return (
    <div className="space-y-3">
      {orders.map((order) => (
        <div
          key={order.order_id}
          className="p-4 border border-line rounded-lg hover:bg-paper transition-colors cursor-pointer"
          onClick={() => onOrderClick(order)}
        >
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <p className="font-mono text-sm text-accent">
                  {order.external_order_id || `주문 #${order.order_id}`}
                </p>
                <Badge
                  variant={
                    order.order_status === "COMPLETED"
                      ? "success"
                      : order.order_status === "CANCELLED"
                      ? "default"
                      : "info"
                  }
                  size="sm"
                >
                  {getOrderStatusLabel(order.order_status)}
                </Badge>
              </div>
              <p className="text-sm text-muted mb-1">
                {new Date(order.order_at).toLocaleString("ko-KR")}
              </p>
              <p className="text-sm text-ink">
                {order.order_channel === "CAFE24"
                  ? "Cafe24"
                  : order.order_channel === "GPMALL"
                  ? "갓피플몰"
                  : order.order_channel}
              </p>
            </div>
            <div className="text-right ml-4">
              <p className="font-semibold text-ink text-lg">
                {order.payment_amount.toLocaleString()}원
              </p>
              <p className="text-xs text-muted mt-1">
                결제: {order.payment_method || "-"}
              </p>
              <ArrowRight className="w-4 h-4 text-muted mt-2 ml-auto" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

// ============================================================================
// 내부 컴포넌트: CustomerSubscriptionsTab
// ============================================================================
interface CustomerSubscriptionsTabProps {
  subscriptions: OrderItem[];
  onSubscriptionClick: (item: OrderItem) => void;
}

const CustomerSubscriptionsTab: React.FC<CustomerSubscriptionsTabProps> = ({
  subscriptions,
  onSubscriptionClick,
}) => {
  if (subscriptions.length === 0) {
    return (
      <div className="text-center py-8 text-muted">구독 내역이 없습니다.</div>
    );
  }

  return (
    <div className="space-y-3">
      {subscriptions.map((item) => (
        <div
          key={item.order_item_id}
          className="p-4 border border-line rounded-lg hover:bg-paper transition-colors cursor-pointer"
          onClick={() => onSubscriptionClick(item)}
        >
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <Badge
                  variant={
                    item.product_kind === "YEARLY" ? "info" : "success"
                  }
                  size="sm"
                >
                  {item.product_kind === "YEARLY" ? "연간" : "월간"}
                </Badge>
                <p className="font-medium text-ink">{item.product_name}</p>
              </div>
              <p className="text-sm text-muted mb-1">
                구독기간 :{" "}
                {formatSubscriptionPeriod(
                  item.subscribe_start_issue,
                  item.subscribe_end_issue
                )}
              </p>
              {item.last_send_issue && (
                <p className="text-xs text-muted">
                  최근 발송: {item.last_send_issue}
                </p>
              )}
            </div>
            <div className="text-right ml-4">
              <p className="font-semibold text-ink">
                {item.price.toLocaleString()}원
              </p>
              {item.sale > 0 && (
                <p className="text-xs text-muted line-through">
                  {(item.price + item.sale).toLocaleString()}원
                </p>
              )}
              <ArrowRight className="w-4 h-4 text-muted mt-2 ml-auto" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

// ============================================================================
// 내부 컴포넌트: CustomerSendsTab
// ============================================================================
interface CustomerSendsTabProps {
  sends: Send[];
  onSendClick: (send: Send) => void;
}

const CustomerSendsTab: React.FC<CustomerSendsTabProps> = ({
  sends,
  onSendClick,
}) => {
  if (sends.length === 0) {
    return (
      <div className="text-center py-8 text-muted">배송 내역이 없습니다.</div>
    );
  }

  return (
    <div className="space-y-3">
      {sends.map((send) => (
        <div
          key={send.send_id}
          className="p-4 border border-line rounded-lg hover:bg-paper transition-colors cursor-pointer"
          onClick={() => onSendClick(send)}
        >
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <Badge
                  variant={
                    send.send_status === "DELIVERED"
                      ? "success"
                      : send.send_status === "CANCELLED"
                      ? "default"
                      : "info"
                  }
                  size="sm"
                >
                  {getSendStatusLabel(send.send_status)}
                </Badge>
                {send.tracking_no && (
                  <p className="font-mono text-sm text-accent">
                    {send.tracking_no}
                  </p>
                )}
              </div>
              <p className="text-sm text-muted mb-1">
                {send.send_date
                  ? new Date(send.send_date).toLocaleDateString("ko-KR")
                  : "-"}
              </p>
              <p className="text-sm text-ink">
                {send.courier_company || "택배사 미지정"}
              </p>
            </div>
            <div className="text-right ml-4">
              <p className="text-sm text-ink font-medium">{send.address_name}</p>
              <p className="text-xs text-muted mt-1">{send.phone}</p>
              <ArrowRight className="w-4 h-4 text-muted mt-2 ml-auto" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

// ============================================================================
// 내부 컴포넌트: CustomerInquiriesTab
// ============================================================================
const CustomerInquiriesTab: React.FC = () => {
  return (
    <div className="space-y-4">
      <div className="text-center py-12 text-muted">
        <MessageSquare className="w-12 h-12 mx-auto mb-3 text-muted/50" />
        <p>문의 내역이 없습니다.</p>
        <p className="text-xs mt-2">문의 내역 기능은 준비 중입니다.</p>
      </div>
    </div>
  );
};

// ============================================================================
// 내부 컴포넌트: OrderDetailPanel
// ============================================================================
interface OrderDetailPanelProps {
  order: Order;
  orderItems: OrderItem[];
  getAddressById: (addressId: number | null) => Address | null;
}

const OrderDetailPanel: React.FC<OrderDetailPanelProps> = ({
  order,
  orderItems,
  getAddressById,
}) => {
  const address = order.address_id ? getAddressById(order.address_id) : null;
  const addressMemo = address?.address_memo || "";
  const requestMemo = order.request_memo || "";
  const showRequestMemo =
    addressMemo.trim() !== requestMemo.trim() && requestMemo;

  const items = order.order_items
    ? order.order_items
    : orderItems.filter((item) => item.order_id === order.order_id);

  return (
    <div className="space-y-4">
      {/* 기본 정보 */}
      <div className="p-4 bg-paper rounded-lg border border-line">
        <h3 className="text-sm font-semibold text-ink mb-4 uppercase tracking-wide">
          기본 정보
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-muted uppercase tracking-wide block mb-1">
              외부 주문 번호
            </label>
            <p className="text-sm text-ink font-medium">
              {order.external_order_id || "-"}
            </p>
          </div>
          <div>
            <label className="text-xs text-muted uppercase tracking-wide block mb-1">
              주문 채널
            </label>
            <p className="text-sm text-ink font-medium">
              {getChannelLabel(order.order_channel)}
            </p>
          </div>
          <div>
            <label className="text-xs text-muted uppercase tracking-wide block mb-1">
              주문 상태
            </label>
            <p className="text-sm text-ink font-medium">
              {getOrderStatusLabel(order.order_status)}
            </p>
          </div>
          <div>
            <label className="text-xs text-muted uppercase tracking-wide block mb-1">
              결제 방식
            </label>
            <p className="text-sm text-ink font-medium">
              {order.payment_method || "-"}
            </p>
          </div>
          <div>
            <label className="text-xs text-muted uppercase tracking-wide block mb-1">
              주문 일시
            </label>
            <p className="text-sm text-ink font-medium">
              {new Date(order.order_at).toLocaleString("ko-KR")}
            </p>
          </div>
          <div>
            <label className="text-xs text-muted uppercase tracking-wide block mb-1">
              결제 일시
            </label>
            <p className="text-sm text-ink font-medium">
              {order.payment_at
                ? new Date(order.payment_at).toLocaleString("ko-KR")
                : "-"}
            </p>
          </div>
          <div>
            <label className="text-xs text-muted uppercase tracking-wide block mb-1">
              취소 일시
            </label>
            <p className="text-sm text-ink font-medium">
              {order.cancelled_at
                ? new Date(order.cancelled_at).toLocaleString("ko-KR")
                : "-"}
            </p>
          </div>
        </div>
      </div>

      {/* 금액 정보 */}
      <div className="p-4 bg-paper rounded-lg border border-line">
        <h3 className="text-sm font-semibold text-ink mb-4 uppercase tracking-wide">
          금액 정보
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-muted uppercase tracking-wide block mb-1">
              상품 금액
            </label>
            <p className="text-sm text-ink font-medium">
              {order.total_amount.toLocaleString()}원
            </p>
          </div>
          <div>
            <label className="text-xs text-muted uppercase tracking-wide block mb-1">
              할인 금액
            </label>
            <p className="text-sm text-ink font-medium">
              {order.discount_amount.toLocaleString()}원
            </p>
          </div>
          <div>
            <label className="text-xs text-muted uppercase tracking-wide block mb-1">
              배송비
            </label>
            <p className="text-sm text-ink font-medium">
              {order.send_fee.toLocaleString()}원
            </p>
          </div>
          <div>
            <label className="text-xs text-muted uppercase tracking-wide block mb-1">
              최종 결제 금액
            </label>
            <p className="text-base font-bold text-accent">
              {order.payment_amount.toLocaleString()}원
            </p>
          </div>
        </div>
      </div>

      {/* 배송지 정보 */}
      <div className="p-4 bg-paper rounded-lg border border-line">
        <h3 className="text-sm font-semibold text-ink mb-4 uppercase tracking-wide">
          배송지 정보
        </h3>
        {address ? (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-muted uppercase tracking-wide block mb-1">
                  수령인
                </label>
                <p className="text-sm text-ink font-medium">
                  {address.address_name}
                </p>
              </div>
              <div>
                <label className="text-xs text-muted uppercase tracking-wide block mb-1">
                  연락처
                </label>
                <p className="text-sm text-ink font-medium">{address.phone}</p>
              </div>
              <div>
                <label className="text-xs text-muted uppercase tracking-wide block mb-1">
                  국가
                </label>
                <p className="text-sm text-ink font-medium">{address.nation}</p>
              </div>
              <div>
                <label className="text-xs text-muted uppercase tracking-wide block mb-1">
                  우편번호
                </label>
                <p className="text-sm text-ink font-medium">
                  {address.postal_code}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-muted uppercase tracking-wide block mb-1">
                  주소
                </label>
                <p className="text-sm text-ink font-medium">{address.address1}</p>
              </div>
              <div>
                <label className="text-xs text-muted uppercase tracking-wide block mb-1">
                  상세주소
                </label>
                <p className="text-sm text-ink font-medium">
                  {address.address2 || "-"}
                </p>
              </div>
            </div>
            <div>
              <label className="text-xs text-muted uppercase tracking-wide block mb-1">
                배송 특이사항
              </label>
              <p className="text-sm text-ink font-medium">
                {address.address_memo || "-"}
              </p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-ink">배송지 정보 없음</p>
        )}
      </div>

      {/* 고객 요청사항 */}
      {showRequestMemo && (
        <div className="p-4 bg-paper rounded-lg border border-line">
          <h3 className="text-sm font-semibold text-ink mb-4 uppercase tracking-wide">
            고객 요청사항
          </h3>
          <p className="text-sm text-ink whitespace-pre-wrap">
            {order.request_memo}
          </p>
        </div>
      )}

      {/* 관리자 메모 */}
      <div className="p-4 bg-paper rounded-lg border border-line">
        <h3 className="text-sm font-semibold text-ink mb-4 uppercase tracking-wide">
          관리자 메모
        </h3>
        <p className="text-sm text-ink whitespace-pre-wrap">
          {order.admin_memo || "-"}
        </p>
      </div>

      {/* 주문 품목 */}
      <div className="p-4 bg-paper rounded-lg border border-line">
        <h3 className="text-sm font-semibold text-ink mb-4 uppercase tracking-wide">
          주문 품목
        </h3>
        {items.length === 0 ? (
          <p className="text-sm text-muted">주문 품목이 없습니다.</p>
        ) : (
          <div className="space-y-3">
            {items.map((item) => {
              const itemAddress = getAddressById(item.address_id);
              return (
                <div
                  key={item.order_item_id}
                  className="p-3 bg-white rounded border border-line space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={
                          item.product_kind === "YEARLY"
                            ? "info"
                            : item.product_kind === "MONTHLY"
                            ? "success"
                            : "default"
                        }
                        size="sm"
                      >
                        {item.product_kind === "YEARLY"
                          ? "연간"
                          : item.product_kind === "MONTHLY"
                          ? "월간"
                          : "단권"}
                      </Badge>
                      <span className="font-medium text-ink">
                        {item.product_name}
                      </span>
                    </div>
                    <span className="font-semibold text-ink">
                      {item.price.toLocaleString()}원
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-muted">외부 품목 ID:</span>{" "}
                      <span className="text-ink">
                        {item.external_order_item_id || "-"}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted">상품 코드:</span>{" "}
                      <span className="text-ink">{item.product_code}</span>
                    </div>
                    <div>
                      <span className="text-muted">할인 금액:</span>{" "}
                      <span className="text-ink">
                        {item.sale.toLocaleString()}원
                      </span>
                    </div>
                    <div>
                      <span className="text-muted">주문 수량:</span>{" "}
                      <span className="text-ink">{item.order_num}</span>
                    </div>
                    {(item.product_kind === "YEARLY" ||
                      item.product_kind === "MONTHLY") && (
                      <>
                        <div>
                          <span className="text-muted">구독 시작 호:</span>{" "}
                          <span className="text-ink">
                            {item.subscribe_start_issue || "-"}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted">구독 종료 호:</span>{" "}
                          <span className="text-ink">
                            {item.subscribe_end_issue || "-"}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted">최근 발송 호:</span>{" "}
                          <span className="text-ink">
                            {item.last_send_issue || "-"}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted">실제 마지막 발송 호:</span>{" "}
                          <span className="text-ink">
                            {item.final_subscribe_end_issue || "-"}
                          </span>
                        </div>
                      </>
                    )}
                    <div>
                      <span className="text-muted">발송 일시:</span>{" "}
                      <span className="text-ink">
                        {item.sended_at
                          ? new Date(item.sended_at).toLocaleString("ko-KR")
                          : "-"}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted">취소 일시:</span>{" "}
                      <span className="text-ink">
                        {item.cancelled_at
                          ? new Date(item.cancelled_at).toLocaleString("ko-KR")
                          : "-"}
                      </span>
                    </div>
                  </div>
                  {itemAddress && (
                    <div className="pt-2 border-t border-line">
                      <p className="text-sm text-muted mb-1">배송지</p>
                      <p className="text-sm text-ink">
                        {itemAddress.address_name} / {itemAddress.phone} /{" "}
                        {itemAddress.postal_code} {itemAddress.address1}{" "}
                        {itemAddress.address2}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// 내부 컴포넌트: SubscriptionDetailPanel
// ============================================================================
interface SubscriptionDetailPanelProps {
  orderItem: OrderItem;
  getAddressById: (addressId: number | null) => Address | null;
}

const SubscriptionDetailPanel: React.FC<SubscriptionDetailPanelProps> = ({
  orderItem,
  getAddressById,
}) => {
  const address = getAddressById(orderItem.address_id);

  return (
    <div className="space-y-4">
      {/* 기본 정보 */}
      <div className="p-4 bg-paper rounded-lg border border-line">
        <h3 className="text-sm font-semibold text-ink mb-4 uppercase tracking-wide">
          기본 정보
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-muted uppercase tracking-wide block mb-1">
              외부 주문 품목 ID
            </label>
            <p className="text-sm text-ink font-medium">
              {orderItem.external_order_item_id || "-"}
            </p>
          </div>
          <div>
            <label className="text-xs text-muted uppercase tracking-wide block mb-1">
              상품 코드
            </label>
            <p className="text-sm text-ink font-medium">
              {orderItem.product_code}
            </p>
          </div>
          <div>
            <label className="text-xs text-muted uppercase tracking-wide block mb-1">
              상품 종류
            </label>
            <p className="text-sm text-ink font-medium">
              {orderItem.product_kind === "YEARLY"
                ? "연간"
                : orderItem.product_kind === "MONTHLY"
                ? "월간"
                : "단권"}
            </p>
          </div>
          <div>
            <label className="text-xs text-muted uppercase tracking-wide block mb-1">
              상품명
            </label>
            <p className="text-sm text-ink font-medium">
              {orderItem.product_name}
            </p>
          </div>
          <div>
            <label className="text-xs text-muted uppercase tracking-wide block mb-1">
              단가
            </label>
            <p className="text-sm text-ink font-medium">
              {orderItem.price.toLocaleString()}원
            </p>
          </div>
          <div>
            <label className="text-xs text-muted uppercase tracking-wide block mb-1">
              할인 금액
            </label>
            <p className="text-sm text-ink font-medium">
              {orderItem.sale.toLocaleString()}원
            </p>
          </div>
          <div>
            <label className="text-xs text-muted uppercase tracking-wide block mb-1">
              주문 수량
            </label>
            <p className="text-sm text-ink font-medium">{orderItem.order_num}</p>
          </div>
        </div>
      </div>

      {/* 배송지 정보 */}
      <div className="p-4 bg-paper rounded-lg border border-line">
        <h3 className="text-sm font-semibold text-ink mb-4 uppercase tracking-wide">
          배송지 정보
        </h3>
        {address ? (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-muted uppercase tracking-wide block mb-1">
                  수령인
                </label>
                <p className="text-sm text-ink font-medium">
                  {address.address_name}
                </p>
              </div>
              <div>
                <label className="text-xs text-muted uppercase tracking-wide block mb-1">
                  연락처
                </label>
                <p className="text-sm text-ink font-medium">{address.phone}</p>
              </div>
              <div>
                <label className="text-xs text-muted uppercase tracking-wide block mb-1">
                  국가
                </label>
                <p className="text-sm text-ink font-medium">{address.nation}</p>
              </div>
              <div>
                <label className="text-xs text-muted uppercase tracking-wide block mb-1">
                  우편번호
                </label>
                <p className="text-sm text-ink font-medium">
                  {address.postal_code}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-muted uppercase tracking-wide block mb-1">
                  주소
                </label>
                <p className="text-sm text-ink font-medium">{address.address1}</p>
              </div>
              <div>
                <label className="text-xs text-muted uppercase tracking-wide block mb-1">
                  상세주소
                </label>
                <p className="text-sm text-ink font-medium">
                  {address.address2 || "-"}
                </p>
              </div>
            </div>
            <div>
              <label className="text-xs text-muted uppercase tracking-wide block mb-1">
                배송 특이사항
              </label>
              <p className="text-sm text-ink font-medium">
                {address.address_memo || "-"}
              </p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-ink">배송지 정보를 찾을 수 없습니다.</p>
        )}
      </div>

      {/* 구독 호 정보 */}
      <div className="p-4 bg-paper rounded-lg border border-line">
        <h3 className="text-sm font-semibold text-ink mb-4 uppercase tracking-wide">
          구독 호 정보
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-muted uppercase tracking-wide block mb-1">
              구독 시작 호
            </label>
            <p className="text-sm text-ink font-medium">
              {orderItem.subscribe_start_issue || "-"}
            </p>
          </div>
          <div>
            <label className="text-xs text-muted uppercase tracking-wide block mb-1">
              구독 종료 호
            </label>
            <p className="text-sm text-ink font-medium">
              {orderItem.subscribe_end_issue || "-"}
            </p>
          </div>
          <div>
            <label className="text-xs text-muted uppercase tracking-wide block mb-1">
              최근 발송 호
            </label>
            <p className="text-sm text-ink font-medium">
              {orderItem.last_send_issue || "-"}
            </p>
          </div>
          <div>
            <label className="text-xs text-muted uppercase tracking-wide block mb-1">
              실제 마지막 발송 호
            </label>
            <p className="text-sm text-ink font-medium">
              {orderItem.final_subscribe_end_issue || "-"}
            </p>
          </div>
        </div>
      </div>

      {/* 일시 정보 */}
      <div className="p-4 bg-paper rounded-lg border border-line">
        <h3 className="text-sm font-semibold text-ink mb-4 uppercase tracking-wide">
          일시 정보
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-muted uppercase tracking-wide block mb-1">
              발송 일시
            </label>
            <p className="text-sm text-ink font-medium">
              {orderItem.sended_at
                ? new Date(orderItem.sended_at).toLocaleString("ko-KR")
                : "-"}
            </p>
          </div>
          <div>
            <label className="text-xs text-muted uppercase tracking-wide block mb-1">
              취소 일시
            </label>
            <p className="text-sm text-ink font-medium">
              {orderItem.cancelled_at
                ? new Date(orderItem.cancelled_at).toLocaleString("ko-KR")
                : "-"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 내부 컴포넌트: SendDetailPanel
// ============================================================================
interface SendDetailPanelProps {
  send: Send;
  sendItems: SendItem[];
  getOrderItemById: (orderItemId: number) => OrderItem | undefined;
}

const SendDetailPanel: React.FC<SendDetailPanelProps> = ({
  send,
  sendItems,
  getOrderItemById,
}) => {
  const items = send.send_items || sendItems;

  return (
    <div className="space-y-4">
      {/* 기본 정보 */}
      <div className="p-4 bg-paper rounded-lg border border-line">
        <h3 className="text-sm font-semibold text-ink mb-4 uppercase tracking-wide">
          기본 정보
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-muted uppercase tracking-wide block mb-1">
              발송 상태
            </label>
            <p className="text-sm text-ink font-medium">
              {getSendStatusLabel(send.send_status)}
            </p>
          </div>
          <div>
            <label className="text-xs text-muted uppercase tracking-wide block mb-1">
              발송 날짜
            </label>
            <p className="text-sm text-ink font-medium">
              {send.send_date
                ? new Date(send.send_date).toLocaleDateString("ko-KR")
                : "-"}
            </p>
          </div>
          <div>
            <label className="text-xs text-muted uppercase tracking-wide block mb-1">
              택배사
            </label>
            <p className="text-sm text-ink font-medium">
              {send.courier_company || "-"}
            </p>
          </div>
          <div>
            <label className="text-xs text-muted uppercase tracking-wide block mb-1">
              운송장 번호
            </label>
            <p className="text-sm text-ink font-mono font-medium">
              {send.tracking_no || "-"}
            </p>
          </div>
          <div>
            <label className="text-xs text-muted uppercase tracking-wide block mb-1">
              취소 일시
            </label>
            <p className="text-sm text-ink font-medium">
              {send.cancelled_at
                ? new Date(send.cancelled_at).toLocaleString("ko-KR")
                : "-"}
            </p>
          </div>
        </div>
      </div>

      {/* 배송지 정보 (스냅샷) */}
      <div className="p-4 bg-paper rounded-lg border border-line">
        <h3 className="text-sm font-semibold text-ink mb-4 uppercase tracking-wide">
          배송지 정보 (스냅샷)
        </h3>
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-muted uppercase tracking-wide block mb-1">
                수령인
              </label>
              <p className="text-sm text-ink font-medium">{send.address_name}</p>
            </div>
            <div>
              <label className="text-xs text-muted uppercase tracking-wide block mb-1">
                연락처
              </label>
              <p className="text-sm text-ink font-medium">{send.phone}</p>
            </div>
            <div>
              <label className="text-xs text-muted uppercase tracking-wide block mb-1">
                국가
              </label>
              <p className="text-sm text-ink font-medium">{send.nation}</p>
            </div>
            <div>
              <label className="text-xs text-muted uppercase tracking-wide block mb-1">
                우편번호
              </label>
              <p className="text-sm text-ink font-medium">{send.postal_code}</p>
            </div>
          </div>
          <div>
            <label className="text-xs text-muted uppercase tracking-wide block mb-1">
              주소
            </label>
            <p className="text-sm text-ink font-medium">{send.address}</p>
          </div>
          {send.address_memo && (
            <div>
              <label className="text-xs text-muted uppercase tracking-wide block mb-1">
                배송 특이사항
              </label>
              <p className="text-sm text-ink font-medium">{send.address_memo}</p>
            </div>
          )}
        </div>
      </div>

      {/* 내부 배송 메모 */}
      {send.send_memo && (
        <div className="p-4 bg-paper rounded-lg border border-line">
          <h3 className="text-sm font-semibold text-ink mb-4 uppercase tracking-wide">
            내부 배송 메모
          </h3>
          <p className="text-sm text-ink whitespace-pre-wrap">
            {send.send_memo}
          </p>
        </div>
      )}

      {/* 배송 품목 */}
      <div className="p-4 bg-paper rounded-lg border border-line">
        <h3 className="text-sm font-semibold text-ink mb-4 uppercase tracking-wide">
          배송 품목
        </h3>
        {items.length === 0 ? (
          <p className="text-sm text-muted">배송 품목이 없습니다.</p>
        ) : (
          <div className="space-y-3">
            {items.map((sendItem) => {
              const orderItem = getOrderItemById(sendItem.order_item_id);
              const productKind =
                sendItem.product_kind || orderItem?.product_kind;
              const productName =
                sendItem.product_name || orderItem?.product_name || "-";
              const productCode =
                sendItem.product_code || orderItem?.product_code || "-";

              return (
                <div
                  key={sendItem.send_item_id}
                  className="p-3 bg-white rounded border border-line space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {productKind && (
                        <Badge
                          variant={
                            productKind === "YEARLY"
                              ? "info"
                              : productKind === "MONTHLY"
                              ? "success"
                              : "default"
                          }
                          size="sm"
                        >
                          {productKind === "YEARLY"
                            ? "연간"
                            : productKind === "MONTHLY"
                            ? "월간"
                            : "단권"}
                        </Badge>
                      )}
                      <span className="font-medium text-ink">{productName}</span>
                    </div>
                    <span className="font-semibold text-ink">
                      {sendItem.send_num}권
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <label className="text-xs text-muted uppercase tracking-wide block mb-1">
                        상품 코드
                      </label>
                      <p className="text-sm text-ink font-medium">
                        {productCode}
                      </p>
                    </div>
                    <div>
                      <label className="text-xs text-muted uppercase tracking-wide block mb-1">
                        제작단가
                      </label>
                      <p className="text-sm text-ink font-medium">
                        {sendItem.purchase
                          ? `${sendItem.purchase.toLocaleString()}원`
                          : "-"}
                      </p>
                    </div>
                    <div>
                      <label className="text-xs text-muted uppercase tracking-wide block mb-1">
                        무게
                      </label>
                      <p className="text-sm text-ink font-medium">
                        {sendItem.unit_weight ? `${sendItem.unit_weight}g` : "-"}
                      </p>
                    </div>
                    <div>
                      <label className="text-xs text-muted uppercase tracking-wide block mb-1">
                        크기
                      </label>
                      <p className="text-sm text-ink font-medium">
                        {sendItem.unit_width &&
                        sendItem.unit_length &&
                        sendItem.unit_height
                          ? `${sendItem.unit_width}×${sendItem.unit_length}×${sendItem.unit_height}mm`
                          : "-"}
                      </p>
                    </div>
                    {sendItem.cancelled_at && (
                      <div className="col-span-2">
                        <label className="text-xs text-muted uppercase tracking-wide block mb-1">
                          취소 일시
                        </label>
                        <p className="text-sm text-ink font-medium">
                          {new Date(sendItem.cancelled_at).toLocaleString(
                            "ko-KR"
                          )}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// 메인 컴포넌트: CustomerListPage
// ============================================================================
const CustomerListPage: React.FC = () => {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 탭 상태
  const [customerTab, setCustomerTab] = useState<"active" | "deleted">("active");
  
  // 필터 상태
  const [searchTerm, setSearchTerm] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [dateFilter, setDateFilter] = useState({ start: "", end: "" });
  const [showFilters, setShowFilters] = useState(false);

  // 페이지네이션
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);
  const [sortKey, setSortKey] = useState("created_at");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [totalCustomers, setTotalCustomers] = useState(0);

  // 선택된 고객
  const [selectedCustomers, setSelectedCustomers] = useState<Set<string>>(
    new Set()
  );

  // 모달 상태
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(
    null
  );
  const [detailTab, setDetailTab] = useState("info");
  const [editForm, setEditForm] = useState<Partial<Customer>>({});
  const [isEditMode, setIsEditMode] = useState(false);
  
  // 삭제 확인 모달 상태
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [customersToDelete, setCustomersToDelete] = useState<Customer[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // 복원 상태
  const [isRestoring, setIsRestoring] = useState(false);

  // 상세보기 패널 상태
  const [isDetailPanelOpen, setIsDetailPanelOpen] = useState(false);
  const [detailPanelType, setDetailPanelType] = useState<
    "order" | "subscription" | "send" | null
  >(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [selectedOrderItem, setSelectedOrderItem] = useState<OrderItem | null>(
    null
  );
  const [selectedSend, setSelectedSend] = useState<Send | null>(null);

  // 데이터 상태
  const [orders, setOrders] = useState<Order[]>([]);
  const [orderItems] = useState<OrderItem[]>([]);
  const [sends] = useState<Send[]>([]);
  const [sendItems] = useState<SendItem[]>([]);
  const [addresses] = useState<Address[]>([]);

  // 필터/검색어/탭 변경 시 페이지를 1로 리셋
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, sourceFilter, dateFilter.start, dateFilter.end, sortKey, sortDirection, customerTab]);

  useEffect(() => {
    fetchCustomers();
  }, [currentPage, sortKey, sortDirection, searchTerm, sourceFilter, dateFilter, customerTab]);

  // 필터 필드 정의
  const filterFields: FilterField[] = [
    {
      key: "channel",
      label: "유입경로",
      type: "select",
      options: SOURCE_OPTIONS.map((source) => ({
        value: source,
        label:
          source === "CAFE24"
            ? "Cafe24"
            : source === "GPMALL"
            ? "갓피플몰"
            : source,
      })),
    },
    {
      key: "created_at",
      label: "가입일",
      type: "dateRange",
    },
  ];

  // 정렬 옵션 정의
  const sortOptions: SortOption[] = [
    { key: "last_order_at", direction: "desc", label: "최근 주문일 최신순" },
    { key: "last_order_at", direction: "asc", label: "최근 주문일 오래된순" },
    { key: "created_at", direction: "desc", label: "가입일 최신순" },
    { key: "created_at", direction: "asc", label: "가입일 오래된순" },
    { key: "customer_name", direction: "asc", label: "이름 가나다순" },
    { key: "customer_name", direction: "desc", label: "이름 역순" },
  ];

  // 활성 필터 태그
  const activeFilters: ActiveFilter[] = [
    ...(sourceFilter
      ? [
          {
            key: "channel",
            label: "유입경로",
            value:
              sourceFilter === "CAFE24"
                ? "Cafe24"
                : sourceFilter === "GPMALL"
                ? "갓피플몰"
                : sourceFilter,
            onRemove: () => setSourceFilter(""),
          },
        ]
      : []),
    ...(dateFilter.start || dateFilter.end
      ? [
          {
            key: "created_at",
            label: "가입일",
            value: `${dateFilter.start || "이전"} ~ ${dateFilter.end || "이후"}`,
            onRemove: () => setDateFilter({ start: "", end: "" }),
          },
        ]
      : []),
  ];

  const fetchCustomers = async () => {
    setLoading(true);
    setError(null);
    try {
      const params: CustomerListQuery = {
        page: currentPage,
        limit: itemsPerPage,
        search: searchTerm || null,
        channel: sourceFilter || null,
        sort: sortKey,
        order: sortDirection.toUpperCase(),
        deleted_only: customerTab === "deleted" ? true : undefined,
      };

      const response = await customersApi.getCustomers(params);
      setCustomers(response.data.data);
      setTotalCustomers(response.data.pagination.total);
    } catch (err: any) {
      setError(err?.message || "고객 목록을 불러오는데 실패했습니다.");
      setCustomers([]);
      setTotalCustomers(0);
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (key: string, direction: "asc" | "desc") => {
    setSortKey(key);
    setSortDirection(direction);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedCustomers(
        new Set(paginatedCustomers.map((c) => String(c.customer_id)))
      );
    } else {
      setSelectedCustomers(new Set());
    }
  };

  const handleSelectCustomer = (customerId: string, checked: boolean) => {
    const newSelected = new Set(selectedCustomers);
    if (checked) {
      newSelected.add(customerId);
    } else {
      newSelected.delete(customerId);
    }
    setSelectedCustomers(newSelected);
  };

  const handleViewDetail = async (customer: Customer) => {
    setIsDetailModalOpen(true);
    setDetailTab("info");
    setIsEditMode(false);
    
    try {
      // 고객 상세 정보 가져오기
      const customerResponse = await customersApi.getCustomer(customer.customer_id);
      const customerData = customerResponse.data.data;
      
      if (customerData) {
        setSelectedCustomer(customerData);
        setEditForm(customerData);
      } else {
        // API 호출 실패 시 기존 데이터 사용
        setSelectedCustomer(customer);
        setEditForm(customer);
      }
      
      // 고객의 주문 목록 가져오기
      const ordersResponse = await ordersApi.getOrdersByCustomer(customer.customer_id);
      setOrders(ordersResponse.data.data as Order[]);
    } catch (err: any) {
      console.error("고객 정보를 불러오는데 실패했습니다:", err);
      // 에러 발생 시 기존 데이터 사용
      setSelectedCustomer(customer);
      setEditForm(customer);
      setOrders([]);
    }
  };

  // 수정 모드 전환
  const handleStartEdit = () => {
    setIsEditMode(true);
    setEditForm(selectedCustomer || {});
  };

  // 수정 취소
  const handleCancelEdit = () => {
    setIsEditMode(false);
    setEditForm(selectedCustomer || {});
  };

  // 고객 정보 수정 저장
  const handleSaveCustomerInfo = async () => {
    if (
      !selectedCustomer ||
      !editForm.customer_name ||
      !editForm.customer_phone
    ) {
      alert("이름과 연락처는 필수입니다.");
      return;
    }

    try {
      const updateData: CustomerUpdate = {
        customer_name: editForm.customer_name || null,
        customer_phone: editForm.customer_phone || null,
        customer_email: editForm.customer_email !== undefined ? editForm.customer_email : null,
        admin_memo: editForm.admin_memo !== undefined ? editForm.admin_memo : null,
      };

      const response = await customersApi.updateCustomer(
        selectedCustomer.customer_id,
        updateData
      );
      const updatedCustomer = response.data.data;

      if (updatedCustomer) {
        setCustomers(
          customers.map((c) =>
            c.customer_id === selectedCustomer.customer_id ? updatedCustomer : c
          )
        );
        setSelectedCustomer(updatedCustomer);
        setEditForm(updatedCustomer);
      }
    setIsEditMode(false);
    alert("고객 정보가 수정되었습니다.");
    } catch (err: any) {
      alert(err?.message || "고객 정보 수정에 실패했습니다.");
    }
  };

  // 엑셀 다운로드 함수
  const handleExportExcel = (selectedOnly: boolean = false) => {
    let dataToExport: Customer[];

    if (selectedOnly && selectedCustomers.size > 0) {
      // 선택된 고객만 다운로드
      dataToExport = filteredCustomers.filter((customer) =>
        selectedCustomers.has(String(customer.customer_id))
      );
    } else {
      // 필터링된 모든 고객 다운로드
      dataToExport = filteredCustomers;
    }

    if (dataToExport.length === 0) {
      alert("다운로드할 데이터가 없습니다.");
      return;
    }

    // 엑셀 형식으로 변환
    const excelData = dataToExport.map((customer) => ({
      이름: customer.customer_name,
      연락처: customer.customer_phone,
      이메일: customer.customer_email || "",
      유입경로:
        customer.create_channel === "CAFE24"
          ? "Cafe24"
          : customer.create_channel === "GPMALL"
          ? "갓피플몰"
          : customer.create_channel,
      최근주문일: customer.last_order_at
        ? new Date(customer.last_order_at).toLocaleDateString("ko-KR")
        : "",
      가입일: new Date(customer.created_at).toLocaleDateString("ko-KR"),
      관리자메모: customer.admin_memo || "",
    }));

    // 워크시트 생성
    const ws = XLSX.utils.json_to_sheet(excelData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "고객 목록");

    // 파일명 생성
    const fileName = `고객목록_${new Date().toISOString().split("T")[0]}.xlsx`;

    // 다운로드
    XLSX.writeFile(wb, fileName);
  };

  // 이메일 발송 함수
  const handleSendEmail = () => {
    if (selectedCustomers.size === 0) {
      alert("이메일을 발송할 고객을 선택해주세요.");
      return;
    }

    const selectedCustomerList = filteredCustomers.filter((customer) =>
      selectedCustomers.has(String(customer.customer_id))
    );

    // 이메일 주소가 있는 고객만 필터링
    const customersWithEmail = selectedCustomerList.filter(
      (customer) => customer.customer_email
    );

    if (customersWithEmail.length === 0) {
      alert("이메일 주소가 있는 고객이 없습니다.");
      return;
    }

    // 이메일 주소 수집
    const emailAddresses = customersWithEmail
      .map((customer) => customer.customer_email)
      .filter((email): email is string => email !== null)
      .join(";");

    // mailto 링크 생성
    const mailtoLink = `mailto:${emailAddresses}`;
    window.location.href = mailtoLink;
  };

  // 컬럼 정의
  const columns: Column<Customer>[] = [
    {
      key: "customer_name",
      label: "이름",
      sortable: true,
      align: "center",
      render: (value, row: Customer) => (
        <div className="flex items-center justify-center gap-2">
          <span className={`font-medium ${row.deleted_at ? "text-muted line-through" : "text-ink"}`}>
            {value}
          </span>
          {row.deleted_at && (
            <Badge variant="default" size="sm">
              삭제됨
            </Badge>
          )}
        </div>
      ),
    },
    {
      key: "customer_phone",
      label: "연락처",
      align: "center",
      render: (value) => (
        <div className="flex items-center justify-center gap-2">
          <Phone className="w-4 h-4 text-muted" />
          <span className="text-sm">{value}</span>
        </div>
      ),
    },
    {
      key: "customer_email",
      label: "이메일",
      align: "center",
      render: (value) => (
        <div className="flex items-center justify-center gap-2">
          <Mail className="w-4 h-4 text-muted" />
          <span className="text-sm truncate">{value || "-"}</span>
        </div>
      ),
    },
    {
      key: "create_channel",
      label: "유입경로",
      align: "center",
      render: (value) => (
        <div className="flex justify-center">
          <Badge
            variant={
              value === "CAFE24"
                ? "cafe24"
                : value === "GPMALL"
                ? "gpmall"
                : "default"
            }
            size="sm"
          >
            {value === "CAFE24"
              ? "Cafe24"
              : value === "GPMALL"
              ? "갓피플몰"
              : value}
          </Badge>
        </div>
      ),
    },
    {
      key: "last_order_at",
      label: "최근 주문일",
      sortable: true,
      align: "center",
      render: (value) => (
        <span className="text-sm text-muted">
          {value ? new Date(value).toLocaleDateString("ko-KR") : "-"}
        </span>
      ),
    },
    {
      key: "created_at",
      label: "가입일",
      sortable: true,
      align: "center",
      render: (value) => (
        <span className="text-sm text-muted">
          {new Date(value).toLocaleDateString("ko-KR")}
        </span>
      ),
    },
    ...(customerTab === "deleted"
      ? [
          {
            key: "actions",
            label: "작업",
            align: "center" as const,
            width: "100px",
            render: (_value: any, row: Customer) => (
              <div className="flex items-center justify-center">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRestoreCustomer(row);
                  }}
                  className="p-2 rounded-lg hover:bg-success-50 text-success hover:text-success-600 transition-colors"
                  title="복원"
                  disabled={isRestoring}
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              </div>
            ),
          },
        ]
      : []),
  ];

  // 필터링 (날짜 필터만 클라이언트 사이드에서 처리)
  // 삭제 상태 필터링은 백엔드에서 deleted_only 파라미터로 처리됨
  const filteredCustomers = customers.filter((customer) => {
      // 날짜 필터
      if (dateFilter.start) {
        const joinDate = new Date(customer.created_at);
        const startDate = new Date(dateFilter.start);
        if (joinDate < startDate) return false;
      }
      if (dateFilter.end) {
        const joinDate = new Date(customer.created_at);
        const endDate = new Date(dateFilter.end);
      endDate.setHours(23, 59, 59, 999); // 종료일의 끝까지 포함
        if (joinDate > endDate) return false;
      }
      return true;
  });

  const totalPages = Math.ceil(totalCustomers / itemsPerPage);
  const paginatedCustomers = filteredCustomers;

  const detailTabs = [
    { key: "info", label: "기본 정보" },
    { key: "orders", label: "주문" },
    { key: "subscriptions", label: "구독" },
    { key: "sends", label: "배송" },
    { key: "inquiries", label: "문의내역" },
  ];

  // 고객의 주문 목록 가져오기
  const getCustomerOrders = () => {
    if (!selectedCustomer) return [];
    return orders.filter((o) => o.customer_id === selectedCustomer.customer_id);
  };

  // 고객의 구독 목록 가져오기 (YEARLY, MONTHLY만)
  const getCustomerSubscriptions = () => {
    if (!selectedCustomer) return [];
    const customerOrders = getCustomerOrders();
    const orderIds = customerOrders.map((o) => o.order_id);
    return orderItems.filter(
      (item) =>
        orderIds.includes(item.order_id) &&
        (item.product_kind === "YEARLY" || item.product_kind === "MONTHLY")
    );
  };


  // 고객의 배송 목록 가져오기
  const getCustomerSends = () => {
    if (!selectedCustomer) return [];
    const customerOrders = getCustomerOrders();
    const orderIds = customerOrders.map((o) => o.order_id);
    return sends.filter((s) => orderIds.includes(s.order_id));
  };

  // 주문 상세보기 열기
  const handleViewOrderDetail = (order: Order) => {
    setSelectedOrder(order);
    setDetailPanelType("order");
    setIsDetailPanelOpen(true);
  };

  // 구독 상세보기 열기
  const handleViewSubscriptionDetail = (orderItem: OrderItem) => {
    setSelectedOrderItem(orderItem);
    setDetailPanelType("subscription");
    setIsDetailPanelOpen(true);
  };

  // 배송 상세보기 열기
  const handleViewSendDetail = (send: Send) => {
    setSelectedSend(send);
    setDetailPanelType("send");
    setIsDetailPanelOpen(true);
  };

  // 삭제 확인 모달 열기
  const handleDeleteClick = () => {
    if (selectedCustomers.size === 0) {
      alert("삭제할 고객을 선택해주세요.");
      return;
    }
    
    const selectedCustomerList = filteredCustomers.filter((customer) =>
      selectedCustomers.has(String(customer.customer_id))
    );
    
    setCustomersToDelete(selectedCustomerList);
    setIsDeleteModalOpen(true);
  };

  // 고객 삭제 실행
  const handleConfirmDelete = async () => {
    if (customersToDelete.length === 0) return;
    
    setIsDeleting(true);
    try {
      // 모든 고객 삭제 시도
      const deletePromises = customersToDelete.map((customer) =>
        customersApi.deleteCustomer(customer.customer_id)
      );
      
      await Promise.all(deletePromises);
      
      // 성공 시 목록 새로고침
      await fetchCustomers();
      
      // 선택 초기화
      setSelectedCustomers(new Set());
      setIsDeleteModalOpen(false);
      setCustomersToDelete([]);
      
      // 삭제된 고객이 현재 상세 모달에 표시된 고객이면 모달 닫기
      if (selectedCustomer && customersToDelete.some(c => c.customer_id === selectedCustomer.customer_id)) {
        setIsDetailModalOpen(false);
        setSelectedCustomer(null);
      }
      
      alert(`${customersToDelete.length}명의 고객이 삭제되었습니다.`);
    } catch (err: any) {
      alert(err?.message || "고객 삭제에 실패했습니다.");
    } finally {
      setIsDeleting(false);
    }
  };

  // 고객 복원
  const handleRestoreCustomer = async (customer: Customer) => {
    if (!confirm(`"${customer.customer_name}" 고객을 복원하시겠습니까?`)) {
      return;
    }

    setIsRestoring(true);
    try {
      await customersApi.restoreCustomer(customer.customer_id);
      await fetchCustomers();
      alert("고객이 복원되었습니다.");
    } catch (err: any) {
      alert(err?.message || "고객 복원에 실패했습니다.");
    } finally {
      setIsRestoring(false);
    }
  };

  // 일괄 복원
  const handleBatchRestore = async () => {
    if (selectedCustomers.size === 0) {
      alert("복원할 고객을 선택해주세요.");
      return;
    }

    const selectedCustomerList = filteredCustomers.filter((customer) =>
      selectedCustomers.has(String(customer.customer_id))
    );

    if (selectedCustomerList.length === 0) {
      alert("복원할 고객이 없습니다.");
      return;
    }

    if (!confirm(`${selectedCustomerList.length}명의 고객을 복원하시겠습니까?`)) {
      return;
    }

    setIsRestoring(true);
    try {
      const restorePromises = selectedCustomerList.map((customer) =>
        customersApi.restoreCustomer(customer.customer_id)
      );
      
      await Promise.all(restorePromises);
      await fetchCustomers();
      
      setSelectedCustomers(new Set());
      alert(`${selectedCustomerList.length}명의 고객이 복원되었습니다.`);
    } catch (err: any) {
      alert(err?.message || "고객 복원에 실패했습니다.");
    } finally {
      setIsRestoring(false);
    }
  };

  // 배송지 ID로 주소 정보 가져오기
  const getAddressById = (addressId: number | null): Address | null => {
    if (!addressId) return null;
    return addresses.find((addr) => addr.address_id === addressId) || null;
  };

  // 주문 품목 ID로 품목 정보 가져오기
  const getOrderItemById = (orderItemId: number) => {
    return orderItems.find((item) => item.order_item_id === orderItemId);
  };

  // 배송에 포함된 배송 품목들 가져오기
  const getSendItemsBySendId = (sendId: number) => {
    return sendItems.filter((item) => item.send_id === sendId);
  };

  return (
    <div className="min-h-screen">
      <div className="max-w-[1600px] mx-auto px-6 py-6">
        <Breadcrumb
          items={[
            { label: "고객 관리", path: "/customer/list" },
            { label: "고객 목록" },
          ]}
        />
        {/* 헤더 */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div></div>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                icon={Download}
                onClick={() => handleExportExcel(false)}
              >
                엑셀 다운로드
              </Button>
              <Button
                variant="outline"
                size="sm"
                icon={RefreshCw}
                onClick={fetchCustomers}
                loading={loading}
              >
                새로고침
              </Button>
              <Button
                size="sm"
                icon={Plus}
                onClick={() => navigate("/customer/register")}
              >
                고객 등록
              </Button>
            </div>
          </div>
        </div>

        {/* 탭 */}
        <div className="mb-6">
          <Tabs
            tabs={[
              {
                key: "active",
                label: "활성 고객",
                icon: <Users className="w-4 h-4" />,
              },
              {
                key: "deleted",
                label: "삭제된 고객",
                icon: <Archive className="w-4 h-4" />,
              },
            ]}
            activeTab={customerTab}
            onChange={(key) => setCustomerTab(key as "active" | "deleted")}
          />
        </div>

        {/* 검색 및 필터 */}
        <SearchFilterBar
          searchValue={searchTerm}
          onSearchChange={setSearchTerm}
          searchPlaceholder="고객 이름을 검색해보세요"
          showFilters={showFilters}
          onToggleFilters={() => setShowFilters(!showFilters)}
          filterFields={filterFields}
          filterValues={{
            channel: sourceFilter,
            created_at_start: dateFilter.start,
            created_at_end: dateFilter.end,
          }}
          onFilterChange={(key, value) => {
            if (key === "channel") {
              setSourceFilter(value);
            } else if (key === "created_at_start") {
              setDateFilter({ ...dateFilter, start: value });
            } else if (key === "created_at_end") {
              setDateFilter({ ...dateFilter, end: value });
            }
          }}
          activeFilters={activeFilters}
          sortOptions={sortOptions}
          currentSort={{ key: sortKey, direction: sortDirection }}
          onSortChange={handleSort}
          onReset={() => {
                      setSearchTerm("");
                      setSourceFilter("");
                      setDateFilter({ start: "", end: "" });
                    }}
          hasActiveFilters={
            !!(
              searchTerm ||
              sourceFilter ||
              dateFilter.start ||
              dateFilter.end
            )
          }
        />

        {/* 목록 */}
        <ListPage
                data={paginatedCustomers}
          columns={columns}
                keyExtractor={(row) => String(row.customer_id)}
          emptyMessage="고객 정보가 없습니다"
          selectable
          selectedItems={new Set(
            Array.from(selectedCustomers).map((id) => String(id))
          )}
          onSelectAll={handleSelectAll}
          onSelectItem={(id, checked) =>
            handleSelectCustomer(String(id), checked)
          }
          allSelected={
            paginatedCustomers.length > 0 &&
            paginatedCustomers.every((c) =>
              selectedCustomers.has(String(c.customer_id))
            )
          }
                onSort={handleSort}
                sortKey={sortKey}
                sortDirection={sortDirection}
                onRowClick={handleViewDetail}
          hoverable
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={setCurrentPage}
          totalItems={totalCustomers}
          itemsPerPage={itemsPerPage}
          batchActions={[
            ...(customerTab === "active"
              ? [
                  {
                    label: "이메일 발송",
                    icon: Mail,
                    onClick: handleSendEmail,
                  },
                  {
                    label: "엑셀 다운로드",
                    icon: Download,
                    onClick: () => handleExportExcel(true),
                  },
                  {
                    label: "삭제",
                    icon: Trash2,
                    onClick: handleDeleteClick,
                    variant: "danger" as const,
                  },
                ]
              : [
                  {
                    label: "복원",
                    icon: RotateCcw,
                    onClick: handleBatchRestore,
                    variant: "default" as const,
                  },
                ]),
          ]}
          loading={loading}
          error={error}
          onRetry={fetchCustomers}
        />

        {/* 고객 상세 모달 */}
        <Modal
          isOpen={isDetailModalOpen}
          onClose={() => {
            setIsDetailModalOpen(false);
            setIsEditMode(false);
          }}
          title={`고객 상세 - ${selectedCustomer?.customer_name}`}
          size="xl"
          footer={
            detailTab === "info" ? (
              isEditMode ? (
                <>
                  <Button variant="ghost" onClick={handleCancelEdit}>
                    취소
                  </Button>
                  <Button onClick={handleSaveCustomerInfo} icon={Save}>
                    저장
                  </Button>
                </>
              ) : (
                <>
                  {selectedCustomer?.deleted_at ? (
                    <Button
                      onClick={() => {
                        if (selectedCustomer) {
                          handleRestoreCustomer(selectedCustomer);
                        }
                      }}
                      icon={RotateCcw}
                      disabled={isRestoring}
                      loading={isRestoring}
                    >
                      복원
                    </Button>
                  ) : (
                    <>
                      <Button onClick={handleStartEdit} icon={Edit}>
                        수정
                      </Button>
                      <Button
                        variant="danger"
                        onClick={() => {
                          if (selectedCustomer) {
                            setCustomersToDelete([selectedCustomer]);
                            setIsDeleteModalOpen(true);
                          }
                        }}
                        icon={Trash2}
                      >
                        삭제
                      </Button>
                    </>
                  )}
                </>
              )
            ) : undefined
          }
        >
          {selectedCustomer && (
            <div>
              <Tabs
                tabs={detailTabs}
                activeTab={detailTab}
                onChange={setDetailTab}
                className="mb-6"
              />

              {detailTab === "info" && (
                <CustomerInfoTab
                  customer={selectedCustomer}
                  isEditMode={isEditMode}
                  editForm={editForm}
                  onEditFormChange={setEditForm}
                />
              )}

              {detailTab === "orders" && (
                <CustomerOrdersTab
                  orders={getCustomerOrders()}
                  onOrderClick={handleViewOrderDetail}
                />
              )}

              {detailTab === "subscriptions" && (
                <CustomerSubscriptionsTab
                  subscriptions={getCustomerSubscriptions()}
                  onSubscriptionClick={handleViewSubscriptionDetail}
                />
              )}

              {detailTab === "sends" && (
                <CustomerSendsTab
                  sends={getCustomerSends()}
                  onSendClick={handleViewSendDetail}
                />
              )}

              {detailTab === "inquiries" && <CustomerInquiriesTab />}
            </div>
          )}
        </Modal>

        {/* 상세보기 패널 */}
        <SlidePanel
          isOpen={isDetailPanelOpen}
          onClose={() => {
            setIsDetailPanelOpen(false);
            setDetailPanelType(null);
            setSelectedOrder(null);
            setSelectedOrderItem(null);
            setSelectedSend(null);
          }}
          title={
            detailPanelType === "order"
              ? "주문 상세"
              : detailPanelType === "subscription"
              ? "구독 상세"
              : detailPanelType === "send"
              ? "배송 상세"
              : "상세보기"
          }
          size="lg"
        >
          {detailPanelType === "order" && selectedOrder && (
            <OrderDetailPanel
              order={selectedOrder}
              orderItems={orderItems}
              getAddressById={getAddressById}
            />
          )}

          {detailPanelType === "subscription" && selectedOrderItem && (
            <SubscriptionDetailPanel
              orderItem={selectedOrderItem}
              getAddressById={getAddressById}
            />
          )}

          {detailPanelType === "send" && selectedSend && (
            <SendDetailPanel
              send={selectedSend}
              sendItems={getSendItemsBySendId(selectedSend.send_id)}
              getOrderItemById={getOrderItemById}
            />
          )}
        </SlidePanel>

        {/* 삭제 확인 모달 */}
        <Modal
          isOpen={isDeleteModalOpen}
          onClose={() => {
            if (!isDeleting) {
              setIsDeleteModalOpen(false);
              setCustomersToDelete([]);
            }
          }}
          title="고객 삭제 확인"
          size="md"
          footer={
            <div className="flex items-center justify-end gap-3 w-full">
              <Button
                variant="ghost"
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setCustomersToDelete([]);
                }}
                disabled={isDeleting}
              >
                취소
              </Button>
              <Button
                variant="danger"
                onClick={handleConfirmDelete}
                icon={Trash2}
                loading={isDeleting}
                disabled={isDeleting}
              >
                삭제
              </Button>
            </div>
          }
        >
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-4 bg-danger-50 border border-danger-200 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-danger flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-ink mb-2">
                  정말로 {customersToDelete.length}명의 고객을 삭제하시겠습니까?
                </p>
                <p className="text-xs text-muted">
                  이 작업은 되돌릴 수 없습니다. 삭제된 고객 정보는 복구할 수 없습니다.
                </p>
              </div>
            </div>
            
            {customersToDelete.length > 0 && (
              <div className="max-h-48 overflow-y-auto border border-line rounded-lg">
                <div className="p-3 bg-paper border-b border-line">
                  <p className="text-xs font-medium text-muted uppercase tracking-wide">
                    삭제될 고객 목록 ({customersToDelete.length}명)
                  </p>
                </div>
                <div className="divide-y divide-line">
                  {customersToDelete.slice(0, 10).map((customer) => (
                    <div key={customer.customer_id} className="p-3">
                      <p className="text-sm font-medium text-ink">
                        {customer.customer_name}
                      </p>
                      <p className="text-xs text-muted mt-1">
                        {customer.customer_phone}
                        {customer.customer_email && ` • ${customer.customer_email}`}
                      </p>
                    </div>
                  ))}
                  {customersToDelete.length > 10 && (
                    <div className="p-3 text-center">
                      <p className="text-xs text-muted">
                        외 {customersToDelete.length - 10}명...
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </Modal>
      </div>
    </div>
  );
};

export default CustomerListPage;
