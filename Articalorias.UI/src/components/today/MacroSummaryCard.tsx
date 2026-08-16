import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/Card';
import { ProgressBar } from '@/components/ui/Progress';
import { Icon } from '@/components/ui/Icon';
import { MACRO_META, formatMacroAmount, macroLabel, macroTotalFor } from '@/utils/macros';
import { cn } from '@/utils/cn';
import type { DailyLogResponse, MacroKey } from '@/types';

interface MacroSummaryCardProps {
  log: DailyLogResponse;
  /** Water is excluded here: it has its own card with quick-add cups */
  className?: string;
}

/**
 * Bars for the day's tracked NUTRIENT macros (carbs, fat, sugar, alcohol),
 * driven by the targets frozen on the day itself: a past day shows the
 * macros it was lived under, never today's settings. Protein stays in the
 * hero, water in its own card.
 *
 * "hit" macros fill calmly toward their goal. "limit" macros (sugar,
 * alcohol) flip to the warning color once past the limit, and an untargeted
 * limit macro shows the plain amount, judgement-free.
 */
export function MacroSummaryCard({ log, className }: MacroSummaryCardProps) {
  const { t } = useTranslation();

  const rows = log.macroTargets.filter((m) => m.macroKey !== 'water');
  if (rows.length === 0) return null;

  return (
    <Card className={className}>
      <div className="grid grid-cols-2 gap-x-4 gap-y-3.5">
        {rows.map((m) => {
          const key = m.macroKey as MacroKey;
          const meta = MACRO_META[key];
          const value = macroTotalFor(log, key) ?? 0;
          const over = m.target !== null && value > m.target;
          const limitBroken = m.direction === 'limit' && over;
          return (
            <div key={key}>
              <div className="flex items-center justify-between mb-1">
                <span className="flex items-center gap-1.5 text-[12px] font-semibold text-ink-2 min-w-0">
                  <Icon name={meta.icon} size={13} style={{ color: meta.color }} />
                  <span className="truncate">{macroLabel(t, key)}</span>
                </span>
                <span
                  className={cn(
                    'text-[12px] font-bold tabular-nums shrink-0',
                    limitBroken ? 'text-warning' : 'text-ink',
                  )}
                >
                  {formatMacroAmount(key, value)}
                  {m.target !== null && (
                    <span className="text-ink-3 font-medium"> / {formatMacroAmount(key, m.target)}</span>
                  )}
                </span>
              </div>
              {m.target !== null ? (
                <ProgressBar
                  progress={m.target > 0 ? value / m.target : 0}
                  height={6}
                  color={limitBroken ? 'var(--t-warning)' : meta.color}
                  label={t('macros.bar_aria', '{{macro}} progress', { macro: macroLabel(t, key) })}
                />
              ) : (
                <div className="h-1.5 rounded-full" style={{ background: 'var(--t-ring-track)' }} aria-hidden="true" />
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
