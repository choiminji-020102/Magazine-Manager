import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, MoreHorizontal } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { FilterBar } from "@/components/common/FilterBar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Shield } from "lucide-react";
import { adminsApi } from "@/api/adminsApi";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/utils/errorHandler";
import { formatDateTime } from "@/utils/format";
import { ADMIN_ROLE_LABEL } from "@/utils/constants";
import { cn } from "@/utils/cn";
import type { AdminResponse } from "@/types/admin";

export default function AdminListPage() {
  const { currentAdmin } = useAuth();

  if (currentAdmin?.admin_role !== "SUPER_ADMIN") {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-400">
        <Shield className="h-10 w-10 text-gray-300" />
        <p className="text-sm">SUPER_ADMIN 권한이 필요합니다.</p>
      </div>
    );
  }

  return <AdminListContent />;
}

export function AdminListContent() {
  const { currentAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [showDeleted, setShowDeleted] = useState(false);

  // 관리자 등록 모달
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({
    email: "",
    admin_name: "",
    plain_password: "",
    admin_role: "ADMIN" as string,
  });

  // 정보 수정 모달
  const [editTarget, setEditTarget] = useState<AdminResponse | null>(null);
  const [editForm, setEditForm] = useState({ admin_name: "", email: "" });

  // 확인 모달
  const [toggleTarget, setToggleTarget] = useState<AdminResponse | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminResponse | null>(null);
  const [restoreTarget, setRestoreTarget] = useState<AdminResponse | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admins", showDeleted],
    queryFn: () =>
      adminsApi.getAdmins({ page: 1, limit: 50, is_deleted: showDeleted || undefined }).then((r) => r.data),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["admins"] });

  const createMutation = useMutation({
    mutationFn: () =>
      adminsApi.createAdmin({ ...form, admin_role: form.admin_role as any, is_active: true }),
    onSuccess: () => {
      toast.success("관리자가 등록되었습니다.");
      invalidate();
      setCreateOpen(false);
      setForm({ email: "", admin_name: "", plain_password: "", admin_role: "ADMIN" });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const updateMutation = useMutation({
    mutationFn: () =>
      adminsApi.updateAdmin(editTarget!.admin_id, editForm as any),
    onSuccess: () => {
      toast.success("관리자 정보가 수정되었습니다.");
      invalidate();
      setEditTarget(null);
    },
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

  const items = data?.items ?? [];

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <PageHeader
        left={<span className="text-sm text-gray-500">총 {data?.total ?? 0}명</span>}
        actions={
          !showDeleted && (
            <Button size="sm" onClick={() => setCreateOpen(true)} className="gap-1">
              <Plus className="h-3.5 w-3.5" />
              관리자 등록
            </Button>
          )
        }
      />

      <FilterBar
        basic={
          <button
            onClick={() => setShowDeleted((v) => !v)}
            className={`text-xs px-2.5 py-1.5 rounded border transition-colors whitespace-nowrap ${
              showDeleted
                ? "bg-gray-100 border-gray-300 text-gray-600 font-medium"
                : "border-gray-200 text-gray-500 hover:bg-gray-50"
            }`}
          >
            삭제된 관리자 포함
          </button>
        }
        hasActiveFilters={showDeleted}
        onReset={() => setShowDeleted(false)}
        chips={showDeleted ? [{ label: "삭제된 관리자 포함", onRemove: () => setShowDeleted(false) }] : []}
      />

      {/* 카드 그리드 */}
      <div className="flex-1 overflow-y-auto p-5">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <LoadingSpinner size="md" />
          </div>
        ) : items.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-12">관리자가 없습니다.</p>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4">
            {items.map((admin) => (
              <AdminCard
                key={admin.admin_id}
                admin={admin}
                isSelf={admin.admin_id === currentAdmin?.admin_id}
                onEdit={(a) => { setEditTarget(a); setEditForm({ admin_name: a.admin_name, email: a.email }); }}
                onRoleChange={(adminId, role) => roleMutation.mutate({ adminId, role })}
                onToggle={(a) => setToggleTarget(a)}
                onDelete={(a) => setDeleteTarget(a)}
                onRestore={(a) => setRestoreTarget(a)}
              />
            ))}
          </div>
        )}
      </div>

      {/* 관리자 등록 모달 */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>관리자 등록</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label>이름 <span className="text-red-500 ml-0.5">*</span></Label>
              <Input className="mt-1" value={form.admin_name}
                onChange={(e) => setForm((f) => ({ ...f, admin_name: e.target.value }))} placeholder="이름" />
            </div>
            <div>
              <Label>이메일 <span className="text-red-500 ml-0.5">*</span></Label>
              <Input className="mt-1" type="email" value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="이메일" />
            </div>
            <div>
              <Label>비밀번호 <span className="text-red-500 ml-0.5">*</span></Label>
              <Input className="mt-1" type="password" value={form.plain_password}
                onChange={(e) => setForm((f) => ({ ...f, plain_password: e.target.value }))} placeholder="비밀번호" />
            </div>
            <div>
              <Label>권한</Label>
              <Select value={form.admin_role} onValueChange={(v) => setForm((f) => ({ ...f, admin_role: v }))}>
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
              disabled={createMutation.isPending || !form.email || !form.admin_name || !form.plain_password}>
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

interface AdminCardProps {
  admin: AdminResponse;
  isSelf: boolean;

  onEdit: (admin: AdminResponse) => void;
  onRoleChange: (adminId: number, role: string) => void;
  onToggle: (admin: AdminResponse) => void;
  onDelete: (admin: AdminResponse) => void;
  onRestore: (admin: AdminResponse) => void;
}

function AdminCard({ admin, isSelf, onEdit, onRoleChange, onToggle, onDelete, onRestore }: AdminCardProps) {
  const initials = admin.admin_name.slice(0, 1);
  const isDeleted = admin.is_deleted;

  return (
    <div className={cn(
      "bg-white border rounded-xl p-4 flex flex-col gap-3 transition-all",
      isDeleted
        ? "border-gray-200 opacity-60"
        : "border-gray-200 hover:border-gray-300 hover:shadow-sm"
    )}>
      {/* 상단: 아바타 + 이름 + 더보기 */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3">
          <div className={cn(
            "w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-base font-semibold",
            !admin.is_active || isDeleted ? "bg-gray-100 text-gray-400" : "bg-blue-100 text-blue-600"
          )}>
            {initials}
          </div>
          <div className="min-w-0">
            <div className="text-sm font-medium text-gray-900 truncate">{admin.admin_name}</div>
            <div className="text-xs text-gray-400 truncate">{admin.email}</div>
          </div>
        </div>

        {!isSelf && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" className="flex-shrink-0">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {isDeleted ? (
                <DropdownMenuItem onClick={() => onRestore(admin)}>복구</DropdownMenuItem>
              ) : (
                <>
                  <DropdownMenuItem onClick={() => onEdit(admin)}>정보 수정</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {(["SUPER_ADMIN", "ADMIN", "MANAGER"] as const).map((role) =>
                    admin.admin_role !== role ? (
                      <DropdownMenuItem key={role} onClick={() => onRoleChange(admin.admin_id, role)}>
                        {ADMIN_ROLE_LABEL[role]}로 변경
                      </DropdownMenuItem>
                    ) : null
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => onToggle(admin)}>
                    {admin.is_active ? "비활성화" : "활성화"}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-red-600 focus:text-red-600 focus:bg-red-50"
                    onClick={() => onDelete(admin)}
                  >
                    삭제
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* 하단: 권한 + 상태 */}
      <div className="flex items-center justify-between pt-1 border-t border-gray-100">
        <StatusBadge type="admin_role" value={admin.admin_role} />
        {isDeleted ? (
          <span className="text-xs text-red-400">삭제됨</span>
        ) : (
          <span className={cn("text-xs", admin.is_active ? "text-green-600" : "text-gray-400")}>
            {admin.is_active ? "● 활성" : "● 비활성"}
          </span>
        )}
      </div>

      {/* 최근 로그인 */}
      <div className="text-xs text-gray-400">
        최근 로그인: {admin.last_login_at ? formatDateTime(admin.last_login_at) : "없음"}
      </div>
    </div>
  );
}
