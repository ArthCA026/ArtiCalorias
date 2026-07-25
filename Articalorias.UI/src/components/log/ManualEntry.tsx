import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Field, DecimalField } from '@/components/ui/Field';
import { InlineError } from '@/components/ui/States';
import { Icon } from '@/components/ui/Icon';
import { foodService } from '@/services/foodService';
import { activityService } from '@/services/activityService';
import { toDateString } from '@/utils/format';
import { extractApiError } from '@/utils/apiError';

interface ManualProps {
  onBack: () => void;
  onDone: (date: string, count: number) => void;
}

const num = (raw: string): number | null => {
  if (raw.trim() === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
};

/** Manual meal entry. Two required fields; everything else is disclosed on demand. */
export function ManualFood({ onBack, onDone }: ManualProps) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [kcal, setKcal] = useState('');
  const [protein, setProtein] = useState('');
  const [showMore, setShowMore] = useState(false);
  const [portion, setPortion] = useState('');
  const [fat, setFat] = useState('');
  const [carbs, setCarbs] = useState('');
  const [alcohol, setAlcohol] = useState('');
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: () => {
      const date = toDateString();
      return foodService
        .create(date, {
          foodName: name.trim(),
          portionDescription: portion.trim() || null,
          quantity: 1,
          caloriesKcal: num(kcal) ?? 0,
          proteinGrams: num(protein) ?? 0,
          fatGrams: num(fat) ?? 0,
          carbsGrams: num(carbs) ?? 0,
          alcoholGrams: num(alcohol) ?? 0,
        })
        .then(() => date);
    },
    onSuccess: (date) => onDone(date, 1),
    onError: (err) =>
      setError(extractApiError(err, t('log.save_error', 'Could not save. Check your connection and try again.'))),
  });

  const valid = name.trim().length > 0 && num(kcal) !== null && (num(kcal) as number) >= 0;

  return (
    <form
      className="space-y-3.5"
      onSubmit={(e) => {
        e.preventDefault();
        if (valid && !save.isPending) save.mutate();
      }}
    >
      <Field
        label={t('log.food_name', 'Food')}
        placeholder={t('log.food_name_ph', 'e.g. Greek yogurt')}
        value={name}
        onChange={(e) => setName(e.target.value)}
        autoComplete="off"
        enterKeyHint="next"
        required
      />
      <div className="grid grid-cols-2 gap-3">
        <DecimalField
          label={t('log.calories', 'Calories')}
          placeholder="0"
          suffix="kcal"
          value={kcal}
          onValueChange={setKcal}
        />
        <DecimalField
          label={t('log.protein', 'Protein')}
          placeholder="0"
          suffix="g"
          value={protein}
          onValueChange={setProtein}
        />
      </div>

      <button
        type="button"
        aria-expanded={showMore}
        className="pressable flex items-center gap-1 text-sm font-semibold text-primary-soft-ink py-1"
        onClick={() => setShowMore((v) => !v)}
      >
        <Icon name={showMore ? 'chevronUp' : 'chevronDown'} size={16} />
        {showMore ? t('log.fewer_details', 'Fewer details') : t('log.more_details', 'More details')}
      </button>
      {showMore && (
        <div className="space-y-3.5">
          <Field
            label={t('log.portion', 'Portion')}
            placeholder={t('log.portion_ph', 'e.g. 1 cup')}
            value={portion}
            onChange={(e) => setPortion(e.target.value)}
            autoComplete="off"
          />
          <div className="grid grid-cols-3 gap-3">
            <DecimalField
              label={t('log.fat', 'Fat')}
              placeholder="0"
              suffix="g"
              value={fat}
              onValueChange={setFat}
            />
            <DecimalField
              label={t('log.carbs', 'Carbs')}
              placeholder="0"
              suffix="g"
              value={carbs}
              onValueChange={setCarbs}
            />
            <DecimalField
              label={t('log.alcohol', 'Alcohol')}
              placeholder="0"
              suffix="g"
              value={alcohol}
              onValueChange={setAlcohol}
            />
          </div>
        </div>
      )}

      {error && <InlineError message={error} />}

      <Button type="submit" variant="primary" size="lg" fullWidth loading={save.isPending} disabled={!valid}>
        {t('log.add_to_today', 'Add to today')}
      </Button>
      <Button variant="ghost" size="md" fullWidth onClick={onBack} disabled={save.isPending}>
        {t('common.back', 'Back')}
      </Button>
    </form>
  );
}

/** Manual activity entry with optional AI intensity estimate. */
export function ManualActivity({ onBack, onDone }: ManualProps) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [duration, setDuration] = useState('30');
  const [met, setMet] = useState('');
  const [metExplanation, setMetExplanation] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const estimate = useMutation({
    mutationFn: () =>
      activityService
        .estimateMet({ activityName: name.trim(), durationMinutes: num(duration) })
        .then((r) => r.data),
    onSuccess: (res) => {
      setMet(String(res.metValue));
      setMetExplanation(res.explanation);
      setError(null);
    },
    onError: (err) =>
      setError(extractApiError(err, t('log.estimate_error', 'Could not estimate intensity. You can type a MET value yourself: walking is about 3, running about 9.'))),
  });

  const save = useMutation({
    mutationFn: () => {
      const date = toDateString();
      return activityService
        .create(date, {
          activityName: name.trim(),
          durationMinutes: num(duration),
          metValue: num(met),
        })
        .then(() => date);
    },
    onSuccess: (date) => onDone(date, 1),
    onError: (err) =>
      setError(extractApiError(err, t('log.save_error', 'Could not save. Check your connection and try again.'))),
  });

  const d = num(duration);
  const m = num(met);
  const valid = name.trim().length > 0 && d !== null && d > 0 && m !== null && m >= 0.5 && m <= 50;

  return (
    <form
      className="space-y-3.5"
      onSubmit={(e) => {
        e.preventDefault();
        if (valid && !save.isPending) save.mutate();
      }}
    >
      <Field
        label={t('log.activity_name', 'Activity')}
        placeholder={t('log.activity_name_ph', 'e.g. Brisk walk')}
        value={name}
        onChange={(e) => setName(e.target.value)}
        autoComplete="off"
        enterKeyHint="next"
        required
      />
      <div className="grid grid-cols-2 gap-3">
        <DecimalField
          label={t('log.duration', 'Duration')}
          placeholder="30"
          suffix="min"
          value={duration}
          onValueChange={setDuration}
        />
        <DecimalField
          label={t('log.met', 'Intensity (MET)')}
          placeholder="3.5"
          value={met}
          onValueChange={(v) => {
            setMet(v);
            setMetExplanation(null);
          }}
        />
      </div>

      <Button
        variant="soft"
        size="md"
        fullWidth
        icon="sparkles"
        loading={estimate.isPending}
        disabled={name.trim().length < 2}
        onClick={() => estimate.mutate()}
      >
        {t('log.estimate_met', 'Estimate intensity for me')}
      </Button>
      {metExplanation && <p className="text-[13px] text-ink-2 leading-relaxed">{metExplanation}</p>}

      {error && <InlineError message={error} />}

      <Button type="submit" variant="primary" size="lg" fullWidth loading={save.isPending} disabled={!valid}>
        {t('log.add_to_today', 'Add to today')}
      </Button>
      <Button variant="ghost" size="md" fullWidth onClick={onBack} disabled={save.isPending}>
        {t('common.back', 'Back')}
      </Button>
    </form>
  );
}
