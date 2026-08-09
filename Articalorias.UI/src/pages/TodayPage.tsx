import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { DayView } from '@/components/day/DayView';
import { StreakChip } from '@/components/today/StreakChip';
import { StreakCelebration } from '@/components/today/StreakCelebration';
import { useGetStreak } from '@/hooks/useStreak';
import { dailyLogService } from '@/services/dailyLogService';
import { queryKeys } from '@/lib/queryKeys';
import { toDateString, parseDate } from '@/utils/format';

/** One celebration per calendar day, surviving reloads and remounts. */
const CELEBRATED_KEY = 'ac-streak-celebrated';

export default function TodayPage() {
  const { t, i18n } = useTranslation();
  const today = toDateString();

  // Same key as DayView's query: shared cache entry, no extra request
  const { data: dash } = useQuery({
    queryKey: queryKeys.dashboard(today),
    queryFn: () => dailyLogService.getDashboard(today).then((r) => r.data),
    staleTime: 5 * 60 * 1000,
  });

  const hasLoggedToday = (dash?.foodEntries.length ?? 0) > 0;

  // ── Streak celebration (first food of the day bumps the counter) ──────────
  // The streak query refetches after every log mutation; when its value rises
  // while today has food on it, that rise IS the "first log of the day" moment.
  // prevStreak only advances once food is visible, so the celebration is never
  // lost to the race between the streak refetch and the dashboard refetch.
  const { data: streak } = useGetStreak();
  const [celebrating, setCelebrating] = useState<number | null>(null);
  const prevStreak = useRef<number | null>(null);

  useEffect(() => {
    if (!streak?.streakEnabled) return;
    const n = streak.currentStreak;
    const prev = prevStreak.current;

    if (prev === null) {
      // First settled value of this visit: a baseline, never a celebration.
      prevStreak.current = n;
      return;
    }
    if (n > prev) {
      if (!hasLoggedToday) return; // dashboard still catching up; keep waiting
      prevStreak.current = n;
      if (localStorage.getItem(CELEBRATED_KEY) !== today) {
        localStorage.setItem(CELEBRATED_KEY, today);
        // Reacting to an external async source (the streak query settling after
        // a log) is exactly what this effect exists for; it fires at most once
        // per calendar day, so the extra render is intentional and bounded.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setCelebrating(n);
      }
      return;
    }
    prevStreak.current = n;
  }, [streak?.streakEnabled, streak?.currentStreak, hasLoggedToday, today, streak]);

  const dateLabel = useMemo(
    () =>
      new Intl.DateTimeFormat(i18n.language, {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      }).format(parseDate(today)),
    [i18n.language, today],
  );

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-extrabold text-ink leading-tight">
            {t('today.title', 'Today')}
          </h1>
          <p className="text-[13px] text-ink-2 capitalize">{dateLabel}</p>
        </div>
        <StreakChip hasLoggedToday={hasLoggedToday} />
      </header>

      <DayView date={today} isToday />

      {celebrating !== null && (
        <StreakCelebration streak={celebrating} onDone={() => setCelebrating(null)} />
      )}
    </div>
  );
}
