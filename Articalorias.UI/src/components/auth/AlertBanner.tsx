import type { ReactNode } from "react";

interface AlertBannerProps {
  variant?: "error" | "warning" | "success";
  children: ReactNode;
}

const variantStyles = {
  error: "bg-red-50 border-red-200 text-red-700",
  warning: "bg-amber-50 border-amber-200 text-amber-800",
  success: "bg-green-50 border-green-200 text-green-700",
};

export default function AlertBanner({ variant = "error", children }: AlertBannerProps) {
  return (
    <div className={`rounded-md border px-4 py-3 text-sm ${variantStyles[variant]}`} role="alert">
      {children}
    </div>
  );
}
