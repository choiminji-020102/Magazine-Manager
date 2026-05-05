import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DataTable, type ColumnDef } from "@/components/common/DataTable";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";

import { dispatchExcelApi } from "@/api/dispatchExcelApi";
import { toast } from "@/hooks/use-toast";
import { formatIssue } from "@/utils/format";
import { getErrorMessage } from "@/utils/errorHandler";
import type { YearlyExcelCandidate } from "@/types/dispatchExcel";

type YearlyExcelVariant = "gichulyu" | "postoffice";

interface YearlyExcelDialogProps {
  open: boolean;
  onClose: () => void;
  issue: string;
  variant: YearlyExcelVariant;
  onSuccess?: () => void;
}

const PREFIX_OPTIONS: Record<YearlyExcelVariant, { value: string; label: string }[]> = {
  gichulyu: [
    { value: "W0", label: "기본판 (W0)" },
    { value: "WB", label: "큰글자 (WB)" },
  ],
  postoffice: [
    { value: "HN", label: "꿀땅 (HN)" },
    { value: "CL", label: "저학년 (CL)" },
    { value: "CH", label: "고학년 (CH)" },
    { value: "JN", label: "청소년 (JN)" },
  ],
};

const VARIANT_TITLE: Record<YearlyExcelVariant, string> = {
  gichulyu: "기출유 정기구독 엑셀 (말씀함께)",
  postoffice: "우체국 정기구독 엑셀 (청소년이하)",
};

const VARIANT_COURIER: Record<YearlyExcelVariant, string> = {
  gichulyu: "기출유우편",
  postoffice: "일반우편",
};

const VARIANT_DESCRIPTION: Record<YearlyExcelVariant, string> = {
  gichulyu:
    "기본판(W0) / 큰글자(WB) 2개 시트로 생성. 다운로드 즉시 기출유우편 상태로 전환됩니다.",
  postoffice:
    "꿀땅/저학년/고학년/청소년 1개 시트로 생성. 다운로드 즉시 일반우편 상태로 전환됩니다.",
};

const columns: ColumnDef<YearlyExcelCandidate>[] = [
  {
    key: "send_id",
    header: "발송ID",
    cell: (r) => (
      <span className="font-mono text-xs text-gray-400">#{r.send_id}</span>
    ),
    width: "w-20",
  },
  {
    key: "recipient",
    header: "수령인",
    cell: (r) => (
      <div>
        <div className="text-sm">{r.recipient_name}</div>
        <div className="text-xs text-gray-500">{r.recipient_phone}</div>
      </div>
    ),
    width: "w-36",
  },
  {
    key: "address",
    header: "배송지",
    cell: (r) => (
      <div>
        <div className="text-xs text-gray-500 font-mono">{r.postal_code}</div>
        <div className="text-sm">{r.recipient_address}</div>
      </div>
    ),
  },
  {
    key: "product",
    header: "상품",
    cell: (r) => (
      <span className="text-xs px-1.5 py-0.5 bg-purple-50 text-purple-700 rounded">
        {r.display_product_name}
      </span>
    ),
    width: "w-24",
  },
  {
    key: "period",
    header: "구독기간",
    cell: (r) => (
      <div>
        <div className="text-xs text-gray-500">시작: {r.start_label}</div>
        <div className="text-sm">{r.period_label}</div>
      </div>
    ),
    width: "w-52",
  },
  {
    key: "num",
    header: "수량",
    cell: (r) => <span className="text-sm font-medium">{r.send_num}</span>,
    width: "w-16",
  },
];

export default function YearlyExcelDialog({
  open,
  onClose,
  issue,
  variant,
  onSuccess,
}: YearlyExcelDialogProps) {
  const prefixOptions = PREFIX_OPTIONS[variant];
  const allPrefixes = useMemo(() => prefixOptions.map((o) => o.value), [prefixOptions]);

  const [postalCode, setPostalCode] = useState("");
  const [selectedPrefixes, setSelectedPrefixes] = useState<Set<string>>(new Set(allPrefixes));
  const [searchTriggered, setSearchTriggered] = useState(false);
  const [searchParams, setSearchParams] = useState<{
    issue: string;
    postal_code: string | null;
    product_codes: string | null;
  }>({
    issue,
    postal_code: null,
    product_codes: null,
  });
  const [selectedIds, setSelectedIds] = useState<Set<string | number>>(new Set());
  const [downloading, setDownloading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // 다이얼로그가 열리는 시점에 최신 props(issue/variant)를 기준으로 초기화
  useEffect(() => {
    if (open) {
      setPostalCode("");
      setSelectedPrefixes(new Set(allPrefixes));
      setSearchTriggered(false);
      setSearchParams({ issue, postal_code: null, product_codes: null });
      setSelectedIds(new Set());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const fetcher =
    variant === "gichulyu"
      ? dispatchExcelApi.getYearlyGichulyuCandidates
      : dispatchExcelApi.getYearlyPostofficeCandidates;

  const { data, isFetching } = useQuery({
    queryKey: [
      "yearly-excel-candidates",
      variant,
      searchParams.issue,
      searchParams.postal_code,
      searchParams.product_codes,
    ],
    queryFn: () =>
      fetcher({
        issue: searchParams.issue,
        postal_code: searchParams.postal_code,
        product_codes: searchParams.product_codes,
      }).then((r) => r.data),
    enabled: open && searchTriggered && searchParams.issue.length === 6,
  });

  const candidates: YearlyExcelCandidate[] = data?.data?.candidates ?? [];

  useEffect(() => {
    if (data?.data?.candidates) {
      setSelectedIds(new Set(data.data.candidates.map((c) => c.send_id)));
    }
  }, [data]);

  const togglePrefix = (prefix: string) => {
    setSelectedPrefixes((prev) => {
      const next = new Set(prev);
      if (next.has(prefix)) next.delete(prefix);
      else next.add(prefix);
      return next;
    });
  };

  const handleSearch = () => {
    if (!issue || issue.length !== 6) {
      toast.error("발송 호가 올바르지 않습니다. (YYYYMM)");
      return;
    }
    if (selectedPrefixes.size === 0) {
      toast.error("최소 1개 이상의 상품을 선택해주세요.");
      return;
    }
    const productCodes =
      selectedPrefixes.size === allPrefixes.length
        ? null
        : Array.from(selectedPrefixes).join(",");
    setSearchParams({
      issue,
      postal_code: postalCode.trim() || null,
      product_codes: productCodes,
    });
    setSearchTriggered(true);
  };

  const handleDownload = async () => {
    if (selectedIds.size === 0) {
      toast.error("선택된 발송이 없습니다.");
      return;
    }
    setDownloading(true);
    try {
      const downloader =
        variant === "gichulyu"
          ? dispatchExcelApi.downloadYearlyGichulyu
          : dispatchExcelApi.downloadYearlyPostoffice;
      const meta = await downloader({
        send_ids: Array.from(selectedIds) as number[],
        issue,
      });
      toast.success(`엑셀 다운로드 완료 (${meta.includedCount}건)`);
      if (meta.skippedCount > 0) {
        toast.warning(`${meta.skippedCount}건은 조건 불일치로 스킵됨`);
      }
      onSuccess?.();
      setConfirmOpen(false);
      onClose();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setDownloading(false);
    }
  };

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(o) => {
          if (!o && !downloading) onClose();
        }}
      >
        <DialogContent className="max-w-5xl max-h-[92vh] flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{VARIANT_TITLE[variant]}</DialogTitle>
            <p className="text-xs text-gray-500 mt-1">{VARIANT_DESCRIPTION[variant]}</p>
          </DialogHeader>

          {/* 필터 영역 */}
          <div className="flex flex-wrap items-end gap-3 pb-3 border-b border-gray-100">
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-gray-500">발송 호</Label>
              <div className="h-9 px-3 flex items-center bg-gray-50 rounded-md border border-gray-200 text-sm font-medium text-gray-900 min-w-[120px]">
                {issue.length === 6 ? formatIssue(issue) : "-"}
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-gray-500">우편번호 필터 (선택)</Label>
              <Input
                className="w-36"
                placeholder="전체"
                value={postalCode}
                maxLength={6}
                onChange={(e) => setPostalCode(e.target.value.replace(/\D/g, ""))}
              />
            </div>
            <div className="flex flex-col gap-1 flex-1 min-w-[240px]">
              <Label className="text-xs text-gray-500">상품 필터</Label>
              <div className="flex flex-wrap gap-3 h-9 items-center">
                {prefixOptions.map((opt) => (
                  <label
                    key={opt.value}
                    className="flex items-center gap-1.5 cursor-pointer select-none"
                  >
                    <Checkbox
                      checked={selectedPrefixes.has(opt.value)}
                      onCheckedChange={() => togglePrefix(opt.value)}
                    />
                    <span className="text-xs text-gray-700">{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>
            <Button size="sm" className="h-9" onClick={handleSearch} disabled={isFetching}>
              {isFetching && <LoadingSpinner size="sm" className="mr-1" />}
              대상 조회
            </Button>
          </div>

          {/* 후보 테이블 */}
          <div className="flex-1 min-h-[280px] max-h-[460px] overflow-y-auto border border-gray-200 rounded">
            {!searchTriggered ? (
              <div className="flex items-center justify-center h-60 text-sm text-gray-400">
                위의 [대상 조회] 버튼을 눌러 발송 후보를 불러오세요.
              </div>
            ) : (
              <DataTable
                columns={columns}
                data={candidates}
                getRowId={(r) => r.send_id}
                isLoading={isFetching}
                emptyMessage="조건에 맞는 발송 후보가 없습니다."
                selectedIds={selectedIds}
                onSelectionChange={setSelectedIds}
              />
            )}
          </div>

          {searchTriggered && candidates.length > 0 && (
            <div className="flex items-center justify-between text-xs text-gray-500 flex-shrink-0">
              <span>
                전체 <span className="font-semibold text-gray-900">{candidates.length}</span>건 중{" "}
                <span className="font-semibold text-blue-700">{selectedIds.size}</span>건 선택됨
              </span>
              <span className="text-amber-700">
                ⚠ 다운로드 즉시 배송중(SHIPPING) 전환 · 체크 해제된 건은 전환되지 않음
              </span>
            </div>
          )}

          <DialogFooter>
            <Button variant="ghost" onClick={onClose} disabled={downloading}>
              닫기
            </Button>
            <Button
              onClick={() => setConfirmOpen(true)}
              disabled={selectedIds.size === 0 || downloading || !searchTriggered}
            >
              <Download className="h-4 w-4 mr-1" />
              다운로드 ({selectedIds.size}건)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={confirmOpen}
        onOpenChange={(o) => {
          if (!downloading) setConfirmOpen(o);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>다운로드 확인</DialogTitle>
          </DialogHeader>
          <div className="py-2 text-sm text-gray-700 space-y-2">
            <p>
              선택된 <span className="font-semibold text-gray-900">{selectedIds.size}건</span>을{" "}
              {variant === "gichulyu" ? "기출유 정기구독" : "우체국 정기구독"} 엑셀로 다운로드합니다.
            </p>
            <p className="text-amber-700">
              다운로드 직후 이 발송들은{" "}
              <span className="font-semibold">배송중({VARIANT_COURIER[variant]})</span> 상태로
              전환됩니다. 계속 진행하시겠습니까?
            </p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmOpen(false)} disabled={downloading}>
              취소
            </Button>
            <Button onClick={handleDownload} disabled={downloading}>
              {downloading && <LoadingSpinner size="sm" className="mr-1" />}
              다운로드 진행
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
