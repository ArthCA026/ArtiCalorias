import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/Card';
import { Sheet } from '@/components/ui/Sheet';
import { ActionSheet } from '@/components/ui/ActionSheet';
import { Button } from '@/components/ui/Button';
import { Field, DecimalField } from '@/components/ui/Field';
import { Stepper } from '@/components/ui/Stepper';
import { EmptyState, InlineError } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';
import { useLongPress } from '@/hooks/useLongPress';
import { useLogSheet } from '@/components/log/LogSheetContext';
import { foodService } from '@/services/foodService';
import { activityService } from '@/services/activityService';
import { foodTemplateService } from '@/services/foodTemplateService';
import { extractApiError } from '@/utils/apiError';
import { fmt } from '@/utils/format';
import type { ActivityEntryResponse, FoodEntryResponse } from '@/types';

const round1 = (n: number) => Math.round(n * 10) / 10;
const num = (raw: string): number => {
  const n = Number(raw.replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};

/* ------------------------------------------------------------------ */
/* Shared row                                                          */
/* ------------------------------------------------------------------ */

interface RowProps {
  title: string;
  subtitle: string;
  value: string;
  onOpen: () => void;
}

function EntryRow({ title, subtitle, value, onOpen }: RowProps) {
  const { t } = useTranslation();
  const handlers = useLongPress({ onLongPress: onOpen, onTap: onOpen });
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={t('today.entry_aria', '{{name}}, open options', { name: title })}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onOpen();
      }}
      {...handlers}
      className="pressable w-full flex items-center gap-3 px-4 py-3 active:bg-press cursor-pointer"
    >
      <span className="flex-1 min-w-0">
        <span className="block text-[15px] font-semibold text-ink truncate">{title}</span>
        <span className="block text-[13px] text-ink-2 mt-0.5 truncate">{subtitle}</span>
      </span>
      <span className="shrink-0 text-[15px] font-bold text-ink tabular-nums">{value}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Meals                                                               */
/* ------------------------------------------------------------------ */

interface MealsListProps {
  date: string;
  entries: FoodEntryResponse[];
  onChanged: () => void;
}

export function MealsList({ date, entries, onChanged }: MealsListProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { openLog } = useLogSheet();
  const [selected, setSelected] = useState<FoodEntryResponse | null>(null);
  const [editing, setEditing] = useState<FoodEntryResponse | null>(null);

  const del = useMutation({
    mutationFn: (entry: FoodEntryResponse) => foodService.remove(date, entry.foodEntryId),
    onSuccess: () => {
      onChanged();
      toast('success', t('today.deleted', 'Deleted'));
    },
    onError: (err) => toast('error', extractApiError(err, t('log.save_error', 'Could not save. Check your connection and try again.'))),
  });

  const saveTemplate = useMutation({
    mutationFn: (entry: FoodEntryResponse) => {
      const qty = entry.quantity && entry.quantity > 0 ? entry.quantity : 1;
      return foodTemplateService.create({
        templateName: entry.foodName,
        portionDescription: entry.portionDescription?.slice(0, 100) || t('today.portion_default', '1 serving'),
        defaultQuantity: qty,
        caloriesKcal: round1(entry.caloriesKcal / qty),
        proteinGrams: round1(entry.proteinGrams / qty),
        fatGrams: round1(entry.fatGrams / qty),
        carbsGrams: round1(entry.carbsGrams / qty),
        alcoholGrams: round1(entry.alcoholGrams / qty),
        autoAddToNewDay: false,
      });
    },
    onSuccess: () => toast('success', t('today.saved_as_template', 'Saved to Templates')),
    onError: (err) => toast('error', extractApiError(err, t('log.save_error', 'Could not save. Check your connection and try again.'))),
  });

  return (
    <section>
      <h2 className="text-[15px] font-bold text-ink mb-2 px-1">{t('today.meals', 'Meals')}</h2>
      <Card padded={false} className="overflow-hidden">
        {entries.length === 0 ? (
          <EmptyState
            icon="meal"
            title={t('today.no_meals_title', 'Nothing logged yet')}
            body={t('today.no_meals_body', 'Describe your meal in plain words and the AI fills in the macros for you.')}
            actionLabel={t('today.log_first_meal', 'Log a meal')}
            onAction={() => openLog('meal')}
          />
        ) : (
          <div className="divide-y divide-hairline/50">
            {entries.map((e) => (
              <EntryRow
                key={e.foodEntryId}
                title={e.foodName}
                subtitle={[
                  e.quantity && e.quantity !== 1 ? `x${e.quantity}` : null,
                  e.portionDescription,
                  `P ${fmt(e.proteinGrams)}g`,
                ]
                  .filter(Boolean)
                  .join(' · ')}
                value={`${fmt(e.caloriesKcal)} kcal`}
                onOpen={() => setSelected(e)}
              />
            ))}
          </div>
        )}
      </Card>

      <ActionSheet
        open={selected !== null}
        onClose={() => setSelected(null)}
        title={selected?.foodName}
        actions={[
          {
            icon: 'pencil',
            label: t('common.edit', 'Edit'),
            onSelect: () => setEditing(selected),
          },
          {
            icon: 'bookmark',
            label: t('today.save_as_template', 'Save as template'),
            onSelect: () => selected && saveTemplate.mutate(selected),
          },
          {
            icon: 'trash',
            label: t('common.delete', 'Delete'),
            destructive: true,
            onSelect: () => selected && del.mutate(selected),
          },
        ]}
      />

      {editing && (
        <EditFoodSheet
          date={date}
          entry={editing}
          onClose={() => setEditing(null)}
          onChanged={onChanged}
        />
      )}
    </section>
  );
}

interface EditFoodSheetProps {
  date: string;
  entry: FoodEntryResponse;
  onClose: () => void;
  onChanged: () => void;
}

function EditFoodSheet({ date, entry, onClose, onChanged }: EditFoodSheetProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [name, setName] = useState(entry.foodName);
  const [qty, setQty] = useState(entry.quantity && entry.quantity > 0 ? entry.quantity : 1);
  const [kcal, setKcal] = useState(String(entry.caloriesKcal));
  const [protein, setProtein] = useState(String(entry.proteinGrams));
  const [fat, setFat] = useState(String(entry.fatGrams));
  const [carbs, setCarbs] = useState(String(entry.carbsGrams));
  const [error, setError] = useState<string | null>(null);

  // Changing quantity scales every macro proportionally (what you see is what is saved)
  const applyQty = (nextQty: number) => {
    const ratio = nextQty / qty;
    setQty(nextQty);
    setKcal((v) => String(round1(num(v) * ratio)));
    setProtein((v) => String(round1(num(v) * ratio)));
    setFat((v) => String(round1(num(v) * ratio)));
    setCarbs((v) => String(round1(num(v) * ratio)));
  };

  const save = useMutation({
    mutationFn: () =>
      foodService.update(date, entry.foodEntryId, {
        foodName: name.trim(),
        portionDescription: entry.portionDescription,
        quantity: qty,
        caloriesKcal: num(kcal),
        proteinGrams: num(protein),
        fatGrams: num(fat),
        carbsGrams: num(carbs),
        alcoholGrams: entry.alcoholGrams,
        notes: entry.notes,
        scaleByQuantity: false,
      }),
    onSuccess: () => {
      onChanged();
      toast('success', t('common.saved', 'Saved'));
      onClose();
    },
    onError: (err) => setError(extractApiError(err, t('log.save_error', 'Could not save. Check your connection and try again.'))),
  });

  return (
    <Sheet open onClose={onClose} title={t('today.edit_meal', 'Edit meal')}>
      <div className="space-y-3.5">
        <Field
          label={t('log.food_name', 'Food')}
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="off"
        />
        <div>
          <p className="text-[13px] font-semibold text-ink-2 mb-1.5">{t('log.quantity', 'Quantity')}</p>
          <Stepper
            value={qty}
            step={qty >= 1 ? 1 : 0.5}
            min={0.5}
            onChange={applyQty}
            decreaseLabel={t('log.less', 'Less')}
            increaseLabel={t('log.more', 'More')}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <DecimalField label={t('log.calories', 'Calories')} suffix="kcal" value={kcal} onValueChange={setKcal} />
          <DecimalField label={t('log.protein', 'Protein')} suffix="g" value={protein} onValueChange={setProtein} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <DecimalField label={t('log.fat', 'Fat')} suffix="g" value={fat} onValueChange={setFat} />
          <DecimalField label={t('log.carbs', 'Carbs')} suffix="g" value={carbs} onValueChange={setCarbs} />
        </div>
        {error && <InlineError message={error} />}
        <Button
          variant="primary"
          size="lg"
          fullWidth
          loading={save.isPending}
          disabled={name.trim().length === 0}
          onClick={() => save.mutate()}
        >
          {t('common.save', 'Save')}
        </Button>
      </div>
    </Sheet>
  );
}

/* ------------------------------------------------------------------ */
/* Activities                                                          */
/* ------------------------------------------------------------------ */

interface ActivitiesListProps {
  date: string;
  entries: ActivityEntryResponse[];
  hasCalorieEstimate: boolean;
  onChanged: () => void;
}

export function ActivitiesList({ date, entries, hasCalorieEstimate, onChanged }: ActivitiesListProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { openLog } = useLogSheet();
  const [selected, setSelected] = useState<ActivityEntryResponse | null>(null);
  const [editing, setEditing] = useState<ActivityEntryResponse | null>(null);

  const del = useMutation({
    mutationFn: (entry: ActivityEntryResponse) =>
      activityService.remove(date, entry.activityEntryId),
    onSuccess: () => {
      onChanged();
      toast('success', t('today.deleted', 'Deleted'));
    },
    onError: (err) => toast('error', extractApiError(err, t('log.save_error', 'Could not save. Check your connection and try again.'))),
  });

  const saveTemplate = useMutation({
    mutationFn: (entry: ActivityEntryResponse) =>
      activityService.createTemplate({
        templateName: entry.activityName,
        autoAddToNewDay: false,
        defaultDurationMinutes: entry.durationMinutes ?? 30,
        defaultMET: entry.metValue ?? 3.5,
      }),
    onSuccess: () => toast('success', t('today.saved_as_template', 'Saved to Templates')),
    onError: (err) => toast('error', extractApiError(err, t('log.save_error', 'Could not save. Check your connection and try again.'))),
  });

  return (
    <section>
      <h2 className="text-[15px] font-bold text-ink mb-2 px-1">{t('today.activities', 'Activities')}</h2>
      <Card padded={false} className="overflow-hidden">
        {entries.length === 0 ? (
          <EmptyState
            icon="activity"
            title={t('today.no_activities_title', 'No activity yet')}
            body={t('today.no_activities_body', 'Moving raises your budget. Log a walk, a workout, anything that got you moving.')}
            actionLabel={t('today.log_activity', 'Log activity')}
            onAction={() => openLog('activity')}
          />
        ) : (
          <div className="divide-y divide-hairline/50">
            {entries.map((a) => (
              <EntryRow
                key={a.activityEntryId}
                title={a.activityName}
                subtitle={t('today.activity_meta', '{{min}} min, MET {{met}}', {
                  min: fmt(a.durationMinutes ?? 0),
                  met: a.metValue ?? 0,
                })}
                value={hasCalorieEstimate ? `${fmt(a.calculatedCaloriesKcal)} kcal` : '–'}
                onOpen={() => setSelected(a)}
              />
            ))}
          </div>
        )}
      </Card>

      <ActionSheet
        open={selected !== null}
        onClose={() => setSelected(null)}
        title={selected?.activityName}
        actions={[
          {
            icon: 'pencil',
            label: t('common.edit', 'Edit'),
            onSelect: () => setEditing(selected),
          },
          {
            icon: 'bookmark',
            label: t('today.save_as_template', 'Save as template'),
            onSelect: () => selected && saveTemplate.mutate(selected),
          },
          {
            icon: 'trash',
            label: t('common.delete', 'Delete'),
            destructive: true,
            onSelect: () => selected && del.mutate(selected),
          },
        ]}
      />

      {editing && (
        <EditActivitySheet
          date={date}
          entry={editing}
          onClose={() => setEditing(null)}
          onChanged={onChanged}
        />
      )}
    </section>
  );
}

interface EditActivitySheetProps {
  date: string;
  entry: ActivityEntryResponse;
  onClose: () => void;
  onChanged: () => void;
}

function EditActivitySheet({ date, entry, onClose, onChanged }: EditActivitySheetProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [name, setName] = useState(entry.activityName);
  const [duration, setDuration] = useState(entry.durationMinutes ?? 30);
  const [met, setMet] = useState(String(entry.metValue ?? 3.5));
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: () =>
      activityService.update(date, entry.activityEntryId, {
        activityName: name.trim(),
        durationMinutes: duration,
        metValue: num(met),
      }),
    onSuccess: () => {
      onChanged();
      toast('success', t('common.saved', 'Saved'));
      onClose();
    },
    onError: (err) => setError(extractApiError(err, t('log.save_error', 'Could not save. Check your connection and try again.'))),
  });

  const m = num(met);
  const valid = name.trim().length > 0 && duration > 0 && m >= 0.5 && m <= 50;

  return (
    <Sheet open onClose={onClose} title={t('today.edit_activity', 'Edit activity')}>
      <div className="space-y-3.5">
        <Field
          label={t('log.activity_name', 'Activity')}
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="off"
        />
        <div>
          <p className="text-[13px] font-semibold text-ink-2 mb-1.5">{t('log.duration', 'Duration')}</p>
          <Stepper
            value={duration}
            step={5}
            min={5}
            max={1440}
            format={(v) => t('log.minutes_short', '{{v}} min', { v })}
            onChange={setDuration}
            decreaseLabel={t('log.less', 'Less')}
            increaseLabel={t('log.more', 'More')}
          />
        </div>
        <DecimalField label={t('log.met', 'Intensity (MET)')} value={met} onValueChange={setMet} />
        {error && <InlineError message={error} />}
        <Button
          variant="primary"
          size="lg"
          fullWidth
          loading={save.isPending}
          disabled={!valid}
          onClick={() => save.mutate()}
        >
          {t('common.save', 'Save')}
        </Button>
      </div>
    </Sheet>
  );
}
