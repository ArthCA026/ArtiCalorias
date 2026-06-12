import type { ReactNode } from "react";

interface AlertBannerProps {
  variant?: "error" | "warning" | "success";
  children: ReactNode;
}

const variantStyles = {
  error:   "bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-900 text-red-700 dark:text-red-400",
  warning: "bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-400",
  success: "bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-900 text-green-700 dark:text-green-400",
};

export default function AlertBanner({ variant = "error", children }: AlertBannerProps) {
  return (
    <div className={`rounded-md border px-4 py-2 text-sm ${variantStyles[variant]}`} role="alert">
      {children}
    </div>
  );
}
