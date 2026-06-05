import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Eye, EyeOff, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
      <div className="p-6 max-w-xl space-y-4">
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
    <div className="border border-gray-100 rounded-lg overflow-hidden">
      <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{title}</h3>
      </div>
      <div className="px-4 py-4 space-y-3">{children}</div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-gray-400 w-20 flex-shrink-0">{label}</span>
      <span className="text-sm text-gray-800">{value}</span>
    </div>
  );
}

function AccountInfo() {
  const { currentAdmin } = useAuth();

  const initials = currentAdmin?.admin_name
    ? currentAdmin.admin_name.slice(0, 1)
    : "?";

  return (
    <div className="flex items-center gap-4">
      {/* 이니셜 아바타 */}
      <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
        <span className="text-lg font-semibold text-blue-600">{initials}</span>
      </div>
      {/* 정보 */}
      <div className="space-y-1.5 flex-1">
        <InfoRow label="이름" value={currentAdmin?.admin_name ?? "-"} />
        <InfoRow label="이메일" value={currentAdmin?.email ?? "-"} />
        <InfoRow
          label="권한"
          value={
            <span className="text-xs font-medium px-2 py-0.5 rounded bg-gray-100 text-gray-600">
              {ADMIN_ROLE_LABEL[currentAdmin?.admin_role ?? ""] ?? currentAdmin?.admin_role ?? "-"}
            </span>
          }
        />
      </div>
    </div>
  );
}

function PasswordField({
  label,
  value,
  onChange,
  show,
  onToggleShow,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  show: boolean;
  onToggleShow: () => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="text-xs text-gray-500">{label}</label>
      <div className="relative mt-1">
        <Input
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="h-8 text-sm pr-9"
        />
        <button
          type="button"
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          onClick={onToggleShow}
        >
          {show ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
        </button>
      </div>
    </div>
  );
}

function PasswordChange() {
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

  return (
    <form onSubmit={handleSubmit} className="space-y-2.5">
      <PasswordField
        label="현재 비밀번호"
        value={currentPassword}
        onChange={setCurrentPassword}
        show={showCurrent}
        onToggleShow={() => setShowCurrent((v) => !v)}
        placeholder="현재 비밀번호"
      />
      <PasswordField
        label="새 비밀번호"
        value={newPassword}
        onChange={setNewPassword}
        show={showNew}
        onToggleShow={() => setShowNew((v) => !v)}
        placeholder="8자 이상, 영문+숫자+특수문자 포함"
      />
      <PasswordField
        label="새 비밀번호 확인"
        value={confirmPassword}
        onChange={setConfirmPassword}
        show={showConfirm}
        onToggleShow={() => setShowConfirm((v) => !v)}
        placeholder="새 비밀번호 재입력"
      />
      <div className="pt-1">
        <Button
          type="submit"
          size="sm"
          disabled={changePwMutation.isPending || !currentPassword || !newPassword || !confirmPassword}
        >
          변경
        </Button>
      </div>
    </form>
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
  const [showScopes, setShowScopes] = useState(false);

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
    return <p className="text-sm text-gray-400">확인 중...</p>;
  }

  if (isError) {
    return <p className="text-sm text-red-500">상태를 확인할 수 없습니다.</p>;
  }

  const authorized = status?.authorized ?? false;
  const expiresAt = status?.expires_at;
  const refreshExpiresAt = status?.refresh_token_expires_at;
  const refreshExpired = refreshExpiresAt ? new Date(refreshExpiresAt) < new Date() : false;

  const tokenStatus = !authorized
    ? "not_connected"
    : refreshExpired
      ? "reconnect_required"
      : "active";

  const statusConfig = {
    not_connected: { dotColor: "bg-gray-300", label: "미연동", labelColor: "text-gray-500" },
    active: { dotColor: "bg-green-500", label: "연동됨", labelColor: "text-green-700" },
    reconnect_required: { dotColor: "bg-red-500", label: "재연결 필요", labelColor: "text-red-600" },
  };

  const { dotColor, label, labelColor } = statusConfig[tokenStatus];

  return (
    <div className="space-y-3.5">
      {/* 상태 */}
      <div className="flex items-center gap-2">
        <span className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${dotColor}`} />
        <span className={`text-sm font-medium ${labelColor}`}>{label}</span>
      </div>

      {/* 연동 정보 */}
      {authorized && (
        <div className="space-y-2">
          {status?.mall_id && (
            <InfoRow label="몰 ID" value={<span className="font-mono">{status.mall_id}</span>} />
          )}
          {expiresAt && (
            <InfoRow
              label="액세스 토큰"
              value={<span className="text-gray-500 text-xs">{formatRelativeTime(expiresAt)}</span>}
            />
          )}
          {refreshExpiresAt && (
            <InfoRow
              label="리프레시 토큰"
              value={
                <span className={`text-xs ${refreshExpired ? "text-red-500 font-medium" : "text-gray-500"}`}>
                  {formatRelativeTime(refreshExpiresAt)}
                </span>
              }
            />
          )}
          {/* 스코프: 접기/펼치기 */}
          {status?.scopes && status.scopes.length > 0 && (
            <div>
              <button
                className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 mt-1"
                onClick={() => setShowScopes((v) => !v)}
              >
                스코프 (개발자용)
                {showScopes ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </button>
              {showScopes && (
                <p className="mt-1.5 text-[11px] text-gray-500 font-mono bg-gray-50 rounded px-2.5 py-2 break-all leading-relaxed">
                  {status.scopes.join(", ")}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* 안내 메시지 */}
      {tokenStatus === "reconnect_required" && (
        <p className="text-xs text-red-500 bg-red-50 rounded px-2.5 py-2">
          인증이 만료되었습니다. 다시 연결해주세요.
        </p>
      )}
      {tokenStatus === "not_connected" && (
        <p className="text-xs text-gray-400">
          Cafe24 API를 사용하려면 OAuth 연동이 필요합니다.
        </p>
      )}

      {/* 액션 버튼 */}
      <div>
        {tokenStatus === "not_connected" && (
          <Button size="sm" onClick={handleConnect} disabled={connecting}>
            연결하기
          </Button>
        )}
        {tokenStatus === "active" && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleConnect}
            disabled={connecting}
            className="gap-1"
          >
            <RefreshCw className="h-3 w-3" />
            재연결
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
