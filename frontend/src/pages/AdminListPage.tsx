import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, MoreHorizontal, Shield } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
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
import { DataTable, type ColumnDef } from "@/components/common/DataTable";
import { ConfirmModal } from "@/components/common/ConfirmModal";
import { StatusBadge } from "@/components/common/StatusBadge";
import { adminsApi } from "@/api/adminsApi";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { formatDateTime } from "@/utils/format";
import { ADMIN_ROLE_LABEL } from "@/utils/constants";
import type { AdminResponse } from "@/types/admin";

export default function AdminListPage() {
  const { currentAdmin } = useAuth();

  // SUPER_ADMIN이 아니면 접근 거부
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

function AdminListContent() {
  const { currentAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AdminResponse | null>(null);
  const [restoreTarget, setRestoreTarget] = useState<AdminResponse | null>(null);
  const [toggleTarget, setToggleTarget] = useState<AdminResponse | null>(null);
  const [editTarget, setEditTarget] = useState<AdminResponse | null>(null);
  const [editForm, setEditForm] = useState({ admin_name: "", email: "" });
  const [showDeleted, setShowDeleted] = useState(false);

  // 관리자 생성 폼 상태
  const [form, setForm] = useState({
    email: "",
    admin_name: "",
    plain_password: "",
    admin_role: "ADMIN" as string,
    is_active: true,
  });

  const { data, isLoading } = useQuery({
    queryKey: ["admins", showDeleted],
    queryFn: () =>
      adminsApi.getAdmins({ page: 1, limit: 50, is_deleted: showDeleted || undefined }).then((r) => r.data),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      adminsApi.createAdmin({
        ...form,
        admin_role: form.admin_role as any,
        is_active: true,
      }),
    onSuccess: () => {
      toast.success("관리자가 등록되었습니다.");
      queryClient.invalidateQueries({ queryKey: ["admins"] });
      setCreateOpen(false);
      setForm({ email: "", admin_name: "", plain_password: "", admin_role: "ADMIN", is_active: true });
    },
    onError: () => toast.error("관리자 등록 실패"),
  });

  const toggleMutation = useMutation({
    mutationFn: (admin: AdminResponse) =>
      admin.is_active
        ? adminsApi.deactivateAdmin(admin.admin_id)
        : adminsApi.activateAdmin(admin.admin_id),
    onSuccess: () => {
      toast.success(toggleTarget?.is_active ? "비활성화되었습니다." : "활성화되었습니다.");
      queryClient.invalidateQueries({ queryKey: ["admins"] });
      setToggleTarget(null);
    },
    onError: () => toast.error("처리 실패"),
  });

  const deleteMutation = useMutation({
    mutationFn: (adminId: number) => adminsApi.deleteAdmin(adminId),
    onSuccess: () => {
      toast.success("관리자가 삭제되었습니다.");
      queryClient.invalidateQueries({ queryKey: ["admins"] });
      setDeleteTarget(null);
    },
    onError: () => toast.error("삭제 실패"),
  });

  const restoreMutation = useMutation({
    mutationFn: (adminId: number) => adminsApi.restoreAdmin(adminId),
    onSuccess: () => {
      toast.success("관리자가 복구되었습니다.");
      queryClient.invalidateQueries({ queryKey: ["admins"] });
      setRestoreTarget(null);
    },
    onError: () => toast.error("복구 실패"),
  });

  const updateAdminMutation = useMutation({
    mutationFn: ({ adminId, data }: { adminId: number; data: { admin_name?: string; email?: string } }) =>
      adminsApi.updateAdmin(adminId, data as any),
    onSuccess: () => {
      toast.success("관리자 정보가 수정되었습니다.");
      queryClient.invalidateQueries({ queryKey: ["admins"] });
      setEditTarget(null);
    },
    onError: () => toast.error("수정 실패"),
  });

  const roleMutation = useMutation({
    mutationFn: ({ adminId, role }: { adminId: number; role: string }) =>
      adminsApi.changeAdminRole(adminId, { admin_role: role as any }),
    onSuccess: () => {
      toast.success("권한이 변경되었습니다.");
      queryClient.invalidateQueries({ queryKey: ["admins"] });
    },
    onError: () => toast.error("권한 변경 실패"),
  });

  const columns: ColumnDef<AdminResponse>[] = [
    {
      key: "name",
      header: "관리자",
      cell: (row) => (
        <div>
          <div className="font-medium text-gray-900 text-[13px]">{row.admin_name}</div>
          <div className="text-xs text-gray-400">{row.email}</div>
        </div>
      ),
    },
    {
      key: "role",
      header: "권한",
      cell: (row) => <StatusBadge type="admin_role" value={row.admin_role} />,
      width: "w-28",
    },
    {
      key: "active",
      header: "상태",
      cell: (row) => (
        <span className={`text-xs ${row.is_active ? "text-green-600" : "text-gray-400"}`}>
          {row.is_active ? "활성" : "비활성"}
        </span>
      ),
      width: "w-16",
    },
    {
      key: "last_login",
      header: "최근 로그인",
      cell: (row) => (
        <span className="text-xs text-gray-400">
          {row.last_login_at ? formatDateTime(row.last_login_at) : "-"}
        </span>
      ),
      width: "w-36",
    },
    {
      key: "created_at",
      header: "등록일",
      cell: (row) => (
        <span className="text-xs text-gray-400">{formatDateTime(row.created_at)}</span>
      ),
      width: "w-36",
    },
    {
      key: "actions",
      header: "",
      cell: (row) => {
        const isSelf = row.admin_id === currentAdmin?.admin_id;
        if (isSelf) return null;
        // 삭제된 관리자: 복구만 가능
        if (showDeleted) {
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                <Button variant="ghost" size="icon-sm">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={(e) => { e.stopPropagation(); setRestoreTarget(row); }}
                >
                  복구
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          );
        }
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="icon-sm">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  setEditTarget(row);
                  setEditForm({ admin_name: row.admin_name, email: row.email });
                }}
              >
                정보 수정
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {/* 권한 변경 */}
              {(["SUPER_ADMIN", "ADMIN", "MANAGER"] as const).map((role) =>
                row.admin_role !== role ? (
                  <DropdownMenuItem
                    key={role}
                    onClick={(e) => {
                      e.stopPropagation();
                      roleMutation.mutate({ adminId: row.admin_id, role });
                    }}
                  >
                    {ADMIN_ROLE_LABEL[role]}(으)로 변경
                  </DropdownMenuItem>
                ) : null
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  setToggleTarget(row);
                }}
              >
                {row.is_active ? "비활성화" : "활성화"}
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-red-600 focus:text-red-600 focus:bg-red-50"
                onClick={(e) => {
                  e.stopPropagation();
                  setDeleteTarget(row);
                }}
              >
                삭제
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
      width: "w-12",
      className: "text-right",
    },
  ];

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      {/* 헤더 */}
      <PageHeader
        left={<span className="text-sm text-gray-500">총 {data?.total ?? 0}명</span>}
        actions={
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant={showDeleted ? "default" : "outline"}
              onClick={() => setShowDeleted((v) => !v)}
              className="gap-1 text-xs"
            >
              {showDeleted ? "활성 관리자 보기" : "삭제된 관리자 보기"}
            </Button>
            {!showDeleted && (
              <Button size="sm" onClick={() => setCreateOpen(true)} className="gap-1">
                <Plus className="h-3.5 w-3.5" />
                관리자 등록
              </Button>
            )}
          </div>
        }
      />

      {/* 테이블 */}
      <div className="flex-1 overflow-hidden bg-white">
        <div className="h-full overflow-y-auto">
          <DataTable
            columns={columns}
            data={data?.items ?? []}
            getRowId={(row) => row.admin_id}
            isLoading={isLoading}
            emptyMessage="관리자가 없습니다."
          />
        </div>
      </div>

      {/* 관리자 등록 모달 */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>관리자 등록</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label htmlFor="admin-name">이름 <span className="text-red-500 ml-0.5">*</span></Label>
              <Input
                id="admin-name"
                className="mt-1"
                value={form.admin_name}
                onChange={(e) => setForm((f) => ({ ...f, admin_name: e.target.value }))}
                placeholder="이름"
              />
            </div>
            <div>
              <Label htmlFor="admin-email">이메일 <span className="text-red-500 ml-0.5">*</span></Label>
              <Input
                id="admin-email"
                type="email"
                className="mt-1"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="이메일"
              />
            </div>
            <div>
              <Label htmlFor="admin-password">비밀번호 <span className="text-red-500 ml-0.5">*</span></Label>
              <Input
                id="admin-password"
                type="password"
                className="mt-1"
                value={form.plain_password}
                onChange={(e) => setForm((f) => ({ ...f, plain_password: e.target.value }))}
                placeholder="비밀번호"
              />
            </div>
            <div>
              <Label>권한</Label>
              <Select
                value={form.admin_role}
                onValueChange={(v) => setForm((f) => ({ ...f, admin_role: v }))}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SUPER_ADMIN">슈퍼관리자</SelectItem>
                  <SelectItem value="ADMIN">관리자</SelectItem>
                  <SelectItem value="MANAGER">매니저</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              취소
            </Button>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending || !form.email || !form.admin_name || !form.plain_password}
            >
              등록
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 활성/비활성 확인 모달 */}
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

      {/* 삭제 확인 모달 */}
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

      {/* 복구 확인 모달 */}
      <ConfirmModal
        open={!!restoreTarget}
        onClose={() => setRestoreTarget(null)}
        onConfirm={() => restoreTarget && restoreMutation.mutate(restoreTarget.admin_id)}
        title="관리자 복구"
        description={`${restoreTarget?.admin_name}님을 복구합니다.`}
        confirmLabel="복구"
        isLoading={restoreMutation.isPending}
      />

      {/* 관리자 정보 수정 모달 */}
      <Dialog open={!!editTarget} onOpenChange={(open) => !open && setEditTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>관리자 정보 수정</DialogTitle>
          </DialogHeader>
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
            <Button
              onClick={() => editTarget && updateAdminMutation.mutate({ adminId: editTarget.admin_id, data: editForm })}
              disabled={updateAdminMutation.isPending || !editForm.admin_name || !editForm.email}
            >
              저장
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
