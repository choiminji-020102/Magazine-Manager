import React, { useState, useEffect } from "react";
import { Plus, Edit, Trash2, CheckCircle, XCircle, RefreshCw, Save, AlertTriangle } from "lucide-react";

import { adminsApi } from "../api/adminsApi";
import { AdminResponse, AdminRole, AdminUpdate } from "../types/admin";
import { PaginationMeta } from "../types/api";
import Button from "../components/common/Button";
import Alert from "../components/common/Alert";
import Breadcrumb from "../components/common/Breadcrumb";
import SearchFilterBar from "../components/common/SearchFilterBar";
import ListPage from "../components/common/ListPage";
import Modal from "../components/common/Modal";
import Input from "../components/common/Input";
import { Column } from "../components/common/Table";
import { getErrorMessage } from "../utils/errorHandler";
import { ROLE_CONFIG, ADMIN_ROLES } from "../utils/constants";

interface AdminListPageProps {
  onNewAdmin?: () => void;
}

const AdminListPage: React.FC<AdminListPageProps> = ({
  onNewAdmin,
}) => {
  const [admins, setAdmins] = useState<AdminResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  
  // 삭제 확인 모달 상태
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [adminsToDelete, setAdminsToDelete] = useState<AdminResponse[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);

  // 모달 상태
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedAdminId, setSelectedAdminId] = useState<number | null>(null);
  const [selectedAdmin, setSelectedAdmin] = useState<AdminResponse | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editForm, setEditForm] = useState<AdminUpdate>({
    admin_name: null,
    email: null,
    admin_role: null,
    is_active: null,
    plain_password: null,
  });

  // 페이지네이션
  const [pagination, setPagination] = useState<PaginationMeta>({
    total: 0,
    page: 1,
    limit: 20,
    total_pages: 0,
  });
  const [sortKey, setSortKey] = useState("created_at");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  // 필터/검색어 변경 시 페이지를 1로 리셋
  useEffect(() => {
    setPagination((prev) => ({ ...prev, page: 1 }));
  }, [searchTerm, sortKey, sortDirection]);

  useEffect(() => {
    loadAdmins();
  }, [refreshKey, pagination.page, searchTerm, sortKey, sortDirection]);

  const loadAdmins = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await adminsApi.getAdmins({
        page: pagination.page,
        limit: pagination.limit,
        search: searchTerm || null,
      });
      
      if (!response?.data?.data || !Array.isArray(response.data.data)) {
        throw new Error("올바르지 않은 응답 형식입니다.");
      }

      if (!response.data.pagination) {
        throw new Error("페이지네이션 정보가 없습니다.");
      }

      setAdmins(response.data.data);
      setPagination(response.data.pagination);
    } catch (err) {
      setError(
        getErrorMessage(err) || "관리자 목록을 불러오는데 실패했습니다."
      );
      setAdmins([]);
      setPagination({
        total: 0,
        page: 1,
        limit: 20,
        total_pages: 0,
      });
    } finally {
      setLoading(false);
    }
  };

  // 삭제 확인 모달 열기
  const handleDelete = (admin: AdminResponse) => {
    setAdminsToDelete([admin]);
    setIsDeleteModalOpen(true);
  };

  // 관리자 삭제 실행
  const handleConfirmDelete = async () => {
    if (adminsToDelete.length === 0) return;
    
    setIsDeleting(true);
    try {
      // 모든 관리자 삭제 시도
      const deletePromises = adminsToDelete.map((admin) =>
        adminsApi.deleteAdmin(admin.admin_id)
      );
      
      await Promise.all(deletePromises);
      
      // 성공 시 목록 새로고침
      setRefreshKey((prev) => prev + 1);
      
      // 선택 초기화
      setIsDeleteModalOpen(false);
      setAdminsToDelete([]);
      
      // 삭제된 관리자가 현재 상세 모달에 표시된 관리자면 모달 닫기
      if (selectedAdmin && adminsToDelete.some(a => a.admin_id === selectedAdmin.admin_id)) {
        setIsDetailModalOpen(false);
        setSelectedAdminId(null);
        setSelectedAdmin(null);
        setIsEditMode(false);
      }
      
      alert(`${adminsToDelete.length}명의 관리자가 삭제되었습니다.`);
    } catch (err) {
      const errorMessage = getErrorMessage(err) || "관리자 삭제에 실패했습니다.";
      alert(errorMessage);
    } finally {
      setIsDeleting(false);
    }
  };

  const getRoleInfo = (role: string) => {
    return ROLE_CONFIG[role] || ROLE_CONFIG.MANAGER;
  };

  const handleSort = (key: string, direction: "asc" | "desc") => {
    setSortKey(key);
    setSortDirection(direction);
  };

  // 클라이언트 사이드 정렬 (서버에서 정렬을 지원하지 않는 경우)
  const sortedAdmins = [...admins].sort((a, b) => {
    let aVal: any;
    let bVal: any;

    if (sortKey === "admin_name") {
      aVal = a.admin_name;
      bVal = b.admin_name;
    } else if (sortKey === "email") {
      aVal = a.email;
      bVal = b.email;
    } else if (sortKey === "created_at") {
      aVal = a.created_at ? new Date(a.created_at).getTime() : 0;
      bVal = b.created_at ? new Date(b.created_at).getTime() : 0;
    } else {
      return 0;
    }

    if (aVal === null || aVal === undefined) {
      return sortDirection === "asc" ? 1 : -1;
    }
    if (bVal === null || bVal === undefined) {
      return sortDirection === "asc" ? -1 : 1;
    }

    if (typeof aVal === "number" && typeof bVal === "number") {
      return sortDirection === "asc" ? aVal - bVal : bVal - aVal;
    }

    const aStr = String(aVal).toLowerCase();
    const bStr = String(bVal).toLowerCase();
    if (sortDirection === "asc") {
      return aStr > bStr ? 1 : -1;
    }
    return aStr < bStr ? 1 : -1;
  });

  const handleViewDetail = async (adminId: number) => {
    try {
      const response = await adminsApi.getAdmin(adminId);
      const adminData = response.data.data;
      if (!adminData) {
        setError("관리자 정보를 불러올 수 없습니다.");
        return;
      }
      setSelectedAdmin(adminData);
      setSelectedAdminId(adminId);
      setEditForm({
        admin_name: adminData.admin_name,
        email: adminData.email,
        admin_role: adminData.admin_role as AdminRole,
        is_active: adminData.is_active,
        plain_password: null,
      });
      setIsEditMode(false);
      setIsDetailModalOpen(true);
    } catch (err) {
      setError(getErrorMessage(err) || "관리자 정보를 불러오는데 실패했습니다.");
    }
  };

  const handleStartEdit = () => {
    setIsEditMode(true);
  };

  const handleCancelEdit = () => {
    setIsEditMode(false);
    if (selectedAdmin) {
      setEditForm({
        admin_name: selectedAdmin.admin_name,
        email: selectedAdmin.email,
        admin_role: selectedAdmin.admin_role as AdminRole,
        is_active: selectedAdmin.is_active,
        plain_password: null,
      });
    }
  };

  const handleSaveAdmin = async () => {
    if (!selectedAdminId || !editForm.admin_name || !editForm.email) {
      setError("이름과 이메일은 필수입니다.");
      return;
    }

    try {
      setError(null);
      const updateData: AdminUpdate = {
        admin_name: editForm.admin_name,
        email: editForm.email,
        admin_role: editForm.admin_role,
        is_active: editForm.is_active,
        plain_password: editForm.plain_password || null,
      };
      
      await adminsApi.updateAdmin(selectedAdminId, updateData);
      setIsEditMode(false);
      setRefreshKey((prev) => prev + 1);
      // 선택된 관리자 정보도 업데이트
      const response = await adminsApi.getAdmin(selectedAdminId);
      const adminData = response.data.data;
      if (adminData) {
        setSelectedAdmin(adminData);
        setEditForm({
          admin_name: adminData.admin_name,
          email: adminData.email,
          admin_role: adminData.admin_role as AdminRole,
          is_active: adminData.is_active,
          plain_password: null,
        });
      }
    } catch (err) {
      setError(getErrorMessage(err) || "관리자 정보 수정에 실패했습니다.");
    }
  };


  // 테이블 컬럼 정의
  const columns: Column<AdminResponse>[] = [
    {
      key: "admin_id",
      label: "ID",
      align: "center",
    },
    {
      key: "admin_name",
      label: "이름",
      align: "center",
    },
    {
      key: "email",
      label: "이메일",
      align: "center",
      width: "200px",
      render: (value) => {
        return (
          <span className="text-sm text-ink truncate inline-block max-w-full">
            {value}
          </span>
        );
      },
    },
    {
      key: "admin_role",
      label: "역할",
      align: "center",
      render: (value) => {
        const roleInfo = getRoleInfo(value);
        return (
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${roleInfo.color}`}>
            {roleInfo.label}
          </span>
        );
      },
    },
    {
      key: "is_active",
      label: "상태",
      align: "center",
      render: (value) => {
        return value ? (
          <span className="inline-flex items-center text-accent">
            <CheckCircle className="w-4 h-4 mr-1" />
            <span className="text-xs">활성</span>
          </span>
        ) : (
          <span className="inline-flex items-center text-red-600">
            <XCircle className="w-4 h-4 mr-1" />
            <span className="text-xs">비활성</span>
          </span>
        );
      },
    },
    {
      key: "created_at",
      label: "생성일",
      align: "center",
      render: (value) => {
        return (
          <span className="text-sm text-muted">
            {new Date(value).toLocaleDateString("ko-KR", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </span>
        );
      },
    },
    {
      key: "last_login_at",
      label: "마지막 로그인",
      align: "center",
      render: (value) => {
        if (!value) {
          return <span className="text-sm text-muted">-</span>;
        }
        return (
          <span className="text-sm text-muted">
            {new Date(value).toLocaleDateString("ko-KR", {
              year: "numeric",
              month: "long",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        );
      },
    },
    {
      key: "actions",
      label: "작업",
      align: "center",
      render: (_, row) => {
    return (
          <div className="flex items-center justify-center space-x-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleViewDetail(row.admin_id);
              }}
              className="p-2 text-accent hover:bg-accent/10 rounded-lg transition-colors"
              title="상세보기"
            >
              <Edit className="w-4 h-4" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDelete(row);
              }}
              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              title="삭제"
            >
              <Trash2 className="w-4 h-4" />
            </button>
      </div>
    );
      },
    },
  ];

  // 정렬 옵션 정의
  const sortOptions = [
    { key: "created_at", direction: "desc" as const, label: "생성일 최신순" },
    { key: "created_at", direction: "asc" as const, label: "생성일 오래된순" },
    { key: "admin_name", direction: "asc" as const, label: "이름 가나다순" },
    { key: "admin_name", direction: "desc" as const, label: "이름 역순" },
  ];

  return (
    <div className="min-h-screen">
      <div className="max-w-[1600px] mx-auto px-6 py-6">
        <Breadcrumb
          items={[
            { label: "관리자 관리", path: "/admin/list" },
            { label: "관리자 목록" },
          ]}
        />

      {/* 헤더 */}
        <div className="mb-6">
      <div className="flex items-center justify-between">
            <div></div>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                icon={RefreshCw}
                onClick={loadAdmins}
                loading={loading}
              >
                새로고침
              </Button>
        <Button
                size="sm"
                icon={Plus}
          onClick={() => onNewAdmin && onNewAdmin()}
        >
          새 관리자 추가
        </Button>
            </div>
          </div>
      </div>

      {/* 에러 메시지 */}
        {error && <Alert type="error" className="mb-6">{error}</Alert>}

        {/* 검색 및 필터 */}
        <SearchFilterBar
          searchValue={searchTerm}
          onSearchChange={setSearchTerm}
          searchPlaceholder="이름 또는 이메일로 검색..."
          showFilters={false}
          onToggleFilters={() => {}}
          filterFields={[]}
          filterValues={{}}
          onFilterChange={() => {}}
          activeFilters={[]}
          sortOptions={sortOptions}
          currentSort={{ key: sortKey, direction: sortDirection }}
          onSortChange={handleSort}
          onReset={() => {
            setSearchTerm("");
          }}
          hasActiveFilters={!!searchTerm}
        />

        {/* 목록 */}
        <ListPage
          data={sortedAdmins}
          columns={columns}
          keyExtractor={(row) => String(row.admin_id)}
          emptyMessage={
            searchTerm
              ? "검색 결과가 없습니다."
              : "관리자가 없습니다."
          }
          selectable={false}
          selectedItems={new Set()}
          onSelectAll={() => {}}
          onSort={handleSort}
          sortKey={sortKey}
          sortDirection={sortDirection}
          onRowClick={(row) => {
            handleViewDetail(row.admin_id);
          }}
          hoverable
          currentPage={pagination.page}
          totalPages={pagination.total_pages}
          onPageChange={(page) => setPagination((prev) => ({ ...prev, page }))}
          totalItems={pagination.total}
          itemsPerPage={pagination.limit}
          loading={loading}
          error={error}
          onRetry={loadAdmins}
        />

        {/* 관리자 상세 모달 */}
        <Modal
          isOpen={isDetailModalOpen}
          onClose={() => {
            setIsDetailModalOpen(false);
            setSelectedAdminId(null);
            setSelectedAdmin(null);
            setIsEditMode(false);
          }}
          title={selectedAdmin ? `관리자 상세 - ${selectedAdmin.admin_name}` : "관리자 상세"}
          size="lg"
          footer={
            isEditMode ? (
              <>
                <Button variant="ghost" onClick={handleCancelEdit}>
                  취소
                </Button>
                <Button onClick={handleSaveAdmin} icon={Save}>
                  저장
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setIsDetailModalOpen(false);
                    setSelectedAdminId(null);
                    setSelectedAdmin(null);
                  }}
                >
                  닫기
                </Button>
                <Button onClick={handleStartEdit} icon={Edit}>
                  수정
                </Button>
                <Button
                  variant="danger"
                  onClick={() => {
                    if (selectedAdmin) {
                      handleDelete(selectedAdmin);
                    }
                  }}
                  icon={Trash2}
                >
                  삭제
                </Button>
              </>
            )
          }
        >
          {selectedAdmin && (
            <div className="space-y-6">
              {/* 에러 메시지 */}
              {error && <Alert type="error">{error}</Alert>}

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-paper rounded-lg">
                  <div className="space-y-4">
                    {isEditMode ? (
                      <>
                        <Input
                          label="이름"
                          value={editForm.admin_name || selectedAdmin.admin_name || ""}
                          onChange={(e) =>
                            setEditForm({ ...editForm, admin_name: e.target.value })
                          }
                          required
                        />
                        <Input
                          label="이메일"
                          type="email"
                          value={editForm.email || selectedAdmin.email || ""}
                          onChange={(e) =>
                            setEditForm({ ...editForm, email: e.target.value })
                          }
                          required
                        />
                        <div>
                          <label className="block text-xs text-muted uppercase tracking-wide mb-2">
                            비밀번호
                          </label>
                          <Input
                            type="password"
                            value={editForm.plain_password || ""}
                            onChange={(e) =>
                              setEditForm({ ...editForm, plain_password: e.target.value || null })
                            }
                            placeholder="변경하지 않으려면 비워두세요"
                          />
                        </div>
                      </>
                    ) : (
                      <>
                        <div>
                          <label className="text-xs text-muted uppercase tracking-wide">
                            이름
                          </label>
                          <p className="text-base font-medium text-ink mt-1">
                            {selectedAdmin.admin_name}
                          </p>
                        </div>
                        <div>
                          <label className="text-xs text-muted uppercase tracking-wide">
                            이메일
                          </label>
                          <p className="text-base text-ink mt-1">
                            {selectedAdmin.email}
                          </p>
                        </div>
                        <div>
                          <label className="text-xs text-muted uppercase tracking-wide">
                            비밀번호
                          </label>
                          <p className="text-base text-ink mt-1">••••••••</p>
                        </div>
                      </>
                    )}
                  </div>
                </div>
                <div className="p-4 bg-paper rounded-lg">
                  <div className="space-y-4">
                    {isEditMode ? (
                      <>
                        <div>
                          <label className="block text-xs text-muted uppercase tracking-wide mb-2">
                            역할 <span className="text-red-500">*</span>
                          </label>
                          <select
                            value={editForm.admin_role || selectedAdmin.admin_role}
                            onChange={(e) =>
                              setEditForm({ ...editForm, admin_role: e.target.value as AdminRole })
                            }
                            className="w-full px-4 py-2.5 text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
                          >
                            {ADMIN_ROLES.map((role) => (
                              <option key={role.value} value={role.value}>
                                {role.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs text-muted uppercase tracking-wide mb-2">
                            계정 활성화
                          </label>
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() =>
                                setEditForm({ ...editForm, is_active: !(editForm.is_active !== undefined ? editForm.is_active ?? false : selectedAdmin.is_active) })
                              }
                              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 ${
                                editForm.is_active !== undefined
                                  ? editForm.is_active ?? false
                                    ? "bg-accent"
                                    : "bg-gray-300"
                                  : selectedAdmin.is_active
                                  ? "bg-accent"
                                  : "bg-gray-300"
                              }`}
                            >
                              <span
                                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                  editForm.is_active !== undefined
                                    ? editForm.is_active ?? false
                                      ? "translate-x-6"
                                      : "translate-x-1"
                                    : selectedAdmin.is_active
                                    ? "translate-x-6"
                                    : "translate-x-1"
                                }`}
                              />
                            </button>
                            <span className="text-base text-ink">
                              {editForm.is_active !== undefined
                                ? editForm.is_active ?? false
                                  ? "활성"
                                  : "비활성"
                                : selectedAdmin.is_active
                                ? "활성"
                                : "비활성"}
                            </span>
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        <div>
                          <label className="text-xs text-muted uppercase tracking-wide">
                            역할
                          </label>
                          <p className="text-base text-ink mt-1">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              getRoleInfo(selectedAdmin.admin_role).color
                            }`}>
                              {getRoleInfo(selectedAdmin.admin_role).label}
                            </span>
                          </p>
                        </div>
                        <div>
                          <label className="text-xs text-muted uppercase tracking-wide">
                            상태
                          </label>
                          <p className="text-base text-ink mt-1">
                            {selectedAdmin.is_active ? (
                              <span className="inline-flex items-center text-accent">
                                <CheckCircle className="w-4 h-4 mr-1" />
                                <span className="text-xs">활성</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center text-red-600">
                                <XCircle className="w-4 h-4 mr-1" />
                                <span className="text-xs">비활성</span>
                              </span>
                            )}
                          </p>
                        </div>
                      </>
                    )}
                    <div>
                      <label className="text-xs text-muted uppercase tracking-wide">
                        생성일
                      </label>
                      <p className="text-base text-ink mt-1">
                        {new Date(selectedAdmin.created_at).toLocaleDateString("ko-KR")}
                      </p>
                    </div>
                    {selectedAdmin.last_login_at && (
                      <div>
                        <label className="text-xs text-muted uppercase tracking-wide">
                          마지막 로그인
                        </label>
                        <p className="text-base text-ink mt-1">
                          {new Date(selectedAdmin.last_login_at).toLocaleString("ko-KR", {
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
        </div>
          )}
        </Modal>

        {/* 삭제 확인 모달 */}
        <Modal
          isOpen={isDeleteModalOpen}
          onClose={() => {
            if (!isDeleting) {
              setIsDeleteModalOpen(false);
              setAdminsToDelete([]);
            }
          }}
          title="관리자 삭제 확인"
          size="md"
          footer={
            <div className="flex items-center justify-end gap-3 w-full">
              <Button
                variant="ghost"
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setAdminsToDelete([]);
                }}
                disabled={isDeleting}
              >
                취소
              </Button>
              <Button
                variant="danger"
                onClick={handleConfirmDelete}
                icon={Trash2}
                loading={isDeleting}
                disabled={isDeleting}
              >
                삭제
              </Button>
            </div>
          }
        >
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-4 bg-danger-50 border border-danger-200 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-danger flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-ink mb-2">
                  정말로 {adminsToDelete.length}명의 관리자를 삭제하시겠습니까?
                </p>
                <p className="text-xs text-muted">
                  이 작업은 되돌릴 수 없습니다. 삭제된 관리자 정보는 복구할 수 없습니다.
                </p>
              </div>
            </div>
            
            {adminsToDelete.length > 0 && (
              <div className="max-h-48 overflow-y-auto border border-line rounded-lg">
                <div className="p-3 bg-paper border-b border-line">
                  <p className="text-xs font-medium text-muted uppercase tracking-wide">
                    삭제될 관리자 목록 ({adminsToDelete.length}명)
                  </p>
                </div>
                <div className="divide-y divide-line">
                  {adminsToDelete.slice(0, 10).map((admin) => (
                    <div key={admin.admin_id} className="p-3">
                      <p className="text-sm font-medium text-ink">
                        {admin.admin_name}
                      </p>
                      <p className="text-xs text-muted mt-1">
                        {admin.email}
                        {admin.admin_role && ` • ${getRoleInfo(admin.admin_role).label}`}
                      </p>
                    </div>
                  ))}
                  {adminsToDelete.length > 10 && (
                    <div className="p-3 text-center">
                      <p className="text-xs text-muted">
                        외 {adminsToDelete.length - 10}명...
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </Modal>
      </div>
    </div>
  );
};

export default AdminListPage;
