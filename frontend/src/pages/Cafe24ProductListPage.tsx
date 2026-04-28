import { useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Download, CheckCircle2, XCircle, MinusCircle, Info } from "lucide-react";
import { cafe24API } from "@/api/cafe24Api";
import { DataTable, ColumnDef } from "@/components/common/DataTable";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { ImportStatCard, ImportDetailCard } from "@/components/common/ImportResultCards";
import type { Cafe24Product, Cafe24ProductImportResponse } from "@/types/cafe24";
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

function ImportResultModal({
  open,
  onClose,
  onNavigate,
  result,
}: {
  open: boolean;
  onClose: () => void;
  onNavigate: () => void;
  result: Cafe24ProductImportResponse | null;
}) {
  if (!result) return null;
  const failed = result.results.filter((r) => r.status === "failed");
  const skipped = result.results.filter((r) => r.status === "skipped");
  const nothingCreated = result.created_count === 0;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Cafe24 상품 가져오기 결과</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-auto py-2">
          <div className="space-y-4">
            {/* 요약 카드 3개 */}
            <div className="grid grid-cols-3 gap-2">
              <ImportStatCard
                label="등록"
                count={result.created_count}
                icon={<CheckCircle2 className="h-5 w-5" />}
                tone="success"
                unit="개"
              />
              <ImportStatCard
                label="실패"
                count={result.failed_count}
                icon={<XCircle className="h-5 w-5" />}
                tone="danger"
                unit="개"
              />
              <ImportStatCard
                label="건너뜀"
                count={result.skipped_count}
                icon={<MinusCircle className="h-5 w-5" />}
                tone="neutral"
                unit="개"
              />
            </div>

            {/* 등록 0건 안내 */}
            {nothingCreated && (
              <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
                <Info className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                <div className="text-xs text-amber-700 leading-relaxed">
                  새로 등록된 상품이 없습니다. 아래 상세를 확인해 주세요.
                </div>
              </div>
            )}

            {/* 실패 상세 */}
            {failed.length > 0 && (
              <section>
                <h4 className="text-xs font-semibold text-red-600 mb-1.5 flex items-center gap-1">
                  <XCircle className="h-3.5 w-3.5" />
                  실패 상세 ({failed.length}개)
                </h4>
                <div className="space-y-1.5 max-h-56 overflow-auto pr-1">
                  {failed.map((r) => (
                    <ImportDetailCard
                      key={r.cafe24_product_code}
                      itemKey={r.product_code || r.cafe24_product_code}
                      message={r.message || "알 수 없는 오류"}
                      tone="danger"
                    />
                  ))}
                </div>
              </section>
            )}

            {/* 건너뜀 상세 */}
            {skipped.length > 0 && (
              <section>
                <h4 className="text-xs font-semibold text-gray-600 mb-1.5 flex items-center gap-1">
                  <MinusCircle className="h-3.5 w-3.5" />
                  건너뜀 상세 ({skipped.length}개)
                </h4>
                <div className="space-y-1.5 max-h-56 overflow-auto pr-1">
                  {skipped.map((r) => (
                    <ImportDetailCard
                      key={r.cafe24_product_code}
                      itemKey={r.product_code || r.cafe24_product_code}
                      message={r.message || "이미 등록된 상품"}
                      tone="neutral"
                    />
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>확인</Button>
          <Button onClick={onNavigate} disabled={result.created_count === 0}>
            상품 목록으로 이동
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function Cafe24ProductListPage() {
  const navigate = useNavigate();
  const [selectedIds, setSelectedIds] = useState<Set<string | number>>(new Set());
  const [importOpen, setImportOpen] = useState(false);
  const [resultOpen, setResultOpen] = useState(false);
  const [importResult, setImportResult] = useState<Cafe24ProductImportResponse | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["cafe24-products"],
    queryFn: () => cafe24API.getProducts(),
  });

  const products = data?.products ?? [];

  const importableCount = useMemo(
    () => products.filter((p) => !p.already_imported).length,
    [products]
  );

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
        left={
          <span className="text-sm text-gray-500">
            총 {products.length}개 (신규 {importableCount}개)
          </span>
        }
        actions={
          <Button
            size="sm"
            onClick={handleImportOpen}
            disabled={selectedIds.size === 0}
            className="gap-1"
          >
            <Download className="h-3.5 w-3.5" />
            선택 {selectedIds.size}개 가져오기
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
          isRowSelectable={(row) => !row.already_imported}
          disabledRowLabel={() => (
            <div className="text-[10px] text-green-700 font-medium leading-tight text-center">
              <div>이미</div>
              <div>가져옴</div>
            </div>
          )}
        />
      </div>

      <Cafe24ProductImportModal
        open={importOpen}
        onClose={handleImportClose}
        onImported={(result) => {
          setImportResult(result);
          setResultOpen(true);
        }}
        selectedProducts={selectedProducts}
      />

      <ImportResultModal
        open={resultOpen}
        onClose={() => setResultOpen(false)}
        onNavigate={() => {
          setResultOpen(false);
          navigate("/products");
        }}
        result={importResult}
      />
    </div>
  );
}
