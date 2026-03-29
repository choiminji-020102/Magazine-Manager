import { useEffect, useState } from "react";
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast";
import { type ToastItem } from "@/hooks/use-toast";

// 전역 상태 구독
let listeners: Array<(toasts: ToastItem[]) => void> = [];
let globalToasts: ToastItem[] = [];

export function dispatchToast(toast: ToastItem) {
  globalToasts = [...globalToasts, toast];
  listeners.forEach((l) => l(globalToasts));
}

export function removeToast(id: string) {
  globalToasts = globalToasts.filter((t) => t.id !== id);
  listeners.forEach((l) => l(globalToasts));
}

export function Toaster() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    const listener = (items: ToastItem[]) => setToasts([...items]);
    listeners.push(listener);
    return () => {
      listeners = listeners.filter((l) => l !== listener);
    };
  }, []);

  return (
    <ToastProvider>
      {toasts.map(({ id, title, description, variant }) => (
        <Toast
          key={id}
          variant={variant}
          onOpenChange={(open) => {
            if (!open) removeToast(id);
          }}
          defaultOpen
        >
          <div className="grid gap-1">
            {title && <ToastTitle>{title}</ToastTitle>}
            {description && <ToastDescription>{description}</ToastDescription>}
          </div>
          <ToastClose />
        </Toast>
      ))}
      <ToastViewport />
    </ToastProvider>
  );
}
