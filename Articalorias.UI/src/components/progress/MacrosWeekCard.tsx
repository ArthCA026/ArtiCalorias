import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/Card';
import { ProgressBar } from '@/components/ui/Progress';
import { Icon } from '@/components/ui/Icon';
import { isLoggedDay } from '@/components/progress/weekMath';
import { MACRO_META, dayTargetFor, formatMacroAmount, macroLabel, macroTotalFor } from '@/utils/macros';
import { cn } from '@/utils/cn';
import type { DailyLogResponse, MacroKey } from '@/types';

interface MacrosWeekCardProps {
  days: DailyLogResponse[];
}

interface Row {
  key: MacroKey | 'protein';
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

  const rows = useMemo<Row[]>(() => {
    const logged = days.filter(isLoggedDay);
    if (logged.length === 0) return [];

    const out: Row[] = [];

    // Protein first: it always tracks, via its own long-standing goal.
    const proteinDays = logged.filter((d) => d.snapshotProteinGoalGrams > 0);
    if (proteinDays.length > 0) {
      out.push({
        key: 'protein',
        avg: proteinDays.reduce((s, d) => s + d.totalProteinGrams, 0) / proteinDays.length,
        target:
          proteinDays.reduce((s, d) => s + d.snapshotProteinGoalGrams, 0) / proteinDays.length,
        direction: 'hit',
        daysCounted: proteinDays.length,
      });
    }

    for (const key of ['carbs', 'fat', 'sugar', 'alcohol', 'water'] as MacroKey[]) {
      const tracked = logged
        .map((d) => ({ day: d, target: dayTargetFor(d, key) }))
        .filter((x) => x.target !== undefined);
      if (tracked.length === 0) continue;
      const withTargets = tracked.filter((x) => x.target!.target !== null);
      out.push({
        key,
        avg:
          tracked.reduce((s, x) => s + (macroTotalFor(x.day, key) ?? 0), 0) / tracked.length,
        target:
          withTargets.length > 0
            ? withTargets.reduce((s, x) => s + (x.target!.target as number), 0) / withTargets.length
            : null,
        direction: tracked[0].target!.direction,
        daysCounted: tracked.length,
      });
    }

    return out;
  }, [days]);

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
          const meta = r.key === 'protein'
            ? { icon: 'zap' as const, color: 'var(--t-protein)', unit: 'g' as const }
            : MACRO_META[r.key];
          const label = r.key === 'protein' ? t('today.protein', 'Protein') : macroLabel(t, r.key);
          const fmt = (v: number) =>
            r.key === 'protein' ? `${Math.round(v)}g` : formatMacroAmount(r.key, v);
          const limitBroken = r.direction === 'limit' && r.target !== null && r.avg > r.target;
          return (
            <div key={r.key}>
              <div className="flex items-center justify-between mb-1">
                <span className="flex items-center gap-1.5 text-[13px] font-semibold text-ink-2">
                  <Icon name={meta.icon} size={14} style={{ color: meta.color }} />
                  {label}
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
                color={limitBroken ? 'var(--t-warning)' : meta.color}
                label={t('macros.bar_aria', '{{macro}} progress', { macro: label })}
              />
            </div>
          );
        })}
      </div>
    </Card>
  );
}
