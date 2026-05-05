import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { ConfirmModal } from "@/components/common/ConfirmModal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { dispatchApi } from "@/api/dispatchApi";
import { toast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/utils/errorHandler";
import type { DispatchScope } from "@/types/dispatch";

interface Props {
  open: boolean;
  onClose: () => void;
  scope: DispatchScope;
  initialIssue?: string;       // 페이지의 호 입력값을 초기 노출 (yearly/vipN 시)
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
  initialIssue,
  onSuccess,
}: Props) {
  const requiresIssue = scopeRequiresIssue(scope);
  const [issue, setIssue] = useState(initialIssue ?? "");
  const [issueError, setIssueError] = useState(false);

  // 모달 오픈 시 입력 초기화 (페이지 호 입력값 반영)
  useEffect(() => {
    if (open) {
      setIssue(initialIssue ?? "");
      setIssueError(false);
    }
  }, [open, initialIssue]);

  const mutation = useMutation({
    mutationFn: () =>
      dispatchApi
        .regeneratePreparingSends({
          scope,
          issue: requiresIssue ? issue : null,
        })
        .then((r) => r.data.data!),
    onSuccess: (data) => {
      toast.success(
        `발송 박스 재계산 완료 — 삭제 ${data.deleted_count}건 / 생성 ${data.created_count}건`,
      );
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
          <p>
            <span className="font-medium text-gray-900">{SCOPE_LABEL[scope]}</span> 영역의{" "}
            <span className="font-medium">PREPARING 박스를 통째로 재계산</span>합니다. 다른 영역의
            박스는 건드리지 않습니다.
          </p>
          <ul className="text-xs text-gray-500 list-disc pl-5 space-y-0.5">
            <li>기존 PREPARING 박스 일괄 삭제 후, 결제완료(PAID) 주문 기준 신규 박스 생성</li>
            <li>DELIVERED / CANCELLED 박스는 영향 없음</li>
            <li>박스의 운영자 메모(관리자 메모)는 재계산 시 사라집니다</li>
          </ul>
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
              {issueError && (
                <p className="text-xs text-red-500 mt-1">발송 호를 6자리로 입력해주세요.</p>
              )}
            </div>
          )}
        </div>
      }
      confirmLabel="재계산 진행"
      isLoading={mutation.isPending}
    />
  );
}
