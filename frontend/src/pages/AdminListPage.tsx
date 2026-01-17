import React, { useState, useEffect } from "react";
import { Plus, Edit, Trash2, Search, CheckCircle, XCircle } from "lucide-react";

import { adminAPI, AdminResponse } from "../api/adminApi";
import Button from "../components/common/Button";
import Alert from "../components/common/Alert";
import LoadingSpinner from "../components/common/LoadingSpinner";
import { getErrorMessage } from "../utils/errorHandler";
import { ROLE_CONFIG } from "../utils/constants";

interface AdminListPageProps {
  onSelectAdmin?: (adminId: number) => void;
  onNewAdmin?: () => void;
}

const AdminListPage: React.FC<AdminListPageProps> = ({
  onSelectAdmin,
  onNewAdmin,
}) => {
  const [admins, setAdmins] = useState<AdminResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [deleteError, setDeleteError] = useState("");

  useEffect(() => {
    loadAdmins();
  }, [refreshKey]);

  const loadAdmins = async () => {
    try {
      setLoading(true);
      setError("");
      const data = await adminAPI.getAll();
      setAdmins(data);
    } catch (err) {
      setError(
        getErrorMessage(err) || "관리자 목록을 불러오는데 실패했습니다."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (adminId: number) => {
    if (deleteConfirm !== adminId) {
      setDeleteConfirm(adminId);
      setDeleteError("");
      return;
    }

    try {
      setDeleteError("");
      await adminAPI.delete(adminId);
      setDeleteConfirm(null);
      setRefreshKey((prev) => prev + 1); // 목록 새로고침
    } catch (err) {
      const errorMessage =
        getErrorMessage(err) || "관리자 삭제에 실패했습니다.";
      setDeleteError(errorMessage);
      setDeleteConfirm(null);
    }
  };

  const getRoleInfo = (role: string) => {
    return ROLE_CONFIG[role] || ROLE_CONFIG.MANAGER;
  };

  const filteredAdmins = admins.filter(
    (admin) =>
      admin.admin_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      admin.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">관리자 계정 관리</h2>
          <p className="text-sm text-gray-600 mt-1">
            총 {admins.length}명의 관리자
          </p>
        </div>
        <Button
          onClick={() => onNewAdmin && onNewAdmin()}
          variant="primary"
          icon={Plus}
          iconPosition="left"
        >
          새 관리자 추가
        </Button>
      </div>

      {/* 에러 메시지 */}
      {error && <Alert type="error">{error}</Alert>}
      {deleteError && <Alert type="error">{deleteError}</Alert>}

      {/* 검색 */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          placeholder="이름 또는 이메일로 검색..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-11 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* 관리자 목록 테이블 */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                  ID
                </th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                  이름
                </th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                  이메일
                </th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                  역할
                </th>
                <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">
                  상태
                </th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                  생성일
                </th>
                <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">
                  작업
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredAdmins.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-gray-500">
                    {searchTerm
                      ? "검색 결과가 없습니다."
                      : "관리자가 없습니다."}
                  </td>
                </tr>
              ) : (
                filteredAdmins.map((admin) => (
                  <tr
                    key={admin.admin_id}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td className="py-3 px-4 text-sm text-gray-700">
                      {admin.admin_id}
                    </td>
                    <td className="py-3 px-4 text-sm font-medium text-gray-900">
                      {admin.admin_name}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-700">
                      {admin.email}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          getRoleInfo(admin.admin_role).color
                        }`}
                      >
                        {getRoleInfo(admin.admin_role).label}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      {admin.is_active ? (
                        <span className="inline-flex items-center text-blue-600">
                          <CheckCircle className="w-4 h-4 mr-1" />
                          <span className="text-xs">활성</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center text-red-600">
                          <XCircle className="w-4 h-4 mr-1" />
                          <span className="text-xs">비활성</span>
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-500">
                      {new Date(admin.created_at).toLocaleDateString("ko-KR", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-center space-x-2">
                        <button
                          onClick={() =>
                            onSelectAdmin && onSelectAdmin(admin.admin_id)
                          }
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="수정"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(admin.admin_id)}
                          className={`p-2 rounded-lg transition-colors ${
                            deleteConfirm === admin.admin_id
                              ? "bg-red-600 text-white"
                              : "text-red-600 hover:bg-red-50"
                          }`}
                          title={deleteConfirm === admin.admin_id ? "확인" : "삭제"}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminListPage;
