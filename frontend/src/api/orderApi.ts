import api from "./axios";
import { logApiError } from "../utils/errorHandler";

// 타입 정의
export enum OrderChannel {
  CAFE24 = "CAFE24",
  GPMALL = "GPMALL",
  OFFLINE = "OFFLINE",
}

export enum OrderStatus {
  ORDERED = "ORDERED",
  PAID = "PAID",
  CANCELLED = "CANCELLED",
  SHIPPING = "SHIPPING",
  COMPLETED = "COMPLETED",
}

export interface Order {
  order_id: number;
  customer_id: number;
  external_order_id: string | null;
  order_channel: OrderChannel;
  order_status: OrderStatus;
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
}

export interface OrderItem {
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

export interface OrderCreate {
  customer_id: number;
  external_order_id?: string | null;
  order_channel: OrderChannel;
  order_status?: OrderStatus;
  total_amount: number;
  discount_amount?: number;
  send_fee?: number;
  payment_amount: number;
  payment_method?: string | null;
  address_id?: number | null;
  request_memo?: string | null;
  admin_memo?: string | null;
  order_at?: string;
  payment_at?: string | null;
  order_items: Omit<
    OrderItem,
    "order_item_id" | "order_id" | "created_at" | "updated_at"
  >[];
}

export interface OrderUpdate {
  order_status?: OrderStatus;
  payment_method?: string | null;
  payment_at?: string | null;
  cancelled_at?: string | null;
  admin_memo?: string | null;
}

// API 함수들
export const orderAPI = {
  /**
   * 모든 주문 조회
   * GET /order
   */
  getAll: async (): Promise<Order[]> => {
    try {
      const response = await api.get<Order[]>("/order");
      return response.data;
    } catch (err) {
      logApiError(err as any, "GET_ALL_ORDERS");
      throw err;
    }
  },

  /**
   * 특정 주문 조회
   * GET /order/{order_id}
   */
  getById: async (orderId: number): Promise<Order> => {
    try {
      const response = await api.get<Order>(`/order/${orderId}`);
      return response.data;
    } catch (err) {
      logApiError(err as any, "GET_ORDER_BY_ID");
      throw err;
    }
  },

  /**
   * 주문 생성
   * POST /order
   */
  create: async (data: OrderCreate): Promise<Order> => {
    try {
      const response = await api.post<Order>("/order", data);
      return response.data;
    } catch (err) {
      logApiError(err as any, "CREATE_ORDER");
      throw err;
    }
  },

  /**
   * 주문 수정
   * PUT /order/{order_id}
   */
  update: async (orderId: number, data: OrderUpdate): Promise<Order> => {
    try {
      const response = await api.put<Order>(`/order/${orderId}`, data);
      return response.data;
    } catch (err) {
      logApiError(err as any, "UPDATE_ORDER");
      throw err;
    }
  },

  /**
   * 주문 취소
   * DELETE /order/{order_id}
   */
  cancel: async (orderId: number): Promise<void> => {
    try {
      await api.delete(`/order/${orderId}`);
    } catch (err) {
      logApiError(err as any, "CANCEL_ORDER");
      throw err;
    }
  },
};
