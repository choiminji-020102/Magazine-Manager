import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { cafe24API } from "@/api/cafe24Api";
import { DataTable, ColumnDef } from "@/components/common/DataTable";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import type { Cafe24Product } from "@/types/cafe24";
import Cafe24ProductImportModal from "./Cafe24ProductImportModal";

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function formatCafe24Price(value: string | number): string {
  const num = Math.floor(Number(value));
  return num.toLocaleString("ko-KR") + "원";
}

function formatCafe24Date(dateStr: string): string {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  return d.toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" });
}

const columns: ColumnDef<Cafe24Product>[] = [
  {
    key: "list_image",
    header: "",
    cell: (row) =>
      row.list_image ? (
        <img src={row.list_image} alt="" className="w-10 h-10 object-cover rounded" />
      ) : (
        <div className="w-10 h-10 bg-gray-100 rounded" />
      ),
    width: "w-14",
  },
  {
    key: "product_code",
    header: "카페24 상품코드",
    cell: (row) => <span className="text-xs font-mono text-gray-500">{row.product_code}</span>,
    width: "w-28",
  },
  {
    key: "product_name",
    header: "상품명",
    cell: (row) => (
      <span className="text-[13px] font-medium text-gray-900">{stripHtml(row.product_name)}</span>
    ),
  },
  {
    key: "retail_price",
    header: "상품 소비자가",
    cell: (row) => <span className="text-[13px]">{formatCafe24Price(row.retail_price)}</span>,
    width: "w-28",
  },
  {
    key: "price",
    header: "상품 판매가",
    cell: (row) => <span className="text-[13px] font-medium">{formatCafe24Price(row.price)}</span>,
    width: "w-28",
  },
  {
    key: "selling",
    header: "판매상태",
    cell: (row) => (
      <span className={`text-xs font-medium ${row.selling === "T" ? "text-blue-600" : "text-gray-400"}`}>
        {row.selling === "T" ? "판매함" : "판매안함"}
      </span>
    ),
    width: "w-20",
  },
  {
    key: "product_weight",
    header: "상품 중량",
    cell: (row) => <span className="text-xs text-gray-600">{row.product_weight}</span>,
    width: "w-20",
  },
  {
    key: "created_date",
    header: "생성일",
    cell: (row) => <span className="text-xs text-gray-500">{formatCafe24Date(row.created_date)}</span>,
    width: "w-24",
  },
  {
    key: "updated_date",
    header: "수정일",
    cell: (row) => <span className="text-xs text-gray-500">{formatCafe24Date(row.updated_date)}</span>,
    width: "w-24",
  },
];

export default function Cafe24ProductListPage() {
  const [selectedIds, setSelectedIds] = useState<Set<string | number>>(new Set());
  const [importOpen, setImportOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["cafe24-products"],
    queryFn: () => cafe24API.getProducts(),
  });

  const products = data?.products ?? [];

  const selectedProducts = products.filter((p) => selectedIds.has(p.product_no));

  const handleImportOpen = useCallback(() => {
    if (selectedIds.size === 0) return;
    setImportOpen(true);
  }, [selectedIds]);

  const handleImportClose = useCallback(() => {
    setImportOpen(false);
    setSelectedIds(new Set());
  }, []);

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <PageHeader
        left={<span className="text-sm text-gray-500">총 {products.length}개</span>}
        actions={
          <Button
            size="sm"
            onClick={handleImportOpen}
            disabled={selectedIds.size === 0}
            className="gap-1"
          >
            <Download className="h-3.5 w-3.5" />
            상품 등록 ({selectedIds.size})
          </Button>
        }
      />

      <div className="flex-1 min-h-0 overflow-auto">
        <DataTable
          columns={columns}
          data={products}
          getRowId={(row) => row.product_no}
          isLoading={isLoading}
          emptyMessage="Cafe24 상품이 없습니다."
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
        />
      </div>

      <Cafe24ProductImportModal
        open={importOpen}
        onClose={handleImportClose}
        selectedProducts={selectedProducts}
      />
    </div>
  );
}
