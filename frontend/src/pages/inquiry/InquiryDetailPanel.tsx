import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/common/StatusBadge";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { ConfirmModal } from "@/components/common/ConfirmModal";
import { inquiriesApi } from "@/api/inquiriesApi";
import { toast } from "@/hooks/use-toast";
import { formatDateTime, formatDate, formatPhone, formatAmount } from "@/utils/format";
import { CHANNEL_LABEL, ORDER_STATUS_LABEL } from "@/utils/constants";

interface InquiryDetailPanelProps {
  inquiryId: number;
  onClose: () => void;
}


export default function InquiryDetailPanel({ inquiryId, onClose }: InquiryDetailPanelProps) {
  const queryClient = useQueryClient();
  const [answerText, setAnswerText] = useState("");
  const [answerMode, setAnswerMode] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const { data: res, isLoading } = useQuery({
    queryKey: ["inquiry", inquiryId],
    queryFn: () => inquiriesApi.getInquiry(inquiryId).then((r) => r.data),
    enabled: !!inquiryId,
  });

  const inquiry = res?.data;

  const answerMutation = useMutation({
    mutationFn: () =>
      inquiriesApi.answerInquiry(inquiryId, {
        answer: answerText,
        inquiry_status: "COMPLETED",
      }),
    onSuccess: () => {
      toast.success("답변이 등록되었습니다.");
      queryClient.invalidateQueries({ queryKey: ["inquiry", inquiryId] });
      queryClient.invalidateQueries({ queryKey: ["inquiries"] });
      setAnswerMode(false);
      setAnswerText("");
    },
    onError: () => toast.error("답변 등록 실패"),
  });

  const deleteMutation = useMutation({
    mutationFn: () => inquiriesApi.deleteInquiry(inquiryId),
    onSuccess: () => {
      toast.success("문의가 삭제되었습니다.");
      queryClient.invalidateQueries({ queryKey: ["inquiries"] });
      onClose();
    },
    onError: () => toast.error("문의 삭제 실패"),
  });

  const statusMutation = useMutation({
    mutationFn: (newStatus: string) =>
      inquiriesApi.updateInquiry(inquiryId, { inquiry_status: newStatus }),
    onSuccess: (_data, newStatus) => {
      // 이전 상태에 따라 되돌리기 문구를 구분 (완료→접수: 재오픈, 취소→접수: 취소 해제)
      const message =
        newStatus === "COMPLETED"
          ? "완료 처리되었습니다."
          : newStatus === "CANCELLED"
          ? "취소되었습니다."
          : inquiry?.inquiry_status === "CANCELLED"
          ? "취소가 해제되었습니다."
          : "접수 상태로 되돌렸습니다.";
      toast.success(message);
      queryClient.invalidateQueries({ queryKey: ["inquiry", inquiryId] });
      queryClient.invalidateQueries({ queryKey: ["inquiries"] });
    },
    onError: () => toast.error("상태 변경 실패"),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner />
      </div>
    );
  }

  if (!inquiry) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-gray-400">
        문의를 불러올 수 없습니다.
      </div>
    );
  }

  // 미완료(접수) 상태 판정 — 레거시 IN_PROGRESS 데이터도 접수처럼 처리할 수 있게 포함
  const isPending =
    inquiry.inquiry_status === "RECEIVED" || inquiry.inquiry_status === "IN_PROGRESS";

  return (
    <div className="flex flex-col h-full">
      {/* 패널 헤더 */}
      <div className="px-5 py-4 border-b border-gray-200 bg-white">
        <div className="flex items-start justify-between mb-3">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 mb-1">
              <StatusBadge type="inquiry_status" value={inquiry.inquiry_status} />
              <StatusBadge type="inquiry_type" value={inquiry.inquiry_type} />
            </div>
            <div className="font-semibold text-gray-900 text-base leading-tight">
              {inquiry.title ?? "(제목 없음)"}
            </div>
            {inquiry.customer_name && (
              <div className="text-xs text-gray-400 mt-0.5">
                {inquiry.customer_name}
                {inquiry.customer_phone && (
                  <span className="ml-1.5 font-mono">{formatPhone(inquiry.customer_phone)}</span>
                )}
              </div>
            )}
          </div>
          <div className="flex items-center gap-1 flex-shrink-0 ml-2">
            <Button
              variant="ghost"
              size="sm"
              className="text-red-500 hover:text-red-600 hover:bg-red-50 text-xs px-2"
              onClick={() => setDeleteConfirm(true)}
            >
              삭제
            </Button>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 p-1 rounded-md hover:bg-gray-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* 액션 버튼 (접수 → 완료 / 취소, 3단계) */}
        <div className="flex items-center gap-2 mt-3 flex-wrap">
          {/* 접수 상태(레거시 IN_PROGRESS 포함): 답변 등록 · 완료 처리 · 취소 */}
          {isPending && (
            <>
              <Button
                size="sm"
                onClick={() => {
                  setAnswerMode(true);
                  setAnswerText(inquiry.answer ?? "");
                }}
              >
                답변 등록
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => statusMutation.mutate("COMPLETED")}
                disabled={statusMutation.isPending}
              >
                완료 처리
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-red-600 border-red-200 hover:bg-red-50"
                onClick={() => statusMutation.mutate("CANCELLED")}
                disabled={statusMutation.isPending}
              >
                취소
              </Button>
            </>
          )}
          {/* 완료 상태: 접수로 되돌리기(재오픈) */}
          {inquiry.inquiry_status === "COMPLETED" && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => statusMutation.mutate("RECEIVED")}
              disabled={statusMutation.isPending}
            >
              접수로 되돌리기
            </Button>
          )}
          {/* 취소 상태: 취소 해제 */}
          {inquiry.inquiry_status === "CANCELLED" && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => statusMutation.mutate("RECEIVED")}
              disabled={statusMutation.isPending}
            >
              취소 해제
            </Button>
          )}
        </div>
      </div>

      <ConfirmModal
        open={deleteConfirm}
        onClose={() => setDeleteConfirm(false)}
        onConfirm={() => deleteMutation.mutate()}
        title="문의 삭제"
        description="이 문의를 삭제합니다. 삭제 후 복구할 수 없습니다."
        confirmLabel="삭제"
        isLoading={deleteMutation.isPending}
      />

      {/* 내용 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {/* 문의 내용 */}
        <Section title="문의 내용">
          {inquiry.content ? (
            <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
              {inquiry.content}
            </p>
          ) : (
            <p className="text-sm text-gray-400">(내용 없음)</p>
          )}
        </Section>

        {/* 답변 입력 폼 */}
        {answerMode && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3.5">
            <div className="text-xs font-semibold text-blue-700 mb-2">답변 작성</div>
            <textarea
              className="w-full border border-gray-300 rounded-md p-2 text-sm resize-none h-28 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              placeholder="답변 내용을 입력해주세요."
              value={answerText}
              onChange={(e) => setAnswerText(e.target.value)}
            />
            <div className="flex items-center gap-2 mt-2">
              <Button
                size="sm"
                onClick={() => answerMutation.mutate()}
                disabled={answerMutation.isPending || !answerText.trim()}
              >
                답변 등록
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => { setAnswerMode(false); setAnswerText(""); }}
              >
                취소
              </Button>
            </div>
          </div>
        )}

        {/* 기존 답변 */}
        {inquiry.answer && !answerMode && (
          <Section title="답변">
            <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
              {inquiry.answer}
            </p>
            <Button
              variant="ghost"
              size="sm"
              className="mt-1 text-xs text-gray-400 px-0 hover:bg-transparent"
              onClick={() => { setAnswerMode(true); setAnswerText(inquiry.answer ?? ""); }}
            >
              답변 수정
            </Button>
          </Section>
        )}

        {/* 메타 정보 */}
        <Section title="정보">
          <InfoRow label="상태" value={
            <StatusBadge type="inquiry_status" value={inquiry.inquiry_status} />
          } />
          <InfoRow label="유형" value={
            <StatusBadge type="inquiry_type" value={inquiry.inquiry_type} />
          } />
          {inquiry.inquiry_category && (
            <InfoRow label="카테고리" value={inquiry.inquiry_category} />
          )}
          {inquiry.order_id && (
            <InfoRow
              label="관련 주문"
              value={
                [
                  inquiry.order_channel &&
                    (CHANNEL_LABEL[inquiry.order_channel] ?? inquiry.order_channel),
                  inquiry.order_status &&
                    (ORDER_STATUS_LABEL[inquiry.order_status] ?? inquiry.order_status),
                  inquiry.order_payment_amount != null &&
                    formatAmount(inquiry.order_payment_amount),
                  inquiry.order_at && formatDate(inquiry.order_at),
                ]
                  .filter(Boolean)
                  .join(" · ") || `#${inquiry.order_id}`
              }
            />
          )}
          {inquiry.order_id && (
            <InfoRow
              label="관련 주문품목"
              value={
                inquiry.order_item_id
                  ? (inquiry.order_item_product_name ?? `#${inquiry.order_item_id}`)
                  : "전체 품목 (주문 전체)"
              }
            />
          )}
          {inquiry.handler_name && (
            <InfoRow label="담당자" value={inquiry.handler_name} />
          )}
          {inquiry.handled_at && (
            <InfoRow label="처리일시" value={formatDateTime(inquiry.handled_at)} />
          )}
        </Section>

        {/* 시스템 (CRUD 타임스탬프 등 시스템 메타데이터는 별도 섹션으로 분리) */}
        <Section title="시스템">
          <InfoRow label="등록일" value={formatDateTime(inquiry.created_at)} />
          <InfoRow label="수정일" value={formatDateTime(inquiry.updated_at)} />
        </Section>
      </div>
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
  if (!value) return null;
  return (
    <div className="flex items-start gap-3">
      <span className="text-xs text-gray-400 w-24 flex-shrink-0 pt-0.5">{label}</span>
      <span className="text-sm text-gray-700 flex-1">{value}</span>
    </div>
  );
}
