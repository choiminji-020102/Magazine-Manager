interface PageHeaderProps {
  left?: React.ReactNode;
  actions?: React.ReactNode;
}

export function PageHeader({ left, actions }: PageHeaderProps) {
  return (
    <div className="flex items-center justify-between px-5 py-3 bg-white border-b border-gray-200 flex-shrink-0 min-h-[52px]">
      <div className="flex items-center gap-3">{left}</div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
