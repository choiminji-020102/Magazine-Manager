import { useState, useCallback } from "react";
import { useDebounce } from "@/hooks/useDebounce";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
import { productsApi } from "@/api/productsApi";
import { toast } from "@/hooks/use-toast";
import { formatAmount, formatDate, formatIssue } from "@/utils/format";
import type { ProductResponse } from "@/types/product";
import { ProductKind } from "@/types/product";
import ProductDetailPanel from "./product/ProductDetailPanel";

/** 모달 섹션 구분 헤더 */
function FormSection({
  title,
  optional,
  children,
}: {
  title: string;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{title}</span>
        {optional && (
          <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">선택</span>
        )}
        <div className="flex-1 h-px bg-gray-100" />
      </div>
      {children}
    </div>
  );
}

/** 필드 레이블 (필수 * 표시 포함) */
function FormLabel({ required, children }: { required?: boolean; children: React.ReactNode }) {
  return (
    <label className="text-xs font-medium text-gray-600">
      {children}
      {required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
  );
}

const KIND_OPTIONS = [
  { value: "", label: "전체 종류" },
  { value: "YEARLY", label: "정기구독" },
  { value: "MONTHLY", label: "단품" },
];

const ACTIVE_OPTIONS = [
  { value: "", label: "전체 상태" },
  { value: "true", label: "활성" },
  { value: "false", label: "비활성" },
];

const EMPTY_FORM = {
  product_code: "",
  product_name: "",
  product_kind: ProductKind.YEARLY as ProductKind,
  list_price: "",
  sale_price: "",
  cost_price: "",
  stock_quantity: "0",
  external_product_code_cafe24: "",
  external_product_code_gpmall: "",
  unit_weight: "",
  unit_width: "",
  unit_length: "",
  unit_height: "",
};

export default function ProductListPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState("");
  const [activeFilter, setActiveFilter] = useState("");
  const [startIssue, setStartIssue] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const createMutation = useMutation({
    mutationFn: () =>
      productsApi.createProduct({
        product_code: form.product_code,
        product_name: form.product_name,
        product_kind: form.product_kind,
        list_price: Number(form.list_price),
        sale_price: Number(form.sale_price),
        cost_price: Number(form.cost_price),
        stock_quantity: Number(form.stock_quantity),
        external_product_code_cafe24: form.external_product_code_cafe24 || null,
        external_product_code_gpmall: form.external_product_code_gpmall || null,
        unit_weight: form.unit_weight ? Number(form.unit_weight) : null,
        unit_width: form.unit_width ? Number(form.unit_width) : null,
        unit_length: form.unit_length ? Number(form.unit_length) : null,
        unit_height: form.unit_height ? Number(form.unit_height) : null,
        is_active: true,
      }),
    onSuccess: () => {
      toast.success("상품이 등록되었습니다.");
      queryClient.invalidateQueries({ queryKey: ["products"] });
      setCreateOpen(false);
      setForm(EMPTY_FORM);
    },
    onError: () => toast.error("상품 등록 실패"),
  });

  const debouncedSearch = useDebounce(search, 300);
  const debouncedStartIssue = useDebounce(startIssue, 300);

  const limit = 20;

  const { data, isLoading } = useQuery({
    queryKey: ["products", page, limit, debouncedSearch, kind, activeFilter, debouncedStartIssue],
    queryFn: () =>
      productsApi
        .getProducts({
          page,
          limit,
          search: debouncedSearch || null,
          product_kind: (kind || null) as ProductKind | null,
          is_active: activeFilter === "" ? null : activeFilter === "true",
          subscribe_start_issue: debouncedStartIssue || null,
        })
        .then((r) => r.data),
  });

  const handleRowClick = useCallback((product: ProductResponse) => {
    setSelectedId(product.product_id);
    setPanelOpen(true);
  }, []);

  const handlePanelClose = useCallback(() => {
    setPanelOpen(false);
    setTimeout(() => setSelectedId(null), 250);
  }, []);

  const columns: ColumnDef<ProductResponse>[] = [
    {
      key: "product_code",
      header: "상품코드",
      cell: (row) => (
        <span className="text-xs font-mono text-gray-500">{row.product_code}</span>
      ),
      width: "w-28",
    },
    {
      key: "external_product_code_cafe24",
      header: "카페24 상품코드",
      cell: (row) => (
        <span className="text-xs font-mono text-gray-500">{row.external_product_code_cafe24 || "-"}</span>
      ),
      width: "w-28",
    },
    {
      key: "kind",
      header: "종류",
      cell: (row) => <StatusBadge type="product_kind" value={row.product_kind} />,
      width: "w-24",
    },
    {
      key: "product_name",
      header: "상품명",
      cell: (row) => (
        <span className="font-medium text-gray-900 text-[13px]">{row.product_name}</span>
      ),
    },
    {
      key: "list_price",
      header: "상품 소비자가",
      cell: (row) => (
        <span className="text-[13px] text-gray-500">{formatAmount(row.list_price)}</span>
      ),
      width: "w-24",
    },
    {
      key: "sale_price",
      header: "상품 판매가",
      cell: (row) => (
        <span className="text-[13px] font-medium">{formatAmount(row.sale_price)}</span>
      ),
      width: "w-24",
    },
    {
      key: "active",
      header: "판매상태",
      cell: (row) => (
        <span
          className={`inline-block w-1.5 h-1.5 rounded-full ${
            row.is_active ? "bg-green-500" : "bg-gray-300"
          }`}
        />
      ),
      width: "w-12",
    },
    {
      key: "issue",
      header: "시작호",
      cell: (row) => (
        <span className="text-xs text-gray-600">
          {row.subscribe_start_issue ? formatIssue(row.subscribe_start_issue) : "-"}
        </span>
      ),
      width: "w-28",
    },
    {
      key: "unit_weight",
      header: "상품 중량",
      cell: (row) => (
        <span className="text-xs text-gray-600">{row.unit_weight ?? "-"}</span>
      ),
      width: "w-20",
    },
    {
      key: "created_at",
      header: "생성일",
      cell: (row) => (
        <span className="text-xs text-gray-500">{formatDate(row.created_at)}</span>
      ),
      width: "w-24",
    },
    {
      key: "updated_at",
      header: "수정일",
      cell: (row) => (
        <span className="text-xs text-gray-500">{formatDate(row.updated_at)}</span>
      ),
      width: "w-24",
    },
  ];

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <PageHeader
        left={<span className="text-sm text-gray-500">총 {data?.total ?? 0}개</span>}
        actions={
          <Button size="sm" onClick={() => setCreateOpen(true)} className="gap-1">
            <Plus className="h-3.5 w-3.5" />
            상품 등록
          </Button>
        }
      />
      <FilterBar
        basic={
          <>
            <Select value={kind} onValueChange={(v) => { setKind(v === "_all" ? "" : v); setPage(1); }}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="전체 종류" />
              </SelectTrigger>
              <SelectContent>
                {KIND_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value || "_all"}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
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
              className="w-52"
              placeholder="상품명 / 코드 검색"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          </>
        }
        advanced={
          <Input
            className="w-36"
            placeholder="시작호 (YYYYMM)"
            maxLength={6}
            value={startIssue}
            onChange={(e) => { setStartIssue(e.target.value.replace(/\D/g, "")); setPage(1); }}
          />
        }
        advancedActiveCount={startIssue ? 1 : 0}
        hasActiveFilters={!!(kind || activeFilter || search || startIssue)}
        onReset={() => {
          setKind(""); setActiveFilter(""); setSearch(""); setStartIssue("");
          setPage(1);
        }}
        chips={[
          ...(kind ? [{ label: `종류: ${KIND_OPTIONS.find(o => o.value === kind)?.label}`, onRemove: () => { setKind(""); setPage(1); } }] : []),
          ...(activeFilter ? [{ label: `상태: ${ACTIVE_OPTIONS.find(o => o.value === activeFilter)?.label}`, onRemove: () => { setActiveFilter(""); setPage(1); } }] : []),
          ...(search ? [{ label: `검색: ${search}`, onRemove: () => { setSearch(""); setPage(1); } }] : []),
          ...(startIssue ? [{ label: `시작호: ${startIssue}`, onRemove: () => { setStartIssue(""); setPage(1); } }] : []),
        ]}
      />

      {/* 테이블 */}
      <div className="flex-1 overflow-hidden bg-white">
        <div className="h-full overflow-y-auto">
          <DataTable
            columns={columns}
            data={data?.items ?? []}
            getRowId={(row) => row.product_id}
            onRowClick={handleRowClick}
            isLoading={isLoading}
            emptyMessage="상품이 없습니다."
            activeRowId={selectedId}
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
          <ProductDetailPanel productId={selectedId} onClose={handlePanelClose} />
        )}
      </SlidingPanel>

      {/* 상품 등록 모달 */}
      <Dialog open={createOpen} onOpenChange={(open) => { if (!open) { setCreateOpen(false); setForm(EMPTY_FORM); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>상품 등록</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-1">
            {/* 섹션 1: 기본 정보 */}
            <FormSection title="기본 정보">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <FormLabel required>상품 코드</FormLabel>
                  <Input
                    className="mt-1 h-8 text-sm font-mono"
                    placeholder="예: W0+202604 (정기구독)"
                    value={form.product_code}
                    onChange={(e) => setForm((f) => ({ ...f, product_code: e.target.value }))}
                  />
                  <p className="mt-1 text-[11px] text-gray-400">YEARLY 정기구독: 코드+YYYYMM · YEARLY 연장구독: 코드~YYYYMM · MONTHLY: 코드-YYYYMM</p>
                </div>
                <div>
                  <FormLabel required>상품 종류</FormLabel>
                  <Select value={form.product_kind} onValueChange={(v) => setForm((f) => ({ ...f, product_kind: v as ProductKind }))}>
                    <SelectTrigger className="mt-1 h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="YEARLY">정기구독</SelectItem>
                      <SelectItem value="MONTHLY">단품</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <FormLabel required>상품명</FormLabel>
                <Input
                  className="mt-1 h-8 text-sm"
                  placeholder="예: 말씀함께 2026년 4월호"
                  value={form.product_name}
                  onChange={(e) => setForm((f) => ({ ...f, product_name: e.target.value }))}
                />
              </div>
            </FormSection>

            {/* 섹션 2: 가격 · 재고 */}
            <FormSection title="가격 · 재고">
              <div className="grid grid-cols-4 gap-3">
                <div>
                  <FormLabel>정가</FormLabel>
                  <Input className="mt-1 h-8 text-sm" type="number" min={0} placeholder="0"
                    value={form.list_price}
                    onChange={(e) => setForm((f) => ({ ...f, list_price: e.target.value }))} />
                </div>
                <div>
                  <FormLabel required>판매가</FormLabel>
                  <Input className="mt-1 h-8 text-sm" type="number" min={0} placeholder="0"
                    value={form.sale_price}
                    onChange={(e) => setForm((f) => ({ ...f, sale_price: e.target.value }))} />
                </div>
                <div>
                  <FormLabel>원가</FormLabel>
                  <Input className="mt-1 h-8 text-sm" type="number" min={0} placeholder="0"
                    value={form.cost_price}
                    onChange={(e) => setForm((f) => ({ ...f, cost_price: e.target.value }))} />
                </div>
                <div>
                  <FormLabel>초기 재고</FormLabel>
                  <Input className="mt-1 h-8 text-sm" type="number" min={0} placeholder="0"
                    value={form.stock_quantity}
                    onChange={(e) => setForm((f) => ({ ...f, stock_quantity: e.target.value }))} />
                </div>
              </div>
            </FormSection>

            {/* 섹션 3: 외부 연동 (선택) */}
            <FormSection title="외부 연동" optional>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <FormLabel>카페24 상품코드</FormLabel>
                  <Input className="mt-1 h-8 text-sm font-mono" placeholder="카페24 상품코드"
                    value={form.external_product_code_cafe24}
                    onChange={(e) => setForm((f) => ({ ...f, external_product_code_cafe24: e.target.value }))} />
                </div>
                <div>
                  <FormLabel>갓피플몰 상품코드</FormLabel>
                  <Input className="mt-1 h-8 text-sm font-mono" placeholder="갓피플몰 상품 코드"
                    value={form.external_product_code_gpmall}
                    onChange={(e) => setForm((f) => ({ ...f, external_product_code_gpmall: e.target.value }))} />
                </div>
              </div>
            </FormSection>

            {/* 섹션 4: 물리 정보 (선택) */}
            <FormSection title="물리 정보" optional>
              <div className="grid grid-cols-4 gap-3">
                <div>
                  <FormLabel>무게 (kg)</FormLabel>
                  <Input className="mt-1 h-8 text-sm" type="number" min={0} step="0.1" placeholder="0"
                    value={form.unit_weight}
                    onChange={(e) => setForm((f) => ({ ...f, unit_weight: e.target.value }))} />
                </div>
                <div>
                  <FormLabel>가로 (mm)</FormLabel>
                  <Input className="mt-1 h-8 text-sm" type="number" min={0} step="0.1" placeholder="0"
                    value={form.unit_width}
                    onChange={(e) => setForm((f) => ({ ...f, unit_width: e.target.value }))} />
                </div>
                <div>
                  <FormLabel>세로 (mm)</FormLabel>
                  <Input className="mt-1 h-8 text-sm" type="number" min={0} step="0.1" placeholder="0"
                    value={form.unit_length}
                    onChange={(e) => setForm((f) => ({ ...f, unit_length: e.target.value }))} />
                </div>
                <div>
                  <FormLabel>높이 (mm)</FormLabel>
                  <Input className="mt-1 h-8 text-sm" type="number" min={0} step="0.1" placeholder="0"
                    value={form.unit_height}
                    onChange={(e) => setForm((f) => ({ ...f, unit_height: e.target.value }))} />
                </div>
              </div>
            </FormSection>
          </div>

          <DialogFooter className="mt-2">
            <Button variant="outline" onClick={() => { setCreateOpen(false); setForm(EMPTY_FORM); }}>
              취소
            </Button>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending || !form.product_code || !form.product_name || !form.sale_price}
            >
              {createMutation.isPending && <LoadingSpinner size="sm" className="mr-1.5" />}
              등록
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
