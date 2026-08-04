import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Sheet } from '@/components/ui/Sheet';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { addDays, mondayOf, parseDate, toDateString } from '@/utils/format';
import { cn } from '@/utils/cn';

interface WeekPickerSheetProps {
  open: boolean;
  onClose: () => void;
  /** Monday of the week currently shown on Progress */
  selected: string;
  onPick: (monday: string) => void;
}

const PAGE = 12;

/** Weeks between two Mondays, positive when b is older than a. */
function weeksBetween(a: string, b: string): number {
  return Math.round((parseDate(a).getTime() - parseDate(b).getTime()) / (7 * 86400000));
}

/**
 * Fast week jumper for Progress: one tap on the pager label instead of
 * hammering the back arrow. Recent weeks first, older ones a tap away.
 */
export function WeekPickerSheet({ open, onClose, selected, onPick }: WeekPickerSheetProps) {
  const { t, i18n } = useTranslation();
  const currentMonday = mondayOf(toDateString());
  const [extraPages, setExtraPages] = useState(0);

  // Always list at least up to the selected week, so the current choice is
  // visible and checked even when it is months back.
  const count = Math.max(PAGE, weeksBetween(currentMonday, selected) + 3) + extraPages;

  const thisYear = parseDate(currentMonday).getFullYear();

  const rows = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const monday = addDays(currentMonday, -7 * i);
        const sunday = addDays(monday, 6);
        const withYear =
          parseDate(monday).getFullYear() !== thisYear ||
          parseDate(sunday).getFullYear() !== thisYear;
        const f = new Intl.DateTimeFormat(i18n.language, {
          day: 'numeric',
          month: 'short',
          ...(withYear ? { year: 'numeric' as const } : {}),
        });
        const range = `${f.format(parseDate(monday))} - ${f.format(parseDate(sunday))}`;
        const title =
          i === 0
            ? t('progress.this_week', 'This week')
            : i === 1
              ? t('progress.last_week', 'Last week')
              : range;
        return { monday, title, sub: i <= 1 ? range : undefined };
      }),
    [count, currentMonday, thisYear, i18n.language, t],
  );

  return (
    <Sheet open={open} onClose={onClose} title={t('progress.week_picker_title', 'Jump to a week')}>
      <div className="space-y-2">
        {rows.map((row) => {
          const active = row.monday === selected;
          return (
            <button
              key={row.monday}
              type="button"
              onClick={() => {
                onPick(row.monday);
                onClose();
              }}
              className={cn(
                'pressable w-full rounded-card px-4 py-3 text-left flex items-center gap-3',
                active ? 'bg-primary-soft ring-2 ring-primary/60' : 'bg-inset',
              )}
            >
              <span className="flex-1">
                <span className="block text-[15px] font-bold text-ink">{row.title}</span>
                {row.sub && (
                  <span className="block text-[12px] text-ink-2 mt-0.5">{row.sub}</span>
                )}
              </span>
              {active && <Icon name="checkCircle" size={20} className="text-primary shrink-0" />}
            </button>
          );
        })}
        <Button variant="ghost" size="md" fullWidth onClick={() => setExtraPages((e) => e + PAGE)}>
          {t('progress.week_picker_older', 'Show older weeks')}
        </Button>
      </div>
    </Sheet>
  );
}
