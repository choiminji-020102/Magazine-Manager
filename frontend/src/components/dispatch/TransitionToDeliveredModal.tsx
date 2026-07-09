import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueries } from "@tanstack/react-query";
import { CheckCircle2, XCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { ImportStatCard, ImportDetailCard } from "@/components/common/ImportResultCards";
import { dispatchApi } from "@/api/dispatchApi";
import { sendsApi } from "@/api/sendsApi";
import { toast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/utils/errorHandler";
import { formatPhone, formatIssue } from "@/utils/format";
import {
  SEND_METHOD_OPTIONS,
  COURIER_COMPANY_OPTIONS,
  SEND_METHOD_TO_COURIER,
} from "@/utils/constants";
import type {
  SendResponse,
  SendMethod,
  CourierCompany,
  SendDetailResponse,
} from "@/types/send";

interface Props {
  open: boolean;
  onClose: () => void;
  sends: SendResponse[]; // 선택된 PREPARING 박스 (페이지가 필터링해 전달)
  // allSucceeded: 남은 실패분 없이 전부 끝났는지 — 부모가 선택 상태를 비워도 되는지 판단용
  // (부분 실패 시 모달은 재시도 대기 중으로 열려있는데 부모가 선택을 지워버리면 안 됨)
  onSuccess?: (count: number, allSucceeded: boolean) => void;
}

// 대량 선택 시 한 번의 API 호출에 담을 최대 건수.
// 카페24 연동 건이 섞이면 백엔드가 내부적으로 100건씩 다시 쪼개 호출하므로(0.5초 간격),
// 200건이면 최악의 경우도 서브배치 2개로 끝나 axios 타임아웃(아래 60초) 안에 안정적으로 마무리됨.
const CHUNK_SIZE = 200;

interface TransitionResult {
  succeededCount: number;
  failed: { sendId: number; recipientName: string; reason: string }[];
}

export default function TransitionToDeliveredModal({
  open,
  onClose,
  sends,
  onSuccess,
}: Props) {
  const [sendMethod, setSendMethod] = useState<SendMethod | "">("");
  const [courier, setCourier] = useState<CourierCompany | "">("");
  // tracking_no by send_id (운송장 번호 입력값 — 표준화는 백엔드 책임)
  const [trackingMap, setTrackingMap] = useState<Record<number, string>>({});
  // 모달이 열릴 때 sends prop을 스냅샷 — 처리 중 부모 선택 상태가 바뀌어도 영향받지 않음
  // (Cafe24OrderListPage의 pendingIds 스냅샷과 동일 패턴).
  // 일부 실패 시에는 실패한 것만 남기고 좁혀서 재시도 대상으로 재사용.
  const [items, setItems] = useState<SendResponse[]>([]);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [result, setResult] = useState<TransitionResult | null>(null);

  // 모달 오픈 시 입력 초기화 + 대상 스냅샷
  useEffect(() => {
    if (open) {
      setSendMethod("");
      setCourier("");
      setTrackingMap({});
      setItems(sends);
      setProgress(null);
      setResult(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 오픈 시점 스냅샷만 필요 (sends 변경 추적 안 함)
  }, [open]);

  // courier_company 변경 → tracking_no 자동 세팅
  const handleCourierChange = (next: string) => {
    const co = next as CourierCompany;
    setCourier(co);
    if (co === "자체배송") {
      const prefilled: Record<number, string> = {};
      items.forEach((s) => { prefilled[s.send_id] = "자체배송"; });
      setTrackingMap(prefilled);
    } else {
      setTrackingMap({});
    }
  };

  // send_method 변경 → courier_company 자동 도출 → handleCourierChange 위임
  const handleSendMethodChange = (next: string) => {
    setSendMethod(next as SendMethod);
    const derived = SEND_METHOD_TO_COURIER[next] as CourierCompany | undefined;
    if (derived) handleCourierChange(derived);
  };

  // 박스 안 SendItem 정보 — 모달 열린 상태에서 박스마다 detail 병렬 조회 (운영자 박스 식별용).
  // 정기 박스: 1 SendItem (한 줄). 단품 박스: N SendItem (여러 줄).
  // "필터 결과 전체 선택"으로 이미 send-detail 캐시가 채워져 있으면(staleTime 60s) 네트워크 호출 없이 즉시 표시됨.
  const detailQueries = useQueries({
    queries: items.map((s) => ({
      queryKey: ["send-detail", s.send_id],
      queryFn: () => sendsApi.getSend(s.send_id).then((r) => r.data.data!),
      enabled: open,
      staleTime: 60 * 1000,
    })),
  });
  const detailBySendId = useMemo(() => {
    const map = new Map<number, SendDetailResponse>();
    detailQueries.forEach((q, i) => {
      if (q.data) map.set(items[i].send_id, q.data);
    });
    return map;
  }, [detailQueries, items]);

  // 선택된 대상을 CHUNK_SIZE 단위로 나눠 순차 제출. 카페24 API 레이트리밋 버킷이 몰 단위로
  // 공유되므로 병렬 호출은 하지 않음. 청크 하나가 실패해도 (all-or-nothing 특성상 청크 전체를
  // 실패로 기록하고) 나머지 청크는 계속 진행 — 대량 처리 중 일부 실패가 전체를 막지 않도록 함.
  const runTransition = async (targets: SendResponse[]): Promise<TransitionResult> => {
    const payloadSends = targets.map((s) => ({
      send_id: s.send_id,
      tracking_no: (trackingMap[s.send_id] ?? "").trim(),
    }));

    let succeededCount = 0;
    const failed: TransitionResult["failed"] = [];
    setProgress({ done: 0, total: targets.length });

    for (let i = 0; i < payloadSends.length; i += CHUNK_SIZE) {
      const chunk = payloadSends.slice(i, i + CHUNK_SIZE);
      try {
        const { data } = await dispatchApi.transitionToDelivered(
          {
            sends: chunk,
            send_method: sendMethod as SendMethod,
            courier_company: courier as CourierCompany,
          },
          { timeout: 60_000 },
        );
        succeededCount += data.data!.transitioned_count;
      } catch (err) {
        const reason = getErrorMessage(err);
        chunk.forEach((c) => {
          const target = targets.find((t) => t.send_id === c.send_id);
          failed.push({ sendId: c.send_id, recipientName: target?.recipient_name ?? "-", reason });
        });
      }
      setProgress((prev) => ({ done: (prev?.done ?? 0) + chunk.length, total: targets.length }));
    }

    return { succeededCount, failed };
  };

  const mutation = useMutation({
    mutationFn: () => runTransition(items),
    onSuccess: (res) => {
      setProgress(null);
      setResult(res);
      if (res.failed.length === 0) {
        toast.success(`발송 완료 처리 완료: ${res.succeededCount}건`);
        onSuccess?.(res.succeededCount, true);
        onClose();
      } else {
        // 실패분만 남겨 재시도 대상으로 좁힘 — 부모 목록/카운트는 성공분 반영을 위해 갱신하되,
        // 재시도 대기 중인 실패분이 남아있으니 부모의 선택 상태는 비우지 않음(allSucceeded=false)
        const failedIds = new Set(res.failed.map((f) => f.sendId));
        setItems((prev) => prev.filter((s) => failedIds.has(s.send_id)));
        onSuccess?.(res.succeededCount, false);
      }
    },
    onError: (err) => {
      setProgress(null);
      toast.error(getErrorMessage(err));
    },
  });

  const handleSubmit = () => {
    if (!sendMethod) {
      toast.error("배송 방법을 선택해주세요.");
      return;
    }
    if (!courier) {
      toast.error("운송사를 선택해주세요.");
      return;
    }
    const missingTracking = items.filter((s) => !(trackingMap[s.send_id] ?? "").trim());
    if (missingTracking.length > 0) {
      toast.error(`운송장 번호를 모두 입력해주세요. (누락: ${missingTracking.length}건)`);
      return;
    }
    setResult(null);
    mutation.mutate();
  };

  const isRetry = result !== null && result.failed.length > 0;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o && !mutation.isPending) onClose();
      }}
    >
      <DialogContent className="max-w-5xl max-h-[88vh] flex flex-col gap-4">
        <DialogHeader>
          <DialogTitle>[발송 완료 처리]</DialogTitle>
          <p className="text-xs text-gray-500 mt-1">
            선택된 <span className="font-medium">{items.length}건</span>을 한
            번에 발송 완료로 처리합니다. 운송장 번호는 필수입니다 — 비택배(우편·자체배송 등)는
            배송 방법 선택 시 "자체배송"으로 자동 채워지며 수정 가능합니다. 이미
            발송 완료·취소된 박스가 섞여 있으면 전체가 처리되지 않으니, 선택을
            다시 확인해주세요.
          </p>
        </DialogHeader>

        {/* 처리 결과 요약 — 일부 실패 시에만 표시 (전체 성공이면 모달이 바로 닫힘) */}
        {result && result.failed.length > 0 && (
          <div className="space-y-2 pb-2 border-b border-gray-100">
            <div className="grid grid-cols-2 gap-2">
              <ImportStatCard
                label="성공"
                count={result.succeededCount}
                icon={<CheckCircle2 className="h-5 w-5" />}
                tone="success"
              />
              <ImportStatCard
                label="실패"
                count={result.failed.length}
                icon={<XCircle className="h-5 w-5" />}
                tone="danger"
              />
            </div>
            <div className="space-y-1.5 max-h-32 overflow-auto pr-1">
              {result.failed.map((f) => (
                <ImportDetailCard
                  key={f.sendId}
                  itemKey={`#${f.sendId} ${f.recipientName}`}
                  message={f.reason}
                  tone="danger"
                />
              ))}
            </div>
          </div>
        )}

        {/* 공통 필드 — send_method / courier_company */}
        <div className="grid grid-cols-2 gap-3 pb-3 border-b border-gray-100">
          <div>
            <Label className="text-xs text-gray-500">
              배송 방법 <span className="text-red-500 ml-0.5">*</span>
            </Label>
            <Select value={sendMethod} onValueChange={handleSendMethodChange}>
              <SelectTrigger className="mt-1 h-9 text-sm">
                <SelectValue placeholder="선택해주세요" />
              </SelectTrigger>
              <SelectContent>
                {SEND_METHOD_OPTIONS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-gray-500">
              운송사 <span className="text-red-500 ml-0.5">*</span>
            </Label>
            <Select
              value={courier}
              onValueChange={handleCourierChange}
            >
              <SelectTrigger className="mt-1 h-9 text-sm">
                <SelectValue placeholder="선택해주세요" />
              </SelectTrigger>
              <SelectContent>
                {COURIER_COMPANY_OPTIONS.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-400 mt-1">
              배송 방법 선택 시 자동 채워집니다. 필요 시 수정.
            </p>
          </div>
        </div>

        {/* 박스별 운송장 입력 */}
        <div className="flex-1 min-h-0 overflow-y-auto border border-gray-200 rounded">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 text-gray-500 sticky top-0">
              <tr>
                <th className="px-2 py-2 text-left font-medium w-20">발송ID</th>
                <th className="px-2 py-2 text-left font-medium w-32">수령인</th>
                <th className="px-2 py-2 text-left font-medium w-64">배송지</th>
                <th className="px-2 py-2 text-left font-medium">상품</th>
                <th className="px-2 py-2 text-left font-medium w-44">
                  운송장 번호 <span className="text-red-500 ml-0.5">*</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((s) => {
                const value = trackingMap[s.send_id] ?? "";
                const detail = detailBySendId.get(s.send_id);
                const detailItems = detail?.items ?? [];
                return (
                  <tr
                    key={s.send_id}
                    className="border-t border-gray-100 align-top"
                  >
                    <td className="px-2 py-2 font-mono text-gray-400">
                      #{s.send_id}
                    </td>
                    <td className="px-2 py-2">
                      <div>{s.recipient_name}</div>
                      <div className="text-gray-400">
                        {formatPhone(s.recipient_phone)}
                      </div>
                    </td>
                    <td className="px-2 py-2">
                      <div className="font-mono text-gray-400">
                        {s.postal_code}
                      </div>
                      <div className="truncate">{s.recipient_address}</div>
                    </td>
                    <td className="px-2 py-2">
                      {detail === undefined ? (
                        <span className="text-gray-300 text-[11px]">로딩…</span>
                      ) : detailItems.length === 0 ? (
                        <span className="text-gray-300">-</span>
                      ) : (
                        <div className="space-y-0.5">
                          {detailItems.map((it) => (
                            <div
                              key={it.send_item_id}
                              className="flex items-center gap-1.5"
                            >
                              <span className="font-mono text-gray-500">
                                {it.product_code}
                              </span>
                              <span className="text-gray-300">·</span>
                              <span className="text-gray-600">
                                {formatIssue(it.issue)}
                              </span>
                              <span className="text-gray-400 ml-auto">
                                × {it.send_num}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-2 py-2">
                      <Input
                        className="h-8 font-mono"
                        placeholder="'-'를 제외한 숫자만 입력"
                        value={value}
                        onChange={(e) =>
                          setTrackingMap((prev) => ({
                            ...prev,
                            [s.send_id]: e.target.value,
                          }))
                        }
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={onClose}
            disabled={mutation.isPending}
          >
            닫기
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={
              mutation.isPending ||
              !sendMethod ||
              !courier ||
              items.length === 0
            }
          >
            {mutation.isPending && (
              <LoadingSpinner size="sm" className="mr-1" />
            )}
            {mutation.isPending
              ? `처리 중… (완료 ${progress?.done ?? 0}/${progress?.total ?? items.length}건)`
              : isRetry
              ? `실패 건 재시도 (${items.length}건)`
              : `발송 완료 처리 (${items.length}건)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
