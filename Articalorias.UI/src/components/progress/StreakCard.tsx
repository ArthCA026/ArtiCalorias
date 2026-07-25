import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { useGetStreak } from '@/hooks/useStreak';

/** Current logging streak at a glance. Hidden when the user disabled streaks. */
export function StreakCard() {
  const { t } = useTranslation();
  const { data: streak } = useGetStreak();

  if (!streak || !streak.streakEnabled) return null;

  const n = streak.currentStreak;
  const longest = Math.max(streak.longestStreak, n);

  return (
    <Card className="flex items-center gap-3.5">
      <span className="w-11 h-11 rounded-2xl bg-streak-soft text-streak flex items-center justify-center shrink-0">
        <Icon name="flame" size={22} />
      </span>
      <div className="flex-1">
        <p className="text-2xl font-extrabold text-ink tabular-nums leading-none">{n}</p>
        <p className="mt-1 text-[13px] text-ink-2">
          {n === 1
            ? t('progress.streak_day', 'day logging streak')
            : t('progress.streak_days', 'days logging streak')}
        </p>
      </div>
      <p className="text-[13px] font-semibold text-ink-2 tabular-nums">
        {t('progress.streak_longest', 'Longest: {{n}}', { n: longest })}
      </p>
    </Card>
  );
}
