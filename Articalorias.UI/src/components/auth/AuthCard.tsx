import type { ReactNode } from "react";

interface AuthCardProps {
  title: string;
  subtitle?: string;
  alerts?: ReactNode;
  children: ReactNode;
}

export default function AuthCard({ title, subtitle, alerts, children }: AuthCardProps) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
        {subtitle && <p className="mt-1 text-sm text-gray-500">{subtitle}</p>}
      </div>
      <div aria-live="polite" className="space-y-3">{alerts}</div>
      {children}
    </div>
  );
}
