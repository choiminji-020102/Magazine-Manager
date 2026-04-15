import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { authAPI } from "@/api/authApi";
import { cafe24API } from "@/api/cafe24Api";
import { toast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/utils/errorHandler";

const CAFE24_SCOPES = [
  "mall.read_order",
  "mall.read_product",
  "mall.read_store",
];

export default function SettingsPage() {
  const { currentAdmin } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  // Cafe24 콜백 결과 처리
  useEffect(() => {
    const cafe24Result = searchParams.get("cafe24");
    if (!cafe24Result) return;

    if (cafe24Result === "success") {
      toast.success("Cafe24 연동이 완료되었습니다.");
    } else if (cafe24Result === "error") {
      const message = searchParams.get("message") || "알 수 없는 오류";
      toast.error(`Cafe24 연동 실패: ${message}`);
    }

    // URL에서 쿼리 파라미터 제거
    searchParams.delete("cafe24");
    searchParams.delete("message");
    setSearchParams(searchParams, { replace: true });
  }, [searchParams, setSearchParams]);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="p-6 max-w-2xl space-y-6">
        <Section title="내 계정">
          <AccountSettings adminId={currentAdmin?.admin_id} />
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

function AccountSettings(_props: { adminId?: number }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const { currentAdmin } = useAuth();

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
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <span className="text-gray-500">이름</span>
          <div className="font-medium mt-0.5">{currentAdmin?.admin_name}</div>
        </div>
        <div>
          <span className="text-gray-500">이메일</span>
          <div className="font-medium mt-0.5">{currentAdmin?.email}</div>
        </div>
        <div>
          <span className="text-gray-500">권한</span>
          <div className="font-medium mt-0.5">{currentAdmin?.admin_role}</div>
        </div>
      </div>

      <hr className="border-gray-100" />

      <form onSubmit={handleSubmit} className="space-y-3">
        <h3 className="text-xs font-medium text-gray-500 uppercase">비밀번호 변경</h3>
        <div>
          <Label className="text-sm">현재 비밀번호</Label>
          <Input
            type="password"
            className="mt-1"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="현재 비밀번호"
          />
        </div>
        <div>
          <Label className="text-sm">새 비밀번호</Label>
          <Input
            type="password"
            className="mt-1"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="8자 이상"
          />
        </div>
        <div>
          <Label className="text-sm">새 비밀번호 확인</Label>
          <Input
            type="password"
            className="mt-1"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="새 비밀번호 재입력"
          />
        </div>
        <Button
          type="submit"
          size="sm"
          disabled={changePwMutation.isPending || !currentPassword || !newPassword}
        >
          비밀번호 변경
        </Button>
      </form>
    </div>
  );
}

function Cafe24Settings() {
  const queryClient = useQueryClient();
  const [connecting, setConnecting] = useState(false);

  const { data: status, isLoading, isError } = useQuery({
    queryKey: ["cafe24-status"],
    queryFn: () => cafe24API.getStatus(),
    retry: false,
  });

  const refreshMutation = useMutation({
    mutationFn: () => cafe24API.refreshToken(),
    onSuccess: () => {
      toast.success("Cafe24 토큰이 갱신되었습니다.");
      queryClient.invalidateQueries({ queryKey: ["cafe24-status"] });
    },
    onError: (err) => {
      const message = getErrorMessage(err);
      if (message.includes("인증 코드 요청부터")) {
        toast.error("리프레시 토큰이 만료되었습니다. Cafe24를 다시 연결해주세요.");
      } else {
        toast.error(`토큰 갱신 실패: ${message}`);
      }
    },
  });

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const res = await cafe24API.startOAuth({
        scopes: CAFE24_SCOPES,
      });
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

  return (
    <div className="space-y-4">
      {/* 연동 상태 */}
      <div className="flex items-center gap-3">
        <span
          className={`inline-block w-2 h-2 rounded-full ${
            authorized ? "bg-green-500" : "bg-gray-300"
          }`}
        />
        <span className="text-sm font-medium text-gray-700">
          {authorized ? "연동됨" : "연동되지 않음"}
        </span>
      </div>

      {/* 토큰 정보 */}
      {authorized && expiresAt && (
        <div className="text-xs text-gray-500 space-y-1">
          <div>액세스 토큰 만료: {new Date(expiresAt).toLocaleString("ko-KR")}</div>
          {refreshExpiresAt && (
            <div>리프레시 토큰 만료: {new Date(refreshExpiresAt).toLocaleString("ko-KR")}</div>
          )}
          {status?.scopes && status.scopes.length > 0 && (
            <div>스코프: {status.scopes.join(", ")}</div>
          )}
        </div>
      )}

      {/* 액션 버튼 */}
      <div className="flex items-center gap-2">
        {authorized ? (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refreshMutation.mutate()}
              disabled={refreshMutation.isPending}
            >
              토큰 갱신
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleConnect}
              disabled={connecting}
            >
              다시 연결
            </Button>
          </>
        ) : (
          <Button size="sm" onClick={handleConnect} disabled={connecting}>
            Cafe24 연결하기
          </Button>
        )}
      </div>

      <p className="text-xs text-gray-400">
        Cafe24 API를 사용하려면 OAuth 연동이 필요합니다.
      </p>
    </div>
  );
}
