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
import { getErrorMessage } from "@/utils/errorHandler";
import { formatIssueShort } from "@/utils/format";
import type { VipExcelCandidate } from "@/types/dispatchExcel";

interface VipExcelDialogProps {
  open: boolean;
  onClose: () => void;
  slotNumber: number;       // 1~6
  slotLabel?: string | null;
  onSuccess?: () => void;
}

function todayYYYYMMDD(): string {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
}

const columns: ColumnDef<VipExcelCandidate>[] = [
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
        <div className="text-xs text-gray-500 font-mono flex items-center gap-1">
          {r.country_code !== "KR" && (
            <span className="px-1 py-0.5 bg-amber-100 text-amber-700 rounded text-[10px] font-semibold">
              🌐 {r.country_code}
            </span>
          )}
          <span>{r.postal_code}</span>
        </div>
        <div className="text-sm">{r.recipient_address}</div>
      </div>
    ),
  },
  {
    key: "product",
    header: "상품",
    cell: (r) => (
      <div className="space-y-0.5">
        {r.items.map((it) => (
          <div key={it.send_item_id} className="flex items-center justify-center h-6">
            <span
              className={`text-xs px-1.5 py-0.5 rounded ${
                it.product_kind === "YEARLY"
                  ? "bg-purple-50 text-purple-700"
                  : "bg-sky-50 text-sky-700"
              }`}
              title={`${it.product_kind === "YEARLY" ? "정기" : "단품"} · ${it.product_code}`}
            >
              {it.display_product_name}
            </span>
          </div>
        ))}
      </div>
    ),
    width: "w-28",
    className: "text-center",
    headerClassName: "text-center",
  },
  {
    key: "issue",
    header: "발행호",
    cell: (r) => (
      <div className="space-y-0.5">
        {r.items.map((it) => (
          <div
            key={it.send_item_id}
            className="flex items-center h-6 text-sm font-medium text-gray-700"
          >
            {formatIssueShort(it.issue)}
          </div>
        ))}
      </div>
    ),
    width: "w-28",
  },
  {
    key: "num",
    header: "수량",
    cell: (r) => (
      <div className="space-y-0.5">
        {r.items.map((it) => (
          <div
            key={it.send_item_id}
            className="flex items-center justify-center h-6 text-sm font-medium"
          >
            {it.send_num}
          </div>
        ))}
      </div>
    ),
    width: "w-16",
    className: "text-center",
    headerClassName: "text-center",
  },
];

export default function VipExcelDialog({
  open,
  onClose,
  slotNumber,
  slotLabel,
  onSuccess,
}: VipExcelDialogProps) {
  // VIP 엑셀은 단품 엑셀과 동일하게 호 무관 — 발송 생성 단계에서 정기는 이미 issue 검증됨
  const [postalCode, setPostalCode] = useState("");
  const [sendDate, setSendDate] = useState(todayYYYYMMDD());
  const [searchTriggered, setSearchTriggered] = useState(false);
  const [searchParams, setSearchParams] = useState<{ postal_code: string | null }>({
    postal_code: null,
  });
  const [selectedIds, setSelectedIds] = useState<Set<string | number>>(new Set());
  const [downloading, setDownloading] = useState(false);

  // 다이얼로그 오픈 시 입력 초기화
  useEffect(() => {
    if (open) {
      setPostalCode("");
      setSendDate(todayYYYYMMDD());
      setSearchTriggered(false);
      setSearchParams({ postal_code: null });
      setSelectedIds(new Set());
    }
  }, [open]);

  const { data, isFetching } = useQuery({
    queryKey: ["vip-excel-candidates", slotNumber, searchParams.postal_code],
    queryFn: () =>
      dispatchExcelApi
        .getVipCandidates(slotNumber, {
          postal_code: searchParams.postal_code,
        })
        .then((r) => r.data),
    enabled: open && searchTriggered,
  });

  const candidates: VipExcelCandidate[] = data?.data?.candidates ?? [];

  // 조회 완료 시 전체 선택으로 초기화
  useEffect(() => {
    if (data?.data?.candidates) {
      setSelectedIds(new Set(data.data.candidates.map((c) => c.send_id)));
    }
  }, [data]);

  const handleSearch = () => {
    if (!/^\d{8}$/.test(sendDate)) {
      toast.error("발송날짜를 YYYYMMDD 8자리로 입력해주세요.");
      return;
    }
    setSearchParams({ postal_code: postalCode.trim() || null });
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
      const meta = await dispatchExcelApi.downloadVipExcel(slotNumber, {
        send_ids: Array.from(selectedIds) as number[],
        send_date: sendDate,
      });
      toast.success(`엑셀 다운로드 완료 (${meta.includedCount}건)`);
      if (meta.skippedCount > 0) {
        toast.warning(`${meta.skippedCount}건은 조건 불일치로 스킵됨`);
      }
      onSuccess?.();
      onClose();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setDownloading(false);
    }
  };

  const dialogTitle = slotLabel
    ? `VIP ${slotNumber} (${slotLabel}) 일반우편 엑셀 다운로드`
    : `VIP ${slotNumber} 일반우편 엑셀 다운로드`;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o && !downloading) onClose();
      }}
    >
        <DialogContent className="max-w-5xl max-h-[92vh] flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{dialogTitle}</DialogTitle>
            <p className="text-xs text-gray-500 mt-1">
              선택된 PREPARING 박스를 엑셀로 출력합니다. 박스 상태는 유지되며, 발송 완료 처리는
              별도 [발송 완료 처리] 단계에서 진행합니다. 한 박스에 정기·단품이 섞여 있을 수 있어
              비고 컬럼에 구분 표시됩니다.
            </p>
          </DialogHeader>

          {/* 필터 영역 (단품 엑셀과 동일 — 호 무관) */}
          <div className="flex flex-wrap items-end gap-3 pb-3 border-b border-gray-100">
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
              <span className="text-gray-400">박스 상태는 변경되지 않습니다.</span>
            </div>
          )}

          <DialogFooter>
            <Button variant="ghost" onClick={onClose} disabled={downloading}>
              닫기
            </Button>
            <Button
              onClick={handleDownload}
              disabled={selectedIds.size === 0 || downloading || !searchTriggered}
            >
              {downloading && <LoadingSpinner size="sm" className="mr-1" />}
              <Download className="h-4 w-4 mr-1" />
              다운로드 ({selectedIds.size}건)
            </Button>
          </DialogFooter>
        </DialogContent>
    </Dialog>
  );
}
