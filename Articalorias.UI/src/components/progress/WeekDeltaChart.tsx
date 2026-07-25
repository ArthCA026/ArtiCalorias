import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Bar, BarChart, Cell, ReferenceLine, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import { Card } from '@/components/ui/Card';
import { useUnits } from '@/hooks/useUnits';
import { kcalToDisplay } from '@/utils/units';
import { addDays, parseDate } from '@/utils/format';
import { isFavorableDelta } from './weekMath';
import type { DailyLogResponse } from '@/types';

interface WeekDeltaChartProps {
  /** Monday of the shown week, yyyy-MM-dd */
  monday: string;
  days: DailyLogResponse[];
}

/**
 * One bar per weekday showing how far the day landed from the plan.
 * Favorable days use the brand color, off-plan days the warning color;
 * polarity is also carried by bar direction around the zero line, and the
 * signed chips in the day list repeat the exact numbers as text.
 */
export function WeekDeltaChart({ monday, days }: WeekDeltaChartProps) {
  const { t, i18n } = useTranslation();
  const { energyUnit } = useUnits();

  const data = useMemo(() => {
    const byDate = new Map(days.map((d) => [d.logDate, d]));
    const weekday = new Intl.DateTimeFormat(i18n.language, { weekday: 'narrow' });
    return Array.from({ length: 7 }, (_, i) => {
      const dateStr = addDays(monday, i);
      const log = byDate.get(dateStr);
      return {
        label: weekday.format(parseDate(dateStr)),
        // No data: value 0 renders no bar for that day.
        value: log ? Math.round(kcalToDisplay(log.dailyGoalDeltaKcal, energyUnit)) : 0,
        fill: log && isFavorableDelta(log) ? 'var(--t-primary)' : 'var(--t-warning)',
      };
    });
  }, [days, monday, i18n.language, energyUnit]);

  return (
    <Card>
      <p className="text-[13px] font-bold text-ink-2 uppercase tracking-wide">
        {t('progress.chart_title', 'Day by day')}
      </p>
      <p className="mt-0.5 text-[13px] text-ink-2">
        {t('progress.chart_subtitle', 'How each day landed against your plan')}
      </p>
      <div
        className="mt-3 h-[190px]"
        role="img"
        aria-label={t('progress.chart_aria', 'Bar chart of each day compared to your plan')}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 4 }}>
            <XAxis
              dataKey="label"
              axisLine={false}
              tickLine={false}
              interval={0}
              tick={{ fill: 'var(--t-ink-3)', fontSize: 11 }}
            />
            <YAxis hide />
            <ReferenceLine y={0} stroke="var(--t-hairline)" />
            <Bar dataKey="value" radius={4} maxBarSize={26}>
              {data.map((entry, i) => (
                <Cell key={i} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
