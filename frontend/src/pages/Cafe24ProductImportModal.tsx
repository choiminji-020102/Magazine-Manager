import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { cafe24API } from "@/api/cafe24Api";
import { toast } from "@/hooks/use-toast";
import type { Cafe24Product, Cafe24ProductImportItem } from "@/types/cafe24";

// ── 자동 파싱 ────────────────────────────────────────────────────────────────

const PREFIX_RULES: { keyword: string; prefix: string }[] = [
  { keyword: "큰글", prefix: "WB" },
  { keyword: "꿀땅", prefix: "HN" },
  { keyword: "청소년", prefix: "JN" },
  // 어린이는 저학년/고학년 구분 필요 → 아래에서 별도 처리
  { keyword: "기본판", prefix: "W0" },
];

function parsePrefix(name: string): string {
  const plain = name.replace(/<[^>]*>/g, " ");
  for (const rule of PREFIX_RULES) {
    if (plain.includes(rule.keyword)) return rule.prefix;
  }
  // 어린이 저학년/고학년
  if (plain.includes("어린이") || plain.includes("어예동")) {
    if (/저학년|1[-~]2/.test(plain)) return "CL";
    if (/고학년|3[-~]6/.test(plain)) return "CH";
  }
  return "";
}

function parseKind(name: string): "YEARLY" | "MONTHLY" {
  const plain = name.replace(/<[^>]*>/g, " ");
  return plain.includes("단품") ? "MONTHLY" : "YEARLY";
}

// 연장 구독 상품 여부: 상품명에 "연장" 포함
function parseIsExtension(name: string): boolean {
  const plain = name.replace(/<[^>]*>/g, " ");
  return plain.includes("연장");
}

function parseIssue(name: string): string {
  const plain = name.replace(/<[^>]*>/g, " ");
  const m = plain.match(/(\d{2})년\s*(\d{1,2})월/);
  if (!m) return "";
  const year = 2000 + parseInt(m[1], 10);
  const month = m[2].padStart(2, "0");
  return `${year}${month}`;
}

function buildProductCode(
  prefix: string,
  kind: "YEARLY" | "MONTHLY",
  issue: string,
  isExtension: boolean = false,
): string {
  if (!prefix || !issue) return "";
  // YEARLY: '+' (정기구독) 또는 '~' (연장 구독) / MONTHLY: '-'
  const sep = kind === "MONTHLY" ? "-" : (isExtension ? "~" : "+");
  return `${prefix}${sep}${issue}`;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function cafe24PriceToInt(value: string): number {
  return Math.floor(Number(value));
}

// ── 폼 행 타입 ────────────────────────────────────────────────────────────────

interface ImportRow {
  cafe24: Cafe24Product;
  product_code: string;
  product_kind: "YEARLY" | "MONTHLY";
  product_name: string;
  list_price: string;
  sale_price: string;
  cost_price: string;
  stock_quantity: string;
  unit_weight: string;
}

function initRow(p: Cafe24Product): ImportRow {
  const kind = parseKind(p.product_name);
  const prefix = parsePrefix(p.product_name);
  const issue = parseIssue(p.product_name);
  const isExtension = parseIsExtension(p.product_name);
  return {
    cafe24: p,
    product_code: buildProductCode(prefix, kind, issue, isExtension),
    product_kind: kind,
    product_name: stripHtml(p.product_name),
    list_price: String(cafe24PriceToInt(p.retail_price)),
    sale_price: String(cafe24PriceToInt(p.price)),
    cost_price: "0",
    stock_quantity: "0",
    unit_weight: p.product_weight ? String(Number(p.product_weight)) : "",
  };
}

// ── 컴포넌트 ──────────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
  selectedProducts: Cafe24Product[];
}

export default function Cafe24ProductImportModal({ open, onClose, selectedProducts }: Props) {
  const queryClient = useQueryClient();
  const [rows, setRows] = useState<ImportRow[]>([]);

  useEffect(() => {
    if (open && selectedProducts.length > 0) {
      setRows(selectedProducts.map(initRow));
    }
  }, [open, selectedProducts]);

  const updateRow = (idx: number, field: keyof ImportRow, value: string) => {
    setRows((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, [field]: value } : r))
    );
  };

  // product_kind 변경 시 product_code의 구분자도 자동 변경
  // YEARLY ↔ MONTHLY 전환 시 '+'/'~'/'-' 서로 치환 (연장 '~'은 YEARLY → MONTHLY 시 '-'로, MONTHLY → YEARLY 시 '+'로 복귀)
  const updateKind = (idx: number, kind: "YEARLY" | "MONTHLY") => {
    setRows((prev) =>
      prev.map((r, i) => {
        if (i !== idx) return r;
        let code = r.product_code;
        if (kind === "YEARLY") code = code.replace("-", "+");
        else code = code.replace(/[+~]/, "-");
        return { ...r, product_kind: kind, product_code: code };
      })
    );
  };

  const importMutation = useMutation({
    mutationFn: () => {
      const items: Cafe24ProductImportItem[] = rows.map((r) => ({
        cafe24_product_code: r.cafe24.product_code,
        product_code: r.product_code,
        product_kind: r.product_kind,
        product_name: r.product_name,
        list_price: parseInt(r.list_price) || 0,
        sale_price: parseInt(r.sale_price) || 0,
        cost_price: parseInt(r.cost_price) || 0,
        stock_quantity: parseInt(r.stock_quantity) || 0,
        unit_weight: r.unit_weight ? Number(r.unit_weight) : null,
      }));
      return cafe24API.importProducts({ items });
    },
    onSuccess: (data) => {
      const msgs: string[] = [];
      if (data.created_count > 0) msgs.push(`${data.created_count}개 등록`);
      if (data.skipped_count > 0) msgs.push(`${data.skipped_count}개 건너뜀(이미 등록)`);
      if (data.failed_count > 0) msgs.push(`${data.failed_count}개 실패`);
      toast.success(msgs.join(", "));

      // 실패 상세 표시
      data.results
        .filter((r) => r.status === "failed")
        .forEach((r) => toast.error(`${r.product_code}: ${r.message}`));

      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["cafe24-products"] });
      onClose();
    },
    onError: () => toast.error("상품 등록 실패"),
  });

  const hasEmptyCode = rows.some((r) => !r.product_code);

  const handleClose = () => {
    if (!importMutation.isPending) {
      setRows([]);
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Cafe24 상품 등록 ({selectedProducts.length}개)</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-2">
          {rows.map((row, idx) => (
            <div key={row.cafe24.product_no} className="border border-gray-200 rounded-lg p-3.5 space-y-2.5">
              {/* 헤더: Cafe24 정보 */}
              <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
                {row.cafe24.list_image && (
                  <img src={row.cafe24.list_image} alt="" className="w-8 h-8 object-cover rounded" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-gray-400 font-mono">{row.cafe24.product_code}</div>
                  <div className="text-sm text-gray-600 truncate">{stripHtml(row.cafe24.product_name)}</div>
                </div>
              </div>

              {/* 내부 필드 */}
              <div className="grid grid-cols-4 gap-2">
                <div>
                  <label className="text-xs text-gray-500">상품코드<span className="text-red-500 ml-0.5">*</span></label>
                  <Input
                    className="mt-0.5 h-7 text-xs font-mono"
                    value={row.product_code}
                    onChange={(e) => updateRow(idx, "product_code", e.target.value)}
                    placeholder="예: W0+202606"
                  />
                  {!row.product_code && (
                    <p className="text-xs text-red-500 mt-0.5">필수</p>
                  )}
                </div>
                <div>
                  <label className="text-xs text-gray-500">종류<span className="text-red-500 ml-0.5">*</span></label>
                  <Select value={row.product_kind} onValueChange={(v) => updateKind(idx, v as "YEARLY" | "MONTHLY")}>
                    <SelectTrigger className="mt-0.5 h-7 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="YEARLY">정기구독</SelectItem>
                      <SelectItem value="MONTHLY">단품</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-gray-500">상품명<span className="text-red-500 ml-0.5">*</span></label>
                  <Input
                    className="mt-0.5 h-7 text-xs"
                    value={row.product_name}
                    onChange={(e) => updateRow(idx, "product_name", e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-5 gap-2">
                <div>
                  <label className="text-xs text-gray-500">소비자가</label>
                  <Input
                    className="mt-0.5 h-7 text-xs"
                    type="number"
                    min={0}
                    value={row.list_price}
                    onChange={(e) => updateRow(idx, "list_price", e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500">판매가</label>
                  <Input
                    className="mt-0.5 h-7 text-xs"
                    type="number"
                    min={0}
                    value={row.sale_price}
                    onChange={(e) => updateRow(idx, "sale_price", e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500">원가</label>
                  <Input
                    className="mt-0.5 h-7 text-xs"
                    type="number"
                    min={0}
                    value={row.cost_price}
                    onChange={(e) => updateRow(idx, "cost_price", e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500">재고</label>
                  <Input
                    className="mt-0.5 h-7 text-xs"
                    type="number"
                    min={0}
                    value={row.stock_quantity}
                    onChange={(e) => updateRow(idx, "stock_quantity", e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500">중량(kg)</label>
                  <Input
                    className="mt-0.5 h-7 text-xs"
                    type="number"
                    min={0}
                    step="0.1"
                    value={row.unit_weight}
                    onChange={(e) => updateRow(idx, "unit_weight", e.target.value)}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        <DialogFooter className="mt-2">
          <Button variant="outline" onClick={handleClose} disabled={importMutation.isPending}>
            취소
          </Button>
          <Button
            onClick={() => importMutation.mutate()}
            disabled={importMutation.isPending || hasEmptyCode || rows.length === 0}
          >
            {importMutation.isPending && <LoadingSpinner size="sm" className="mr-1.5" />}
            {rows.length}개 등록
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
