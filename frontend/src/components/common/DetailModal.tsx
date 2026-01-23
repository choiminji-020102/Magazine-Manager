import React, { ReactNode } from "react";
import Modal from "./Modal";
import Tabs from "./Tabs";
import Button from "./Button";
import { Edit, Save } from "lucide-react";

export interface DetailTab {
  key: string;
  label: string;
  content: ReactNode;
}

interface DetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  tabs: DetailTab[];
  activeTab: string;
  onTabChange: (tab: string) => void;
  isEditMode?: boolean;
  onStartEdit?: () => void;
  onCancelEdit?: () => void;
  onSave?: () => void;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
}

const DetailModal: React.FC<DetailModalProps> = ({
  isOpen,
  onClose,
  title,
  tabs,
  activeTab,
  onTabChange,
  isEditMode = false,
  onStartEdit,
  onCancelEdit,
  onSave,
  footer,
  size = "xl",
}) => {
  const defaultFooter =
    activeTab === tabs[0]?.key ? (
      isEditMode ? (
        <>
          <Button variant="ghost" onClick={onCancelEdit}>
            취소
          </Button>
          <Button onClick={onSave} icon={Save}>
            저장
          </Button>
        </>
      ) : (
        <>
          <Button variant="ghost" onClick={onClose}>
            닫기
          </Button>
          {onStartEdit && (
            <Button onClick={onStartEdit} icon={Edit}>
              수정
            </Button>
          )}
        </>
      )
    ) : undefined;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size={size}
      footer={footer !== undefined ? footer : defaultFooter}
    >
      <div>
        <Tabs
          tabs={tabs.map((tab) => ({ key: tab.key, label: tab.label }))}
          activeTab={activeTab}
          onChange={onTabChange}
          className="mb-6"
        />

        {tabs.find((tab) => tab.key === activeTab)?.content}
      </div>
    </Modal>
  );
};

export default DetailModal;
