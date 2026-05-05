import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";
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
import type { MonthlyExcelCandidate } from "@/types/dispatchExcel";

interface MonthlyExcelDialogProps {
  open: boolean;
  onClose: () => void;
  issue: string;
  onSuccess?: () => void;
}

function todayYYYYMMDD(): string {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
}

const columns: ColumnDef<MonthlyExcelCandidate>[] = [
  {
    key: "send_id",
    header: "발송ID",
    cell: (r) => <span className="font-mono text-xs text-gray-400">#{r.send_id}</span>,
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
    key: "products",
    header: "상품 / 수량",
    cell: (r) => (
      <div className="flex flex-wrap gap-1">
        {r.items.map((it) => (
          <span
            key={it.send_item_id}
            className="text-xs px-1.5 py-0.5 bg-sky-50 text-sky-700 rounded"
          >
            {it.column_label} × {it.send_num}
          </span>
        ))}
      </div>
    ),
    width: "w-64",
  },
];

export default function MonthlyExcelDialog({
  open,
  onClose,
  issue,
  onSuccess,
}: MonthlyExcelDialogProps) {
  const [postalCode, setPostalCode] = useState("");
  const [sendDate, setSendDate] = useState(todayYYYYMMDD());
  const [searchTriggered, setSearchTriggered] = useState(false);
  const [searchParams, setSearchParams] = useState<{ issue: string; postal_code: string | null }>({
    issue,
    postal_code: null,
  });
  const [selectedIds, setSelectedIds] = useState<Set<string | number>>(new Set());
  const [downloading, setDownloading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // 다이얼로그가 열리는 시점에 최신 issue/오늘 날짜 기준으로 초기화
  // open=true 이후 부모의 issue가 바뀌면 다이얼로그 내 [대상 조회] 누를 때 최신 issue가 반영됨
  useEffect(() => {
    if (open) {
      setPostalCode("");
      setSendDate(todayYYYYMMDD());
      setSearchTriggered(false);
      setSearchParams({ issue, postal_code: null });
      setSelectedIds(new Set());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const { data, isFetching } = useQuery({
    queryKey: ["monthly-excel-candidates", searchParams.issue, searchParams.postal_code],
    queryFn: () =>
      dispatchExcelApi
        .getMonthlyCandidates({
          issue: searchParams.issue,
          postal_code: searchParams.postal_code,
        })
        .then((r) => r.data),
    enabled: open && searchTriggered && searchParams.issue.length === 6,
  });

  const candidates: MonthlyExcelCandidate[] = data?.data?.candidates ?? [];

  // 조회 완료 시 전체 선택으로 초기화
  useEffect(() => {
    if (data?.data?.candidates) {
      setSelectedIds(new Set(data.data.candidates.map((c) => c.send_id)));
    }
  }, [data]);

  const handleSearch = () => {
    if (!issue || issue.length !== 6) {
      toast.error("발송 호가 올바르지 않습니다. (YYYYMM)");
      return;
    }
    if (!/^\d{8}$/.test(sendDate)) {
      toast.error("발송날짜를 YYYYMMDD 8자리로 입력해주세요.");
      return;
    }
    setSearchParams({ issue, postal_code: postalCode.trim() || null });
    setSearchTriggered(true);
  };

  const handleDownload = async () => {
    if (selectedIds.size === 0) {
      toast.error("선택된 발송이 없습니다.");
      return;
    }
    if (!/^\d{8}$/.test(sendDate)) {
      toast.error("발송날짜를 YYYYMMDD 8자리로 입력해주세요.");
      return;
    }
    setDownloading(true);
    try {
      const meta = await dispatchExcelApi.downloadMonthly({
        send_ids: Array.from(selectedIds) as number[],
        send_date: sendDate,
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
            <DialogTitle>기출유 단품 엑셀 다운로드</DialogTitle>
            <p className="text-xs text-gray-500 mt-1">
              다운로드 즉시 선택된 발송이 <span className="font-medium">배송중(CJ대한통운)</span>으로
              전환됩니다. 체크 해제된 건은 유지됩니다.
            </p>
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
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-gray-500">
                발송날짜 <span className="text-red-500 ml-0.5">*</span>
              </Label>
              <Input
                type="date"
                className="w-40"
                value={
                  sendDate.length === 8
                    ? `${sendDate.slice(0, 4)}-${sendDate.slice(4, 6)}-${sendDate.slice(6, 8)}`
                    : ""
                }
                onChange={(e) => setSendDate(e.target.value.replace(/-/g, ""))}
              />
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

      {/* 확인 모달 */}
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
              선택된 <span className="font-semibold text-gray-900">{selectedIds.size}건</span>을
              기출유 단품 엑셀로 다운로드합니다.
            </p>
            <p className="text-amber-700">
              다운로드 직후 이 발송들은{" "}
              <span className="font-semibold">배송중(CJ대한통운)</span> 상태로 전환됩니다. 계속
              진행하시겠습니까?
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
