import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { subscriberAPI } from "../api";
import "./SubscriberManagement.css";

function SubscriberManagement() {
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
  });

  const queryClient = useQueryClient();

  const {
    data: subscribersData,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["subscribers"],
    queryFn: () => subscriberAPI.getAll({ skip: 0, limit: 50 }),
    retry: 1,
    retryDelay: 1000,
  });

  const createMutation = useMutation({
    mutationFn: subscriberAPI.register,
    onSuccess: () => {
      queryClient.invalidateQueries(["subscribers"]); //캐시 무효화
      setShowModal(false);
      resetForm();
    },
    onError: (error) => {
      const errorMessage =
        error.response?.data?.detail || "구독자 등록에 실패했습니다";
      alert(errorMessage);
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      email: "",
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  if (isError) {
    console.error("구독자 데이터를 불러오는데 실패했습니다");
  }

  return (
    <div className="subscriber-management">
      <div className="page-header">
        <h2>구독자 관리</h2>
        <button
          onClick={() => {
            resetForm();
            setShowModal(true);
          }}
          className="btn-primary"
        >
          + 구독자 추가
        </button>
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>이름</th>
              <th>이메일</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td
                  colSpan={3}
                  style={{ textAlign: "center", padding: "20px" }}
                >
                  로딩 중...
                </td>
              </tr>
            )}
            {!isLoading &&
              (!subscribersData || subscribersData.length === 0) && (
                <tr>
                  <td
                    colSpan={3}
                    style={{ textAlign: "center", padding: "20px" }}
                  >
                    {isError
                      ? "데이터를 불러오는데 실패했습니다"
                      : "구독자가 없습니다"}
                  </td>
                </tr>
              )}
            {subscribersData?.map((subscriber) => (
              <tr key={subscriber.id}>
                <td>{subscriber.id}</td>
                <td>{subscriber.name}</td>
                <td>{subscriber.email}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>구독자 추가</h3>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>이름 *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  required
                />
              </div>
              <div className="form-group">
                <label>이메일 *</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  required
                />
              </div>
              <div className="modal-actions">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="btn-secondary"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={createMutation.isPending}
                >
                  {createMutation.isPending ? "저장 중..." : "저장"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default SubscriberManagement;
