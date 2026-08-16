import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/Card';
import { IconButton } from '@/components/ui/Button';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Fab } from '@/components/ui/Fab';
import { Icon } from '@/components/ui/Icon';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { BodyChart, type ChartPoint } from '@/components/body/BodyChart';
import { MeasurementSheet } from '@/components/body/MeasurementSheet';
import { measurementService } from '@/services/measurementService';
import { profileService } from '@/services/profileService';
import { queryKeys } from '@/lib/queryKeys';
import { useUnits } from '@/hooks/useUnits';
import { useDelayedBoolean } from '@/hooks/useDelayedBoolean';
import { kgToDisplay, formatWeight } from '@/utils/units';
import { addDays, parseDate, toDateString } from '@/utils/format';
import { cn } from '@/utils/cn';
import type { BodyMeasurement } from '@/types';

type Metric = 'weight' | 'bodyFat';
type RangeKey = '1m' | '3m' | '6m' | '1y' | 'all';

const RANGES: { key: RangeKey; days: number | null }[] = [
  { key: '1m', days: 30 },
  { key: '3m', days: 91 },
  { key: '6m', days: 182 },
  { key: '1y', days: 365 },
  { key: 'all', days: null },
];

/**
 * Body: weight and body-fat history as a graph plus the measurement log
 * behind it. Every point is editable, any day can get one, and the dashed
 * tail shows where the current calorie goal is steering.
 */
export default function BodyPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { weightUnit } = useUnits();
  const today = toDateString();

  const [metric, setMetric] = useState<Metric>('weight');
  const [range, setRange] = useState<RangeKey>('3m');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<BodyMeasurement | null>(null);
  const [showAll, setShowAll] = useState(false);

  const query = useQuery({
    queryKey: queryKeys.measurements(),
    queryFn: () => measurementService.getAll().then((r) => r.data),
    staleTime: 5 * 60 * 1000,
  });
  const { data: profile } = useQuery({
    queryKey: queryKeys.profile(),
    queryFn: () => profileService.get().then((r) => r.data),
    staleTime: 10 * 60 * 1000,
  });
  const showSkeleton = useDelayedBoolean(query.isLoading, 300);
  const measurements = useMemo(() => query.data ?? [], [query.data]);

  const rangeStart = useMemo(() => {
    const days = RANGES.find((r) => r.key === range)?.days ?? null;
    return days === null ? null : addDays(today, -days);
  }, [range, today]);

  const inRange = useMemo(
    () => measurements.filter((m) => rangeStart === null || m.measuredOn >= rangeStart),
    [measurements, rangeStart],
  );

  /**
   * Deurenberg estimate (the same formula the backend uses in auto mode) for
   * weight-only points, so the body-fat series stays continuous even when
   * the user only ever weighs in. Estimates render hollow, never solid.
   */
  const estimateBf = useMemo(() => {
    if (!profile || !profile.autoCalculateBodyFat) return null;
    if (profile.heightCm == null || profile.age == null || !profile.biologicalSex) return null;
    const heightM = profile.heightCm / 100;
    const sexFactor = profile.biologicalSex === 'M' ? 1 : 0;
    return (weightKg: number) => {
      const bmi = weightKg / (heightM * heightM);
      const bf = 1.2 * bmi + 0.23 * (profile.age ?? 30) - 10.8 * sexFactor - 5.4;
      return bf >= 0 && bf <= 100 ? Math.round(bf * 10) / 10 : null;
    };
  }, [profile]);

  const chartPoints = useMemo<ChartPoint[]>(() => {
    if (metric === 'weight') {
      return inRange
        .filter((m) => m.weightKg != null)
        .map((m) => ({
          date: m.measuredOn,
          value: Math.round(kgToDisplay(m.weightKg!, weightUnit) * 10) / 10,
        }));
    }
    return inRange
      .map((m) => {
        if (m.bodyFatPercent != null) return { date: m.measuredOn, value: m.bodyFatPercent };
        if (m.weightKg != null && estimateBf) {
          const est = estimateBf(m.weightKg);
          if (est !== null) return { date: m.measuredOn, value: est, estimated: true };
        }
        return null;
      })
      .filter((p): p is ChartPoint => p !== null);
  }, [inRange, metric, weightUnit, estimateBf]);

  // Trend chip: latest vs ~30 days back (nearest earlier measurement).
  const trend = useMemo(() => {
    const weights = measurements.filter((m) => m.weightKg != null);
    if (weights.length < 2) return null;
    const latest = weights[weights.length - 1];
    const cutoff = addDays(latest.measuredOn, -30);
    const anchor = [...weights].reverse().find((m) => m.measuredOn <= cutoff) ?? weights[0];
    if (anchor.measuredOn === latest.measuredOn) return null;
    return {
      deltaKg: latest.weightKg! - anchor.weightKg!,
      sinceDays: Math.round(
        (parseDate(latest.measuredOn).getTime() - parseDate(anchor.measuredOn).getTime()) / 86400000,
      ),
    };
  }, [measurements]);

  const goalKgPerDay = profile ? profile.dailyBaseGoalKcal / 7700 : null;
  const latestWeight = [...measurements].reverse().find((m) => m.weightKg != null)?.weightKg ?? null;

  const listRows = useMemo(() => {
    const rows = [...measurements].reverse();
    return showAll ? rows : rows.slice(0, 14);
  }, [measurements, showAll]);

  const dateFmt = useMemo(
    () => new Intl.DateTimeFormat(i18n.language, { weekday: 'short', day: 'numeric', month: 'short' }),
    [i18n.language],
  );

  const signedWeight = (kg: number) => {
    const v = Math.round(kgToDisplay(Math.abs(kg), weightUnit) * 10) / 10;
    return `${kg > 0 ? '+' : kg < 0 ? '−' : ''}${v}`;
  };

  return (
    <div className="space-y-4">
      <header className="flex items-center gap-2">
        <IconButton icon="arrowLeft" label={t('common.back', 'Back')} onClick={() => navigate('/progress')} />
        <div className="flex-1 min-w-0">
          <h1 className="text-[19px] font-extrabold text-ink leading-tight">
            {t('body.title', 'Body')}
          </h1>
          <p className="text-[12px] text-ink-2">
            {latestWeight !== null
              ? t('body.current_weight', 'Current weight: {{weight}}', {
                  weight: formatWeight(latestWeight, weightUnit),
                })
              : t('body.no_weight_yet', 'No weight recorded yet')}
          </p>
        </div>
        {trend && (
          <span
            className={cn(
              'shrink-0 rounded-full px-2.5 py-1.5 text-[12px] font-bold tabular-nums',
              'bg-inset text-ink-2',
            )}
          >
            {t('body.trend_chip', '{{delta}} {{unit}} in {{days}}d', {
              delta: signedWeight(trend.deltaKg),
              unit: weightUnit,
              days: trend.sinceDays,
            })}
          </span>
        )}
      </header>

      {query.isError && (
        <ErrorState
          title={t('body.load_error_title', 'Could not load your measurements')}
          body={t('progress.load_error_body', 'Check your internet connection and try again. Your logged data is safe.')}
          retryLabel={t('common.retry', 'Retry')}
          onRetry={() => query.refetch()}
        />
      )}

      {!query.data && !query.isError && showSkeleton && <SkeletonCard rows={4} />}

      {query.data && (
        <>
          <Card>
            <SegmentedControl<Metric>
              aria-label={t('body.metric_switch', 'Weight or body fat')}
              options={[
                { value: 'weight', label: t('body.metric_weight', 'Weight'), icon: 'scale' },
                { value: 'bodyFat', label: t('body.metric_bf', 'Body fat'), icon: 'ruler' },
              ]}
              value={metric}
              onChange={setMetric}
            />

            <div className="mt-3 flex gap-1.5" role="radiogroup" aria-label={t('body.range_aria', 'Time range')}>
              {RANGES.map((r) => (
                <button
                  key={r.key}
                  type="button"
                  role="radio"
                  aria-checked={range === r.key}
                  onClick={() => setRange(r.key)}
                  className={cn(
                    'pressable flex-1 rounded-full py-1.5 text-[12px] font-bold',
                    range === r.key ? 'bg-primary text-on-primary' : 'bg-inset text-ink-2',
                  )}
                >
                  {t(`body.range_${r.key}`, r.key.toUpperCase())}
                </button>
              ))}
            </div>

            <div className="mt-3">
              {chartPoints.length >= 2 ? (
                <BodyChart
                  metric={metric}
                  points={chartPoints}
                  weightUnit={weightUnit}
                  goalKgPerDay={goalKgPerDay}
                />
              ) : (
                <p className="py-6 text-center text-[13px] text-ink-3 leading-relaxed">
                  {metric === 'weight'
                    ? t('body.chart_needs_two', 'Two measurements draw the first line. Add one whenever you weigh in.')
                    : t('body.chart_needs_bf', 'Record a body fat value with a measurement and the curve appears here.')}
                </p>
              )}
            </div>
          </Card>

          <Card padded={false} className="overflow-hidden">
            <div className="px-4 pt-4 pb-2">
              <p className="text-[13px] font-bold text-ink-2 uppercase tracking-wide">
                {t('body.history_title', 'Measurements')}
              </p>
              <p className="mt-0.5 text-[12px] text-ink-3">
                {t('body.history_subtitle', 'Tap one to correct or delete it')}
              </p>
            </div>

            {measurements.length === 0 ? (
              <EmptyState
                icon="scale"
                title={t('body.empty_title', 'No measurements yet')}
                body={t('body.empty_body', 'Add your weight whenever you step on the scale. Profile weight changes land here automatically.')}
                actionLabel={t('body.add_first', 'Add your first measurement')}
                onAction={() => {
                  setEditing(null);
                  setSheetOpen(true);
                }}
              />
            ) : (
              <>
                {listRows.map((m, i) => (
                  <button
                    key={m.measuredOn}
                    type="button"
                    onClick={() => {
                      setEditing(m);
                      setSheetOpen(true);
                    }}
                    className={cn(
                      'pressable w-full flex items-center gap-3 px-4 py-2.5 text-left active:bg-press',
                      i > 0 && 'border-t border-hairline/60',
                    )}
                  >
                    <span className="flex-1 min-w-0">
                      <span className="block text-[14px] font-semibold text-ink capitalize">
                        {m.measuredOn === today
                          ? t('progress.today_row', 'Today')
                          : dateFmt.format(parseDate(m.measuredOn))}
                      </span>
                      {m.source === 'history' && (
                        <span className="block text-[11px] text-ink-3">
                          {t('body.source_history', 'From your log history')}
                        </span>
                      )}
                    </span>
                    {m.weightKg != null && (
                      <span className="text-[14px] font-bold text-ink tabular-nums">
                        {formatWeight(m.weightKg, weightUnit)}
                      </span>
                    )}
                    {m.bodyFatPercent != null && (
                      <span className="rounded-full bg-protein-soft px-2 py-0.5 text-[12px] font-bold text-protein tabular-nums">
                        {m.bodyFatPercent}%
                      </span>
                    )}
                    <Icon name="chevronRight" size={16} className="text-ink-3 shrink-0" />
                  </button>
                ))}
                {!showAll && measurements.length > listRows.length && (
                  <button
                    type="button"
                    onClick={() => setShowAll(true)}
                    className="pressable w-full border-t border-hairline/60 py-3 text-center text-[13px] font-semibold text-primary-soft-ink"
                  >
                    {t('body.show_all', 'Show all {{n}} measurements', { n: measurements.length })}
                  </button>
                )}
              </>
            )}
          </Card>
        </>
      )}

      <Fab
        label={t('body.add_fab', 'Add')}
        onClick={() => {
          setEditing(null);
          setSheetOpen(true);
        }}
      />

      <MeasurementSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        measurement={editing}
        profile={profile}
      />
    </div>
  );
}
