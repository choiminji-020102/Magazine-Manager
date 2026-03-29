import type { ToastVariant } from "@/components/ui/toast";
import { dispatchToast } from "@/components/ui/toaster";

export interface ToastItem {
  id: string;
  title?: string;
  description?: string;
  variant?: ToastVariant;
}

interface ToastOptions {
  title?: string;
  description?: string;
  variant?: ToastVariant;
  duration?: number;
}

export function toast(options: ToastOptions) {
  const id = Math.random().toString(36).slice(2);
  const duration = options.duration ?? 3500;

  dispatchToast({ id, ...options });

  setTimeout(() => {
    // Toaster에서 자동으로 onOpenChange false로 처리됨
  }, duration);
}

toast.success = (title: string, description?: string) =>
  toast({ title, description, variant: "success" });

toast.error = (title: string, description?: string) =>
  toast({ title, description, variant: "error", duration: 5000 });

toast.warning = (title: string, description?: string) =>
  toast({ title, description, variant: "warning" });

toast.info = (title: string, description?: string) =>
  toast({ title, description, variant: "default" });
