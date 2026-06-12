import { useTranslation } from "react-i18next";

interface LoadingSpinnerProps {
  message?: string;
}

export default function LoadingSpinner({ message }: LoadingSpinnerProps) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center justify-center py-6 sm:py-10 gap-3">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 dark:border-gray-700 border-t-indigo-600" />
      <p className="text-sm text-gray-500 dark:text-gray-400">{message ?? t('common.loading')}</p>
    </div>
  );
}
