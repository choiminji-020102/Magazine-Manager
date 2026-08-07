import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { ConfirmModal } from "@/components/common/ConfirmModal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { dispatchApi } from "@/api/dispatchApi";
import { toast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/utils/errorHandler";
import { formatMissingIssues } from "@/utils/format";
import type { PreviewSkippedIssuesResponse } from "@/types/dispatch";

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess?: (created: number) => void;
}

// 정기(YEARLY) 신규 결제 추가 — incremental.
// 기존 PREPARING 박스는 건드리지 않고, PAID + 호 범위 + 발송 내역 없는 OrderItem 만 박스 추가 생성.
// 정기는 1 OrderItem = 1 박스 매핑이라 묶음 재계산 불필요.
export default function AddToPreparingYearlyModal({
  open,
  onClose,
  onSuccess,
}: Props) {
  const [issue, setIssue] = useState("");
  const [issueError, setIssueError] = useState(false);
  const [preview, setPreview] = useState<PreviewSkippedIssuesResponse | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setIssue("");
      setIssueError(false);
      setPreview(null);
      setPreviewLoading(false);
    }
  }, [open]);

  // issue 6자리 입력 시 debounce 후 순차 위반 미리보기 요청 (정기 신규 결제 추가도
  // 동일하게 그룹핑 통과 후보 OrderItem 을 검사한다 — scope=yearly 로 호출)
  useEffect(() => {
    if (!open) return;
    if (!/^\d{6}$/.test(issue)) {
      setPreview(null);
      setPreviewLoading(false);
      return;
    }
    setPreview(null);
    setPreviewLoading(true);
    const timer = setTimeout(() => {
      dispatchApi
        .previewSkippedIssues({ scope: "yearly", issue })
        .then((r) => setPreview(r.data.data ?? null))
        .catch(() => setPreview(null))
        .finally(() => setPreviewLoading(false));
    }, 400);
    return () => {
      clearTimeout(timer);
      setPreviewLoading(false);
    };
  }, [open, issue]);

  const hasViolations = !!preview && preview.violation_count > 0;

  const mutation = useMutation({
    mutationFn: () =>
      dispatchApi.addToPreparingYearly({ issue }).then((r) => r.data.data!),
    onSuccess: (data) => {
      if (data.created_count === 0) {
        toast.info(
          "추가할 새 결제가 없어요. 발송 목록에 모두 있거나, 입력하신 호가 구독 기간 밖일 수 있어요.",
        );
      } else {
        toast.success(`새 정기구독 ${data.created_count}건을 발송 목록에 추가했어요`);
      }
      onSuccess?.(data.created_count);
      onClose();
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const handleConfirm = () => {
    if (!/^\d{6}$/.test(issue)) {
      setIssueError(true);
      toast.error("발송 호를 YYYYMM 6자리로 입력해주세요.");
      return;
    }
    mutation.mutate();
  };

  return (
    <ConfirmModal
      open={open}
      onClose={() => {
        if (!mutation.isPending) onClose();
      }}
      onConfirm={handleConfirm}
      title="[발송 생성] 정기구독"
      description={
        <div className="space-y-3">
          <p>
            <span className="font-medium text-gray-900">발송 목록</span>에 아직 없는 새 정기구독
            결제를 추가해요.
            <br />
            결제 완료된 주문만 가져오고, 휴지·해외·이미 발송한 호는 빠집니다.
          </p>
          <div>
            <Label className={`text-xs ${issueError ? "text-red-500" : "text-gray-600"}`}>
              발송 호 (YYYYMM) <span className="text-red-500 ml-0.5">*</span>
            </Label>
            <Input
              className={`mt-1 h-8 w-32 font-mono ${issueError ? "border-red-500" : ""}`}
              placeholder="YYYYMM"
              value={issue}
              maxLength={6}
              onChange={(e) => {
                setIssue(e.target.value.replace(/\D/g, ""));
                setIssueError(false);
              }}
            />
            {issueError && (
              <p className="text-xs text-red-500 mt-1">발송 호를 6자리로 입력해주세요.</p>
            )}
          </div>
          {previewLoading && (
            <p className="text-xs text-gray-500">순차 발송 여부 확인 중…</p>
          )}
          {hasViolations && preview && (
            <div className="rounded-md border border-amber-300 bg-amber-50 p-3 space-y-1.5">
              <p className="text-sm font-medium text-amber-900">
                ⚠️ 순차 발송이 아닌 항목 {preview.violation_count}건
              </p>
              <ul className="text-xs text-amber-800 space-y-0.5 list-disc pl-4">
                {preview.samples.map((s) => (
                  <li key={s.order_item_id}>
                    <span className="font-mono">{s.product_code}</span> {s.recipient_name} (
                    {formatMissingIssues(s.missing_issues)} 누락)
                  </li>
                ))}
                {preview.violation_count > preview.samples.length && (
                  <li className="text-amber-700/80">
                    … 외 {preview.violation_count - preview.samples.length}건
                  </li>
                )}
              </ul>
              <p className="text-xs text-amber-700">
                이번에 추가하면 누락된 호는 영구히 다시 보낼 수 없어요.
              </p>
            </div>
          )}
          <p className="text-xs text-gray-500">기존 발송과 메모는 그대로 유지됩니다.</p>
        </div>
      }
      confirmLabel={hasViolations ? "그래도 추가하기" : "추가하기"}
      isLoading={mutation.isPending}
    />
  );
}
