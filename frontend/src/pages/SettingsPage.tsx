import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { authAPI } from "@/api/authApi";
import { cafe24API } from "@/api/cafe24Api";
import { toast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/utils/errorHandler";

export default function SettingsPage() {
  const { currentAdmin } = useAuth();

  return (
    <div className="flex-1 overflow-y-auto">
    <div className="p-6 max-w-2xl space-y-6">
      {/* 내 계정 섹션 */}
      <Section title="내 계정">
        <AccountSettings adminId={currentAdmin?.admin_id} />
      </Section>

      {/* Cafe24 연동 섹션 */}
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

const MALL_ID = "your-mall-id";

function Cafe24Settings() {
  const { data: statusRes, isLoading, refetch } = useQuery({
    queryKey: ["cafe24-status"],
    queryFn: () => cafe24API.getStatus(MALL_ID),
    retry: false,
  });

  const refreshMutation = useMutation({
    mutationFn: () => cafe24API.refreshToken(MALL_ID),
    onSuccess: () => {
      toast.success("Cafe24 토큰이 갱신되었습니다.");
      refetch();
    },
    onError: () => toast.error("토큰 갱신 실패"),
  });

  if (isLoading) {
    return <p className="text-sm text-gray-400">상태 확인 중...</p>;
  }

  const status = statusRes as any;
  const isConnected = status?.is_connected ?? false;
  const expiresAt = status?.expires_at;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <span
          className={`inline-block w-2 h-2 rounded-full ${
            isConnected ? "bg-green-500" : "bg-gray-300"
          }`}
        />
        <span className="text-sm text-gray-700">
          {isConnected ? "연결됨" : "연결되지 않음"}
        </span>
        {expiresAt && (
          <span className="text-xs text-gray-400">
            만료: {new Date(expiresAt).toLocaleString("ko-KR")}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        {isConnected && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => refreshMutation.mutate()}
            disabled={refreshMutation.isPending}
          >
            토큰 갱신
          </Button>
        )}
        {!isConnected && (
          <Button
            size="sm"
            onClick={() =>
              cafe24API
                .startOAuth({ mall_id: MALL_ID, scopes: ["mall.read_order", "mall.write_order"] })
                .then((res) => {
                  if ((res as any).auth_url) {
                    window.open((res as any).auth_url, "_blank");
                  }
                })
                .catch(() => toast.error("OAuth 시작 실패"))
            }
          >
            Cafe24 연결하기
          </Button>
        )}
      </div>
      <p className="text-xs text-gray-400">
        Cafe24 주문을 가져오려면 OAuth 연동이 필요합니다.
      </p>
    </div>
  );
}
