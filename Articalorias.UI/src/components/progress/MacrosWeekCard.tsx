import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/Card';
import { ProgressBar } from '@/components/ui/Progress';
import { Icon, iconOrFallback } from '@/components/ui/Icon';
import { isLoggedDay } from '@/components/progress/weekMath';
import { useMacros } from '@/hooks/useMacros';
import {
  dayTargetFor,
  formatMacroAmount,
  macroColor,
  macroTotalFor,
  sortKeysByCatalog,
} from '@/utils/macros';
import { cn } from '@/utils/cn';
import type { DailyLogResponse, DayMacroTarget, MacroKey } from '@/types';

interface MacrosWeekCardProps {
  days: DailyLogResponse[];
}

interface Row {
  key: MacroKey;
  avg: number;
  target: number | null;
  direction: 'hit' | 'limit';
  daysCounted: number;
}

/**
 * Weekly macro averages, each day measured against the targets FROZEN on
 * that day (never today's settings), averaged over the logged days that
 * actually tracked the macro. A macro no day tracked simply is not here:
 * absence of data reads as absence, not as zero.
 */
export function MacrosWeekCard({ days }: MacrosWeekCardProps) {
  const { t } = useTranslation();
  const { get, label } = useMacros();

  const rows = useMemo<Row[]>(() => {
    const logged = days.filter(isLoggedDay);
    if (logged.length === 0) return [];

    // Every macro any logged day froze a target for, in catalog order.
    // Protein is one of them like any other; a retired macro still resolves
    // through get(), so history keeps rendering.
    const keys = sortKeysByCatalog(
      logged.flatMap((d) => d.macroTargets.map((m) => m.macroKey)),
      get,
    );

    const out: Row[] = [];
    for (const key of keys) {
      const tracked = logged
        .map((d) => ({ day: d, target: dayTargetFor(d, key) }))
        .filter((x): x is { day: DailyLogResponse; target: DayMacroTarget } => x.target !== undefined);
      if (tracked.length === 0) continue;
      const targets = tracked.map((x) => x.target.target).filter((v): v is number => v !== null);
      out.push({
        key,
        avg: tracked.reduce((s, x) => s + (macroTotalFor(x.day, key) ?? 0), 0) / tracked.length,
        target: targets.length > 0 ? targets.reduce((s, v) => s + v, 0) / targets.length : null,
        direction: get(key).direction,
        daysCounted: tracked.length,
      });
    }

    return out;
  }, [days, get]);

  // Nothing beyond a zero-protein plan: the card would only say "no data".
  if (rows.length === 0 || (rows.length === 1 && rows[0].key === 'protein')) return null;

  return (
    <Card>
      <p className="text-[13px] font-bold text-ink-2 uppercase tracking-wide">
        {t('progress.macros_title', 'Macros this week')}
      </p>
      <p className="mt-0.5 text-[13px] text-ink-2">
        {t('progress.macros_subtitle', 'Average per logged day, against that day’s own targets')}
      </p>

      <div className="mt-3 space-y-3">
        {rows.map((r) => {
          const def = get(r.key);
          const name = label(def);
          const color = macroColor(r.key);
          const fmt = (v: number) => formatMacroAmount(def, v);
          const limitBroken = r.direction === 'limit' && r.target !== null && r.avg > r.target;
          return (
            <div key={r.key}>
              <div className="flex items-center justify-between mb-1">
                <span className="flex items-center gap-1.5 text-[13px] font-semibold text-ink-2">
                  <Icon name={iconOrFallback(def.icon)} size={14} style={{ color }} />
                  {name}
                </span>
                <span className={cn('text-[13px] font-bold tabular-nums', limitBroken ? 'text-warning' : 'text-ink')}>
                  {fmt(r.avg)}
                  {r.target !== null && (
                    <span className="text-ink-3 font-medium"> / {fmt(r.target)}</span>
                  )}
                </span>
              </div>
              <ProgressBar
                progress={r.target !== null && r.target > 0 ? r.avg / r.target : 0}
                height={6}
                color={limitBroken ? 'var(--t-warning)' : color}
                label={t('macros.bar_aria', '{{macro}} progress', { macro: name })}
              />
            </div>
          );
        })}
      </div>
    </Card>
  );
}
