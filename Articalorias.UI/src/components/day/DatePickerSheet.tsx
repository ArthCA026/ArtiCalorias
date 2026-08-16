import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Sheet } from '@/components/ui/Sheet';
import { IconButton } from '@/components/ui/Button';
import { historyService } from '@/services/historyService';
import { queryKeys } from '@/lib/queryKeys';
import { isLoggedDay } from '@/components/progress/weekMath';
import { addDays, parseDate, toDateString } from '@/utils/format';
import { cn } from '@/utils/cn';

interface DatePickerSheetProps {
  open: boolean;
  onClose: () => void;
  /** Highlighted date (the one currently shown), yyyy-MM-dd */
  selected?: string;
  /** Latest pickable date, yyyy-MM-dd; days after it are disabled */
  maxDate: string;
  onPick: (date: string) => void;
  title?: string;
}

const monthStartOf = (dateStr: string): string => `${dateStr.slice(0, 7)}-01`;

function addMonths(monthStart: string, months: number): string {
  const d = parseDate(monthStart);
  d.setMonth(d.getMonth() + months);
  return toDateString(d);
}

/**
 * A month calendar for jumping to any day. Dots mark days with something
 * logged, so the answer to "can I even open an old day?" is visible before
 * the first tap: every non-future day is a button.
 */
export function DatePickerSheet({ open, onClose, selected, maxDate, onPick, title }: DatePickerSheetProps) {
  const { t, i18n } = useTranslation();
  const today = toDateString();
  const [monthStart, setMonthStart] = useState(() => monthStartOf(selected ?? today));

  // Month grid: leading blanks to align the 1st under its weekday (Mon first).
  const days = useMemo(() => {
    const first = parseDate(monthStart);
    const blanks = (first.getDay() + 6) % 7;
    const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
    return {
      blanks,
      dates: Array.from({ length: daysInMonth }, (_, i) => addDays(monthStart, i)),
    };
  }, [monthStart]);

  const monthEnd = days.dates[days.dates.length - 1];
  const { data: logs } = useQuery({
    queryKey: queryKeys.history(monthStart, monthEnd),
    queryFn: () => historyService.getDailyRange(monthStart, monthEnd).then((r) => r.data),
    staleTime: 5 * 60 * 1000,
    enabled: open,
  });

  const loggedSet = useMemo(
    () => new Set((logs ?? []).filter(isLoggedDay).map((d) => d.logDate)),
    [logs],
  );

  const monthLabel = useMemo(
    () =>
      new Intl.DateTimeFormat(i18n.language, { month: 'long', year: 'numeric' }).format(
        parseDate(monthStart),
      ),
    [monthStart, i18n.language],
  );

  const weekdayLetters = useMemo(() => {
    const fmt = new Intl.DateTimeFormat(i18n.language, { weekday: 'narrow' });
    // 2024-01-01 is a Monday; any known Monday anchors the row.
    return Array.from({ length: 7 }, (_, i) => fmt.format(parseDate(addDays('2024-01-01', i))));
  }, [i18n.language]);

  const nextDisabled = monthStart >= monthStartOf(maxDate);

  return (
    <Sheet open={open} onClose={onClose} title={title ?? t('day.picker_title', 'Go to a day')}>
      <div className="flex items-center justify-between mb-2">
        <IconButton
          icon="chevronLeft"
          label={t('day.picker_prev_month', 'Previous month')}
          onClick={() => setMonthStart(addMonths(monthStart, -1))}
        />
        <p className="text-[15px] font-bold text-ink capitalize">{monthLabel}</p>
        <IconButton
          icon="chevronRight"
          label={t('day.picker_next_month', 'Next month')}
          disabled={nextDisabled}
          className="disabled:opacity-35 disabled:pointer-events-none"
          onClick={() => setMonthStart(addMonths(monthStart, 1))}
        />
      </div>

      <div className="grid grid-cols-7 mb-1" aria-hidden="true">
        {weekdayLetters.map((l, i) => (
          <span key={i} className="h-8 flex items-center justify-center text-[11px] font-semibold text-ink-3">
            {l}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-y-1">
        {Array.from({ length: days.blanks }, (_, i) => (
          <span key={`b-${i}`} aria-hidden="true" />
        ))}
        {days.dates.map((date) => {
          const disabled = date > maxDate;
          const isSelected = date === selected;
          const isToday = date === today;
          const logged = loggedSet.has(date);
          return (
            <button
              key={date}
              type="button"
              disabled={disabled}
              onClick={() => {
                onPick(date);
                onClose();
              }}
              aria-label={
                logged
                  ? t('day.picker_day_logged_aria', '{{date}}, has logged data', { date })
                  : date
              }
              className={cn(
                'pressable relative mx-auto flex h-11 w-11 flex-col items-center justify-center rounded-full',
                isSelected
                  ? 'bg-primary text-on-primary font-bold'
                  : isToday
                    ? 'ring-2 ring-primary/60 text-ink font-bold'
                    : 'text-ink',
                disabled && 'opacity-30 pointer-events-none',
              )}
            >
              <span className="text-[14px] tabular-nums leading-none">{Number(date.slice(8, 10))}</span>
              {logged && (
                <span
                  aria-hidden="true"
                  className={cn(
                    'absolute bottom-1.5 h-1 w-1 rounded-full',
                    isSelected ? 'bg-on-primary' : 'bg-primary',
                  )}
                />
              )}
            </button>
          );
        })}
      </div>

      <p className="mt-3 text-[12px] text-ink-3 leading-relaxed">
        {t('day.picker_hint', 'A dot means something was logged. Open any past day to review it, or a blank one to add it.')}
      </p>
    </Sheet>
  );
}
