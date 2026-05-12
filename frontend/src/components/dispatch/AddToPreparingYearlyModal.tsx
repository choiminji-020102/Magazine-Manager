import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { ConfirmModal } from "@/components/common/ConfirmModal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { dispatchApi } from "@/api/dispatchApi";
import { toast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/utils/errorHandler";

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess?: (created: number) => void;
}

// 정기(YEARLY) 신규 결제 추가 — incremental.
// 기존 PREPARING 박스는 건드리지 않고, PAID + 호 범위 + 발송 이력 없는 OrderItem 만 박스 추가 생성.
// 정기는 1 OrderItem = 1 박스 매핑이라 묶음 재계산 불필요.
export default function AddToPreparingYearlyModal({
  open,
  onClose,
  onSuccess,
}: Props) {
  const [issue, setIssue] = useState("");
  const [issueError, setIssueError] = useState(false);

  useEffect(() => {
    if (open) {
      setIssue("");
      setIssueError(false);
    }
  }, [open]);

  const mutation = useMutation({
    mutationFn: () =>
      dispatchApi.addToPreparingYearly({ issue }).then((r) => r.data.data!),
    onSuccess: (data) => {
      if (data.created_count === 0) {
        toast.info(
          "추가할 신규 결제가 없습니다. 이미 모든 PAID 정기 품목이 박스에 들어있거나, 입력한 호가 구독 범위 밖일 수 있어요.",
        );
      } else {
        toast.success(`신규 결제 추가 완료 — ${data.created_count}건 박스 생성`);
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
            <span className="font-medium text-gray-900">정기구독</span> 영역의{" "}
            <span className="font-medium text-green-700">신규 결제만 박스로 추가</span>합니다.
            기존 PREPARING 박스는 그대로 유지됩니다.
          </p>
          <ul className="text-xs text-gray-500 list-disc pl-5 space-y-0.5">
            <li>대상: 결제완료(PAID) + 해당 호 범위 안 + 아직 박스 안 만들어진 정기구독 품목</li>
            <li>기존 박스/관리자 메모/박스 ID 모두 보존</li>
            <li>휴지·해외·이미 발송 처리된 품목은 자동 제외</li>
          </ul>
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
        </div>
      }
      confirmLabel="신규 결제 추가"
      isLoading={mutation.isPending}
    />
  );
}
