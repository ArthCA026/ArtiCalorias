import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Sheet } from '@/components/ui/Sheet';
import { Icon } from '@/components/ui/Icon';
import { useGetStreak } from '@/hooks/useStreak';
import { cn } from '@/utils/cn';

interface StreakChipProps {
  /** Whether at least one meal is logged today (keeps the streak alive) */
  hasLoggedToday: boolean;
}

/**
 * Streak flame in the Today header. Tapping opens the detail sheet.
 * Copy is encouraging, never guilt-based, and leans on loss aversion
 * only when the streak is genuinely at stake.
 */
export function StreakChip({ hasLoggedToday }: StreakChipProps) {
  const { t } = useTranslation();
  const { data: streak } = useGetStreak();
  const [open, setOpen] = useState(false);

  if (!streak || !streak.streakEnabled) return null;

  const n = streak.currentStreak;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t('streak.chip_aria', 'Logging streak: {{n}} days', { n })}
        className={cn(
          'pressable flex items-center gap-1.5 rounded-full px-3.5 h-10',
          n > 0 ? 'bg-streak-soft text-streak' : 'bg-inset text-ink-3',
        )}
      >
        <Icon name="flame" size={18} className={n > 0 && hasLoggedToday ? 'animate-celebrate' : undefined} />
        {n > 0 && <span className="text-[15px] font-extrabold tabular-nums">{n}</span>}
      </button>

      <Sheet open={open} onClose={() => setOpen(false)} title={t('streak.title', 'Logging streak')}>
        <div className="flex flex-col items-center text-center pb-2">
          <span className={cn('mt-2', n > 0 ? 'text-streak' : 'text-ink-3')}>
            <Icon name="flame" size={44} />
          </span>
          <p className="mt-2 text-4xl font-extrabold text-ink tabular-nums">{n}</p>
          <p className="text-[15px] text-ink-2 mt-1">
            {n === 1 ? t('streak.day_one', 'day in a row') : t('streak.days', 'days in a row')}
          </p>

          <p className="mt-4 text-sm text-ink-2 leading-relaxed max-w-[18rem]">
            {n === 0
              ? t('streak.start_hint', 'Log one meal today and your streak begins. Consistency beats perfection.')
              : hasLoggedToday
                ? t('streak.safe_today', 'Today is in the books. Come back tomorrow to keep it going.')
                : t('streak.at_stake', 'Log something today to keep your {{n}} day streak alive.', { n })}
          </p>

          <div className="mt-5 w-full rounded-card bg-inset px-4 py-3 flex items-center justify-between">
            <span className="text-[13px] font-semibold text-ink-2">
              {t('streak.longest', 'Longest streak')}
            </span>
            <span className="text-[15px] font-extrabold text-ink tabular-nums">
              {Math.max(streak.longestStreak, n)}
            </span>
          </div>
        </div>
      </Sheet>
    </>
  );
}
