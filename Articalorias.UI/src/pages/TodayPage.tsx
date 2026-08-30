import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { DayView } from '@/components/day/DayView';
import { DatePickerSheet } from '@/components/day/DatePickerSheet';
import { StreakChip } from '@/components/today/StreakChip';
import { StreakCelebration } from '@/components/today/StreakCelebration';
import { AppTour } from '@/components/today/AppTour';
import { Icon } from '@/components/ui/Icon';
import { ConfirmSheet } from '@/components/ui/ActionSheet';
import { useGetStreak } from '@/hooks/useStreak';
import { dailyLogService } from '@/services/dailyLogService';
import { profileService } from '@/services/profileService';
import { measurementService } from '@/services/measurementService';
import { queryKeys } from '@/lib/queryKeys';
import { toDateString, parseDate, mondayOf } from '@/utils/format';
import type { UserProfileResponse } from '@/types';

/** One celebration per calendar day, surviving reloads and remounts. */
const CELEBRATED_KEY = 'ac-streak-celebrated';
/** Local guard so the tour never re-flashes while the profile refetches. */
const TUTORIAL_KEY = 'ac-tutorial-done';
/** Week (Monday date) the body check-in was last offered: once a week, max. */
const BODY_NUDGE_KEY = 'ac-body-nudge-week';
/** Days without a measurement before the weekly check-in starts asking. */
const BODY_STALE_DAYS = 7;

export default function TodayPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const today = toDateString();
  const [pickerOpen, setPickerOpen] = useState(false);

  // Same key as DayView's query: shared cache entry, no extra request
  const { data: dash } = useQuery({
    queryKey: queryKeys.dashboard(today),
    queryFn: () => dailyLogService.getDashboard(today).then((r) => r.data),
    staleTime: 5 * 60 * 1000,
  });

  // A marked fasting day counts as logged: streak safe, celebration eligible.
  const hasLoggedToday = (dash?.foodEntries.length ?? 0) > 0 || (dash?.isFastingDay ?? false);

  // ── Streak celebration ────────────────────────────────────────────────────
  // The rule is state-based, not event-based: celebrate the moment TODAY is
  // part of the streak (streak.lastLoggedDate === today), once per local day.
  // For manual loggers that happens right after their first log; for auto-add
  // users it happens on their first open of the day, because the server now
  // counts auto-added meals into the streak. The old "counter went up while I
  // was watching" trigger silently skipped exactly that second group.
  const { data: streak } = useGetStreak();
  const [celebrating, setCelebrating] = useState<number | null>(null);

  // First open of a day with auto-added meals: the dashboard request extends
  // the streak server-side, but the parallel streak request may have raced it
  // and cached yesterday's state for 5 minutes. When the day visibly has food
  // and the cached streak does not include today, refetch it once.
  const streakRefreshedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!hasLoggedToday || !streak?.streakEnabled) return;
    if (streak.lastLoggedDate === today) return;
    if (streakRefreshedFor.current === today) return; // once per day per mount
    streakRefreshedFor.current = today;
    queryClient.invalidateQueries({ queryKey: queryKeys.streak() });
  }, [hasLoggedToday, streak?.streakEnabled, streak?.lastLoggedDate, today, queryClient]);

  useEffect(() => {
    if (!streak?.streakEnabled) return;
    if (streak.currentStreak <= 0) return;
    if (streak.lastLoggedDate !== today) return; // today not in the streak yet
    if (!hasLoggedToday) return; // dashboard still catching up; wait for it
    if (localStorage.getItem(CELEBRATED_KEY) === today) return;
    localStorage.setItem(CELEBRATED_KEY, today);
    // Reacting to async queries settling is what this effect exists for; it
    // fires at most once per calendar day, so the extra render is bounded.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCelebrating(streak.currentStreak);
  }, [streak?.streakEnabled, streak?.currentStreak, streak?.lastLoggedDate, hasLoggedToday, today]);

  // ── First-run tour ────────────────────────────────────────────────────────
  // Only for a brand-new account: onboarded, never logged anything, tutorial
  // never seen (server flag, mirrored locally to avoid refetch flicker).
  const { data: profile } = useQuery({
    queryKey: queryKeys.profile(),
    queryFn: () => profileService.get().then((r) => r.data),
    staleTime: 10 * 60 * 1000,
  });

  const tourEligible =
    !!profile &&
    !!dash &&
    profile.isOnboardingCompleted &&
    !profile.hasSeenTutorial &&
    !profile.hasEverLoggedFood &&
    localStorage.getItem(TUTORIAL_KEY) === null &&
    celebrating === null;

  // ── Weekly body check-in ──────────────────────────────────────────────────
  // Fresh body data keeps every budget honest, so once a week (never more:
  // the guard stores the week it last asked) the app offers a weigh-in when
  // the newest measurement is a week old or more. It stays quiet whenever the
  // streak celebration is on screen or about to be (auto-add users see that
  // on their first open of the day) and during the first-run tour.
  const { data: measurements } = useQuery({
    queryKey: queryKeys.measurements(),
    queryFn: () => measurementService.getAll().then((r) => r.data),
    staleTime: 5 * 60 * 1000,
  });
  const [bodyNudge, setBodyNudge] = useState<number | null>(null); // days stale

  useEffect(() => {
    if (bodyNudge !== null) return;
    if (!measurements || measurements.length === 0) return; // no body data at all: the locked hero already asks
    if (localStorage.getItem(BODY_NUDGE_KEY) === mondayOf(today)) return; // asked this week
    const newest = measurements[measurements.length - 1].measuredOn;
    const staleDays = Math.round(
      (parseDate(today).getTime() - parseDate(newest).getTime()) / 86400000,
    );
    if (staleDays < BODY_STALE_DAYS) return;
    if (celebrating !== null || tourEligible) return;
    const celebrationImminent =
      !!streak?.streakEnabled &&
      streak.lastLoggedDate === today &&
      hasLoggedToday &&
      localStorage.getItem(CELEBRATED_KEY) !== today;
    if (celebrationImminent) return;
    localStorage.setItem(BODY_NUDGE_KEY, mondayOf(today));
    // Reacting to async queries settling; fires at most once per week.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBodyNudge(staleDays);
  }, [bodyNudge, measurements, celebrating, tourEligible, streak?.streakEnabled, streak?.lastLoggedDate, hasLoggedToday, today]);

  const finishTour = useMutation({
    mutationFn: () => profileService.markTutorialSeen(),
  });

  const onTourDone = () => {
    localStorage.setItem(TUTORIAL_KEY, '1');
    queryClient.setQueryData<UserProfileResponse>(queryKeys.profile(), (p) =>
      p ? { ...p, hasSeenTutorial: true } : p,
    );
    finishTour.mutate();
  };

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
          {/* The date is a door, not a label: it opens the calendar to any
              other day, which is where "can I edit yesterday?" gets its
              visible, always-present answer. */}
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            aria-label={t('today.open_calendar_aria', 'Open the calendar to go to another day')}
            className="pressable flex items-center gap-1 text-[13px] text-ink-2 capitalize"
          >
            {dateLabel}
            <Icon name="calendar" size={13} className="text-ink-3" />
          </button>
        </div>
        <StreakChip hasLoggedToday={hasLoggedToday} />
      </header>

      <DayView date={today} isToday />

      <DatePickerSheet
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        selected={today}
        maxDate={today}
        onPick={(date) => {
          if (date !== today) navigate(`/day/${date}`);
        }}
      />

      {celebrating !== null && (
        <StreakCelebration streak={celebrating} onDone={() => setCelebrating(null)} />
      )}

      {tourEligible && <AppTour onDone={onTourDone} />}

      <ConfirmSheet
        open={bodyNudge !== null}
        onClose={() => setBodyNudge(null)}
        title={t('bodynudge.title', 'Weekly check-in: how is your body doing?')}
        body={t('bodynudge.body', 'Your last measurement is {{n}} days old. A fresh weight keeps your budget and projections honest. It takes ten seconds.', { n: bodyNudge ?? 0 })}
        confirmLabel={t('bodynudge.confirm', 'Update it now')}
        cancelLabel={t('bodynudge.later', 'Not this week')}
        onConfirm={() => {
          setBodyNudge(null);
          navigate('/progress/body', { state: { add: true } });
        }}
      />
    </div>
  );
}
