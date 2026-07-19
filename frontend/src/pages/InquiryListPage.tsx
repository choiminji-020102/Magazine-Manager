import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
import { DataTable, type ColumnDef } from "@/components/common/DataTable";
import { FilterBar } from "@/components/common/FilterBar";
import { PageHeader } from "@/components/common/PageHeader";
import { Pagination } from "@/components/common/Pagination";
import { StatusBadge } from "@/components/common/StatusBadge";
import { SlidingPanel } from "@/components/common/SlidingPanel";
import { inquiriesApi } from "@/api/inquiriesApi";
import { ordersApi } from "@/api/ordersApi";
import { orderItemsApi } from "@/api/orderItemsApi";
import { toast } from "@/hooks/use-toast";
import { formatDate, formatPhone, formatAmount } from "@/utils/format";
import { CHANNEL_LABEL, ORDER_STATUS_LABEL } from "@/utils/constants";
import type { InquiryListResponse, CustomerQuickSearchResponse } from "@/types/inquiry";
import type { OrderResponse } from "@/types/order";
import type { OrderItemDetailResponse } from "@/types/orderItem";
import InquiryDetailPanel from "./inquiry/InquiryDetailPanel";

const STATUS_OPTIONS = [
  { value: "", label: "전체 상태" },
  { value: "RECEIVED", label: "접수" },
  { value: "COMPLETED", label: "완료" },
  { value: "CANCELLED", label: "취소" },
];

const TYPE_OPTIONS = [
  { value: "", label: "전체 유형" },
  { value: "PHONE", label: "전화" },
  { value: "EMAIL", label: "이메일" },
  { value: "KAKAO", label: "카카오" },
  { value: "VISIT", label: "방문" },
  { value: "OTHER", label: "기타" },
];

export default function InquiryListPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [type, setType] = useState("");
  const [search, setSearch] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);

  // 문의 등록 모달
  const [createOpen, setCreateOpen] = useState(false);
  const [phone4, setPhone4] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerQuickSearchResponse | null>(null);
  const [relatedOrderId, setRelatedOrderId] = useState<number | null>(null);
  const [relatedOrderItemId, setRelatedOrderItemId] = useState<number | null>(null);
  const [createForm, setCreateForm] = useState({
    inquiry_type: "PHONE",
    title: "",
    content: "",
  });

  const limit = 20;

  const { data, isLoading } = useQuery({
    queryKey: ["inquiries", page, limit, status, type, search, startDate, endDate],
    queryFn: () =>
      inquiriesApi
        .getInquiries({
          page,
          limit,
          inquiry_status: status || null,
          inquiry_type: type || null,
          search: search || null,
          start_date: startDate || null,
          end_date: endDate || null,
        })
        .then((r) => r.data),
  });

  // 전화번호 뒤4자리 고객 검색
  const { data: phone4Results = [] } = useQuery<CustomerQuickSearchResponse[]>({
    queryKey: ["inquiry-phone4", phone4],
    queryFn: () =>
      inquiriesApi.searchByPhone4(phone4).then((r) => r.data.data ?? []),
    enabled: phone4.length === 4,
  });

  // 선택 고객의 주문 목록 (관련 주문 연결용)
  const { data: customerOrders = [] } = useQuery<OrderResponse[]>({
    queryKey: ["inquiry-customer-orders", selectedCustomer?.customer_id],
    queryFn: () =>
      ordersApi.getOrdersByCustomer(selectedCustomer!.customer_id).then((r) => r.data.data ?? []),
    enabled: !!selectedCustomer,
  });

  // 선택 주문의 품목 목록 (관련 주문품목 연결용)
  const { data: orderItems = [] } = useQuery<OrderItemDetailResponse[]>({
    queryKey: ["inquiry-order-items", relatedOrderId],
    queryFn: () =>
      orderItemsApi.getItemsByOrder(relatedOrderId!).then((r) => r.data.data ?? []),
    enabled: !!relatedOrderId,
  });

  const createMutation = useMutation({
    mutationFn: () =>
      inquiriesApi.createInquiry({
        customer_id: selectedCustomer!.customer_id,
        inquiry_type: createForm.inquiry_type,
        title: createForm.title || null,
        content: createForm.content || null,
        order_id: relatedOrderId,
        order_item_id: relatedOrderItemId,
      }),
    onSuccess: () => {
      toast.success("문의가 등록되었습니다.");
      queryClient.invalidateQueries({ queryKey: ["inquiries"] });
      handleCreateClose();
    },
    onError: () => toast.error("문의 등록 실패"),
  });

  const handleCreateClose = () => {
    setCreateOpen(false);
    setPhone4("");
    setSelectedCustomer(null);
    setRelatedOrderId(null);
    setRelatedOrderItemId(null);
    setCreateForm({ inquiry_type: "PHONE", title: "", content: "" });
  };

  const handleRowClick = useCallback((inquiry: InquiryListResponse) => {
    setSelectedId(inquiry.inquiry_id);
    setPanelOpen(true);
  }, []);

  const handlePanelClose = useCallback(() => {
    setPanelOpen(false);
    setTimeout(() => setSelectedId(null), 250);
  }, []);

  const columns: ColumnDef<InquiryListResponse>[] = [
    {
      key: "customer",
      header: "고객",
      cell: (row) => (
        <div>
          <div className="font-medium text-gray-900 text-[13px]">{row.customer_name}</div>
          <div className="text-xs text-gray-400 font-mono">{formatPhone(row.customer_phone)}</div>
        </div>
      ),
    },
    {
      key: "type",
      header: "유형",
      cell: (row) => <StatusBadge type="inquiry_type" value={row.inquiry_type} />,
      width: "w-20",
    },
    {
      key: "title",
      header: "제목",
      cell: (row) => (
        <span className="text-[13px] text-gray-700 truncate max-w-xs block">
          {row.title ?? row.inquiry_category ?? "-"}
        </span>
      ),
    },
    {
      key: "status",
      header: "상태",
      cell: (row) => <StatusBadge type="inquiry_status" value={row.inquiry_status} />,
      width: "w-24",
    },
    {
      key: "handler",
      header: "담당자",
      cell: (row) => (
        <span className="text-xs text-gray-500">{row.handler_name ?? "-"}</span>
      ),
      width: "w-20",
    },
    {
      key: "created_at",
      header: "등록일",
      cell: (row) => (
        <span className="text-xs text-gray-400">{formatDate(row.created_at)}</span>
      ),
      width: "w-24",
    },
  ];

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <PageHeader
        left={<span className="text-sm text-gray-500">총 {data?.total ?? 0}건</span>}
        actions={
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-3.5 w-3.5 mr-1" />
            문의 등록
          </Button>
        }
      />
      <FilterBar
        basic={
          <>
            <Select value={status} onValueChange={(v) => { setStatus(v === "_all" ? "" : v); setPage(1); }}>
              <SelectTrigger className="w-28">
                <SelectValue placeholder="전체 상태" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value || "_all"}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={type} onValueChange={(v) => { setType(v === "_all" ? "" : v); setPage(1); }}>
              <SelectTrigger className="w-28">
                <SelectValue placeholder="전체 유형" />
              </SelectTrigger>
              <SelectContent>
                {TYPE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value || "_all"}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              className="w-48"
              placeholder="고객명 / 제목 검색"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
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
          </>
        }
        advancedActiveCount={[startDate, endDate].filter(Boolean).length}
        hasActiveFilters={!!(status || type || search || startDate || endDate)}
        onReset={() => {
          setStatus(""); setType(""); setSearch(""); setStartDate(""); setEndDate("");
          setPage(1);
        }}
        chips={[
          ...(status ? [{ label: `상태: ${STATUS_OPTIONS.find(o => o.value === status)?.label}`, onRemove: () => { setStatus(""); setPage(1); } }] : []),
          ...(type ? [{ label: `유형: ${TYPE_OPTIONS.find(o => o.value === type)?.label}`, onRemove: () => { setType(""); setPage(1); } }] : []),
          ...(search ? [{ label: `검색: ${search}`, onRemove: () => { setSearch(""); setPage(1); } }] : []),
          ...(startDate || endDate ? [{ label: `기간: ${startDate || ""}~${endDate || ""}`, onRemove: () => { setStartDate(""); setEndDate(""); setPage(1); } }] : []),
        ]}
      />

      {/* 테이블 */}
      <div className="flex-1 overflow-hidden bg-white">
        <div className="h-full overflow-y-auto">
          <DataTable
            columns={columns}
            data={data?.items ?? []}
            getRowId={(row) => row.inquiry_id}
            onRowClick={handleRowClick}
            isLoading={isLoading}
            emptyMessage="문의가 없습니다."
            activeRowId={selectedId}
            rowClassName={(row) =>
              row.inquiry_status === "RECEIVED" || row.inquiry_status === "IN_PROGRESS"
                ? "bg-amber-50 hover:bg-amber-100"
                : ""
            }
          />
        </div>
      </div>

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

      <SlidingPanel open={panelOpen} onClose={handlePanelClose}>
        {selectedId && (
          <InquiryDetailPanel inquiryId={selectedId} onClose={handlePanelClose} />
        )}
      </SlidingPanel>

      {/* 문의 등록 모달 */}
      <Dialog open={createOpen} onOpenChange={(o) => !o && handleCreateClose()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>문의 등록</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-1">
            {/* 고객 검색 */}
            <div>
              <Label className="text-xs">
                고객 검색 (전화번호 뒤 4자리)
                <span className="text-red-500 ml-0.5">*</span>
              </Label>
              <Input
                className="mt-1"
                placeholder="뒤 4자리 입력"
                maxLength={4}
                value={phone4}
                onChange={(e) => {
                  setPhone4(e.target.value.replace(/\D/g, ""));
                  setSelectedCustomer(null);
                  setRelatedOrderId(null);
                  setRelatedOrderItemId(null);
                }}
              />
              {phone4.length === 4 && (
                <div className="mt-1.5 border border-gray-200 rounded-md overflow-hidden">
                  {phone4Results.length === 0 ? (
                    <div className="px-3 py-2 text-xs text-gray-400">검색 결과 없음</div>
                  ) : (
                    phone4Results.map((c) => (
                      <button
                        key={c.customer_id}
                        type="button"
                        className={`w-full text-left px-3 py-2 text-xs hover:bg-gray-50 flex items-center gap-2 ${
                          selectedCustomer?.customer_id === c.customer_id ? "bg-blue-50" : ""
                        }`}
                        onClick={() => {
                          setSelectedCustomer(c);
                          setRelatedOrderId(null);
                          setRelatedOrderItemId(null);
                        }}
                      >
                        <span className="font-medium text-gray-800">{c.customer_name}</span>
                        <span className="text-gray-400 font-mono">{formatPhone(c.customer_phone)}</span>
                      </button>
                    ))
                  )}
                </div>
              )}
              {selectedCustomer && (
                <div className="mt-1.5 bg-blue-50 border border-blue-200 rounded-md px-3 py-2 text-xs text-blue-700 flex items-center gap-2">
                  <span className="font-medium">{selectedCustomer.customer_name}</span>
                  <span className="font-mono">{formatPhone(selectedCustomer.customer_phone)}</span>
                </div>
              )}
            </div>

            {/* 관련 주문 / 주문품목 연결 (선택) */}
            {selectedCustomer && (
              <>
                <div>
                  <Label className="text-xs">
                    관련 주문 <span className="text-gray-400">(선택)</span>
                  </Label>
                  <Select
                    value={relatedOrderId ? String(relatedOrderId) : "_none"}
                    onValueChange={(v) => {
                      setRelatedOrderId(v === "_none" ? null : Number(v));
                      setRelatedOrderItemId(null);
                    }}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="주문 선택 안 함" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">선택 안 함</SelectItem>
                      {customerOrders.map((o) => (
                        <SelectItem key={o.order_id} value={String(o.order_id)}>
                          {[
                            CHANNEL_LABEL[o.order_channel] ?? o.order_channel,
                            ORDER_STATUS_LABEL[o.order_status] ?? o.order_status,
                            formatAmount(o.payment_amount),
                            formatDate(o.order_at),
                          ].join(" · ")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {customerOrders.length === 0 && (
                    <p className="text-xs text-gray-400 mt-1">이 고객의 주문 내역이 없습니다.</p>
                  )}
                </div>

                {relatedOrderId && (
                  <div>
                    <Label className="text-xs">
                      관련 주문품목 <span className="text-gray-400">(선택)</span>
                    </Label>
                    <Select
                      value={relatedOrderItemId ? String(relatedOrderItemId) : "_none"}
                      onValueChange={(v) =>
                        setRelatedOrderItemId(v === "_none" ? null : Number(v))
                      }
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="전체 품목" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_none">전체 품목 (주문 전체)</SelectItem>
                        {orderItems.map((it) => (
                          <SelectItem key={it.order_item_id} value={String(it.order_item_id)}>
                            {it.product_name}
                            {it.cancelled_at && (
                              <span className="ml-1 text-red-500">(취소)</span>
                            )}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </>
            )}

            {/* 문의 유형 */}
            <div>
              <Label className="text-xs">문의 유형</Label>
              <Select
                value={createForm.inquiry_type}
                onValueChange={(v) => setCreateForm((f) => ({ ...f, inquiry_type: v }))}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TYPE_OPTIONS.filter((o) => o.value).map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 제목 */}
            <div>
              <Label className="text-xs">제목</Label>
              <Input
                className="mt-1"
                placeholder="(선택)"
                value={createForm.title}
                onChange={(e) => setCreateForm((f) => ({ ...f, title: e.target.value }))}
              />
            </div>

            {/* 내용 */}
            <div>
              <Label className="text-xs">내용</Label>
              <textarea
                className="mt-1 w-full border border-gray-300 rounded-md p-2 text-sm resize-none h-24 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="(선택)"
                value={createForm.content}
                onChange={(e) => setCreateForm((f) => ({ ...f, content: e.target.value }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCreateClose}>취소</Button>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={!selectedCustomer || createMutation.isPending}
            >
              등록
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
