import React, { useState, useEffect } from "react";
import {
  Calendar,
  Package,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Filter,
  Search,
} from "lucide-react";
import Card from "../components/common/Card";
import Button from "../components/common/Button";
import Table, { Column } from "../components/common/Table";
import Tabs from "../components/common/Tabs";
import Modal from "../components/common/Modal";
import Input from "../components/common/Input";
import Select from "../components/common/Select";
import StatCard from "../components/common/StatCard";
import LoadingSpinner from "../components/common/LoadingSpinner";
import Breadcrumb from "../components/common/Breadcrumb";
import { dispatchApi } from "../api/dispatchApi";
import type {
  DispatchTarget,
  DispatchTargetsResponse,
  DispatchGenerateRequest,
  DispatchGenerateResponse,
  DispatchSummaryResponse,
  SingleTarget,
  SingleTargetsResponse,
} from "../types/dispatch";

// ============================================================================
// 타입 정의
// ============================================================================

type TabType = "issue" | "single";

// ============================================================================
// 호수별 발송 탭 컴포넌트
// ============================================================================

interface IssueDispatchTabProps {
  loading: boolean;
  onLoadingChange: (loading: boolean) => void;
}

const IssueDispatchTab: React.FC<IssueDispatchTabProps> = ({
  loading,
  onLoadingChange,
}) => {
  // 필터 상태
  const [issue, setIssue] = useState("");
  const [productCode, setProductCode] = useState<string | null>(null);
  const [baseCode, setBaseCode] = useState<string | null>(null);

  // 데이터 상태
  const [targets, setTargets] = useState<DispatchTarget[]>([]);
  const [summary, setSummary] = useState<DispatchSummaryResponse | null>(null);
  const [targetsCount, setTargetsCount] = useState(0);
  const [hasSearched, setHasSearched] = useState(false);

  // 모달 상태
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);
  const [sendDate, setSendDate] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateResult, setGenerateResult] =
    useState<DispatchGenerateResponse | null>(null);

  // 호수 입력 형식 검증 (YYYYMM)
  const validateIssue = (value: string): boolean => {
    if (!value) return false;
    const regex = /^\d{6}$/;
    if (!regex.test(value)) return false;
    const year = parseInt(value.substring(0, 4));
    const month = parseInt(value.substring(4, 6));
    return year >= 2000 && year <= 2100 && month >= 1 && month <= 12;
  };

  // 대상 조회
  const fetchTargets = async () => {
    if (!validateIssue(issue)) {
      return;
    }

    onLoadingChange(true);
    try {
      const response = await dispatchApi.getDispatchTargets(issue, {
        product_code: productCode || null,
        base_code: baseCode || null,
      });
      console.log("API 응답:", response);
      console.log("응답 데이터:", response.data);
      
      const data = response.data.data;
      if (!data) {
        console.error("응답 데이터가 없습니다:", response);
        alert("응답 데이터를 받지 못했습니다.");
        setTargets([]);
        setTargetsCount(0);
        return;
      }
      
      console.log("파싱된 데이터:", data);
      console.log("대상 목록:", data.targets);
      
      setTargets(data.targets || []);
      setTargetsCount(data.count || 0);
      setHasSearched(true);
    } catch (error: any) {
      console.error("발송 대상 조회 실패:", error);
      console.error("에러 상세:", error.response);
      alert(error.response?.data?.detail || error.message || "발송 대상을 조회하는데 실패했습니다.");
      setTargets([]);
      setTargetsCount(0);
      setHasSearched(true);
    } finally {
      onLoadingChange(false);
    }
  };

  // 요약 정보 조회
  const fetchSummary = async () => {
    if (!validateIssue(issue)) {
      return;
    }

    try {
      const response = await dispatchApi.getDispatchSummary(issue, {
        product_code: productCode || null,
        base_code: baseCode || null,
      });
      setSummary(response.data.data!);
    } catch (error: any) {
      console.error("요약 정보 조회 실패:", error);
    }
  };

  // 대상 조회 및 요약 정보 조회
  const handleSearch = async () => {
    if (!validateIssue(issue)) {
      alert("올바른 호수를 입력해주세요. (형식: YYYYMM, 예: 202602)");
      return;
    }

    await Promise.all([fetchTargets(), fetchSummary()]);
  };

  // 일괄 생성
  const handleGenerate = async () => {
    if (!validateIssue(issue)) {
      alert("올바른 호수를 입력해주세요.");
      return;
    }

    setIsGenerating(true);
    try {
      const request: DispatchGenerateRequest = {
        product_code: productCode || null,
        base_code: baseCode || null,
        send_date: sendDate || null,
      };

      const response = await dispatchApi.generateDispatch(issue, request);
      const result = response.data.data!;
      setGenerateResult(result);

      // 성공 시 목록 새로고침
      if (result.created_count > 0) {
        await Promise.all([fetchTargets(), fetchSummary()]);
      }
    } catch (error: any) {
      console.error("발송 생성 실패:", error);
      alert(error.response?.data?.detail || "발송 생성에 실패했습니다.");
    } finally {
      setIsGenerating(false);
    }
  };

  // 테이블 컬럼 정의
  const columns: Column<DispatchTarget>[] = [
    {
      key: "customer_name",
      label: "고객명",
      render: (value, row) => row.customer_name,
    },
    {
      key: "product_code",
      label: "주문 상품코드",
      render: (value, row) => (
        <div className="flex flex-col gap-1">
          <span className="text-sm">{row.product_code}</span>
          <span className="text-xs text-gray-500">
            {row.product_kind}
          </span>
        </div>
      ),
    },
    {
      key: "send_product_code",
      label: "발송 상품코드",
      render: (value, row) => (
        <span className="font-medium text-blue-600">
          {row.send_product_code}
        </span>
      ),
    },
    {
      key: "product_name",
      label: "상품명",
      render: (value, row) => row.product_name,
    },
    {
      key: "address",
      label: "주소",
      render: (value, row) => (
        <div className="text-sm">
          <div>{row.address || "-"}</div>
          {row.postal_code && (
            <div className="text-gray-500 text-xs">
              [{row.postal_code}]
            </div>
          )}
        </div>
      ),
    },
    {
      key: "phone",
      label: "연락처",
      render: (value, row) => row.phone || row.customer_phone || "-",
    },
  ];

  return (
    <div className="space-y-6">
      {/* 필터 섹션 */}
      <Card className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              호수 <span className="text-red-500">*</span>
            </label>
            <Input
              type="text"
              placeholder="202602"
              value={issue}
              onChange={(e) => setIssue(e.target.value)}
              maxLength={6}
              onKeyPress={(e) => {
                if (e.key === "Enter") {
                  handleSearch();
                }
              }}
            />
            <p className="text-xs text-gray-500 mt-1">
              형식: YYYYMM (예: 202602)
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              상품 코드
            </label>
            <Input
              type="text"
              placeholder="전체"
              value={productCode || ""}
              onChange={(e) =>
                setProductCode(e.target.value || null)
              }
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              대표 코드
            </label>
            <Input
              type="text"
              placeholder="예: M1001"
              value={baseCode || ""}
              onChange={(e) => setBaseCode(e.target.value || null)}
            />
          </div>

          <div className="flex items-end">
            <Button
              onClick={handleSearch}
              icon={Search}
              loading={loading}
              disabled={!validateIssue(issue)}
              className="w-full"
            >
              조회
            </Button>
          </div>
        </div>
      </Card>

      {/* 요약 정보 */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatCard
            title="전체 구독"
            value={summary.statistics.total_subscriptions}
            icon={Package}
          />
          <StatCard
            title="연간 구독"
            value={summary.statistics.yearly_count}
            icon={Calendar}
          />
          <StatCard
            title="월간 구독"
            value={summary.statistics.monthly_count}
            icon={RefreshCw}
          />
          <StatCard
            title="대기 발송"
            value={summary.pending_count}
            icon={AlertCircle}
          />
        </div>
      )}

      {/* 대상 목록 */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">
            발송 대상 ({targetsCount}건)
          </h3>
          <Button
            onClick={() => setIsGenerateModalOpen(true)}
            disabled={targetsCount === 0}
            icon={Package}
          >
            일괄 생성
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <LoadingSpinner size="lg" />
          </div>
        ) : !hasSearched ? (
          <div className="text-center py-12 text-gray-500">
            호수를 입력하고 조회 버튼을 클릭해주세요.
          </div>
        ) : targets.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            발송 대상이 없습니다.
          </div>
        ) : (
          <Table
            data={targets}
            columns={columns}
            keyExtractor={(row) => String(row.order_item_id)}
            emptyMessage="발송 대상이 없습니다."
          />
        )}
      </Card>

      {/* 일괄 생성 모달 */}
      <Modal
        isOpen={isGenerateModalOpen}
        onClose={() => {
          if (!isGenerating) {
            setIsGenerateModalOpen(false);
            setSendDate("");
            setGenerateResult(null);
          }
        }}
        title="발송 일괄 생성"
        size="lg"
        footer={
          !generateResult ? (
            <div className="flex items-center justify-end gap-3 w-full">
              <Button
                variant="ghost"
                onClick={() => {
                  setIsGenerateModalOpen(false);
                  setSendDate("");
                }}
                disabled={isGenerating}
              >
                취소
              </Button>
              <Button
                onClick={handleGenerate}
                loading={isGenerating}
                disabled={isGenerating || targetsCount === 0}
                icon={Package}
              >
                생성
              </Button>
            </div>
          ) : null
        }
      >
        {!generateResult ? (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                발송일 (옵션)
              </label>
              <Input
                type="date"
                value={sendDate}
                onChange={(e) => setSendDate(e.target.value)}
              />
              <p className="text-xs text-gray-500 mt-1">
                미입력 시 오늘 날짜로 설정됩니다.
              </p>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
                <div className="flex-1">
                  <h4 className="font-medium text-blue-900 mb-1">
                    일괄 생성 안내
                  </h4>
                  <ul className="text-sm text-blue-800 space-y-1">
                    <li>• 총 {targetsCount}건의 발송이 생성됩니다.</li>
                    <li>
                      • YEARLY 상품은 해당 호수의 MONTHLY 상품으로 변환되어
                      발송됩니다.
                    </li>
                    <li>• 생성 중 오류가 발생한 항목은 별도로 표시됩니다.</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
                <h4 className="font-medium text-green-900">
                  발송 생성 완료
                </h4>
              </div>
              <div className="text-sm text-green-800 space-y-1">
                <p>총 대상: {generateResult.total_targets}건</p>
                <p>생성 성공: {generateResult.created_count}건</p>
                <p>생성 실패: {generateResult.error_count}건</p>
              </div>
            </div>

            {generateResult.errors.length > 0 && (
              <div>
                <h4 className="font-medium text-gray-900 mb-2">
                  생성 실패 항목
                </h4>
                <div className="border border-red-200 rounded-lg overflow-hidden">
                  <Table
                    data={generateResult.errors}
                    columns={[
                      {
                        key: "customer_name",
                        label: "고객명",
                        render: (value, row) => row.customer_name,
                      },
                      {
                        key: "error",
                        label: "오류 메시지",
                        render: (value, row) => (
                          <span className="text-red-600 text-sm">
                            {row.error}
                          </span>
                        ),
                      },
                    ]}
                    keyExtractor={(row) => String(row.order_item_id)}
                  />
                </div>
              </div>
            )}

            <div className="flex justify-end">
              <Button
                onClick={() => {
                  setIsGenerateModalOpen(false);
                  setSendDate("");
                  setGenerateResult(null);
                }}
              >
                닫기
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

// ============================================================================
// SINGLE 발송 탭 컴포넌트
// ============================================================================

interface SingleDispatchTabProps {
  loading: boolean;
  onLoadingChange: (loading: boolean) => void;
}

const SingleDispatchTab: React.FC<SingleDispatchTabProps> = ({
  loading,
  onLoadingChange,
}) => {
  // 필터 상태
  const [productCode, setProductCode] = useState("");

  // 데이터 상태
  const [targets, setTargets] = useState<SingleTarget[]>([]);
  const [targetsCount, setTargetsCount] = useState(0);
  const [hasSearched, setHasSearched] = useState(false);

  // 모달 상태
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);
  const [sendDate, setSendDate] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateResult, setGenerateResult] =
    useState<DispatchGenerateResponse | null>(null);

  // 대상 조회
  const fetchTargets = async () => {
    if (!productCode.trim()) {
      return;
    }

    onLoadingChange(true);
    try {
      const response = await dispatchApi.getSingleTargets(productCode);
      console.log("SINGLE API 응답:", response);
      console.log("응답 데이터:", response.data);
      
      const data = response.data.data;
      if (!data) {
        console.error("응답 데이터가 없습니다:", response);
        alert("응답 데이터를 받지 못했습니다.");
        setTargets([]);
        setTargetsCount(0);
        return;
      }
      
      console.log("파싱된 데이터:", data);
      console.log("대상 목록:", data.targets);
      
      setTargets(data.targets || []);
      setTargetsCount(data.count || 0);
      setHasSearched(true);
    } catch (error: any) {
      console.error("발송 대상 조회 실패:", error);
      console.error("에러 상세:", error.response);
      alert(error.response?.data?.detail || error.message || "발송 대상을 조회하는데 실패했습니다.");
      setTargets([]);
      setTargetsCount(0);
      setHasSearched(true);
    } finally {
      onLoadingChange(false);
    }
  };

  // 일괄 생성
  const handleGenerate = async () => {
    if (!productCode.trim()) {
      alert("상품 코드를 입력해주세요.");
      return;
    }

    setIsGenerating(true);
    try {
      const request: DispatchGenerateRequest = {
        send_date: sendDate || null,
      };

      const response = await dispatchApi.generateSingleDispatch(
        productCode,
        request
      );
      const result = response.data.data!;
      setGenerateResult(result);

      // 성공 시 목록 새로고침
      if (result.created_count > 0) {
        await fetchTargets();
      }
    } catch (error: any) {
      console.error("발송 생성 실패:", error);
      alert(error.response?.data?.detail || "발송 생성에 실패했습니다.");
    } finally {
      setIsGenerating(false);
    }
  };

  // 테이블 컬럼 정의
  const columns: Column<SingleTarget>[] = [
    {
      key: "customer_name",
      label: "고객명",
      render: (value, row) => row.customer_name,
    },
    {
      key: "product_code",
      label: "상품 코드",
      render: (value, row) => (
        <div className="flex flex-col gap-1">
          <span className="text-sm">{row.product_code}</span>
          <span className="text-xs text-gray-500">
            {row.product_kind}
          </span>
        </div>
      ),
    },
    {
      key: "product_name",
      label: "상품명",
      render: (value, row) => row.product_name,
    },
    {
      key: "order_num",
      label: "주문 수량",
      render: (value, row) => (
        <span className="font-medium">{row.order_num}개</span>
      ),
    },
    {
      key: "address",
      label: "주소",
      render: (value, row) => (
        <div className="text-sm">
          <div>{row.address || "-"}</div>
          {row.postal_code && (
            <div className="text-gray-500 text-xs">
              [{row.postal_code}]
            </div>
          )}
        </div>
      ),
    },
    {
      key: "phone",
      label: "연락처",
      render: (value, row) => row.phone || row.customer_phone || "-",
    },
  ];

  return (
    <div className="space-y-6">
      {/* 필터 섹션 */}
      <Card className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              상품 코드 <span className="text-red-500">*</span>
            </label>
            <Input
              type="text"
              placeholder="예: A5500"
              value={productCode}
              onChange={(e) => setProductCode(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === "Enter") {
                  fetchTargets();
                }
              }}
            />
            <p className="text-xs text-gray-500 mt-1">
              SINGLE 상품 코드를 입력하세요.
            </p>
          </div>

          <div className="flex items-end">
            <Button
              onClick={fetchTargets}
              icon={Search}
              loading={loading}
              disabled={!productCode.trim()}
              className="w-full"
            >
              조회
            </Button>
          </div>
        </div>
      </Card>

      {/* 대상 목록 */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">
            발송 대상 ({targetsCount}건)
          </h3>
          <Button
            onClick={() => setIsGenerateModalOpen(true)}
            disabled={targetsCount === 0}
            icon={Package}
          >
            일괄 발송
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <LoadingSpinner size="lg" />
          </div>
        ) : !hasSearched ? (
          <div className="text-center py-12 text-gray-500">
            상품 코드를 입력하고 조회 버튼을 클릭해주세요.
          </div>
        ) : targets.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            발송 대상이 없습니다.
          </div>
        ) : (
          <Table
            data={targets}
            columns={columns}
            keyExtractor={(row) => String(row.order_item_id)}
            emptyMessage="발송 대상이 없습니다."
          />
        )}
      </Card>

      {/* 일괄 생성 모달 */}
      <Modal
        isOpen={isGenerateModalOpen}
        onClose={() => {
          if (!isGenerating) {
            setIsGenerateModalOpen(false);
            setSendDate("");
            setGenerateResult(null);
          }
        }}
        title="발송 일괄 생성"
        size="lg"
        footer={
          !generateResult ? (
            <div className="flex items-center justify-end gap-3 w-full">
              <Button
                variant="ghost"
                onClick={() => {
                  setIsGenerateModalOpen(false);
                  setSendDate("");
                }}
                disabled={isGenerating}
              >
                취소
              </Button>
              <Button
                onClick={handleGenerate}
                loading={isGenerating}
                disabled={isGenerating || targetsCount === 0}
                icon={Package}
              >
                생성
              </Button>
            </div>
          ) : null
        }
      >
        {!generateResult ? (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                발송일 (옵션)
              </label>
              <Input
                type="date"
                value={sendDate}
                onChange={(e) => setSendDate(e.target.value)}
              />
              <p className="text-xs text-gray-500 mt-1">
                미입력 시 오늘 날짜로 설정됩니다.
              </p>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
                <div className="flex-1">
                  <h4 className="font-medium text-blue-900 mb-1">
                    일괄 생성 안내
                  </h4>
                  <ul className="text-sm text-blue-800 space-y-1">
                    <li>• 총 {targetsCount}건의 발송이 생성됩니다.</li>
                    <li>
                      • 각 주문품목의 주문 수량만큼 발송이 생성됩니다.
                    </li>
                    <li>• 생성 중 오류가 발생한 항목은 별도로 표시됩니다.</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
                <h4 className="font-medium text-green-900">
                  발송 생성 완료
                </h4>
              </div>
              <div className="text-sm text-green-800 space-y-1">
                <p>총 대상: {generateResult.total_targets}건</p>
                <p>생성 성공: {generateResult.created_count}건</p>
                <p>생성 실패: {generateResult.error_count}건</p>
              </div>
            </div>

            {generateResult.errors.length > 0 && (
              <div>
                <h4 className="font-medium text-gray-900 mb-2">
                  생성 실패 항목
                </h4>
                <div className="border border-red-200 rounded-lg overflow-hidden">
                  <Table
                    data={generateResult.errors}
                    columns={[
                      {
                        key: "customer_name",
                        label: "고객명",
                        render: (value, row) => row.customer_name,
                      },
                      {
                        key: "error",
                        label: "오류 메시지",
                        render: (value, row) => (
                          <span className="text-red-600 text-sm">
                            {row.error}
                          </span>
                        ),
                      },
                    ]}
                    keyExtractor={(row) => String(row.order_item_id)}
                  />
                </div>
              </div>
            )}

            <div className="flex justify-end">
              <Button
                onClick={() => {
                  setIsGenerateModalOpen(false);
                  setSendDate("");
                  setGenerateResult(null);
                }}
              >
                닫기
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

// ============================================================================
// 메인 컴포넌트: DispatchManagementPage
// ============================================================================

const DispatchManagementPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>("issue");
  const [loading, setLoading] = useState(false);

  const tabs = [
    {
      key: "issue",
      label: "호수별 발송",
      icon: <Calendar className="w-4 h-4" />,
    },
    {
      key: "single",
      label: "SINGLE 발송",
      icon: <Package className="w-4 h-4" />,
    },
  ];

  return (
    <div className="space-y-6">
      <Breadcrumb
        items={[
          { label: "홈", path: "/dashboard" },
          { label: "발송 관리", path: "/shipping" },
          { label: "발송 대상 관리" },
        ]}
      />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            발송 대상 관리
          </h1>
          <p className="text-gray-600 mt-1">
            구독 상품(호수별) 및 단행본 상품의 발송 대상을 조회하고 일괄 생성합니다.
          </p>
        </div>
      </div>

      <Tabs
        tabs={tabs}
        activeTab={activeTab}
        onChange={(key) => setActiveTab(key as TabType)}
      />

      {activeTab === "issue" && (
        <IssueDispatchTab
          loading={loading}
          onLoadingChange={setLoading}
        />
      )}

      {activeTab === "single" && (
        <SingleDispatchTab
          loading={loading}
          onLoadingChange={setLoading}
        />
      )}
    </div>
  );
};

export default DispatchManagementPage;
