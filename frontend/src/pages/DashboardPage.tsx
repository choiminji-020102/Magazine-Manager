import React from "react";
import Card from "../components/common/Card";
import Breadcrumb from "../components/common/Breadcrumb";

const DashboardPage: React.FC = () => {
  return (
    <div className="min-h-screen">
      <div className="max-w-[1600px] mx-auto px-6 py-6">
        <Breadcrumb items={[{ label: "대시보드" }]} />
        
        <div className="flex items-center justify-center min-h-[60vh]">
          <Card className="unified-card p-12 text-center">
            <h2 className="text-2xl font-semibold text-ink mb-2">
              대시보드 준비중
            </h2>
            <p className="text-muted">
              대시보드 페이지를 준비하고 있습니다.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
