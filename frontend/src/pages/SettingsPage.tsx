import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Eye, EyeOff, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { authAPI } from "@/api/authApi";
import { cafe24API } from "@/api/cafe24Api";
import { toast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/utils/errorHandler";
import { ADMIN_ROLE_LABEL } from "@/utils/constants";

export default function SettingsPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    const cafe24Result = searchParams.get("cafe24");
    if (!cafe24Result) return;
    if (cafe24Result === "success") {
      toast.success("Cafe24 연동이 완료되었습니다.");
    } else if (cafe24Result === "error") {
      const message = searchParams.get("message") || "알 수 없는 오류";
      toast.error(`Cafe24 연동 실패: ${message}`);
    }
    searchParams.delete("cafe24");
    searchParams.delete("message");
    setSearchParams(searchParams, { replace: true });
  }, [searchParams, setSearchParams]);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="p-6 max-w-2xl space-y-4">
        <Section title="내 계정">
          <AccountInfo />
        </Section>

        <Section title="비밀번호 변경">
          <PasswordChange />
        </Section>

        <Section title="Cafe24 연동">
          <Cafe24Settings />
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-5">
      <h2 className="text-sm font-semibold text-gray-900 mb-4">{title}</h2>
      {children}
    </div>
  );
}

function AccountInfo() {
  const { currentAdmin } = useAuth();
  return (
    <div className="grid grid-cols-3 gap-4 text-sm">
      <div>
        <span className="text-gray-400 text-xs">이름</span>
        <div className="font-medium text-gray-900 mt-0.5">{currentAdmin?.admin_name ?? "-"}</div>
      </div>
      <div>
        <span className="text-gray-400 text-xs">이메일</span>
        <div className="font-medium text-gray-900 mt-0.5">{currentAdmin?.email ?? "-"}</div>
      </div>
      <div>
        <span className="text-gray-400 text-xs">권한</span>
        <div className="font-medium text-gray-900 mt-0.5">
          {ADMIN_ROLE_LABEL[currentAdmin?.admin_role ?? ""] ?? currentAdmin?.admin_role ?? "-"}
        </div>
      </div>
    </div>
  );
}

function PasswordChange() {
  const [open, setOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const changePwMutation = useMutation({
    mutationFn: () =>
      authAPI.changePassword({
        current_password: currentPassword,
        new_password: newPassword,
      }),
    onSuccess: () => {
      toast.success("비밀번호가 변경되었습니다.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setOpen(false);
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error("새 비밀번호가 일치하지 않습니다.");
      return;
    }
    if (newPassword.length < 8) {
      toast.error("비밀번호는 8자 이상이어야 합니다.");
      return;
    }
    changePwMutation.mutate();
  };

  if (!open) {
    return (
      <button
        className="text-sm text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1"
        onClick={() => setOpen(true)}
      >
        비밀번호 변경하기 <ChevronDown className="h-3.5 w-3.5" />
      </button>
    );
  }

  return (
    <div>
      <button
        className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1 mb-3"
        onClick={() => { setOpen(false); setCurrentPassword(""); setNewPassword(""); setConfirmPassword(""); }}
      >
        접기 <ChevronUp className="h-3.5 w-3.5" />
      </button>
      <form onSubmit={handleSubmit} className="space-y-3 max-w-sm">
        <div>
          <Label className="text-xs">현재 비밀번호</Label>
          <div className="relative mt-1">
            <Input
              type={showCurrent ? "text" : "password"}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="현재 비밀번호"
              className="pr-9"
            />
            <button type="button" className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600" onClick={() => setShowCurrent(!showCurrent)}>
              {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
        <div>
          <Label className="text-xs">새 비밀번호</Label>
          <div className="relative mt-1">
            <Input
              type={showNew ? "text" : "password"}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="8자 이상, 영문+숫자+특수문자 포함"
              className="pr-9"
            />
            <button type="button" className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600" onClick={() => setShowNew(!showNew)}>
              {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
        <div>
          <Label className="text-xs">새 비밀번호 확인</Label>
          <div className="relative mt-1">
            <Input
              type={showConfirm ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="새 비밀번호 재입력"
              className="pr-9"
            />
            <button type="button" className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600" onClick={() => setShowConfirm(!showConfirm)}>
              {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
        <Button
          type="submit"
          size="sm"
          disabled={changePwMutation.isPending || !currentPassword || !newPassword || !confirmPassword}
        >
          비밀번호 변경
        </Button>
      </form>
    </div>
  );
}

function formatRelativeTime(dateStr: string): string {
  const now = new Date();
  const target = new Date(dateStr);
  const diffMs = target.getTime() - now.getTime();
  if (diffMs < 0) return "만료됨";
  const diffMin = Math.round(diffMs / 60000);
  if (diffMin < 60) return `${diffMin}분 후 만료`;
  const diffHour = Math.round(diffMin / 60);
  if (diffHour < 24) return `약 ${diffHour}시간 후 만료`;
  const diffDay = Math.round(diffHour / 24);
  return `약 ${diffDay}일 후 만료`;
}

function Cafe24Settings() {
  const [connecting, setConnecting] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const { data: status, isLoading, isError } = useQuery({
    queryKey: ["cafe24-status"],
    queryFn: () => cafe24API.getStatus(),
    retry: false,
  });

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const res = await cafe24API.startOAuth();
      window.location.href = res.authorize_url;
    } catch (err) {
      setConnecting(false);
      toast.error(getErrorMessage(err));
    }
  };

  if (isLoading) {
    return <p className="text-sm text-gray-400">상태 확인 중...</p>;
  }

  if (isError) {
    return <p className="text-sm text-red-500">Cafe24 상태를 확인할 수 없습니다.</p>;
  }

  const authorized = status?.authorized ?? false;
  const expiresAt = status?.expires_at;
  const refreshExpiresAt = status?.refresh_token_expires_at;

  const refreshExpired = refreshExpiresAt ? new Date(refreshExpiresAt) < new Date() : false;

  // 상태 판단 (3단계)
  // - access_token 만료는 백엔드가 자동 재발급 처리하므로 UI에 노출하지 않음
  // - refresh_token 만료 시에만 사용자 개입(재연결) 필요
  const tokenStatus = !authorized
    ? "not_connected"
    : refreshExpired
      ? "reconnect_required"
      : "active";

  const statusConfig = {
    not_connected: { color: "bg-gray-300", label: "연동되지 않음", message: "Cafe24 API를 사용하려면 OAuth 연동이 필요합니다." },
    active: { color: "bg-green-500", label: "연동됨", message: null },
    reconnect_required: { color: "bg-red-500", label: "재연결 필요", message: "인증이 만료되었습니다. Cafe24를 다시 연결해주세요." },
  };

  const { color, label, message } = statusConfig[tokenStatus];

  return (
    <div className="space-y-4">
      {/* 연동 상태 */}
      <div className="flex items-center gap-2">
        <span className={`inline-block w-2 h-2 rounded-full ${color}`} />
        <span className="text-sm font-medium text-gray-700">{label}</span>
      </div>

      {/* 안내 메시지 */}
      {message && (
        <p className={`text-xs ${tokenStatus === "reconnect_required" ? "text-red-500" : "text-gray-400"}`}>
          {message}
        </p>
      )}

      {/* 상세 정보 (토글) */}
      {authorized && (
        <div>
          <button
            className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
            onClick={() => setShowDetails(!showDetails)}
          >
            상세 정보
            {showDetails ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>
          {showDetails && (
            <div className="bg-gray-50 rounded-lg p-3 text-xs space-y-1.5 mt-2">
              {status?.mall_id && (
                <div className="flex justify-between">
                  <span className="text-gray-400">몰 ID</span>
                  <span className="text-gray-700 font-mono">{status.mall_id}</span>
                </div>
              )}
              {expiresAt && (
                <div className="flex justify-between">
                  <span className="text-gray-400">액세스 토큰</span>
                  <span className="font-medium text-gray-700">
                    {formatRelativeTime(expiresAt)}
                  </span>
                </div>
              )}
              {refreshExpiresAt && (
                <div className="flex justify-between">
                  <span className="text-gray-400">리프레시 토큰</span>
                  <span className={`font-medium ${refreshExpired ? "text-red-500" : "text-gray-700"}`}>
                    {formatRelativeTime(refreshExpiresAt)}
                  </span>
                </div>
              )}
              {status?.scopes && status.scopes.length > 0 && (
                <div className="border-t border-gray-200 pt-1.5 mt-1.5">
                  <span className="text-gray-400">스코프 <span className="text-gray-300">(개발자용)</span></span>
                  <p className="text-gray-500 font-mono mt-0.5 break-all">{status.scopes.join(", ")}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 액션 버튼 */}
      <div className="flex items-center gap-2">
        {tokenStatus === "not_connected" && (
          <Button size="sm" onClick={handleConnect} disabled={connecting}>
            Cafe24 연결하기
          </Button>
        )}
        {tokenStatus === "active" && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleConnect}
            disabled={connecting}
          >
            다시 연결
          </Button>
        )}
        {tokenStatus === "reconnect_required" && (
          <Button size="sm" onClick={handleConnect} disabled={connecting}>
            다시 연결
          </Button>
        )}
      </div>
    </div>
  );
}
