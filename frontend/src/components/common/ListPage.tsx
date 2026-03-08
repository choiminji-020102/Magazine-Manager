import React, { ReactNode } from "react";
import { LucideIcon } from "lucide-react";
import Card from "./Card";
import Table, { Column } from "./Table";
import Pagination from "./Pagination";
import Button from "./Button";
import LoadingSpinner from "./LoadingSpinner";

export interface BatchAction {
  label: string;
  icon?: LucideIcon;
  onClick: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger";
}

interface ListPageProps<T = any> {
  // 데이터
  data: T[];
  columns: Column<T>[];
  keyExtractor: (row: T, index: number) => string | number;
  emptyMessage?: string;

  // 선택 기능
  selectable?: boolean;
  selectedItems?: Set<string | number>;
  onSelectAll?: (checked: boolean) => void;
  onSelectItem?: (id: string | number, checked: boolean) => void;
  allSelected?: boolean;

  // 정렬
  onSort?: (key: string, direction: "asc" | "desc") => void;
  sortKey?: string;
  sortDirection?: "asc" | "desc";

  // 행 클릭
  onRowClick?: (row: T, index: number) => void;
  hoverable?: boolean;
  rowClassName?: (row: T) => string;

  // 페이지네이션
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalItems?: number; // 없으면 data.length 사용
  itemsPerPage: number;

  // 헤더 커스터마이징
  headerText?: string | ReactNode; // "전체 몇건" 또는 "검색 결과 몇건" 등
  headerLeftContent?: ReactNode; // 헤더 왼쪽 커스텀 컨텐츠
  headerRightContent?: ReactNode; // 헤더 오른쪽 커스텀 컨텐츠
  showHeader?: boolean; // 헤더 표시 여부
  customHeader?: ReactNode; // 완전히 커스텀 헤더

  // 일괄 작업
  batchActions?: BatchAction[];
  showBatchActions?: boolean;

  // 상태
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;

  // 커스텀 푸터
  customFooter?: ReactNode;

  // 기타
  className?: string;
}

const ListPage = <T extends Record<string, any>>({
  data,
  columns,
  keyExtractor,
  emptyMessage = "데이터가 없습니다",
  selectable = false,
  selectedItems = new Set(),
  onSelectAll,
  onSelectItem,
  allSelected = false,
  onSort,
  sortKey,
  sortDirection,
  onRowClick,
  hoverable = true,
  rowClassName,
  currentPage,
  totalPages,
  onPageChange,
  totalItems,
  itemsPerPage,
  headerText,
  headerLeftContent,
  headerRightContent,
  showHeader = true,
  customHeader,
  batchActions = [],
  showBatchActions = true,
  loading = false,
  error = null,
  onRetry,
  customFooter,
  className = "",
}: ListPageProps<T>) => {
  // 일괄 작업 바
  const renderBatchActions = () => {
    if (!showBatchActions || !selectedItems || selectedItems.size === 0) return null;

    return (
      <Card className="unified-card mb-6 p-4 bg-neutral-50 border-neutral-200">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-ink">
            {selectedItems.size}개 선택됨
          </span>
          <div className="flex items-center gap-2">
            {batchActions.map((action, index) => (
              <Button
                key={index}
                variant={action.variant === "default" ? "primary" : (action.variant || "outline")}
                size="sm"
                icon={action.icon}
                onClick={action.onClick}
                disabled={action.disabled || selectedItems.size === 0}
              >
                {action.label}
              </Button>
            ))}
            {selectedItems.size > 0 && onSelectAll && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onSelectAll(false)}
              >
                선택 해제
              </Button>
            )}
          </div>
        </div>
      </Card>
    );
  };

  // 테이블 헤더
  const renderTableHeader = () => {
    if (!showHeader) return null;
    if (customHeader) return customHeader;

    const displayTotalItems = totalItems ?? data.length;
    const startIndex = (currentPage - 1) * itemsPerPage + 1;
    const endIndex = Math.min(currentPage * itemsPerPage, displayTotalItems);

    // 기본 헤더 텍스트
    const defaultHeaderText = headerText ?? `전체 ${displayTotalItems}건`;

    return (
      <div className="px-4 py-3 border-b border-line flex items-center justify-between">
        <div className="flex items-center gap-2">
          {headerLeftContent || (
            <span className="text-sm text-muted">
              {typeof defaultHeaderText === "string" ? (
                defaultHeaderText
              ) : (
                defaultHeaderText
              )}
            </span>
          )}
        </div>
        {headerRightContent || (
          <span className="text-sm text-muted">
            {displayTotalItems > 0 ? (
              <>
                {startIndex} - {endIndex} / {displayTotalItems}
              </>
            ) : (
              <>0 / 0</>
            )}
          </span>
        )}
      </div>
    );
  };

  // 로딩 상태
  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <LoadingSpinner />
      </div>
    );
  }

  // 에러 상태
  if (error) {
    return (
      <Card className="unified-card">
        <div className="p-8 text-center">
          <p className="text-danger-600 mb-4">{error}</p>
          {onRetry && <Button onClick={onRetry}>다시 시도</Button>}
        </div>
      </Card>
    );
  }

  return (
    <div className={className}>
      {/* 일괄 작업 바 */}
      {renderBatchActions()}

      {/* 테이블 */}
      <Card className="unified-card">
        {renderTableHeader()}

        <Table
          columns={columns}
          data={data}
          keyExtractor={keyExtractor}
          onSort={onSort}
          sortKey={sortKey}
          sortDirection={sortDirection}
          emptyMessage={emptyMessage}
          hoverable={hoverable}
          onRowClick={onRowClick}
          selectable={selectable}
          selectedRows={Array.from(selectedItems)}
          onSelectRow={onSelectItem}
          onSelectAll={
            onSelectAll
              ? () => {
                  // Table의 allSelected 상태를 기반으로 토글
                  const isAllSelected =
                    data.length > 0 &&
                    selectedItems.size === data.length;
                  onSelectAll(!isAllSelected);
                }
              : undefined
          }
          allSelected={allSelected}
          rowClassName={rowClassName}
        />

        {/* 페이지네이션 */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-line">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={onPageChange}
            />
          </div>
        )}

        {/* 커스텀 푸터 */}
        {customFooter}
      </Card>
    </div>
  );
};

export default ListPage;
