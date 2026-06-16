import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Eye, EyeOff, RefreshCw, ChevronDown, ChevronUp, Plus } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ConfirmModal } from "@/components/common/ConfirmModal";
import { StatusBadge } from "@/components/common/StatusBadge";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { useAuth } from "@/contexts/AuthContext";
import { authAPI } from "@/api/authApi";
import { cafe24API } from "@/api/cafe24Api";
import { adminsApi } from "@/api/adminsApi";
import { toast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/utils/errorHandler";
import { formatDateTime } from "@/utils/format";
import { cn } from "@/utils/cn";
import type { AdminResponse } from "@/types/admin";

export default function SettingsPage() {
  const { currentAdmin } = useAuth();
  const isSuperAdmin = currentAdmin?.admin_role === "SUPER_ADMIN";
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  // 관리자 등록 모달
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    email: "", admin_name: "", plain_password: "", admin_role: "ADMIN" as string,
  });

  // 정보 수정 모달
  const [editTarget, setEditTarget] = useState<AdminResponse | null>(null);
  const [editForm, setEditForm] = useState({ admin_name: "", email: "" });

  // 확인 모달
  const [toggleTarget, setToggleTarget] = useState<AdminResponse | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminResponse | null>(null);
  const [restoreTarget, setRestoreTarget] = useState<AdminResponse | null>(null);

  useEffect(() => {
    const cafe24Result = searchParams.get("cafe24");
    if (!cafe24Result) return;
    if (cafe24Result === "success") toast.success("Cafe24 연동이 완료되었습니다.");
    else if (cafe24Result === "error") {
      const message = searchParams.get("message") || "알 수 없는 오류";
      toast.error(`Cafe24 연동 실패: ${message}`);
    }
    searchParams.delete("cafe24");
    searchParams.delete("message");
    setSearchParams(searchParams, { replace: true });
  }, [searchParams, setSearchParams]);

  const { data, isLoading } = useQuery({
    queryKey: ["admins"],
    queryFn: () =>
      adminsApi.getAdmins({ page: 1, limit: 50 }).then((r) => r.data),
    enabled: isSuperAdmin,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["admins"] });

  const createMutation = useMutation({
    mutationFn: () =>
      adminsApi.createAdmin({ ...createForm, admin_role: createForm.admin_role as any, is_active: true }),
    onSuccess: () => {
      toast.success("관리자가 등록되었습니다.");
      invalidate();
      setCreateOpen(false);
      setCreateForm({ email: "", admin_name: "", plain_password: "", admin_role: "ADMIN" });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const updateMutation = useMutation({
    mutationFn: () => adminsApi.updateAdmin(editTarget!.admin_id, editForm as any),
    onSuccess: () => { toast.success("관리자 정보가 수정되었습니다."); invalidate(); setEditTarget(null); },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const roleMutation = useMutation({
    mutationFn: ({ adminId, role }: { adminId: number; role: string }) =>
      adminsApi.changeAdminRole(adminId, { admin_role: role as any }),
    onSuccess: () => { toast.success("권한이 변경되었습니다."); invalidate(); },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const toggleMutation = useMutation({
    mutationFn: (admin: AdminResponse) =>
      admin.is_active ? adminsApi.deactivateAdmin(admin.admin_id) : adminsApi.activateAdmin(admin.admin_id),
    onSuccess: () => {
      toast.success(toggleTarget?.is_active ? "비활성화되었습니다." : "활성화되었습니다.");
      invalidate();
      setToggleTarget(null);
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const deleteMutation = useMutation({
    mutationFn: (adminId: number) => adminsApi.deleteAdmin(adminId),
    onSuccess: () => { toast.success("관리자가 삭제되었습니다."); invalidate(); setDeleteTarget(null); },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const restoreMutation = useMutation({
    mutationFn: (adminId: number) => adminsApi.restoreAdmin(adminId),
    onSuccess: () => { toast.success("관리자가 복구되었습니다."); invalidate(); setRestoreTarget(null); },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  // SUPER_ADMIN: 전체 목록 (본인 카드 맨 앞) / 일반 관리자: 본인 카드만
  const rawItems: AdminResponse[] = isSuperAdmin
    ? (data?.items ?? [])
    : currentAdmin
      ? [currentAdmin as unknown as AdminResponse]
      : [];
  const items = [...rawItems].sort((a, b) =>
    a.admin_id === currentAdmin?.admin_id ? -1 : b.admin_id === currentAdmin?.admin_id ? 1 : 0
  );

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <PageHeader
        left={
          isSuperAdmin
            ? <span className="text-sm text-gray-500">총 {data?.total ?? 0}명</span>
            : undefined
        }
        actions={
          isSuperAdmin ? (
            <Button size="sm" onClick={() => setCreateOpen(true)} className="gap-1">
              <Plus className="h-3.5 w-3.5" />
              관리자 등록
            </Button>
          ) : undefined
        }
      />

      <div className="flex-1 overflow-y-auto p-5 space-y-6">
        {/* 관리자 카드 그리드 */}
        {isLoading ? (
          <div className="flex justify-center py-12"><LoadingSpinner size="md" /></div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4">
            {items.map((admin) => {
              const isSelf = admin.admin_id === currentAdmin?.admin_id;
              return isSelf ? (
                <SelfAdminCard key={admin.admin_id} admin={admin} />
              ) : (
                <OtherAdminCard
                  key={admin.admin_id}
                  admin={admin}
                  onEdit={(a) => { setEditTarget(a); setEditForm({ admin_name: a.admin_name, email: a.email }); }}
                  onRoleChange={(adminId, role) => roleMutation.mutate({ adminId, role })}
                  onToggle={(a) => setToggleTarget(a)}
                  onDelete={(a) => setDeleteTarget(a)}
                  onRestore={(a) => setRestoreTarget(a)}
                />
              );
            })}
          </div>
        )}

        {/* Cafe24 연동 */}
        <CardSection title="CAFE24 연동">
          <Cafe24Settings />
        </CardSection>
      </div>

      {/* 관리자 등록 모달 */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>관리자 등록</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label>이름 <span className="text-red-500 ml-0.5">*</span></Label>
              <Input className="mt-1" value={createForm.admin_name}
                onChange={(e) => setCreateForm((f) => ({ ...f, admin_name: e.target.value }))} placeholder="이름" />
            </div>
            <div>
              <Label>이메일 <span className="text-red-500 ml-0.5">*</span></Label>
              <Input className="mt-1" type="email" value={createForm.email}
                onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))} placeholder="이메일" />
            </div>
            <div>
              <Label>비밀번호 <span className="text-red-500 ml-0.5">*</span></Label>
              <Input className="mt-1" type="password" value={createForm.plain_password}
                onChange={(e) => setCreateForm((f) => ({ ...f, plain_password: e.target.value }))} placeholder="비밀번호" />
            </div>
            <div>
              <Label>권한</Label>
              <Select value={createForm.admin_role} onValueChange={(v) => setCreateForm((f) => ({ ...f, admin_role: v }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="SUPER_ADMIN">슈퍼관리자</SelectItem>
                  <SelectItem value="ADMIN">관리자</SelectItem>
                  <SelectItem value="MANAGER">매니저</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>취소</Button>
            <Button onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending || !createForm.email || !createForm.admin_name || !createForm.plain_password}>
              등록
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 정보 수정 모달 */}
      <Dialog open={!!editTarget} onOpenChange={(open) => !open && setEditTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>관리자 정보 수정</DialogTitle></DialogHeader>
          <div className="space-y-3 py-1">
            <div>
              <Label>이름 <span className="text-red-500 ml-0.5">*</span></Label>
              <Input className="mt-1" value={editForm.admin_name}
                onChange={(e) => setEditForm((f) => ({ ...f, admin_name: e.target.value }))} />
            </div>
            <div>
              <Label>이메일 <span className="text-red-500 ml-0.5">*</span></Label>
              <Input className="mt-1" type="email" value={editForm.email}
                onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTarget(null)}>취소</Button>
            <Button onClick={() => updateMutation.mutate()}
              disabled={updateMutation.isPending || !editForm.admin_name || !editForm.email}>
              저장
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 확인 모달들 */}
      <ConfirmModal
        open={!!toggleTarget}
        onClose={() => setToggleTarget(null)}
        onConfirm={() => toggleTarget && toggleMutation.mutate(toggleTarget)}
        title={toggleTarget?.is_active ? "관리자 비활성화" : "관리자 활성화"}
        description={`${toggleTarget?.admin_name}님을 ${toggleTarget?.is_active ? "비활성화" : "활성화"}합니다.`}
        confirmLabel={toggleTarget?.is_active ? "비활성화" : "활성화"}
        variant={toggleTarget?.is_active ? "destructive" : "default"}
        isLoading={toggleMutation.isPending}
      />
      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.admin_id)}
        title="관리자 삭제"
        description={`${deleteTarget?.admin_name}님을 삭제합니다. 이 작업은 취소하기 어렵습니다.`}
        confirmLabel="삭제"
        variant="destructive"
        isLoading={deleteMutation.isPending}
      />
      <ConfirmModal
        open={!!restoreTarget}
        onClose={() => setRestoreTarget(null)}
        onConfirm={() => restoreTarget && restoreMutation.mutate(restoreTarget.admin_id)}
        title="관리자 복구"
        description={`${restoreTarget?.admin_name}님을 복구합니다.`}
        confirmLabel="복구"
        isLoading={restoreMutation.isPending}
      />
    </div>
  );
}

// ─── 관리자 카드 (본인/타인 통합) ────────────────────────────────────────────

const ROLE_BADGE_CLASS: Record<string, string> = {
  SUPER_ADMIN: "bg-red-50 text-red-700 hover:bg-red-100",
  ADMIN: "bg-blue-50 text-blue-700 hover:bg-blue-100",
  MANAGER: "bg-gray-100 text-gray-600 hover:bg-gray-200",
};

interface AdminCardProps {
  admin: AdminResponse;
  isSelf: boolean;
  onEdit?: (admin: AdminResponse) => void;
  onRoleChange?: (adminId: number, role: string) => void;
  onToggle?: (admin: AdminResponse) => void;
  onDelete?: (admin: AdminResponse) => void;
  onRestore?: (admin: AdminResponse) => void;
}

function AdminCard({ admin, isSelf, onEdit, onRoleChange, onToggle, onDelete, onRestore }: AdminCardProps) {
  const [pwOpen, setPwOpen] = useState(false);
  const initials = admin.admin_name.slice(0, 1);
  const isDeleted = admin.is_deleted;
  const isActive = admin.is_active && !isDeleted;

  return (
    <div className={cn(
      "bg-white border rounded-xl p-5 flex flex-col gap-4 transition-all",
      isSelf
        ? "border-blue-200 hover:shadow-sm"
        : isDeleted
          ? "border-gray-200 opacity-60"
          : "border-gray-200 hover:border-gray-300 hover:shadow-sm"
    )}>
      {/* 상단: 아바타 + 이름/이메일 */}
      <div className="flex items-center gap-3">
        <div className={cn(
          "w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-semibold",
          isActive ? "bg-blue-100 text-blue-600" : "bg-gray-100 text-gray-400"
        )}>
          {initials}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-semibold text-gray-900 truncate">{admin.admin_name}</span>
            {isSelf && (
              <span className="text-[10px] bg-blue-50 text-blue-500 px-1.5 py-0.5 rounded font-medium flex-shrink-0">
                내 계정
              </span>
            )}
          </div>
          <div className="text-xs text-gray-400 truncate mt-0.5">{admin.email}</div>
        </div>
      </div>

      {/* 중간: 권한 + 상태 + 로그인 */}
      <div className="border-t border-gray-100 pt-3 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-400 w-16 flex-shrink-0">권한</span>
          <div className="flex-1">
            {isSelf || isDeleted ? (
              <StatusBadge type="admin_role" value={admin.admin_role} />
            ) : (
              <Select value={admin.admin_role} onValueChange={(v) => onRoleChange?.(admin.admin_id, v)}>
                <SelectTrigger className={cn(
                  "h-auto w-auto inline-flex border-0 shadow-none",
                  "focus:ring-0 focus:ring-offset-0 focus:border-0",
                  "py-0.5 px-1.5 text-[11px] font-medium rounded gap-1",
                  ROLE_BADGE_CLASS[admin.admin_role] ?? "bg-gray-100 text-gray-600 hover:bg-gray-200"
                )}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SUPER_ADMIN">슈퍼관리자</SelectItem>
                  <SelectItem value="ADMIN">관리자</SelectItem>
                  <SelectItem value="MANAGER">매니저</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-400 w-16 flex-shrink-0">상태</span>
          {isDeleted ? (
            <span className="text-xs text-red-400 flex-1">삭제됨</span>
          ) : (
            <span className={cn("text-xs flex-1", admin.is_active ? "text-green-600" : "text-gray-400")}>
              {admin.is_active ? "● 활성" : "● 비활성"}
            </span>
          )}
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-400 w-16 flex-shrink-0">로그인</span>
          <span className="text-xs text-gray-500 flex-1">
            {admin.last_login_at ? formatDateTime(admin.last_login_at) : "없음"}
          </span>
        </div>
      </div>

      {/* 하단: 액션 버튼 */}
      <div className="border-t border-gray-100 pt-3">
        {isSelf ? (
          <Button variant="outline" size="sm" onClick={() => setPwOpen(true)}>
            비밀번호 변경
          </Button>
        ) : isDeleted ? (
          <Button variant="outline" size="sm" onClick={() => onRestore?.(admin)}>
            복구
          </Button>
        ) : (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => onEdit?.(admin)}>
              수정
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onToggle?.(admin)}
              className={admin.is_active ? "text-amber-600 border-amber-200 hover:bg-amber-50" : ""}
            >
              {admin.is_active ? "비활성화" : "활성화"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onDelete?.(admin)}
              className="text-red-500 border-red-200 hover:bg-red-50"
            >
              삭제
            </Button>
          </div>
        )}
      </div>

      {isSelf && <PasswordChangeModal open={pwOpen} onClose={() => setPwOpen(false)} />}
    </div>
  );
}

function SelfAdminCard({ admin }: { admin: AdminResponse }) {
  return <AdminCard admin={admin} isSelf />;
}

interface OtherAdminCardProps {
  admin: AdminResponse;
  onEdit: (admin: AdminResponse) => void;
  onRoleChange: (adminId: number, role: string) => void;
  onToggle: (admin: AdminResponse) => void;
  onDelete: (admin: AdminResponse) => void;
  onRestore: (admin: AdminResponse) => void;
}

function OtherAdminCard({ admin, onEdit, onRoleChange, onToggle, onDelete, onRestore }: OtherAdminCardProps) {
  return (
    <AdminCard
      admin={admin}
      isSelf={false}
      onEdit={onEdit}
      onRoleChange={onRoleChange}
      onToggle={onToggle}
      onDelete={onDelete}
      onRestore={onRestore}
    />
  );
}

// ─── 비밀번호 변경 모달 ───────────────────────────────────────────────────────

function PasswordChangeModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const reset = () => {
    setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
    setShowCurrent(false); setShowNew(false); setShowConfirm(false);
  };

  const mutation = useMutation({
    mutationFn: () => authAPI.changePassword({ current_password: currentPassword, new_password: newPassword }),
    onSuccess: () => { toast.success("비밀번호가 변경되었습니다."); reset(); onClose(); },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) { toast.error("새 비밀번호가 일치하지 않습니다."); return; }
    if (newPassword.length < 8) { toast.error("비밀번호는 8자 이상이어야 합니다."); return; }
    mutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { reset(); onClose(); } }}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>비밀번호 변경</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3 py-1">
          <PasswordField label="현재 비밀번호" value={currentPassword} onChange={setCurrentPassword}
            show={showCurrent} onToggleShow={() => setShowCurrent((v) => !v)} placeholder="현재 비밀번호" />
          <PasswordField label="새 비밀번호" value={newPassword} onChange={setNewPassword}
            show={showNew} onToggleShow={() => setShowNew((v) => !v)} placeholder="8자 이상, 영문+숫자+특수문자 포함" />
          <PasswordField label="새 비밀번호 확인" value={confirmPassword} onChange={setConfirmPassword}
            show={showConfirm} onToggleShow={() => setShowConfirm((v) => !v)} placeholder="새 비밀번호 재입력" />
          <DialogFooter className="pt-1">
            <Button type="button" variant="outline" onClick={() => { reset(); onClose(); }}>취소</Button>
            <Button type="submit" disabled={mutation.isPending || !currentPassword || !newPassword || !confirmPassword}>
              변경
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PasswordField({
  label, value, onChange, show, onToggleShow, placeholder,
}: {
  label: string; value: string; onChange: (v: string) => void;
  show: boolean; onToggleShow: () => void; placeholder?: string;
}) {
  return (
    <div>
      <Label className="text-xs text-gray-500">{label}</Label>
      <div className="relative mt-1">
        <Input type={show ? "text" : "password"} value={value}
          onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="h-8 text-sm pr-9" />
        <button type="button"
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          onClick={onToggleShow}>
          {show ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
        </button>
      </div>
    </div>
  );
}

// ─── 카드 섹션 ────────────────────────────────────────────────────────────────

function CardSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border border-gray-100 rounded-xl overflow-hidden">
      <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{title}</h3>
      </div>
      <div className="px-4 py-4">{children}</div>
    </div>
  );
}

// ─── Cafe24 연동 ──────────────────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-gray-400 w-20 flex-shrink-0">{label}</span>
      <span className="text-sm text-gray-800">{value}</span>
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

  if (isLoading) return <p className="text-sm text-gray-400">확인 중...</p>;
  if (isError) return <p className="text-sm text-red-500">상태를 확인할 수 없습니다.</p>;

  const authorized = status?.authorized ?? false;
  const expiresAt = status?.expires_at;
  const refreshExpiresAt = status?.refresh_token_expires_at;
  const refreshExpired = refreshExpiresAt ? new Date(refreshExpiresAt) < new Date() : false;

  const tokenStatus = !authorized ? "not_connected" : refreshExpired ? "reconnect_required" : "active";
  const statusConfig = {
    not_connected: { dotColor: "bg-gray-300", label: "미연동", labelColor: "text-gray-500" },
    active: { dotColor: "bg-green-500", label: "연동됨", labelColor: "text-green-700" },
    reconnect_required: { dotColor: "bg-red-500", label: "재연결 필요", labelColor: "text-red-600" },
  };
  const { dotColor, label, labelColor } = statusConfig[tokenStatus];

  return (
    <div className="space-y-3.5">
      <div className="flex items-center gap-2">
        <span className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${dotColor}`} />
        <span className={`text-sm font-medium ${labelColor}`}>{label}</span>
      </div>

      {authorized && (
        <div className="space-y-2">
          {status?.mall_id && (
            <InfoRow label="몰 ID" value={<span className="font-mono">{status.mall_id}</span>} />
          )}
          {expiresAt && (
            <InfoRow label="액세스 토큰" value={<span className="text-gray-500 text-xs">{formatRelativeTime(expiresAt)}</span>} />
          )}
          {refreshExpiresAt && (
            <InfoRow label="리프레시 토큰" value={
              <span className={`text-xs ${refreshExpired ? "text-red-500 font-medium" : "text-gray-500"}`}>
                {formatRelativeTime(refreshExpiresAt)}
              </span>
            } />
          )}
          {status?.scopes && status.scopes.length > 0 && (
            <div>
              <Button variant="ghost" size="sm" className="gap-1 mt-1" onClick={() => setShowScopes((v) => !v)}>
                스코프 (개발자용)
                {showScopes ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </Button>
              {showScopes && (
                <p className="mt-1.5 text-[11px] text-gray-500 font-mono bg-gray-50 rounded px-2.5 py-2 break-all leading-relaxed">
                  {status.scopes.join(", ")}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {tokenStatus === "reconnect_required" && (
        <p className="text-xs text-red-500 bg-red-50 rounded px-2.5 py-2">인증이 만료되었습니다. 다시 연결해주세요.</p>
      )}
      {tokenStatus === "not_connected" && (
        <p className="text-xs text-gray-400">Cafe24 API를 사용하려면 OAuth 연동이 필요합니다.</p>
      )}

      <div>
        {tokenStatus === "not_connected" && (
          <Button size="sm" onClick={handleConnect} disabled={connecting}>연결하기</Button>
        )}
        {tokenStatus === "active" && (
          <Button variant="outline" size="sm" onClick={handleConnect} disabled={connecting} className="gap-1">
            <RefreshCw className="h-3 w-3" />재연결
          </Button>
        )}
        {tokenStatus === "reconnect_required" && (
          <Button size="sm" onClick={handleConnect} disabled={connecting}>다시 연결</Button>
        )}
      </div>
    </div>
  );
}
