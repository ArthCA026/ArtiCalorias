import { useTranslation } from 'react-i18next';
import { useGetStreak } from '@/hooks/useStreak';

export default function StreakDetail() {
  const { t } = useTranslation();
  const { data: streak } = useGetStreak();

  if (!streak?.streakEnabled) return null;

  return (
    <div className="rounded-xl border border-orange-100 dark:border-orange-900/40 bg-orange-50 dark:bg-orange-950/30 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <span aria-hidden="true" className="text-xl leading-none">🔥</span>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          {t('streak.detail_title')}
        </h3>
      </div>

      {streak.currentStreak === 0 && streak.longestStreak === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {t('streak.detail_empty')}
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg bg-white dark:bg-gray-900 p-3 text-center shadow-sm">
            <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">
              {streak.currentStreak}
            </p>
            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
              {t('streak.detail_current')}
            </p>
          </div>
          <div className="rounded-lg bg-white dark:bg-gray-900 p-3 text-center shadow-sm">
            <p className="text-2xl font-bold text-gray-700 dark:text-gray-300">
              {streak.longestStreak}
            </p>
            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
              {t('streak.detail_longest')}
            </p>
          </div>
        </div>
      )}

      <p className="text-xs text-gray-400 dark:text-gray-500">
        {t('streak.detail_note')}
      </p>
    </div>
  );
}
