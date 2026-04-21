import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { X, AlertTriangle } from "lucide-react";
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
import { productsApi } from "@/api/productsApi";
import { toast } from "@/hooks/use-toast";
import { formatAmount, formatIssue, formatDateTime } from "@/utils/format";
import { ProductKind } from "@/types/product";
interface ProductDetailPanelProps {
  productId: number;
  onClose: () => void;
}

export default function ProductDetailPanel({ productId, onClose }: ProductDetailPanelProps) {
  const queryClient = useQueryClient();
  const [toggleConfirm, setToggleConfirm] = useState(false);
  const [stockInput, setStockInput] = useState("");
  const [stockEditMode, setStockEditMode] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [codeChangeConfirm, setCodeChangeConfirm] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState({
    product_code: "",
    product_kind: ProductKind.YEARLY as ProductKind,
    product_name: "",
    list_price: "",
    sale_price: "",
    cost_price: "",
    external_product_code_cafe24: "",
    external_product_code_gpmall: "",
    unit_weight: "",
    unit_width: "",
    unit_length: "",
    unit_height: "",
  });

  const { data: res, isLoading } = useQuery({
    queryKey: ["product", productId],
    queryFn: () => productsApi.getProduct(productId).then((r) => r.data),
    enabled: !!productId,
  });

  const product = res?.data;

  // product_code에서 subscribe_start_issue 파싱 (백엔드 utils.py의 parse_subscribe_start_issue와 동일 로직)
  const previewStartIssue = useMemo(() => {
    const code = editForm.product_code;
    if (!code) return null;
    for (const sep of ["+", "~", "-"]) {
      if (code.includes(sep)) return code.split(sep)[1] || null;
    }
    return null;
  }, [editForm.product_code]);

  // 상품 코드 또는 종류가 원본과 다른지 여부
  const isCodeOrKindChanged =
    editMode &&
    product &&
    (editForm.product_code !== product.product_code ||
      editForm.product_kind !== product.product_kind);

  const toggleMutation = useMutation({
    mutationFn: () =>
      product?.is_active
        ? productsApi.deactivateProduct(productId)
        : productsApi.activateProduct(productId),
    onSuccess: () => {
      toast.success(product?.is_active ? "상품이 비활성화되었습니다." : "상품이 활성화되었습니다.");
      queryClient.invalidateQueries({ queryKey: ["product", productId] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      setToggleConfirm(false);
    },
    onError: () => toast.error("처리 실패"),
  });

  const updateMutation = useMutation({
    mutationFn: () =>
      productsApi.updateProduct(productId, {
        product_code: editForm.product_code || undefined,
        product_kind: editForm.product_kind || undefined,
        product_name: editForm.product_name || undefined,
        list_price: editForm.list_price ? Number(editForm.list_price) : undefined,
        sale_price: editForm.sale_price ? Number(editForm.sale_price) : undefined,
        cost_price: editForm.cost_price ? Number(editForm.cost_price) : undefined,
        external_product_code_cafe24: editForm.external_product_code_cafe24 || null,
        external_product_code_gpmall: editForm.external_product_code_gpmall || null,
        unit_weight: editForm.unit_weight ? Number(editForm.unit_weight) : null,
        unit_width: editForm.unit_width ? Number(editForm.unit_width) : null,
        unit_length: editForm.unit_length ? Number(editForm.unit_length) : null,
        unit_height: editForm.unit_height ? Number(editForm.unit_height) : null,
      }),
    onSuccess: () => {
      toast.success("상품이 수정되었습니다.");
      queryClient.invalidateQueries({ queryKey: ["product", productId] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      setEditMode(false);
    },
    onError: () => toast.error("상품 수정 실패"),
  });

  const deleteMutation = useMutation({
    mutationFn: () => productsApi.deleteProduct(productId),
    onSuccess: () => {
      toast.success("상품이 삭제되었습니다.");
      queryClient.invalidateQueries({ queryKey: ["products"] });
      onClose();
    },
    onError: () => toast.error("상품 삭제 실패"),
  });

  const stockMutation = useMutation({
    mutationFn: (qty: number) => productsApi.updateStock(productId, { stock_quantity: qty }),
    onSuccess: () => {
      toast.success("재고가 수정되었습니다.");
      queryClient.invalidateQueries({ queryKey: ["product", productId] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      setStockEditMode(false);
      setStockInput("");
    },
    onError: () => toast.error("재고 수정 실패"),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-gray-400">
        상품 정보를 불러올 수 없습니다.
      </div>
    );
  }

  const handleStockSave = () => {
    const qty = parseInt(stockInput, 10);
    if (isNaN(qty) || qty < 0) {
      toast.error("올바른 재고 수량을 입력해주세요.");
      return;
    }
    stockMutation.mutate(qty);
  };

  return (
    <div className="flex flex-col h-full">
      {/* 패널 헤더 */}
      <div className="px-5 py-4 border-b border-gray-200 bg-white">
        <div className="flex items-start justify-between mb-3">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 mb-1">
              <StatusBadge type="product_kind" value={product.product_kind} />
              {!product.is_active && (
                <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">비활성</span>
              )}
            </div>
            <div className="font-semibold text-gray-900 text-base leading-tight">{product.product_name}</div>
            <div className="text-xs text-gray-400 font-mono mt-0.5">{product.product_code}</div>
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
              if (!editMode) {
                setEditForm({
                  product_code: product.product_code,
                  product_kind: product.product_kind as ProductKind,
                  product_name: product.product_name,
                  list_price: String(product.list_price),
                  sale_price: String(product.sale_price),
                  cost_price: String(product.cost_price),
                  external_product_code_cafe24: product.external_product_code_cafe24 ?? "",
                  external_product_code_gpmall: product.external_product_code_gpmall ?? "",
                  unit_weight: product.unit_weight != null ? String(product.unit_weight) : "",
                  unit_width: product.unit_width != null ? String(product.unit_width) : "",
                  unit_length: product.unit_length != null ? String(product.unit_length) : "",
                  unit_height: product.unit_height != null ? String(product.unit_height) : "",
                });
              }
              setEditMode(!editMode);
            }}
            className={editMode ? "bg-blue-50 border-blue-300 text-blue-700" : ""}
          >
            {editMode ? "취소" : "수정"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setToggleConfirm(true)}
            className={
              product.is_active
                ? "text-amber-600 border-amber-200 hover:bg-amber-50"
                : ""
            }
          >
            {product.is_active ? "비활성화" : "활성화"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setStockInput(String(product.stock_quantity));
              setStockEditMode(true);
            }}
          >
            재고 수정
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDeleteConfirm(true)}
            className="text-red-600 border-red-200 hover:bg-red-50"
          >
            삭제
          </Button>
        </div>
      </div>

      {/* 상세 정보 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {/* 상품 수정 폼 */}
        {editMode && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold text-blue-700">상품 수정</div>
              {isCodeOrKindChanged && (
                <div className="flex items-center gap-1 text-[11px] text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                  <AlertTriangle className="h-3 w-3" />
                  코드/종류 변경됨 — 저장 시 확인 필요
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs text-gray-600">상품 코드</Label>
                <Input className="mt-1 h-8 text-sm font-mono" value={editForm.product_code}
                  onChange={(e) => setEditForm((f) => ({ ...f, product_code: e.target.value }))} />
                {/* 시작호 실시간 미리보기 */}
                {editForm.product_code && (
                  <p className="mt-1 text-[11px] text-gray-500">
                    시작호:{" "}
                    <span className={`font-medium ${
                      previewStartIssue && previewStartIssue !== product?.subscribe_start_issue
                        ? "text-amber-600"
                        : "text-gray-700"
                    }`}>
                      {previewStartIssue
                        ? `${previewStartIssue}${previewStartIssue !== product?.subscribe_start_issue ? " (변경됨)" : ""}`
                        : "파싱 불가"}
                    </span>
                  </p>
                )}
              </div>
              <div>
                <Label className="text-xs text-gray-600">상품 종류</Label>
                <Select value={editForm.product_kind} onValueChange={(v) => setEditForm((f) => ({ ...f, product_kind: v as ProductKind }))}>
                  <SelectTrigger className="mt-1 h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="YEARLY">정기구독</SelectItem>
                    <SelectItem value="MONTHLY">단품</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-xs text-gray-600">상품명</Label>
              <Input className="mt-1 h-8 text-sm" value={editForm.product_name}
                onChange={(e) => setEditForm((f) => ({ ...f, product_name: e.target.value }))} />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label className="text-xs text-gray-600">정가</Label>
                <Input className="mt-1 h-8 text-sm" type="number" min={0} value={editForm.list_price}
                  onChange={(e) => setEditForm((f) => ({ ...f, list_price: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs text-gray-600">판매가</Label>
                <Input className="mt-1 h-8 text-sm" type="number" min={0} value={editForm.sale_price}
                  onChange={(e) => setEditForm((f) => ({ ...f, sale_price: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs text-gray-600">원가</Label>
                <Input className="mt-1 h-8 text-sm" type="number" min={0} value={editForm.cost_price}
                  onChange={(e) => setEditForm((f) => ({ ...f, cost_price: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs text-gray-600">카페24 상품코드</Label>
                <Input className="mt-1 h-8 text-sm font-mono" value={editForm.external_product_code_cafe24}
                  onChange={(e) => setEditForm((f) => ({ ...f, external_product_code_cafe24: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs text-gray-600">갓피플몰 상품코드</Label>
                <Input className="mt-1 h-8 text-sm font-mono" value={editForm.external_product_code_gpmall}
                  onChange={(e) => setEditForm((f) => ({ ...f, external_product_code_gpmall: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-4 gap-2">
              <div>
                <Label className="text-xs text-gray-600">무게 (kg)</Label>
                <Input className="mt-1 h-8 text-sm" type="number" min={0} step="0.1" value={editForm.unit_weight}
                  onChange={(e) => setEditForm((f) => ({ ...f, unit_weight: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs text-gray-600">가로 (mm)</Label>
                <Input className="mt-1 h-8 text-sm" type="number" min={0} step="0.1" value={editForm.unit_width}
                  onChange={(e) => setEditForm((f) => ({ ...f, unit_width: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs text-gray-600">세로 (mm)</Label>
                <Input className="mt-1 h-8 text-sm" type="number" min={0} step="0.1" value={editForm.unit_length}
                  onChange={(e) => setEditForm((f) => ({ ...f, unit_length: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs text-gray-600">높이 (mm)</Label>
                <Input className="mt-1 h-8 text-sm" type="number" min={0} step="0.1" value={editForm.unit_height}
                  onChange={(e) => setEditForm((f) => ({ ...f, unit_height: e.target.value }))} />
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => {
                  // 상품 코드 또는 종류 변경 시 경고 모달 먼저 표시
                  if (isCodeOrKindChanged) {
                    setCodeChangeConfirm(true);
                  } else {
                    updateMutation.mutate();
                  }
                }}
                disabled={updateMutation.isPending}
              >
                {updateMutation.isPending && <LoadingSpinner size="sm" className="mr-1" />}
                저장
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditMode(false)}>취소</Button>
            </div>
          </div>
        )}

        {/* 재고 수정 폼 */}
        {stockEditMode && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3.5">
            <div className="text-xs font-semibold text-blue-700 mb-2">재고 수정</div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                className="h-8 px-2 text-sm border border-gray-300 rounded-md w-28 focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={stockInput}
                onChange={(e) => setStockInput(e.target.value)}
                placeholder="수량 입력"
              />
              <Button size="sm" onClick={handleStockSave} disabled={stockMutation.isPending}>
                저장
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => { setStockEditMode(false); setStockInput(""); }}
              >
                취소
              </Button>
            </div>
          </div>
        )}

        {/* 가격 정보 */}
        <Section title="가격">
          <InfoRow label="정가" value={formatAmount(product.list_price)} />
          <InfoRow label="판매가" value={
            <span className="font-semibold text-gray-900">{formatAmount(product.sale_price)}</span>
          } />
          <InfoRow label="원가" value={formatAmount(product.cost_price)} />
        </Section>

        {/* 재고 */}
        <Section title="재고">
          <InfoRow
            label="현재 재고"
            value={
              <span className={product.stock_quantity <= 0 ? "text-red-500 font-medium" : ""}>
                {product.stock_quantity.toLocaleString()}개
              </span>
            }
          />
        </Section>

        {/* 구독 정보 (YEARLY) */}
        {product.product_kind === "YEARLY" && product.subscribe_start_issue && (
          <Section title="구독 정보">
            <InfoRow label="시작호" value={formatIssue(product.subscribe_start_issue)} />
          </Section>
        )}

        {/* 물리 정보 */}
        {!!(Number(product.unit_weight) || Number(product.unit_width) || Number(product.unit_length) || Number(product.unit_height)) && (
          <Section title="물리 정보">
            {Number(product.unit_weight) > 0 && (
              <InfoRow label="무게" value={`${product.unit_weight}kg`} />
            )}
            {Number(product.unit_width) > 0 && (
              <InfoRow label="가로" value={`${product.unit_width}mm`} />
            )}
            {Number(product.unit_length) > 0 && (
              <InfoRow label="세로" value={`${product.unit_length}mm`} />
            )}
            {Number(product.unit_height) > 0 && (
              <InfoRow label="높이" value={`${product.unit_height}mm`} />
            )}
          </Section>
        )}

        {/* 외부 연동 */}
        {(product.external_product_code_cafe24 || product.external_product_code_gpmall) && (
          <Section title="외부 연동">
            {product.external_product_code_cafe24 && (
              <InfoRow label="카페24 상품코드" value={
                <span className="font-mono text-xs">{product.external_product_code_cafe24}</span>
              } />
            )}
            {product.external_product_code_gpmall && (
              <InfoRow label="갓피플몰 상품코드" value={
                <span className="font-mono text-xs">{product.external_product_code_gpmall}</span>
              } />
            )}
          </Section>
        )}

        {/* 시스템 */}
        <Section title="시스템">
          <InfoRow label="등록일" value={formatDateTime(product.created_at)} />
          <InfoRow label="수정일" value={formatDateTime(product.updated_at)} />
        </Section>
      </div>

      {/* 삭제 확인 모달 */}
      <ConfirmModal
        open={deleteConfirm}
        onClose={() => setDeleteConfirm(false)}
        onConfirm={() => deleteMutation.mutate()}
        title="상품 삭제"
        description={`"${product.product_name}" 상품을 삭제합니다.`}
        confirmLabel="삭제"
        variant="destructive"
        isLoading={deleteMutation.isPending}
      />

      {/* 활성/비활성 확인 모달 */}
      <ConfirmModal
        open={toggleConfirm}
        onClose={() => setToggleConfirm(false)}
        onConfirm={() => toggleMutation.mutate()}
        title={product.is_active ? "상품 비활성화" : "상품 활성화"}
        description={
          product.is_active
            ? "이 상품을 비활성화합니다. 비활성 상품은 신규 주문에서 선택되지 않습니다."
            : "이 상품을 활성화합니다."
        }
        confirmLabel={product.is_active ? "비활성화" : "활성화"}
        variant={product.is_active ? "destructive" : "default"}
        isLoading={toggleMutation.isPending}
      />

      {/* 상품 코드/종류 변경 경고 모달 */}
      <ConfirmModal
        open={codeChangeConfirm}
        onClose={() => setCodeChangeConfirm(false)}
        onConfirm={() => {
          setCodeChangeConfirm(false);
          updateMutation.mutate();
        }}
        title="상품 코드 / 종류 변경 확인"
        description={
          `상품 코드 또는 종류를 변경하면 ` +
          `OrderItem·SendItem 등 연결된 데이터의 스냅샷과 불일치가 발생할 수 있습니다.\n\n` +
          (previewStartIssue
            ? `변경 후 시작호: ${previewStartIssue}${previewStartIssue !== product.subscribe_start_issue ? ` (기존: ${product.subscribe_start_issue ?? "-"})` : ""}`
            : "")
        }
        confirmLabel="변경 저장"
        variant="destructive"
        isLoading={updateMutation.isPending}
      />
    </div>
  );
}

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

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  if (!value && value !== 0) return null;
  return (
    <div className="flex items-start gap-3">
      <span className="text-xs text-gray-400 w-24 flex-shrink-0 pt-0.5">{label}</span>
      <span className="text-sm text-gray-700 flex-1">{value}</span>
    </div>
  );
}
