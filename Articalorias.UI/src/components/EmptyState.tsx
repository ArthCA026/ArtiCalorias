import { useTranslation } from "react-i18next";

export default function EmptyState({ message }: { message?: string }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center justify-center py-6 sm:py-10 text-center">
      <p className="text-sm text-gray-400 dark:text-gray-500">{message ?? t('common.empty')}</p>
    </div>
  );
}
