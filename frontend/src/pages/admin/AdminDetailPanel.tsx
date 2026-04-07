import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X, Edit2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ConfirmModal } from "@/components/common/ConfirmModal";
import { StatusBadge } from "@/components/common/StatusBadge";
import { adminsApi } from "@/api/adminsApi";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/utils/errorHandler";
import { formatDateTime } from "@/utils/format";
import { ADMIN_ROLE_LABEL } from "@/utils/constants";
import type { AdminResponse } from "@/types/admin";

interface Props {
  admin: AdminResponse;
  onClose: () => void;
}

export function AdminDetailPanel({ admin, onClose }: Props) {
  const { currentAdmin } = useAuth();
  const queryClient = useQueryClient();
  const isSelf = admin.admin_id === currentAdmin?.admin_id;

  // 수정 모드
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState({ admin_name: "", email: "" });

  // 확인 모달
  const [toggleConfirm, setToggleConfirm] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [restoreConfirm, setRestoreConfirm] = useState(false);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["admins"] });
  };

  // 수정
  const updateMutation = useMutation({
    mutationFn: () =>
      adminsApi.updateAdmin(admin.admin_id, editForm as any),
    onSuccess: () => {
      toast.success("관리자 정보가 수정되었습니다.");
      invalidate();
      setEditMode(false);
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  // 권한 변경
  const roleMutation = useMutation({
    mutationFn: (role: string) =>
      adminsApi.changeAdminRole(admin.admin_id, { admin_role: role as any }),
    onSuccess: () => {
      toast.success("권한이 변경되었습니다.");
      invalidate();
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  // 활성화/비활성화
  const toggleMutation = useMutation({
    mutationFn: () =>
      admin.is_active
        ? adminsApi.deactivateAdmin(admin.admin_id)
        : adminsApi.activateAdmin(admin.admin_id),
    onSuccess: () => {
      toast.success(admin.is_active ? "비활성화되었습니다." : "활성화되었습니다.");
      invalidate();
      setToggleConfirm(false);
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  // 삭제
  const deleteMutation = useMutation({
    mutationFn: () => adminsApi.deleteAdmin(admin.admin_id),
    onSuccess: () => {
      toast.success("관리자가 삭제되었습니다.");
      invalidate();
      setDeleteConfirm(false);
      onClose();
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  // 복구
  const restoreMutation = useMutation({
    mutationFn: () => adminsApi.restoreAdmin(admin.admin_id),
    onSuccess: () => {
      toast.success("관리자가 복구되었습니다.");
      invalidate();
      setRestoreConfirm(false);
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  return (
    <div className="flex flex-col h-full">
      {/* 헤더 */}
      <div className="px-5 py-4 border-b border-gray-200 bg-white flex-shrink-0">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 mb-1">
              <StatusBadge type="admin_role" value={admin.admin_role} />
              {!admin.is_active && (
                <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">비활성</span>
              )}
              {admin.is_deleted && (
                <span className="text-xs text-red-500 bg-red-50 px-1.5 py-0.5 rounded">삭제됨</span>
              )}
            </div>
            <div className="font-semibold text-gray-900 text-base leading-tight">
              {admin.admin_name}
            </div>
            <div className="text-xs text-gray-400 mt-0.5">{admin.email}</div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1 rounded-md hover:bg-gray-100 flex-shrink-0 ml-2"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* 액션 버튼 */}
        {!isSelf && (
          <div className="flex items-center gap-2 mt-3">
            {!admin.is_deleted && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (!editMode) {
                      setEditForm({ admin_name: admin.admin_name, email: admin.email });
                    }
                    setEditMode(!editMode);
                  }}
                  className={`gap-1 ${editMode ? "bg-blue-50 border-blue-300 text-blue-700" : ""}`}
                >
                  <Edit2 className="h-3 w-3" />
                  {editMode ? "취소" : "수정"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setToggleConfirm(true)}
                  className={admin.is_active ? "text-amber-600 border-amber-200 hover:bg-amber-50" : ""}
                >
                  {admin.is_active ? "비활성화" : "활성화"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDeleteConfirm(true)}
                  className="text-red-600 border-red-200 hover:bg-red-50"
                >
                  삭제
                </Button>
              </>
            )}
            {admin.is_deleted && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setRestoreConfirm(true)}
              >
                복구
              </Button>
            )}
          </div>
        )}
      </div>

      {/* 콘텐츠 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {/* 수정 폼 */}
        {editMode && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3.5 space-y-3">
            <div className="text-xs font-semibold text-blue-700">관리자 정보 수정</div>
            <div className="space-y-2">
              <div>
                <label className="text-xs text-gray-600">이름</label>
                <Input
                  className="mt-1 h-8 text-sm"
                  value={editForm.admin_name}
                  onChange={(e) => setEditForm((f) => ({ ...f, admin_name: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs text-gray-600">이메일</label>
                <Input
                  className="mt-1 h-8 text-sm"
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => updateMutation.mutate()}
                disabled={updateMutation.isPending || !editForm.admin_name || !editForm.email}
              >
                저장
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditMode(false)}>
                취소
              </Button>
            </div>
          </div>
        )}

        {/* 기본 정보 */}
        <Section title="기본 정보">
          <InfoRow label="이름" value={admin.admin_name} />
          <InfoRow label="이메일" value={admin.email} />
          <InfoRow label="권한" value={
            !isSelf && !admin.is_deleted ? (
              <Select
                value={admin.admin_role}
                onValueChange={(v) => roleMutation.mutate(v)}
              >
                <SelectTrigger className="h-7 text-xs w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SUPER_ADMIN">슈퍼관리자</SelectItem>
                  <SelectItem value="ADMIN">관리자</SelectItem>
                  <SelectItem value="MANAGER">매니저</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <span>{ADMIN_ROLE_LABEL[admin.admin_role] ?? admin.admin_role}</span>
            )
          } />
          <InfoRow label="상태" value={
            <span className={admin.is_active ? "text-green-600" : "text-gray-400"}>
              {admin.is_active ? "활성" : "비활성"}
            </span>
          } />
        </Section>

        {/* 시스템 */}
        <Section title="시스템">
          <InfoRow label="최근 로그인" value={admin.last_login_at ? formatDateTime(admin.last_login_at) : "-"} />
          <InfoRow label="등록일" value={formatDateTime(admin.created_at)} />
          <InfoRow label="수정일" value={formatDateTime(admin.updated_at)} />
          {admin.deleted_at && (
            <InfoRow label="삭제일" value={formatDateTime(admin.deleted_at)} />
          )}
        </Section>
      </div>

      {/* 확인 모달들 */}
      <ConfirmModal
        open={toggleConfirm}
        onClose={() => setToggleConfirm(false)}
        onConfirm={() => toggleMutation.mutate()}
        title={admin.is_active ? "관리자 비활성화" : "관리자 활성화"}
        description={`${admin.admin_name}님을 ${admin.is_active ? "비활성화" : "활성화"}합니다.`}
        confirmLabel={admin.is_active ? "비활성화" : "활성화"}
        variant={admin.is_active ? "destructive" : "default"}
        isLoading={toggleMutation.isPending}
      />
      <ConfirmModal
        open={deleteConfirm}
        onClose={() => setDeleteConfirm(false)}
        onConfirm={() => deleteMutation.mutate()}
        title="관리자 삭제"
        description={`${admin.admin_name}님을 삭제합니다.`}
        confirmLabel="삭제"
        variant="destructive"
        isLoading={deleteMutation.isPending}
      />
      <ConfirmModal
        open={restoreConfirm}
        onClose={() => setRestoreConfirm(false)}
        onConfirm={() => restoreMutation.mutate()}
        title="관리자 복구"
        description={`${admin.admin_name}님을 복구합니다.`}
        confirmLabel="복구"
        isLoading={restoreMutation.isPending}
      />
    </div>
  );
}

// 섹션 컴포넌트
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

// 정보 행 컴포넌트
function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  if (!value && value !== 0) return null;
  return (
    <div className="flex items-start gap-3">
      <span className="text-xs text-gray-400 w-24 flex-shrink-0 pt-0.5">{label}</span>
      <span className="text-sm text-gray-700 flex-1">{value}</span>
    </div>
  );
}
