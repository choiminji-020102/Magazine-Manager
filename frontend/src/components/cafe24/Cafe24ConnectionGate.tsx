import { useState } from "react";
import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { cafe24API } from "@/api/cafe24Api";
import { toast } from "@/hooks/use-toast";

// Cafe24 페이지 본문을 감싸 연동 상태에 따라 분기.
// - active        → children 렌더 (정상 흐름)
// - not_connected → "Cafe24 연결" 안내 + 버튼 (cafe24_tokens 비어있음)
// - reconnect_required → "재연결 필요" 안내 + 버튼 (refresh_token 만료)
//
// queryKey ["cafe24-status"] 는 Sidebar 와 공유 (5분 캐시 재사용).

export default function Cafe24ConnectionGate({ children }: { children: ReactNode }) {
  const { data: status, isLoading } = useQuery({
    queryKey: ["cafe24-status"],
    queryFn: () => cafe24API.getStatus(),
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  const [connecting, setConnecting] = useState(false);
  const handleConnect = async () => {
    setConnecting(true);
    try {
      const res = await cafe24API.startOAuth();
      window.location.href = res.authorize_url;
    } catch {
      setConnecting(false);
      toast.error("Cafe24 연결 실패");
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center py-16">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  // status 판정 — Sidebar 와 동일 로직
  const authorized = status?.authorized ?? false;
  const refreshExpired = status?.refresh_token_expires_at
    ? new Date(status.refresh_token_expires_at) < new Date()
    : false;

  if (!authorized) {
    return (
      <ConnectionPrompt
        title="Cafe24 연결이 필요합니다"
        description="Cafe24 주문·상품을 가져오려면 먼저 Cafe24 인증을 완료해야 합니다."
        buttonLabel="Cafe24 연결"
        connecting={connecting}
        onConnect={handleConnect}
      />
    );
  }

  if (refreshExpired) {
    return (
      <ConnectionPrompt
        title="Cafe24 재연결이 필요합니다"
        description="리프레시 토큰이 만료되어 Cafe24 API 호출이 차단됩니다. 재연결로 새 토큰을 발급해주세요."
        buttonLabel="재연결"
        connecting={connecting}
        onConnect={handleConnect}
      />
    );
  }

  return <>{children}</>;
}

function ConnectionPrompt({
  title,
  description,
  buttonLabel,
  connecting,
  onConnect,
}: {
  title: string;
  description: string;
  buttonLabel: string;
  connecting: boolean;
  onConnect: () => void;
}) {
  return (
    <div className="px-5 py-4">
      <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
        <AlertCircle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
        <div className="flex-1 text-xs text-amber-700 leading-relaxed pt-0.5">
          <span className="font-semibold">{title}</span>
          <span className="text-amber-600/80"> — </span>
          <span>{description}</span>
        </div>
        <Button size="sm" onClick={onConnect} disabled={connecting} className="shrink-0">
          {connecting ? (
            <LoadingSpinner size="sm" className="mr-1" />
          ) : (
            <Link2 className="h-3.5 w-3.5 mr-1" />
          )}
          {buttonLabel}
        </Button>
      </div>
    </div>
  );
}
