import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useDebounce } from "@/hooks/useDebounce";
import { getErrorMessage } from "@/utils/errorHandler";
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
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { customersApi } from "@/api/customersApi";
import { toast } from "@/hooks/use-toast";
import { formatDate, formatPhone, formatPhoneInput } from "@/utils/format";
import type { CustomerResponse, CustomerChannel } from "@/types/customer";
import CustomerDetailPanel from "./customer/CustomerDetailPanel";

const EMPTY_CREATE_FORM = {
  customer_name: "",
  customer_phone: "",
  customer_email: "",
  create_channel: "OFFLINE" as const,
  admin_memo: "",
};

const CHANNEL_OPTIONS = [
  { value: "", label: "전체 채널" },
  { value: "CAFE24", label: "Cafe24" },
  { value: "GPMALL", label: "갓피플몰" },
  { value: "OFFLINE", label: "오프라인" },
];

const ACTIVE_OPTIONS = [
  { value: "", label: "전체 상태" },
  { value: "true", label: "활성" },
  { value: "false", label: "비활성" },
];

export default function CustomerListPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [phone4, setPhone4] = useState("");
  const [channel, setChannel] = useState("");
  const [activeFilter, setActiveFilter] = useState("");
  const [adminMemo, setAdminMemo] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState(EMPTY_CREATE_FORM);
  const [createErrors, setCreateErrors] = useState<Record<string, boolean>>({});
  const [sortBy, setSortBy] = useState("created_at");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [showDeleted, setShowDeleted] = useState(false);

  const handleCreate = () => {
    const errors: Record<string, boolean> = {};
    if (!createForm.customer_name.trim()) errors.customer_name = true;
    if (!createForm.customer_phone.trim()) errors.customer_phone = true;
    setCreateErrors(errors);
    if (Object.keys(errors).length > 0) {
      const fields = [];
      if (errors.customer_name) fields.push("이름");
      if (errors.customer_phone) fields.push("연락처");
      toast.error(`${fields.join(", ")}을(를) 입력해주세요.`);
      return;
    }
    createMutation.mutate();
  };

  const createMutation = useMutation({
    mutationFn: () =>
      customersApi.createCustomer({
        customer_name: createForm.customer_name,
        customer_phone: createForm.customer_phone,
        customer_email: createForm.customer_email || null,
        create_channel: createForm.create_channel,
        admin_memo: createForm.admin_memo || null,
      }),
    onSuccess: () => {
      toast.success("고객이 등록되었습니다.");
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      setCreateOpen(false);
      setCreateForm(EMPTY_CREATE_FORM);
      setCreateErrors({});
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const debouncedSearch = useDebounce(search, 300);
  const debouncedPhone4 = useDebounce(phone4, 300);
  const debouncedAdminMemo = useDebounce(adminMemo, 300);

  const limit = 20;

  const { data, isLoading } = useQuery({
    queryKey: ["customers", page, limit, debouncedSearch, debouncedPhone4, channel, activeFilter, debouncedAdminMemo, sortBy, sortOrder, showDeleted],
    queryFn: () =>
      customersApi
        .getCustomers({
          page,
          limit,
          search: debouncedSearch || null,
          phone_num4: debouncedPhone4 || null,
          create_channel: (channel || null) as CustomerChannel | null,
          is_active: activeFilter === "" ? null : activeFilter === "true",
          is_deleted: showDeleted,
          admin_memo: debouncedAdminMemo || null,
          sort_by: sortBy,
          sort_order: sortOrder,
        })
        .then((r) => r.data),
  });

  const handleRowClick = useCallback((customer: CustomerResponse) => {
    setSelectedId(customer.customer_id);
    setPanelOpen(true);
  }, []);

  const handlePanelClose = useCallback(() => {
    setPanelOpen(false);
    setTimeout(() => setSelectedId(null), 250);
  }, []);

  const columns: ColumnDef<CustomerResponse>[] = [
    {
      key: "customer_name",
      header: "고객명",
      sortable: true,
      cell: (row) => (
        <div>
          <div className="font-medium text-gray-900 text-[13px]">{row.customer_name}</div>
          {row.customer_email && (
            <div className="text-xs text-gray-400">{row.customer_email}</div>
          )}
        </div>
      ),
    },
    {
      key: "phone",
      header: "연락처",
      cell: (row) => (
        <span className="text-[13px] text-gray-700 font-mono">
          {formatPhone(row.customer_phone)}
        </span>
      ),
      width: "w-36",
    },
    {
      key: "channel",
      header: "채널",
      cell: (row) => <StatusBadge type="channel" value={row.create_channel} />,
      width: "w-24",
    },
    {
      key: "last_order_at",
      header: "최근주문",
      sortable: true,
      cell: (row) => (
        <span className="text-xs text-gray-500">
          {row.last_order_at ? formatDate(row.last_order_at) : "-"}
        </span>
      ),
      width: "w-28",
    },
    {
      key: "active",
      header: "상태",
      cell: (row) => (
        row.is_deleted
          ? <span className="text-[11px] text-red-500 bg-red-50 px-1.5 py-0.5 rounded">삭제됨</span>
          : <span className={`inline-block w-1.5 h-1.5 rounded-full ${row.is_active ? "bg-green-500" : "bg-gray-300"}`} />
      ),
      width: "w-14",
    },
    {
      key: "created_at",
      header: "등록일",
      sortable: true,
      cell: (row) => (
        <span className="text-xs text-gray-400">{formatDate(row.created_at)}</span>
      ),
      width: "w-24",
    },
  ];

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <PageHeader
        left={<span className="text-sm text-gray-500">총 {data?.total ?? 0}명</span>}
        actions={
          <Button size="sm" onClick={() => setCreateOpen(true)} className="gap-1">
            <Plus className="h-3.5 w-3.5" />
            고객 등록
          </Button>
        }
      />
      <FilterBar
        basic={
          <>
            <Input
              className="w-28"
              placeholder="연락처 뒤 4자리"
              maxLength={4}
              value={phone4}
              onChange={(e) => { setPhone4(e.target.value.replace(/\D/g, "")); setPage(1); }}
            />
            <Input
              className="w-48"
              placeholder="이름 / 이메일 검색"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
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
          </>
        }
        advanced={
          <>
            <Select value={activeFilter} onValueChange={(v) => { setActiveFilter(v === "_all" ? "" : v); setPage(1); }}>
              <SelectTrigger className="w-28">
                <SelectValue placeholder="전체 상태" />
              </SelectTrigger>
              <SelectContent>
                {ACTIVE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value || "_all"}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              className="w-36"
              placeholder="관리자 메모"
              value={adminMemo}
              onChange={(e) => { setAdminMemo(e.target.value); setPage(1); }}
            />
            <button
              onClick={() => { setShowDeleted((v) => !v); setPage(1); }}
              className={`text-xs px-2.5 py-1.5 rounded border transition-colors whitespace-nowrap ${
                showDeleted
                  ? "bg-red-50 border-red-200 text-red-600 font-medium"
                  : "border-gray-200 text-gray-500 hover:bg-gray-50"
              }`}
            >
              삭제된 고객만
            </button>
          </>
        }
        advancedActiveCount={[activeFilter, adminMemo, showDeleted ? "deleted" : ""].filter(Boolean).length}
        hasActiveFilters={!!(phone4 || search || channel || activeFilter || adminMemo || showDeleted)}
        onReset={() => {
          setPhone4(""); setSearch(""); setChannel(""); setActiveFilter(""); setAdminMemo("");
          setShowDeleted(false);
          setPage(1);
        }}
        chips={[
          ...(phone4 ? [{ label: `뒤 4자리: ${phone4}`, onRemove: () => { setPhone4(""); setPage(1); } }] : []),
          ...(search ? [{ label: `검색: ${search}`, onRemove: () => { setSearch(""); setPage(1); } }] : []),
          ...(channel ? [{ label: `채널: ${CHANNEL_OPTIONS.find(o => o.value === channel)?.label}`, onRemove: () => { setChannel(""); setPage(1); } }] : []),
          ...(activeFilter ? [{ label: `상태: ${ACTIVE_OPTIONS.find(o => o.value === activeFilter)?.label}`, onRemove: () => { setActiveFilter(""); setPage(1); } }] : []),
          ...(adminMemo ? [{ label: `메모: ${adminMemo}`, onRemove: () => { setAdminMemo(""); setPage(1); } }] : []),
          ...(showDeleted ? [{ label: "삭제된 고객만", onRemove: () => { setShowDeleted(false); setPage(1); } }] : []),
        ]}
      />

      {/* 테이블 */}
      <div className="flex-1 overflow-hidden bg-white">
        <div className="h-full overflow-y-auto">
          <DataTable
            columns={columns}
            data={data?.items ?? []}
            getRowId={(row) => row.customer_id}
            onRowClick={handleRowClick}
            isLoading={isLoading}
            emptyMessage="고객이 없습니다."
            activeRowId={selectedId}
            sortBy={sortBy}
            sortOrder={sortOrder}
            onSortChange={(col, order) => { setSortBy(col); setSortOrder(order); setPage(1); }}
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

      {/* 고객 등록 모달 */}
      <Dialog open={createOpen} onOpenChange={(o) => { if (!o) { setCreateOpen(false); setCreateForm(EMPTY_CREATE_FORM); setCreateErrors({}); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>고객 등록</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div>
              <Label className="text-xs font-medium text-gray-600">
                이름 <span className="text-red-500">*</span>
              </Label>
              <Input
                className={`mt-1 h-8 text-sm ${createErrors.customer_name ? "border-red-500" : ""}`}
                placeholder="홍길동"
                value={createForm.customer_name}
                onChange={(e) => {
                  setCreateForm((f) => ({ ...f, customer_name: e.target.value }));
                  if (e.target.value.trim()) setCreateErrors((prev) => ({ ...prev, customer_name: false }));
                }}
              />
              {createErrors.customer_name && (
                <p className="text-xs text-red-500 mt-1">이름을 입력해주세요.</p>
              )}
            </div>
            <div>
              <Label className="text-xs font-medium text-gray-600">
                연락처 <span className="text-red-500">*</span>
              </Label>
              <Input
                className={`mt-1 h-8 text-sm font-mono ${createErrors.customer_phone ? "border-red-500" : ""}`}
                placeholder="010-0000-0000"
                value={createForm.customer_phone}
                onChange={(e) => {
                  setCreateForm((f) => ({ ...f, customer_phone: formatPhoneInput(e.target.value) }));
                  if (e.target.value.trim()) setCreateErrors((prev) => ({ ...prev, customer_phone: false }));
                }}
              />
              {createErrors.customer_phone && (
                <p className="text-xs text-red-500 mt-1">연락처를 입력해주세요.</p>
              )}
            </div>
            <div>
              <Label className="text-xs font-medium text-gray-600">이메일</Label>
              <Input
                className="mt-1 h-8 text-sm"
                type="email"
                placeholder="example@email.com"
                value={createForm.customer_email}
                onChange={(e) => setCreateForm((f) => ({ ...f, customer_email: e.target.value }))}
              />
            </div>
            <div>
              <Label className="text-xs font-medium text-gray-600">유입 채널</Label>
              <Select
                value={createForm.create_channel}
                onValueChange={(v) => setCreateForm((f) => ({ ...f, create_channel: v as typeof f.create_channel }))}
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
              <Label className="text-xs font-medium text-gray-600">관리자 메모</Label>
              <textarea
                className="mt-1 w-full border border-gray-300 rounded-md p-2 text-sm resize-none h-16 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                placeholder="내부 메모 (선택)"
                value={createForm.admin_memo}
                onChange={(e) => setCreateForm((f) => ({ ...f, admin_memo: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => { setCreateOpen(false); setCreateForm(EMPTY_CREATE_FORM); setCreateErrors({}); }}>
              취소
            </Button>
            <Button
              size="sm"
              onClick={handleCreate}
              disabled={createMutation.isPending}
            >
              {createMutation.isPending && <LoadingSpinner size="sm" className="mr-1" />}
              등록
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SlidingPanel open={panelOpen} onClose={handlePanelClose} width={480}>
        {selectedId && (
          <CustomerDetailPanel customerId={selectedId} onClose={handlePanelClose} />
        )}
      </SlidingPanel>
    </div>
  );
}
