import { useTranslation } from 'react-i18next';

interface StreakBadgeProps {
  streakCount: number;
}

/**
 * Compact inline badge for the Today card header.
 * Colors come from --color-streak-* tokens in index.css so the
 * palette can be re-themed globally without touching this file.
 */
export default function StreakBadge({ streakCount }: StreakBadgeProps) {
  const { t } = useTranslation();

  if (streakCount <= 0) return null;

  return (
    <div
      className="inline-flex shrink-0 items-center gap-1 rounded-full border border-streak-border bg-streak-bg px-2.5 py-1"
      aria-label={`${streakCount} day logging streak`}
      role="status"
    >
      <span aria-hidden="true" className="text-[13px] leading-none">🔥</span>
      <span className="text-[12px] font-semibold leading-tight text-streak-text">
        {t('streak.badge', { count: streakCount })}
      </span>
    </div>
  );
}
