import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { ConfirmModal } from "@/components/common/ConfirmModal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { dispatchApi } from "@/api/dispatchApi";
import { toast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/utils/errorHandler";
import type { DispatchScope, PreviewSkippedIssuesResponse } from "@/types/dispatch";
import { formatMissingIssues } from "@/utils/format";

interface Props {
  open: boolean;
  onClose: () => void;
  scope: DispatchScope;
  onSuccess?: (created: number, deleted: number) => void;
}

const SCOPE_LABEL: Record<DispatchScope, string> = {
  monthly: "단품",
  yearly: "정기구독",
  vip1: "VIP 1",
  vip2: "VIP 2",
  vip3: "VIP 3",
  vip4: "VIP 4",
  vip5: "VIP 5",
  vip6: "VIP 6",
};

// scope 별 issue 필요 여부 — monthly 만 issue 무관, 그 외(정기·VIP) 필수.
function scopeRequiresIssue(scope: DispatchScope): boolean {
  return scope !== "monthly";
}

export default function RegeneratePreparingConfirmModal({
  open,
  onClose,
  scope,
  onSuccess,
}: Props) {
  const requiresIssue = scopeRequiresIssue(scope);
  const [issue, setIssue] = useState("");
  const [issueError, setIssueError] = useState(false);
  const [preview, setPreview] = useState<PreviewSkippedIssuesResponse | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // 모달 오픈 시 입력 초기화
  useEffect(() => {
    if (open) {
      setIssue("");
      setIssueError(false);
      setPreview(null);
      setPreviewLoading(false);
    }
  }, [open]);

  // issue 6자리 입력 시 debounce 후 순차 위반 미리보기 요청
  // scope=monthly 는 호 무관이라 호출 안 함.
  useEffect(() => {
    if (!open || !requiresIssue) return;
    if (!/^\d{6}$/.test(issue)) {
      setPreview(null);
      setPreviewLoading(false);
      return;
    }
    setPreview(null);
    setPreviewLoading(true);
    const timer = setTimeout(() => {
      dispatchApi
        .previewSkippedIssues({ scope, issue })
        .then((r) => setPreview(r.data.data ?? null))
        .catch(() => setPreview(null))
        .finally(() => setPreviewLoading(false));
    }, 400);
    return () => {
      clearTimeout(timer);
      setPreviewLoading(false);
    };
  }, [open, requiresIssue, scope, issue]);

  const hasViolations = !!preview && preview.violation_count > 0;

  const mutation = useMutation({
    mutationFn: () =>
      dispatchApi
        .regeneratePreparingSends({
          scope,
          issue: requiresIssue ? issue : null,
        })
        .then((r) => r.data.data!),
    onSuccess: (data) => {
      toast.success(`발송 박스 ${data.created_count}개를 만들었어요`);
      onSuccess?.(data.created_count, data.deleted_count);
      onClose();
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const handleConfirm = () => {
    if (requiresIssue && !/^\d{6}$/.test(issue)) {
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
      title={`[발송 생성] ${SCOPE_LABEL[scope]}`}
      description={
        <div className="space-y-3">
          {scope === "monthly" ? (
            <p>
              결제 완료된 단품을 우편번호별로 묶어 발송 박스로 만들어요.
              <br />
              같은 주소에 들어갈 단품들이 한 박스에 모입니다.
            </p>
          ) : (
            <p>
              <span className="font-medium text-gray-900">{SCOPE_LABEL[scope]}</span>로 지정된
              주소의 결제를 모아 발송 박스로 만들어요.
              <br />
              결제 완료된 주문이면 정기·단품 가리지 않고 모두 포함됩니다.
            </p>
          )}
          {requiresIssue && (
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
              {issueError ? (
                <p className="text-xs text-red-500 mt-1">발송 호를 6자리로 입력해주세요.</p>
              ) : (
                <p className="text-xs text-gray-500 mt-1">
                  정기구독 책에만 적용돼요. 단품은 책 코드의 호 그대로 들어갑니다.
                </p>
              )}
            </div>
          )}
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
                이번에 발송하면 누락된 호는 영구히 다시 보낼 수 없어요.
              </p>
            </div>
          )}
          <p className="text-xs text-amber-700 leading-relaxed">
            ⚠️ 기존에 있던 박스는 새로 그려지므로, 박스에 적어둔 메모는 사라집니다.
          </p>
        </div>
      }
      confirmLabel={hasViolations ? "그래도 만들기" : "만들기"}
      isLoading={mutation.isPending}
    />
  );
}
