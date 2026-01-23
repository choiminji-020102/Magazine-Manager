import React, { useState, useEffect } from "react";
import {
  Shield,
  Plus,
  Package,
  ExternalLink,
  Check,
  X,
  RefreshCw,
  Edit,
  Trash2,
  User,
} from "lucide-react";
import Card from "../components/common/Card";
import Button from "../components/common/Button";
import Badge from "../components/common/Badge";
import Tabs from "../components/common/Tabs";
import Input from "../components/common/Input";
import Modal from "../components/common/Modal";
import Breadcrumb from "../components/common/Breadcrumb";
import AdminDetailPage from "./AdminDetailPage";
import { useAuth } from "../contexts/AuthContext";
import { cafe24API, Cafe24TokenStatusResponse } from "../api/cafe24Api";
import {
  adminAPI,
  AdminResponse,
  AdminRole,
  AdminCreate,
} from "../api/adminsApi";
import { formatKst } from "../utils/date";

type SettingsTab = "admin" | "cafe24" | "profile";

interface SettingsPageProps {
  initialTab?: string;
}

const SettingsPage: React.FC<SettingsPageProps> = ({
  initialTab = "general",
}) => {
  const { currentAdmin } = useAuth();
  
  // initialTab 매핑: App.tsx에서 사용하는 값 -> 실제 탭 키
  const mapTab = (tab: string): SettingsTab => {
    const tabMap: Record<string, SettingsTab> = {
      admin: "admin",
      permission: "admin",
      profile: "profile",
      integration: "cafe24",
      general: "admin",
      cafe24: "cafe24",
      notification: "admin",
      shipping: "admin",
    };
    return tabMap[tab] || "admin";
  };

  const [activeTab, setActiveTab] = useState<SettingsTab>(mapTab(initialTab));
  const [cafe24TokenStatus, setCafe24TokenStatus] =
    useState<Cafe24TokenStatusResponse | null>(null);
  const [loading, setLoading] = useState(false);

  // 관리자 관련 상태
  const [admins, setAdmins] = useState<AdminResponse[]>([]);
  const [adminLoading, setAdminLoading] = useState(false);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState<AdminResponse | null>(null);
  const [adminForm, setAdminForm] = useState<AdminCreate>({
    email: "",
    plain_password: "",
    admin_name: "",
    admin_role: AdminRole.ADMIN,
    is_active: true,
  });

  // Cafe24 토큰 상태 조회
  const fetchCafe24Status = async () => {
    setLoading(true);
    try {
      // 환경변수나 설정에서 mall_id 가져오기
      const mallId = import.meta.env.VITE_CAFE24_MALL_ID || "your-mall-id";
      const status = await cafe24API.getStatus(mallId);
      setCafe24TokenStatus(status);
    } catch (err) {
      console.error("Cafe24 토큰 상태 조회 실패:", err);
      setCafe24TokenStatus(null);
    } finally {
      setLoading(false);
    }
  };

  // 관리자 목록 조회
  const fetchAdmins = async () => {
    setAdminLoading(true);
    try {
      const data = await adminAPI.getAll();
      setAdmins(data);
    } catch (err) {
      console.error("관리자 목록 조회 실패:", err);
    } finally {
      setAdminLoading(false);
    }
  };

  // 관리자 생성/수정
  const handleSaveAdmin = async () => {
    try {
      if (editingAdmin) {
        await adminAPI.update(editingAdmin.admin_id, adminForm);
      } else {
        await adminAPI.create(adminForm);
      }
      setShowAdminModal(false);
      setEditingAdmin(null);
      setAdminForm({
        email: "",
        plain_password: "",
        admin_name: "",
        admin_role: AdminRole.ADMIN,
        is_active: true,
      });
      fetchAdmins();
    } catch (err) {
      console.error("관리자 저장 실패:", err);
      alert("관리자 저장에 실패했습니다.");
    }
  };

  // 관리자 삭제
  const handleDeleteAdmin = async (adminId: number) => {
    if (!confirm("정말 삭제하시겠습니까?")) return;
    try {
      await adminAPI.delete(adminId);
      fetchAdmins();
    } catch (err) {
      console.error("관리자 삭제 실패:", err);
      alert("관리자 삭제에 실패했습니다.");
    }
  };

  // 관리자 수정 모달 열기
  const handleEditAdmin = (admin: AdminResponse) => {
    setEditingAdmin(admin);
    setAdminForm({
      email: admin.email,
      plain_password: "",
      admin_name: admin.admin_name,
      admin_role: admin.admin_role,
      is_active: admin.is_active,
    });
    setShowAdminModal(true);
  };


  useEffect(() => {
    if (activeTab === "cafe24") {
      fetchCafe24Status();
    } else if (activeTab === "admin") {
      fetchAdmins();
    }
  }, [activeTab]);

  const tabs = [
    {
      key: "admin",
      label: "관리자 설정",
      icon: <Shield className="w-4 h-4" />,
    },
    {
      key: "cafe24",
      label: "Cafe24 연동",
      icon: <Package className="w-4 h-4" />,
    },
    {
      key: "profile",
      label: "마이페이지",
      icon: <User className="w-4 h-4" />,
    },
  ];

  const handleCafe24Connect = async () => {
    try {
      setLoading(true);
      const mallId = import.meta.env.VITE_CAFE24_MALL_ID || "your-mall-id";

      // 필요한 스코프 목록
      const scopes = [
        "mall.read_category",
        "mall.write_category",
        "mall.read_product",
        "mall.write_product",
        "mall.read_order",
        "mall.write_order",
        "mall.read_customer",
        "mall.read_shipping",
        "mall.write_shipping",
      ];

      // OAuth 시작 API 호출
      const response = await cafe24API.startOAuth({
        mall_id: mallId,
        scopes: scopes,
      });

      // 받은 authorize_url로 리다이렉트
      window.location.href = response.authorize_url;
    } catch (err) {
      console.error("Cafe24 연동 시작 실패:", err);
      alert("Cafe24 연동을 시작할 수 없습니다. 다시 시도해주세요.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen">
      <div className="max-w-[1600px] mx-auto px-6 py-6">
        <Breadcrumb
          items={[
            { label: "설정", path: "/settings/admin" },
            { label: "관리자 설정" },
          ]}
        />
        {/* 헤더 */}
        <div className="mb-6">
        </div>

        <Tabs
          tabs={tabs}
          activeTab={activeTab}
          onChange={(key) => setActiveTab(key as SettingsTab)}
        />

        {/* 관리자 설정 */}
        {activeTab === "admin" && (
          <div className="space-y-6">
            <Card className="unified-card">
              <div className="mb-6">
                <h2 className="text-lg font-semibold text-ink mb-2">
                  관리자 계정
                </h2>
              </div>
              <div className="space-y-4">
                {adminLoading ? (
                  <div className="text-center py-8 text-muted">로딩 중...</div>
                ) : admins.length === 0 ? (
                  <div className="text-center py-8 text-muted">
                    관리자가 없습니다
                  </div>
                ) : (
                  admins.map((admin) => (
                    <div
                      key={admin.admin_id}
                      className="flex items-center justify-between p-4 bg-primary-50 border border-line rounded-md"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-accent rounded-full flex items-center justify-center text-white font-semibold">
                          {admin.admin_name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-ink">{admin.admin_name}</p>
                          <p className="text-sm text-muted">{admin.email}</p>
                          <p className="text-xs text-muted mt-1">
                            {admin.admin_role} •{" "}
                            {admin.last_login_at
                              ? `마지막 로그인: ${new Date(
                                  admin.last_login_at
                                ).toLocaleDateString("ko-KR")}`
                              : "로그인 이력 없음"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={admin.is_active ? "success" : "default"}
                        >
                          {admin.is_active ? "활성" : "비활성"}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={Edit}
                          onClick={() => handleEditAdmin(admin)}
                          className="unified-btn-outline"
                        >
                          수정
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={Trash2}
                          onClick={() => handleDeleteAdmin(admin.admin_id)}
                          className="unified-btn-outline"
                        >
                          삭제
                        </Button>
                      </div>
                    </div>
                  ))
                )}
                <Button
                  variant="ghost"
                  icon={Plus}
                  onClick={() => {
                    setEditingAdmin(null);
                    setAdminForm({
                      email: "",
                      plain_password: "",
                      admin_name: "",
                      admin_role: AdminRole.ADMIN,
                      is_active: true,
                    });
                    setShowAdminModal(true);
                  }}
                  className="unified-btn-outline w-full"
                >
                  관리자 추가
                </Button>
              </div>
            </Card>

            <Card className="unified-card">
              <div className="mb-6">
                <h2 className="text-lg font-semibold text-ink mb-2">
                  권한 관리
                </h2>
                <p className="text-sm text-muted">
                  각 역할별 권한을 확인합니다
                </p>
              </div>
              <div className="space-y-2">
                {[
                  {
                    name: "최고 관리자",
                    key: AdminRole.SUPER_ADMIN,
                    count: admins.filter(
                      (a) => a.admin_role === AdminRole.SUPER_ADMIN
                    ).length,
                    description: "모든 권한을 가진 관리자",
                  },
                  {
                    name: "일반 관리자",
                    key: AdminRole.ADMIN,
                    count: admins.filter((a) => a.admin_role === AdminRole.ADMIN)
                      .length,
                    description: "일반 관리 권한",
                  },
                  {
                    name: "매니저",
                    key: AdminRole.MANAGER,
                    count: admins.filter((a) => a.admin_role === AdminRole.MANAGER)
                      .length,
                    description: "제한된 관리 권한",
                  },
                ].map((role) => (
                  <div
                    key={role.key}
                    className="flex items-center justify-between p-4 border border-line rounded-md hover:bg-primary-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Shield className="w-5 h-5 text-accent" />
                      <div>
                        <p className="font-medium text-ink">{role.name}</p>
                        <p className="text-sm text-muted">
                          {role.count}명 • {role.description}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}

        {/* Cafe24 연동 */}
        {activeTab === "cafe24" && (
          <div className="space-y-6">
            <Card className="unified-card overflow-hidden">
              <div className="p-6 bg-gradient-to-r from-accent/5 to-accent/10 border-b border-line">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-accent to-accent-light flex items-center justify-center">
                      <Package className="w-7 h-7 text-white" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-ink mb-1">
                        Cafe24 API 연동
                      </h2>
                      <p className="text-sm text-muted">
                        Cafe24 쇼핑몰과 API 연동 상태를 확인하고 관리합니다
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    icon={RefreshCw}
                    onClick={fetchCafe24Status}
                    loading={loading}
                    className="unified-btn-outline"
                  >
                    새로고침
                  </Button>
                </div>
              </div>

              <div className="p-6">
                {cafe24TokenStatus && cafe24TokenStatus.authorized ? (
                  <div className="space-y-6">
                    {/* 연동 상태 카드 */}
                    <div className="p-6 bg-gradient-to-br from-success-50 to-success-100/50 border-2 border-success-200 rounded-xl">
                      <div className="flex items-start gap-4">
                        <div className="w-14 h-14 bg-success-500 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg">
                          <Check className="w-8 h-8 text-white" />
                        </div>
                        <div className="flex-1">
                          <h3 className="text-xl font-bold text-success-900 mb-3">
                            연동 활성화됨
                          </h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="p-3 bg-white/60 rounded-lg">
                              <p className="text-xs text-success-700 font-medium mb-1">
                                Mall ID
                              </p>
                              <p className="text-sm font-mono font-semibold text-success-900">
                                {cafe24TokenStatus.mall_id}
                              </p>
                            </div>
                            {cafe24TokenStatus.expires_at && (
                              <div className="p-3 bg-white/60 rounded-lg">
                                <p className="text-xs text-success-700 font-medium mb-1">
                                  만료 예정
                                </p>
                                <p className="text-sm font-semibold text-success-900">
                                  {formatKst(cafe24TokenStatus.expires_at)}
                                </p>
                              </div>
                            )}
                            {cafe24TokenStatus.refresh_token_expires_at && (
                              <div className="p-3 bg-white/60 rounded-lg">
                                <p className="text-xs text-success-700 font-medium mb-1">
                                  리프레시 토큰 만료
                                </p>
                                <p className="text-sm font-semibold text-success-900">
                                  {formatKst(
                                    cafe24TokenStatus.refresh_token_expires_at
                                  )}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 권한 스코프 */}
                    <div>
                      <h3 className="text-base font-semibold text-ink mb-4 flex items-center gap-2">
                        <Shield className="w-5 h-5 text-accent" />
                        API 권한 스코프
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {cafe24TokenStatus.scopes.map((scope) => (
                          <div
                            key={scope}
                            className="flex items-center gap-2 p-3 bg-chip border border-line rounded-lg hover:border-accent/30 transition-colors"
                          >
                            <Check className="w-4 h-4 text-success-600 flex-shrink-0" />
                            <span className="text-xs font-mono text-ink">
                              {scope}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* 토큰 갱신 안내 */}
                    <div className="p-4 bg-info-50 border border-info-200 rounded-lg">
                      <div className="flex items-start gap-3">
                        <div className="w-5 h-5 rounded-full bg-info-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <span className="text-white text-xs">i</span>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-info-900 mb-1">
                            자동 토큰 갱신
                          </p>
                          <p className="text-xs text-info-700">
                            액세스 토큰은 만료 7일 전부터 자동으로 갱신됩니다.
                            문제가 발생할 경우 재연동을 진행해주세요.
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* 액션 버튼 */}
                    <div className="flex gap-3">
                      <Button
                        variant="outline"
                        className="unified-btn-outline flex-1"
                        onClick={handleCafe24Connect}
                      >
                        재연동
                      </Button>
                      <Button
                        variant="primary"
                        icon={ExternalLink}
                        className="unified-btn flex-1"
                        onClick={() =>
                          window.open("https://www.cafe24.com/", "_blank")
                        }
                      >
                        Cafe24 관리자 열기
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <div className="w-20 h-20 bg-gradient-to-br from-neutral-100 to-neutral-200 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-inner">
                      <X className="w-10 h-10 text-neutral-400" />
                    </div>
                    <h3 className="text-xl font-bold text-ink mb-2">
                      연동되지 않음
                    </h3>
                    <p className="text-sm text-muted mb-8 max-w-md mx-auto">
                      Cafe24 API와 연동하여 상품, 주문, 고객 정보를 자동으로
                      동기화하세요
                    </p>
                    <Button
                      variant="primary"
                      size="lg"
                      className="unified-btn px-8"
                      onClick={handleCafe24Connect}
                    >
                      Cafe24 연동하기
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          </div>
        )}

        {/* 마이페이지 */}
        {activeTab === "profile" && currentAdmin && (
          <AdminDetailPage
            adminId={currentAdmin.admin_id}
            isMyPage={true}
            onSave={() => {
              // 저장 후 새로고침 또는 상태 업데이트
            }}
          />
        )}
      </div>

      {/* 관리자 추가/수정 모달 */}
      <Modal
        isOpen={showAdminModal}
        onClose={() => {
          setShowAdminModal(false);
          setEditingAdmin(null);
        }}
        title={editingAdmin ? "관리자 수정" : "관리자 추가"}
      >
        <div className="space-y-4">
          <Input
            label="이름"
            value={adminForm.admin_name}
            onChange={(e) =>
              setAdminForm({ ...adminForm, admin_name: e.target.value })
            }
            className="unified-input"
            required
          />
          <Input
            label="이메일"
            type="email"
            value={adminForm.email}
            onChange={(e) =>
              setAdminForm({ ...adminForm, email: e.target.value })
            }
            className="unified-input"
            required
          />
          <Input
            label={editingAdmin ? "새 비밀번호 (변경 시에만 입력)" : "비밀번호"}
            type="password"
            value={adminForm.plain_password}
            onChange={(e) =>
              setAdminForm({ ...adminForm, plain_password: e.target.value })
            }
            className="unified-input"
            required={!editingAdmin}
          />
          <div>
            <label className="block text-xs font-medium text-muted mb-1.5 uppercase tracking-wider">
              역할
            </label>
            <select
              value={adminForm.admin_role}
              onChange={(e) =>
                setAdminForm({
                  ...adminForm,
                  admin_role: e.target.value as AdminRole,
                })
              }
              className="unified-input w-full"
            >
              <option value={AdminRole.SUPER_ADMIN}>최고 관리자</option>
              <option value={AdminRole.ADMIN}>일반 관리자</option>
              <option value={AdminRole.MANAGER}>매니저</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_active"
              checked={adminForm.is_active}
              onChange={(e) =>
                setAdminForm({ ...adminForm, is_active: e.target.checked })
              }
              className="w-4 h-4 rounded border-line text-accent focus:ring-accent"
            />
            <label htmlFor="is_active" className="text-sm text-ink">
              활성 상태
            </label>
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button
              variant="ghost"
              onClick={() => {
                setShowAdminModal(false);
                setEditingAdmin(null);
              }}
              className="unified-btn-outline"
            >
              취소
            </Button>
            <Button onClick={handleSaveAdmin} className="unified-btn">
              저장
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default SettingsPage;
