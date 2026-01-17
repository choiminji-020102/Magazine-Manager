import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Calendar,
  MapPin,
  Package,
  User,
  Clock,
  CheckCircle,
  XCircle,
  Plus,
  Minus,
  Save,
  Send,
  AlertTriangle,
  History,
  MessageSquare,
} from "lucide-react";
import Card from "../components/common/Card";
import Button from "../components/common/Button";
import Input from "../components/common/Input";
import Textarea from "../components/common/Textarea";
import Select from "../components/common/Select";
import Modal from "../components/common/Modal";
import Badge from "../components/common/Badge";
import Alert from "../components/common/Alert";
import Breadcrumb from "../components/common/Breadcrumb";
import Tabs from "../components/common/Tabs";
import { subscriptionAPI, SubscriptionDetail } from "../api/subscriptionApi";


const SubscriptionDetailPage: React.FC = () => {
  const { orderItemId } = useParams<{ orderItemId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [subscription, setSubscription] = useState<SubscriptionDetail | null>(
    null
  );

  // 모달 상태
  const [isExtendModalOpen, setIsExtendModalOpen] = useState(false);
  const [isPeriodChangeModalOpen, setIsPeriodChangeModalOpen] = useState(false);
  const [isPauseModalOpen, setIsPauseModalOpen] = useState(false);
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
  const [isShortenModalOpen, setIsShortenModalOpen] = useState(false);

  // 연장 폼
  const [extendMonths, setExtendMonths] = useState(1);

  // 기간 변경 폼
  const [newStartIssue, setNewStartIssue] = useState("");
  const [newEndIssue, setNewEndIssue] = useState("");

  // 휴지 폼
  const [pauseIssue, setPauseIssue] = useState("");
  const [pauseReason, setPauseReason] = useState("");

  // 배송지 변경 폼
  const [newAddress, setNewAddress] = useState({
    address_name: "",
    phone: "",
    postal_code: "",
    address1: "",
    address2: "",
    address_memo: "",
  });

  // 단축 환불 폼
  const [shortenEndIssue, setShortenEndIssue] = useState("");
  const [refundAmount, setRefundAmount] = useState(0);
  const [refundConfirmed, setRefundConfirmed] = useState(false);
  const [useMessageTemplate, setUseMessageTemplate] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState("");

  // 탭 상태
  const [activeTab, setActiveTab] = useState("info");

  // 구독 상세 조회
  useEffect(() => {
    if (orderItemId) {
      fetchSubscriptionDetail(parseInt(orderItemId, 10));
    }
  }, [orderItemId]);

  const fetchSubscriptionDetail = async (id: number) => {
    try {
      setLoading(true);
      // 실제 API 호출
      const response = await subscriptionAPI.getDetail(id);
      setSubscription(response);
      setNewStartIssue(response.subscribe_start_issue || "");
      setNewEndIssue(response.subscribe_end_issue || "");
    } catch (err: any) {
      // 에러 발생 시 목업 데이터 사용 (개발용)
      console.warn("API 호출 실패, 목업 데이터 사용:", err);
      const mockData: SubscriptionDetail = {
        order_item_id: id,
        order_id: 1,
        customer_id: 1,
        customer_name: "김민수",
        customer_phone: "010-1234-5678",
        customer_email: "minsu.kim@example.com",
        product_code: "YEARLY-2603-BASIC",
        product_kind: "YEARLY",
        product_name: "1년 정기구독 - 26년 3월호 시작 말씀함께[기본판]",
        subscribe_start_issue: "2603",
        subscribe_end_issue: "2602",
        final_subscribe_end_issue: "2604",
        last_send_issue: "2601",
        address_id: 1,
        address: {
          address_id: 1,
          address_name: "김민수",
          phone: "010-1234-5678",
          postal_code: "06234",
          address1: "서울특별시 강남구 테헤란로 123",
          address2: "101동 101호",
          address_memo: null,
        },
        order: {
          order_id: 1,
          order_channel: "CAFE24",
          order_status: "PAID",
          payment_amount: 144000,
          order_at: "2024-01-15T00:00:00",
          payment_at: "2024-01-15T00:00:00",
        },
        pauses: [
          {
            pause_id: 1,
            pause_issue: "2602",
            reason: "해외 출장",
            created_at: "2024-07-15T00:00:00",
            admin_id: 1,
          },
        ],
        shipments: [
          { issue: "2601", sended_at: "2024-01-28T00:00:00" },
          { issue: "2602", sended_at: "2024-02-27T00:00:00" },
        ],
      };
      setSubscription(mockData);
      setNewStartIssue(mockData.subscribe_start_issue || "");
      setNewEndIssue(mockData.subscribe_end_issue || "");
      setError(err?.message || "구독 상세 정보를 불러오는데 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  // 구독 연장 (무상 연장)
  const handleExtend = async () => {
    if (!subscription) return;

    try {
      setError("");
      await subscriptionAPI.extend({
        order_item_id: subscription.order_item_id,
        months: extendMonths,
      });

      setSuccess(`${extendMonths}개월 무상 연장이 완료되었습니다.`);
      setIsExtendModalOpen(false);
      fetchSubscriptionDetail(subscription.order_item_id);
    } catch (err: any) {
      setError(err?.message || "구독 연장에 실패했습니다.");
    }
  };

  // 구독 기간 변경
  const handlePeriodChange = async () => {
    if (!subscription) return;

    if (!newStartIssue || !newEndIssue) {
      setError("시작 호와 종료 호를 모두 입력해주세요.");
      return;
    }

    try {
      setError("");
      await subscriptionAPI.changePeriod({
        order_item_id: subscription.order_item_id,
        subscribe_start_issue: newStartIssue,
        subscribe_end_issue: newEndIssue,
      });

      setSuccess("구독 기간이 변경되었습니다.");
      setIsPeriodChangeModalOpen(false);
      fetchSubscriptionDetail(subscription.order_item_id);
    } catch (err: any) {
      setError(err?.message || "구독 기간 변경에 실패했습니다.");
    }
  };

  // 휴지 신청
  const handlePause = async () => {
    if (!subscription) return;

    if (!pauseIssue) {
      setError("휴지할 호를 선택해주세요.");
      return;
    }

    try {
      setError("");
      await subscriptionAPI.pause({
        order_item_id: subscription.order_item_id,
        pause_issue: pauseIssue,
        reason: pauseReason || null,
      });

      setSuccess("휴지가 신청되었고, 구독 종료일이 자동 연장되었습니다.");
      setIsPauseModalOpen(false);
      setPauseIssue("");
      setPauseReason("");
      fetchSubscriptionDetail(subscription.order_item_id);
    } catch (err: any) {
      setError(err?.message || "휴지 신청에 실패했습니다.");
    }
  };

  // 배송지 변경
  const handlePostcodeSearch = () => {
    if (typeof window !== "undefined" && (window as any).daum?.Postcode) {
      new (window as any).daum.Postcode({
        oncomplete: function (data: any) {
          let addr = "";
          if (data.userSelectedType === "R") {
            addr = data.roadAddress;
          } else {
            addr = data.jibunAddress;
          }
          setNewAddress({
            ...newAddress,
            postal_code: data.zonecode,
            address1: addr,
            address2: "",
          });
        },
      }).open();
    } else {
      alert(
        "우편번호 검색 서비스를 불러올 수 없습니다. 페이지를 새로고침해주세요."
      );
    }
  };

  const handleAddressChange = async () => {
    if (!subscription) return;

    if (
      !newAddress.address_name ||
      !newAddress.phone ||
      !newAddress.postal_code ||
      !newAddress.address1
    ) {
      setError("배송지 정보를 모두 입력해주세요.");
      return;
    }

    try {
      setError("");
      // TODO: 실제 API 호출
      // await subscriptionAPI.changeAddress({
      //   order_item_id: subscription.order_item_id,
      //   address: newAddress,
      // });

      setSuccess("배송지가 변경되었습니다. 미발송분부터 적용됩니다.");
      setIsAddressModalOpen(false);
      fetchSubscriptionDetail(subscription.order_item_id);
    } catch (err: any) {
      setError(err?.message || "배송지 변경에 실패했습니다.");
    }
  };

  // 기간 단축 및 환불
  const handleShorten = async () => {
    if (!subscription) return;

    if (!shortenEndIssue) {
      setError("단축 종료 호를 선택해주세요.");
      return;
    }

    if (!refundConfirmed) {
      setError("환불 완료 확인을 체크해주세요.");
      return;
    }

    try {
      setError("");
      await subscriptionAPI.shorten({
        order_item_id: subscription.order_item_id,
        final_subscribe_end_issue: shortenEndIssue,
        refund_amount: refundAmount,
        use_message_template: useMessageTemplate,
        message_template_id: selectedTemplate || null,
      });

      setSuccess("구독 기간이 단축되었고 환불이 처리되었습니다.");
      setIsShortenModalOpen(false);
      setShortenEndIssue("");
      setRefundAmount(0);
      setRefundConfirmed(false);
      fetchSubscriptionDetail(subscription.order_item_id);
    } catch (err: any) {
      setError(err?.message || "기간 단축 및 환불 처리에 실패했습니다.");
    }
  };

  // 환불 금액 계산
  const calculateRefund = (endIssue: string) => {
    if (!subscription) return;

    // 간단한 환불 계산 (실제로는 더 복잡한 로직)
    const monthlyPrice = subscription.order.payment_amount / 12; // 연간 구독 가정
    const startYear = parseInt(subscription.subscribe_start_issue?.substring(0, 2) || "0");
    const startMonth = parseInt(subscription.subscribe_start_issue?.substring(2, 4) || "0");
    const endYear = parseInt(endIssue.substring(0, 2));
    const endMonth = parseInt(endIssue.substring(2, 4));

    // 남은 개월 수 계산
    const totalMonths = (endYear - startYear) * 12 + (endMonth - startMonth);
    const remainingMonths = 12 - totalMonths; // 원래 12개월 구독 가정

    if (remainingMonths > 0) {
      setRefundAmount(Math.floor(monthlyPrice * remainingMonths));
    } else {
      setRefundAmount(0);
    }
    setShortenEndIssue(endIssue);
  };

  // 호수 목록 생성 (구독 시작 호부터 종료 호까지)
  const generateIssueList = () => {
    if (!subscription || !subscription.subscribe_start_issue) return [];

    const issues: string[] = [];
    const startYear = parseInt(subscription.subscribe_start_issue.substring(0, 2));
    const startMonth = parseInt(subscription.subscribe_start_issue.substring(2, 4));
    const endYear = parseInt(
      (subscription.final_subscribe_end_issue || subscription.subscribe_end_issue || subscription.subscribe_start_issue).substring(0, 2)
    );
    const endMonth = parseInt(
      (subscription.final_subscribe_end_issue || subscription.subscribe_end_issue || subscription.subscribe_start_issue).substring(2, 4)
    );

    let year = startYear;
    let month = startMonth;
    const endDate = endYear * 100 + endMonth;
    let currentDate = year * 100 + month;

    while (currentDate <= endDate) {
      issues.push(`${String(year).padStart(2, "0")}${String(month).padStart(2, "0")}`);
      month++;
      if (month > 12) {
        month = 1;
        year++;
      }
      currentDate = year * 100 + month;
    }

    return issues;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent mx-auto mb-4"></div>
          <p className="text-muted">구독 정보를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (!subscription) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <XCircle className="w-16 h-16 text-muted mx-auto mb-4" />
          <p className="text-lg font-semibold text-ink mb-2">
            구독 정보를 찾을 수 없습니다.
          </p>
          <Button onClick={() => navigate("/subscription/list")}>
            구독 목록으로 돌아가기
          </Button>
        </div>
      </div>
    );
  }

  const issueList = generateIssueList();
  const availablePauseIssues = issueList.filter(
    (issue) => !subscription.pauses.some((p) => p.pause_issue === issue)
  );

  const tabs = [
    { key: "info", label: "구독 정보" },
    { key: "shipments", label: "발송 내역" },
    { key: "pauses", label: "휴지 내역" },
    { key: "order", label: "주문 정보" },
  ];

  return (
    <div className="min-h-screen">
      <div className="max-w-[1600px] mx-auto px-6 py-6">
        <Breadcrumb
          items={[
            { label: "구독 관리", path: "/subscription/list" },
            { label: "구독 상세" },
          ]}
        />

        {/* 헤더 */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              icon={ArrowLeft}
              onClick={() => navigate("/subscription/list")}
            >
              목록으로
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-ink">
                구독 상세 정보
              </h1>
              <p className="text-sm text-muted mt-1">
                주문 상품 ID: {subscription.order_item_id}
              </p>
            </div>
          </div>
        </div>

        {/* 성공/에러 메시지 */}
        {success && (
          <Alert type="success" className="mb-4">
            {success}
          </Alert>
        )}
        {error && (
          <Alert type="error" className="mb-4">
            {error}
          </Alert>
        )}

        {/* 빠른 액션 버튼 */}
        <Card className="unified-card mb-6">
          <div className="p-4">
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant="primary"
                size="sm"
                icon={Plus}
                onClick={() => {
                  setExtendMonths(1);
                  setIsExtendModalOpen(true);
                }}
              >
                구독 연장
              </Button>
              <Button
                variant="secondary"
                size="sm"
                icon={Calendar}
                onClick={() => setIsPeriodChangeModalOpen(true)}
              >
                기간 변경
              </Button>
              <Button
                variant="secondary"
                size="sm"
                icon={Clock}
                onClick={() => {
                  setPauseIssue("");
                  setPauseReason("");
                  setIsPauseModalOpen(true);
                }}
              >
                휴지 신청
              </Button>
              <Button
                variant="secondary"
                size="sm"
                icon={MapPin}
                onClick={() => {
                  setNewAddress({
                    address_name: subscription.address.address_name,
                    phone: subscription.address.phone,
                    postal_code: subscription.address.postal_code,
                    address1: subscription.address.address1,
                    address2: subscription.address.address2 || "",
                    address_memo: subscription.address.address_memo || "",
                  });
                  setIsAddressModalOpen(true);
                }}
              >
                배송지 변경
              </Button>
              <Button
                variant="outline"
                size="sm"
                icon={Minus}
                onClick={() => {
                  setShortenEndIssue("");
                  setRefundAmount(0);
                  setRefundConfirmed(false);
                  setIsShortenModalOpen(true);
                }}
              >
                기간 단축/환불
              </Button>
            </div>
          </div>
        </Card>

        {/* 메인 콘텐츠 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 왼쪽: 구독 정보 */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="unified-card">
              <div className="p-6">
                <Tabs
                  tabs={tabs}
                  activeTab={activeTab}
                  onChange={setActiveTab}
                  className="mb-6"
                />

                {activeTab === "info" && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs text-muted uppercase tracking-wide mb-1 block">
                          상품 코드
                        </label>
                        <p className="text-sm font-medium text-ink">
                          {subscription.product_code}
                        </p>
                      </div>
                      <div>
                        <label className="text-xs text-muted uppercase tracking-wide mb-1 block">
                          상품명
                        </label>
                        <p className="text-sm font-medium text-ink">
                          {subscription.product_name}
                        </p>
                      </div>
                      <div>
                        <label className="text-xs text-muted uppercase tracking-wide mb-1 block">
                          구독 시작 호
                        </label>
                        <p className="text-sm font-medium text-ink">
                          {subscription.subscribe_start_issue || "-"}
                        </p>
                      </div>
                      <div>
                        <label className="text-xs text-muted uppercase tracking-wide mb-1 block">
                          원 구독 종료 호
                        </label>
                        <p className="text-sm font-medium text-ink">
                          {subscription.subscribe_end_issue || "-"}
                        </p>
                      </div>
                      <div>
                        <label className="text-xs text-muted uppercase tracking-wide mb-1 block">
                          실제 종료 호
                        </label>
                        <p className="text-sm font-semibold text-accent">
                          {subscription.final_subscribe_end_issue || "-"}
                        </p>
                      </div>
                      <div>
                        <label className="text-xs text-muted uppercase tracking-wide mb-1 block">
                          마지막 발송 호
                        </label>
                        <p className="text-sm font-medium text-ink">
                          {subscription.last_send_issue || "-"}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === "shipments" && (
                  <div className="space-y-3">
                    {subscription.shipments.length === 0 ? (
                      <div className="text-center py-8 text-muted">
                        발송 내역이 없습니다.
                      </div>
                    ) : (
                      subscription.shipments.map((shipment, index) => (
                        <div
                          key={index}
                          className="p-4 bg-success-50 border border-success-200 rounded-lg flex items-center justify-between"
                        >
                          <div className="flex items-center gap-3">
                            <CheckCircle className="w-5 h-5 text-success-600" />
                            <div>
                              <p className="font-medium text-ink">
                                {shipment.issue}호
                              </p>
                              <p className="text-sm text-muted">
                                발송일: {new Date(shipment.sended_at).toLocaleDateString("ko-KR")}
                              </p>
                            </div>
                          </div>
                          <Badge variant="success" size="sm">
                            발송완료
                          </Badge>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {activeTab === "pauses" && (
                  <div className="space-y-3">
                    {subscription.pauses.length === 0 ? (
                      <div className="text-center py-8 text-muted">
                        휴지 내역이 없습니다.
                      </div>
                    ) : (
                      subscription.pauses.map((pause) => (
                        <div
                          key={pause.pause_id}
                          className="p-4 border border-line rounded-lg"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <Badge variant="warning" className="mb-2">
                                {pause.pause_issue}호
                              </Badge>
                              <p className="text-sm text-muted">
                                사유: {pause.reason || "-"}
                              </p>
                            </div>
                            <div className="text-right text-sm text-muted">
                              <p>
                                {new Date(pause.created_at).toLocaleDateString("ko-KR")}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {activeTab === "order" && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs text-muted uppercase tracking-wide mb-1 block">
                          주문 ID
                        </label>
                        <p className="text-sm font-medium text-ink">
                          {subscription.order.order_id}
                        </p>
                      </div>
                      <div>
                        <label className="text-xs text-muted uppercase tracking-wide mb-1 block">
                          주문 채널
                        </label>
                        <p className="text-sm font-medium text-ink">
                          {subscription.order.order_channel}
                        </p>
                      </div>
                      <div>
                        <label className="text-xs text-muted uppercase tracking-wide mb-1 block">
                          주문 상태
                        </label>
                        <Badge variant="info">
                          {subscription.order.order_status}
                        </Badge>
                      </div>
                      <div>
                        <label className="text-xs text-muted uppercase tracking-wide mb-1 block">
                          결제 금액
                        </label>
                        <p className="text-sm font-medium text-ink">
                          ₩{subscription.order.payment_amount.toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <label className="text-xs text-muted uppercase tracking-wide mb-1 block">
                          주문일
                        </label>
                        <p className="text-sm font-medium text-ink">
                          {new Date(subscription.order.order_at).toLocaleDateString("ko-KR")}
                        </p>
                      </div>
                      <div>
                        <label className="text-xs text-muted uppercase tracking-wide mb-1 block">
                          결제일
                        </label>
                        <p className="text-sm font-medium text-ink">
                          {subscription.order.payment_at
                            ? new Date(subscription.order.payment_at).toLocaleDateString("ko-KR")
                            : "-"}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </Card>
          </div>

          {/* 오른쪽: 고객 정보 및 배송지 */}
          <div className="space-y-6">
            <Card className="unified-card">
              <div className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <User className="w-5 h-5 text-accent" />
                  <h3 className="text-sm font-semibold text-ink uppercase tracking-wide">
                    고객 정보
                  </h3>
                </div>
                <div className="space-y-3 text-sm">
                  <div>
                    <label className="text-xs text-muted mb-1 block">이름</label>
                    <p className="font-medium text-ink">
                      {subscription.customer_name}
                    </p>
                  </div>
                  <div>
                    <label className="text-xs text-muted mb-1 block">연락처</label>
                    <p className="font-medium text-ink">
                      {subscription.customer_phone}
                    </p>
                  </div>
                  <div>
                    <label className="text-xs text-muted mb-1 block">이메일</label>
                    <p className="font-medium text-ink">
                      {subscription.customer_email || "-"}
                    </p>
                  </div>
                </div>
              </div>
            </Card>

            <Card className="unified-card">
              <div className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <MapPin className="w-5 h-5 text-accent" />
                  <h3 className="text-sm font-semibold text-ink uppercase tracking-wide">
                    배송지
                  </h3>
                </div>
                <div className="space-y-2 text-sm">
                  <div>
                    <label className="text-xs text-muted mb-1 block">수령인</label>
                    <p className="font-medium text-ink">
                      {subscription.address.address_name}
                    </p>
                  </div>
                  <div>
                    <label className="text-xs text-muted mb-1 block">연락처</label>
                    <p className="font-medium text-ink">
                      {subscription.address.phone}
                    </p>
                  </div>
                  <div>
                    <label className="text-xs text-muted mb-1 block">주소</label>
                    <p className="font-medium text-ink">
                      ({subscription.address.postal_code}) {subscription.address.address1}
                      {subscription.address.address2 && ` ${subscription.address.address2}`}
                    </p>
                  </div>
                  {subscription.address.address_memo && (
                    <div>
                      <label className="text-xs text-muted mb-1 block">배송 메모</label>
                      <p className="font-medium text-ink">
                        {subscription.address.address_memo}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          </div>
        </div>

        {/* 구독 연장 모달 */}
        <Modal
          isOpen={isExtendModalOpen}
          onClose={() => setIsExtendModalOpen(false)}
          title="구독 연장 (무상 연장)"
          size="md"
          footer={
            <>
              <Button
                variant="ghost"
                onClick={() => setIsExtendModalOpen(false)}
              >
                취소
              </Button>
              <Button variant="primary" onClick={handleExtend}>
                연장 적용
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            <div className="p-4 bg-info-50 border border-info-200 rounded-lg">
              <p className="text-sm text-info-700">
                무상 연장은 추가 결제 없이 구독 종료일만 연장합니다.
              </p>
            </div>
            <div className="flex items-center gap-4">
              <label className="text-sm font-medium text-ink">연장 개월:</label>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  icon={Minus}
                  onClick={() => setExtendMonths(Math.max(1, extendMonths - 1))}
                />
                <span className="w-12 text-center font-semibold text-lg">
                  {extendMonths}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  icon={Plus}
                  onClick={() => setExtendMonths(extendMonths + 1)}
                />
              </div>
            </div>
            {subscription && (
              <div className="p-4 bg-neutral-50 rounded-lg">
                <div className="text-sm space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted">현재 종료 호:</span>
                    <span className="font-medium">
                      {subscription.final_subscribe_end_issue || "-"}
                    </span>
                  </div>
                  <div className="flex justify-between font-semibold">
                    <span>변경 후 종료 호:</span>
                    <span className="text-accent">+{extendMonths}개월</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </Modal>

        {/* 기간 변경 모달 */}
        <Modal
          isOpen={isPeriodChangeModalOpen}
          onClose={() => setIsPeriodChangeModalOpen(false)}
          title="구독 기간 변경"
          size="md"
          footer={
            <>
              <Button
                variant="ghost"
                onClick={() => setIsPeriodChangeModalOpen(false)}
              >
                취소
              </Button>
              <Button variant="primary" onClick={handlePeriodChange}>
                변경 적용
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            <Input
              label="구독 시작 호"
              value={newStartIssue}
              onChange={(e) => setNewStartIssue(e.target.value)}
              placeholder="2603"
              required
            />
            <Input
              label="구독 종료 호"
              value={newEndIssue}
              onChange={(e) => setNewEndIssue(e.target.value)}
              placeholder="2602"
              required
            />
            <div className="p-4 bg-warning-50 border border-warning-200 rounded-lg">
              <p className="text-sm text-warning-700">
                기간을 단축하면 환불이 필요할 수 있습니다. 환불이 필요한 경우
                "기간 단축/환불" 기능을 사용해주세요.
              </p>
            </div>
          </div>
        </Modal>

        {/* 휴지 신청 모달 */}
        <Modal
          isOpen={isPauseModalOpen}
          onClose={() => setIsPauseModalOpen(false)}
          title="휴지 신청"
          size="md"
          footer={
            <>
              <Button
                variant="ghost"
                onClick={() => setIsPauseModalOpen(false)}
              >
                취소
              </Button>
              <Button
                variant="primary"
                onClick={handlePause}
                disabled={!pauseIssue}
              >
                휴지 신청
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            <div className="p-4 bg-info-50 border border-info-200 rounded-lg">
              <p className="text-sm text-info-700">
                휴지 신청 시 해당 호는 발송되지 않으며, 구독 종료일이 자동으로
                1개월 연장됩니다.
              </p>
            </div>
            <Select
              label="휴지할 호 선택"
              value={pauseIssue}
              onChange={(e) => setPauseIssue(e.target.value)}
              options={availablePauseIssues.map((issue) => ({
                value: issue,
                label: `${issue}호`,
              }))}
              placeholder="호를 선택하세요"
              required
            />
            <Textarea
              label="휴지 사유"
              value={pauseReason}
              onChange={(e) => setPauseReason(e.target.value)}
              placeholder="휴지 사유를 입력하세요"
              rows={3}
            />
            {pauseIssue && (
              <div className="p-4 bg-neutral-50 rounded-lg">
                <div className="text-sm space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted">현재 종료 호:</span>
                    <span className="font-medium">
                      {subscription.final_subscribe_end_issue || "-"}
                    </span>
                  </div>
                  <div className="flex justify-between font-semibold">
                    <span>변경 후 종료 호:</span>
                    <span className="text-accent">+1개월 연장</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </Modal>

        {/* 배송지 변경 모달 */}
        <Modal
          isOpen={isAddressModalOpen}
          onClose={() => setIsAddressModalOpen(false)}
          title="배송지 변경"
          size="lg"
          footer={
            <>
              <Button
                variant="ghost"
                onClick={() => setIsAddressModalOpen(false)}
              >
                취소
              </Button>
              <Button variant="primary" onClick={handleAddressChange}>
                변경 적용
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            <div className="p-4 bg-info-50 border border-info-200 rounded-lg">
              <p className="text-sm text-info-700">
                배송지 변경은 미발송분부터 적용됩니다.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="수령인"
                value={newAddress.address_name}
                onChange={(e) =>
                  setNewAddress({ ...newAddress, address_name: e.target.value })
                }
                required
              />
              <Input
                label="연락처"
                value={newAddress.phone}
                onChange={(e) =>
                  setNewAddress({ ...newAddress, phone: e.target.value })
                }
                required
              />
              <div>
                <label className="block text-sm font-medium text-muted mb-2 uppercase tracking-wider text-xs">
                  우편번호 <span className="text-red-500 ml-1">*</span>
                </label>
                <div className="flex gap-2">
                  <Input
                    value={newAddress.postal_code}
                    onChange={(e) =>
                      setNewAddress({ ...newAddress, postal_code: e.target.value })
                    }
                    readOnly
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handlePostcodeSearch}
                  >
                    우편번호 검색
                  </Button>
                </div>
              </div>
              <Input
                label="주소"
                value={newAddress.address1}
                onChange={(e) =>
                  setNewAddress({ ...newAddress, address1: e.target.value })
                }
                readOnly
                required
              />
              <Input
                label="상세주소"
                value={newAddress.address2}
                onChange={(e) =>
                  setNewAddress({ ...newAddress, address2: e.target.value })
                }
              />
              <div className="col-span-2">
                <Textarea
                  label="배송 메모"
                  value={newAddress.address_memo}
                  onChange={(e) =>
                    setNewAddress({ ...newAddress, address_memo: e.target.value })
                  }
                  rows={2}
                />
              </div>
            </div>
          </div>
        </Modal>

        {/* 기간 단축/환불 모달 */}
        <Modal
          isOpen={isShortenModalOpen}
          onClose={() => setIsShortenModalOpen(false)}
          title="구독 기간 단축 및 환불"
          size="md"
          footer={
            <>
              <Button
                variant="ghost"
                onClick={() => setIsShortenModalOpen(false)}
              >
                취소
              </Button>
              <Button
                variant="danger"
                onClick={handleShorten}
                disabled={!refundConfirmed || !shortenEndIssue}
              >
                환불 완료 확인
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            <Select
              label="단축 종료 호"
              value={shortenEndIssue}
              onChange={(e) => calculateRefund(e.target.value)}
              options={issueList
                .filter(
                  (issue) =>
                    issue !== subscription.subscribe_start_issue &&
                    issue < (subscription.final_subscribe_end_issue || subscription.subscribe_end_issue || "")
                )
                .map((issue) => ({
                  value: issue,
                  label: `${issue}호`,
                }))}
              placeholder="종료 호 선택"
              required
            />

            {shortenEndIssue && refundAmount > 0 && (
              <>
                <div className="p-4 bg-warning-50 border border-warning-200 rounded-lg">
                  <p className="text-sm font-medium text-warning-800">
                    환불 예정 금액
                  </p>
                  <p className="text-2xl font-bold text-warning-700 mt-1">
                    ₩{refundAmount.toLocaleString()}
                  </p>
                  <p className="text-xs text-warning-600 mt-1">
                    * 실제 환불액은 결제 방식에 따라 다를 수 있습니다.
                  </p>
                </div>

                <div className="p-4 bg-neutral-50 border border-line rounded-lg">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={useMessageTemplate}
                      onChange={(e) => setUseMessageTemplate(e.target.checked)}
                      className="w-5 h-5 rounded border-line text-accent focus:ring-accent"
                    />
                    <span className="text-sm font-medium text-ink">
                      문자 템플릿 사용
                    </span>
                  </label>
                  {useMessageTemplate && (
                    <div className="mt-3">
                      <Select
                        label="템플릿 선택"
                        value={selectedTemplate}
                        onChange={(e) => setSelectedTemplate(e.target.value)}
                        options={[
                          { value: "refund1", label: "환불 안내 템플릿 1" },
                          { value: "refund2", label: "환불 안내 템플릿 2" },
                        ]}
                        placeholder="템플릿을 선택하세요"
                      />
                    </div>
                  )}
                </div>

                <div className="p-4 bg-danger-50 border border-danger-200 rounded-lg">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={refundConfirmed}
                      onChange={(e) => setRefundConfirmed(e.target.checked)}
                      className="w-5 h-5 rounded border-danger-300 text-danger-600 focus:ring-danger-500"
                    />
                    <span className="text-sm font-medium text-danger-800">
                      고객에게 환불을 완료했습니까?
                    </span>
                  </label>
                  <p className="text-xs text-danger-600 mt-2 ml-8">
                    환불 완료 확인 후에만 구독 기간이 단축됩니다.
                  </p>
                </div>
              </>
            )}
          </div>
        </Modal>
      </div>
    </div>
  );
};

export default SubscriptionDetailPage;
