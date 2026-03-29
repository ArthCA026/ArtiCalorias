import type { ReactNode } from "react";

interface SuccessCardProps {
  icon: ReactNode;
  iconBg?: string;
  title: string;
  description: string;
  children?: ReactNode;
  footer?: ReactNode;
}

export default function SuccessCard({ icon, iconBg = "bg-green-100", title, description, children, footer }: SuccessCardProps) {
  return (
    <div className="space-y-5" role="status">
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm space-y-4 text-center">
        <div className={`mx-auto flex h-12 w-12 items-center justify-center rounded-full ${iconBg}`}>
          {icon}
        </div>
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
        <p className="text-sm text-gray-600">{description}</p>
        {children}
      </div>
      {footer}
    </div>
  );
}
