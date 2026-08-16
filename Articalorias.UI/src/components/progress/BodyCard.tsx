import { useMemo } from 'react';
import { useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { measurementService } from '@/services/measurementService';
import { queryKeys } from '@/lib/queryKeys';
import { useUnits } from '@/hooks/useUnits';
import { formatWeight, kgToDisplay } from '@/utils/units';
import { addDays, parseDate, toDateString } from '@/utils/format';

/**
 * Progress entry point into the Body page: current weight, the last ~30
 * days as a sparkline, and the recent change. One tap opens the full graph.
 */
export function BodyCard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { weightUnit } = useUnits();

  const { data } = useQuery({
    queryKey: queryKeys.measurements(),
    queryFn: () => measurementService.getAll().then((r) => r.data),
    staleTime: 5 * 60 * 1000,
  });

  const model = useMemo(() => {
    const weights = (data ?? []).filter((m) => m.weightKg != null);
    if (weights.length === 0) return null;
    const latest = weights[weights.length - 1];
    const cutoff = addDays(toDateString(), -30);
    const recent = weights.filter((m) => m.measuredOn >= cutoff);
    const anchor = [...weights].reverse().find((m) => m.measuredOn <= cutoff) ?? weights[0];
    const delta =
      anchor.measuredOn !== latest.measuredOn ? latest.weightKg! - anchor.weightKg! : null;
    return { latest, recent, delta };
  }, [data]);

  const spark = useMemo(() => {
    if (!model || model.recent.length < 2) return null;
    const w = 84;
    const h = 30;
    const values = model.recent.map((m) => m.weightKg!);
    const t0 = parseDate(model.recent[0].measuredOn).getTime();
    const t1 = parseDate(model.recent[model.recent.length - 1].measuredOn).getTime();
    const span = Math.max(t1 - t0, 1);
    const vMin = Math.min(...values);
    const vMax = Math.max(...values);
    const vSpan = Math.max(vMax - vMin, 0.2);
    return model.recent
      .map((m, i) => {
        const x = ((parseDate(m.measuredOn).getTime() - t0) / span) * (w - 4) + 2;
        const y = h - 3 - ((m.weightKg! - vMin) / vSpan) * (h - 6);
        return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  }, [model]);

  const signedDelta = (kg: number) => {
    const v = Math.round(kgToDisplay(Math.abs(kg), weightUnit) * 10) / 10;
    return `${kg > 0 ? '+' : kg < 0 ? '−' : ''}${v} ${weightUnit}`;
  };

  return (
    <Card padded={false}>
      <button
        type="button"
        onClick={() => navigate('/progress/body')}
        aria-label={t('body.card_aria', 'Open your body page: weight and body fat over time')}
        className="pressable w-full flex items-center gap-3 p-4 text-left active:bg-press"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-inset text-ink-2">
          <Icon name="scale" size={19} />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-[13px] font-bold text-ink-2 uppercase tracking-wide">
            {t('body.card_title', 'Body')}
          </span>
          {model ? (
            <span className="mt-0.5 flex items-baseline gap-2">
              <span className="text-[17px] font-extrabold text-ink tabular-nums">
                {formatWeight(model.latest.weightKg!, weightUnit)}
              </span>
              {model.delta !== null && (
                <span className="text-[12px] font-semibold text-ink-2 tabular-nums">
                  {t('body.card_delta', '{{delta}} in 30d', { delta: signedDelta(model.delta) })}
                </span>
              )}
            </span>
          ) : (
            <span className="block mt-0.5 text-[13px] text-ink-2">
              {t('body.card_empty', 'Track your weight over time')}
            </span>
          )}
        </span>
        {spark && (
          <svg width="84" height="30" aria-hidden="true" className="shrink-0">
            <path d={spark} fill="none" stroke="var(--t-primary)" strokeWidth="2" strokeLinecap="round" />
          </svg>
        )}
        <Icon name="chevronRight" size={18} className="text-ink-3 shrink-0" />
      </button>
    </Card>
  );
}
