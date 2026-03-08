import React, { useState, useEffect } from "react";
import {
  Shield,
  Package,
  ExternalLink,
  Check,
  X,
  RefreshCw,
  User,
} from "lucide-react";
import Card from "../components/common/Card";
import Button from "../components/common/Button";
import Tabs from "../components/common/Tabs";
import Breadcrumb from "../components/common/Breadcrumb";
import AdminDetailPage from "./AdminDetailPage";
import { useAuth } from "../contexts/AuthContext";
import { cafe24API, Cafe24TokenStatusResponse } from "../api/cafe24Api";
import { formatKst } from "../utils/date";

type SettingsTab = "cafe24" | "profile";

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
      profile: "profile",
      integration: "cafe24",
      cafe24: "cafe24",
    };
    return tabMap[tab] || "cafe24";
  };

  const [activeTab, setActiveTab] = useState<SettingsTab>(mapTab(initialTab));
  const [cafe24TokenStatus, setCafe24TokenStatus] =
    useState<Cafe24TokenStatusResponse | null>(null);
  const [loading, setLoading] = useState(false);

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

  useEffect(() => {
    if (activeTab === "cafe24") {
      fetchCafe24Status();
    }
  }, [activeTab]);

  const tabs = [
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
            { label: "설정", path: "/settings/cafe24" },
            { label: activeTab === "cafe24" ? "Cafe24 연동" : "마이페이지" },
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

    </div>
  );
};

export default SettingsPage;
