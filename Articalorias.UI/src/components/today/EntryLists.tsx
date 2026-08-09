import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/Card';
import { Sheet } from '@/components/ui/Sheet';
import { ActionSheet } from '@/components/ui/ActionSheet';
import { Button } from '@/components/ui/Button';
import { Field, DecimalField } from '@/components/ui/Field';
import { QuantityField, QuickAmountSheet } from '@/components/ui/QuantityField';
import { MacroStrip } from '@/components/ui/MacroStrip';
import { ItemRow, ItemMeta } from '@/components/ui/ItemRow';
import { AmountChip } from '@/components/ui/AmountChip';
import { Icon } from '@/components/ui/Icon';
import { EmptyState, InlineError } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';
import { useLogSheet } from '@/components/log/LogSheetContext';
import { foodService } from '@/services/foodService';
import { activityService } from '@/services/activityService';
import { foodTemplateService } from '@/services/foodTemplateService';
import { queryKeys } from '@/lib/queryKeys';
import { extractApiError } from '@/utils/apiError';
import { fmt, round1, qtyStr } from '@/utils/format';
import type { ActivityEntryResponse, FoodEntryResponse, UpdateFoodEntryRequest } from '@/types';

const num = (raw: string): number => {
  const n = Number(raw.replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};

/* ------------------------------------------------------------------ */
/* Meals                                                               */
/* ------------------------------------------------------------------ */

interface MealsListProps {
  date: string;
  entries: FoodEntryResponse[];
  /** Drives the empty state tense: still open today, closed on a past day */
  isToday: boolean;
  onChanged: () => void;
}

function MealRow({
  entry,
  onOpen,
  onQty,
}: {
  entry: FoodEntryResponse;
  onOpen: () => void;
  onQty: () => void;
}) {
  const { t } = useTranslation();
  const qty = entry.quantity && entry.quantity > 0 ? entry.quantity : 1;
  return (
    <ItemRow
      title={entry.foodName}
      value={t('today.kcal_value', '{{kcal}} kcal', { kcal: fmt(entry.caloriesKcal) })}
      ariaLabel={t('today.entry_aria', '{{name}}, open options', { name: entry.foodName })}
      onOpen={onOpen}
      meta={
        <>
          <AmountChip
            label={qtyStr(qty)}
            ariaLabel={t('today.change_qty_aria', 'Change quantity of {{name}}', {
              name: entry.foodName,
            })}
            onEdit={onQty}
          />
          {entry.portionDescription && (
            <>
              <span className="text-ink-3 shrink-0" aria-hidden="true">
                &middot;
              </span>
              <ItemMeta>{entry.portionDescription}</ItemMeta>
            </>
          )}
        </>
      }
      footer={
        <MacroStrip
          protein={entry.proteinGrams}
          fat={entry.fatGrams}
          carbs={entry.carbsGrams}
        />
      }
    />
  );
}

export function MealsList({ date, entries, isToday, onChanged }: MealsListProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { openLog } = useLogSheet();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<FoodEntryResponse | null>(null);
  const [editing, setEditing] = useState<FoodEntryResponse | null>(null);
  const [qtyTarget, setQtyTarget] = useState<FoodEntryResponse | null>(null);

  const saveError = () => t('log.save_error', 'Could not save. Check your connection and try again.');

  const del = useMutation({
    mutationFn: (entry: FoodEntryResponse) => foodService.remove(date, entry.foodEntryId),
    onSuccess: () => {
      onChanged();
      toast('success', t('today.deleted', 'Deleted'));
    },
    onError: (err) => toast('error', extractApiError(err, saveError())),
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
    onSuccess: () => {
      // The Templates screen must show the new template without a reload
      queryClient.invalidateQueries({ queryKey: queryKeys.foodTemplates() });
      toast('success', t('today.saved_as_template', 'Saved to Templates'));
    },
    onError: (err) => toast('error', extractApiError(err, saveError())),
  });

  // One-tap quantity change. Uses the API's scale-by-quantity so the
  // server rescales every macro from the entry's stored base amount.
  const quickQty = useMutation({
    mutationFn: ({ entry, qty }: { entry: FoodEntryResponse; qty: number }) => {
      const base: UpdateFoodEntryRequest = {
        foodName: entry.foodName,
        portionDescription: entry.portionDescription,
        quantity: qty,
        caloriesKcal: entry.caloriesKcal,
        proteinGrams: entry.proteinGrams,
        fatGrams: entry.fatGrams,
        carbsGrams: entry.carbsGrams,
        alcoholGrams: entry.alcoholGrams,
        notes: entry.notes,
      };
      if (entry.quantity && entry.quantity > 0) {
        return foodService.update(date, entry.foodEntryId, { ...base, scaleByQuantity: true });
      }
      // No stored quantity: treat current macros as the amount for 1 unit
      return foodService.update(date, entry.foodEntryId, {
        ...base,
        caloriesKcal: round1(entry.caloriesKcal * qty),
        proteinGrams: round1(entry.proteinGrams * qty),
        fatGrams: round1(entry.fatGrams * qty),
        carbsGrams: round1(entry.carbsGrams * qty),
        alcoholGrams: round1(entry.alcoholGrams * qty),
        scaleByQuantity: false,
      });
    },
    onSuccess: () => {
      setQtyTarget(null);
      onChanged();
      toast('success', t('common.saved', 'Saved'));
    },
    onError: (err) => toast('error', extractApiError(err, saveError())),
  });

  return (
    <section>
      <Card padded={false} className="overflow-hidden">
        {entries.length === 0 ? (
          <EmptyState
            icon="meal"
            title={
              isToday
                ? t('today.no_meals_title', 'Nothing logged yet')
                : t('day.no_meals_title', 'No meals logged that day')
            }
            body={t('today.no_meals_body', 'Describe your meal in plain words and the AI fills in the macros for you.')}
            actionLabel={t('today.log_first_meal', 'Log a meal')}
            onAction={() => openLog('meal', date)}
          />
        ) : (
          <div className="divide-y divide-hairline/50">
            {entries.map((e) => (
              <MealRow
                key={e.foodEntryId}
                entry={e}
                onOpen={() => setSelected(e)}
                onQty={() => setQtyTarget(e)}
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

      {qtyTarget && (
        <QuickAmountSheet
          open
          onClose={() => setQtyTarget(null)}
          title={t('log.quantity', 'Quantity')}
          subtitle={qtyTarget.foodName}
          value={qtyTarget.quantity && qtyTarget.quantity > 0 ? qtyTarget.quantity : 1}
          min={0.1}
          step={qtyTarget.quantity && qtyTarget.quantity >= 1 ? 1 : 0.5}
          saving={quickQty.isPending}
          onSave={(qty) => quickQty.mutate({ entry: qtyTarget, qty })}
        />
      )}

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
          <QuantityField
            value={qty}
            min={0.1}
            step={qty >= 1 ? 1 : 0.5}
            onCommit={applyQty}
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
  /** Drives the empty state tense: still open today, closed on a past day */
  isToday: boolean;
  onChanged: () => void;
}

function ActivityRow({
  entry,
  hasCalorieEstimate,
  onOpen,
  onDuration,
}: {
  entry: ActivityEntryResponse;
  hasCalorieEstimate: boolean;
  onOpen: () => void;
  onDuration: () => void;
}) {
  const { t } = useTranslation();
  return (
    <ItemRow
      title={entry.activityName}
      value={
        hasCalorieEstimate ? (
          // The flame marks this as burned, so it is never read as calories eaten
          <span className="inline-flex items-center gap-1">
            <Icon name="flame" size={14} className="text-ink-3" />
            {t('today.kcal_value', '{{kcal}} kcal', { kcal: fmt(entry.calculatedCaloriesKcal) })}
          </span>
        ) : (
          '–'
        )
      }
      ariaLabel={t('today.entry_aria', '{{name}}, open options', { name: entry.activityName })}
      onOpen={onOpen}
      meta={
        // A watch import without duration has no minutes to show or edit.
        entry.durationMinutes !== null ? (
          <AmountChip
            label={t('today.duration_meta', '{{min}} min', {
              min: qtyStr(entry.durationMinutes),
            })}
            ariaLabel={t('today.change_duration_aria', 'Change duration of {{name}}', {
              name: entry.activityName,
            })}
            onEdit={onDuration}
          />
        ) : undefined
      }
    />
  );
}

export function ActivitiesList({ date, entries, hasCalorieEstimate, isToday, onChanged }: ActivitiesListProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { openLog } = useLogSheet();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<ActivityEntryResponse | null>(null);
  const [editing, setEditing] = useState<ActivityEntryResponse | null>(null);
  const [durationTarget, setDurationTarget] = useState<ActivityEntryResponse | null>(null);

  const saveError = () => t('log.save_error', 'Could not save. Check your connection and try again.');

  const del = useMutation({
    mutationFn: (entry: ActivityEntryResponse) =>
      activityService.remove(date, entry.activityEntryId),
    onSuccess: () => {
      onChanged();
      toast('success', t('today.deleted', 'Deleted'));
    },
    onError: (err) => toast('error', extractApiError(err, saveError())),
  });

  const saveTemplate = useMutation({
    mutationFn: (entry: ActivityEntryResponse) =>
      activityService.createTemplate({
        templateName: entry.activityName,
        autoAddToNewDay: false,
        defaultDurationMinutes: entry.durationMinutes ?? 30,
        defaultMET: entry.metValue ?? 3.5,
      }),
    onSuccess: () => {
      // The Templates screen must show the new template without a reload
      queryClient.invalidateQueries({ queryKey: queryKeys.activityTemplates() });
      toast('success', t('today.saved_as_template', 'Saved to Templates'));
    },
    onError: (err) => toast('error', extractApiError(err, saveError())),
  });

  // One-tap duration change: the server recalculates burned calories.
  const quickDuration = useMutation({
    mutationFn: ({ entry, minutes }: { entry: ActivityEntryResponse; minutes: number }) =>
      activityService.update(date, entry.activityEntryId, {
        activityName: entry.activityName,
        durationMinutes: minutes,
        metValue: entry.metValue,
      }),
    onSuccess: () => {
      setDurationTarget(null);
      onChanged();
      toast('success', t('common.saved', 'Saved'));
    },
    onError: (err) => toast('error', extractApiError(err, saveError())),
  });

  return (
    <section>
      <Card padded={false} className="overflow-hidden">
        {entries.length === 0 ? (
          <EmptyState
            icon="activity"
            title={
              isToday
                ? t('today.no_activities_title', 'No activity yet')
                : t('day.no_activities_title', 'No activity logged that day')
            }
            body={t('today.no_activities_body', 'Moving raises your budget. Log a walk, a workout, anything that got you moving.')}
            actionLabel={t('today.log_activity', 'Log activity')}
            onAction={() => openLog('activity', date)}
          />
        ) : (
          <div className="divide-y divide-hairline/50">
            {entries.map((a) => (
              <ActivityRow
                key={a.activityEntryId}
                entry={a}
                hasCalorieEstimate={hasCalorieEstimate}
                onOpen={() => setSelected(a)}
                onDuration={() => setDurationTarget(a)}
              />
            ))}
          </div>
        )}
      </Card>

      {entries.length > 0 && hasCalorieEstimate && (
        // Names what the numbers are so they are never misread as "extra"
        // calories: each figure is the total burn of that timeframe, resting
        // burn included, exactly like a smart watch reports it.
        <p className="mt-2 flex items-start gap-1.5 px-1 text-[12px] text-ink-3 leading-relaxed">
          <Icon name="info" size={13} className="shrink-0 mt-0.5" />
          {t('today.activities_gross_note', 'Each burn is the total for that activity, resting calories included, like a watch shows it.')}
        </p>
      )}

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

      {durationTarget && (
        <QuickAmountSheet
          open
          onClose={() => setDurationTarget(null)}
          title={t('log.duration', 'Duration')}
          subtitle={durationTarget.activityName}
          value={durationTarget.durationMinutes ?? 30}
          min={1}
          max={1440}
          step={5}
          suffix={t('common.min_suffix', 'min')}
          saving={quickDuration.isPending}
          onSave={(minutes) => quickDuration.mutate({ entry: durationTarget, minutes })}
        />
      )}

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
  // A watch import can have no MET at all; its stored calories are the truth.
  const isFlatBurn = entry.metValue === null;
  const [name, setName] = useState(entry.activityName);
  const [duration, setDuration] = useState(entry.durationMinutes ?? 30);
  const [met, setMet] = useState(String(entry.metValue ?? 3.5));
  const [kcal, setKcal] = useState(String(Math.round(entry.calculatedCaloriesKcal)));
  // Only an explicit calorie edit overrides; otherwise the server recalculates
  // from MET x weight x duration as usual. Flat-burn entries always send their
  // calories so a name edit can never silently rewrite the watch's number.
  const [kcalDirty, setKcalDirty] = useState(isFlatBurn);
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: () =>
      activityService.update(date, entry.activityEntryId, {
        activityName: name.trim(),
        durationMinutes: duration,
        // Out-of-range MET is omitted rather than rejected: on the calorie
        // path the server derives the real one from kcal and duration.
        metValue: num(met) >= 0.5 && num(met) <= 50 ? num(met) : null,
        caloriesKcal: kcalDirty ? num(kcal) : null,
      }),
    onSuccess: () => {
      onChanged();
      toast('success', t('common.saved', 'Saved'));
      onClose();
    },
    onError: (err) => setError(extractApiError(err, t('log.save_error', 'Could not save. Check your connection and try again.'))),
  });

  const m = num(met);
  const kc = num(kcal);
  const valid =
    name.trim().length > 0 &&
    duration > 0 &&
    (kcalDirty ? kc > 0 : m >= 0.5 && m <= 50);

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
          <QuantityField
            value={duration}
            min={1}
            max={1440}
            step={5}
            suffix={t('common.min_suffix', 'min')}
            onCommit={setDuration}
          />
        </div>
        <DecimalField
          label={t('log.met', 'Intensity (MET)')}
          hint={t('log.met_hint', 'How intense it is. A walk is about 3.5.')}
          value={met}
          onValueChange={(v) => {
            setMet(v);
            // Editing intensity hands the math back to the server.
            if (!isFlatBurn) setKcalDirty(false);
          }}
        />
        <DecimalField
          label={t('log.kcal_burned', 'Calories burned')}
          suffix="kcal"
          hint={t('log.kcal_burned_edit_hint', 'Total burn, resting included. Edit it to match your watch and the intensity adjusts.')}
          value={kcal}
          onValueChange={(v) => {
            setKcal(v);
            setKcalDirty(true);
          }}
        />
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
