import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/Card';
import { Sheet } from '@/components/ui/Sheet';
import { ConfirmSheet } from '@/components/ui/ActionSheet';
import { Button } from '@/components/ui/Button';
import { Field, DecimalField } from '@/components/ui/Field';
import { QuantityField, QuickAmountSheet } from '@/components/ui/QuantityField';
import { MacroStrip, type MacroStripExtra } from '@/components/ui/MacroStrip';
import { ItemRow, ItemMeta } from '@/components/ui/ItemRow';
import { AmountChip } from '@/components/ui/AmountChip';
import { SelectionBar, type SelectionAction } from '@/components/ui/SelectionBar';
import { Icon } from '@/components/ui/Icon';
import { EmptyState, InlineError } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';
import { useLogSheet } from '@/components/log/LogSheetContext';
import { MarkFastingButton, FastingState } from '@/components/today/FastingControls';
import { foodService } from '@/services/foodService';
import { activityService } from '@/services/activityService';
import { foodTemplateService } from '@/services/foodTemplateService';
import { dailyLogService } from '@/services/dailyLogService';
import { queryKeys } from '@/lib/queryKeys';
import { extractApiError } from '@/utils/apiError';
import { fmt, round1, qtyStr, toDateString } from '@/utils/format';
import type { ActivityEntryResponse, FoodEntryResponse, MacroKey, UpdateFoodEntryRequest } from '@/types';

const num = (raw: string): number => {
  const n = Number(raw.replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};

/**
 * Interaction model shared by both lists (and mirrored on Templates):
 *  - one tap opens the item's edit sheet directly;
 *  - holding an item starts multi-select, then taps toggle;
 *  - the floating bar carries the bulk actions (save as templates, copy to
 *    today from a past day, delete) and the X leaves select mode.
 * Bulk deletes always confirm; a single delete lives inside the edit sheet.
 */

/**
 * Multi-select state. The set may hold ids of rows that have since been
 * deleted elsewhere; every consumer filters against the LIVE list, so stale
 * ids are inert rather than pruned (no state-sync effect needed).
 */
function useSelection<TId>() {
  const [ids, setIds] = useState<Set<TId> | null>(null);

  return {
    selecting: ids !== null,
    ids: ids ?? new Set<TId>(),
    start: (id: TId) => setIds(new Set([id])),
    toggle: (id: TId) =>
      setIds((prev) => {
        const next = new Set(prev ?? []);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      }),
    clear: () => setIds(null),
  };
}

/* ------------------------------------------------------------------ */
/* Meals                                                               */
/* ------------------------------------------------------------------ */

interface MealsListProps {
  date: string;
  entries: FoodEntryResponse[];
  /** Extra tracked macros (alcohol/sugar/water) appended to each row's strip */
  extraMacros?: MacroKey[];
  /** Drives the empty state tense: still open today, closed on a past day */
  isToday: boolean;
  /** The day is a marked deliberate fast (only meaningful when empty) */
  isFastingDay: boolean;
  onChanged: () => void;
}

function MealRow({
  entry,
  extraMacros,
  selectMode,
  selected,
  onTap,
  onLongPress,
  onQty,
}: {
  entry: FoodEntryResponse;
  extraMacros: MacroKey[];
  selectMode: boolean;
  selected: boolean;
  onTap: () => void;
  onLongPress: () => void;
  onQty: () => void;
}) {
  const { t } = useTranslation();
  const qty = entry.quantity && entry.quantity > 0 ? entry.quantity : 1;
  // Null stays null: an entry logged before a macro was tracked shows a dash,
  // never a fabricated zero.
  const extras: MacroStripExtra[] = extraMacros.map((key) => ({
    key,
    value:
      key === 'alcohol' ? entry.alcoholGrams : key === 'sugar' ? entry.sugarGrams : entry.waterMl,
  }));
  return (
    <ItemRow
      title={entry.foodName}
      value={t('today.kcal_value', '{{kcal}} kcal', { kcal: fmt(entry.caloriesKcal) })}
      ariaLabel={
        selectMode
          ? t('select.entry_aria', '{{name}}, toggle selection', { name: entry.foodName })
          : t('today.entry_tap_aria', '{{name}}, tap to edit, hold to select', { name: entry.foodName })
      }
      selectMode={selectMode}
      selected={selected}
      onTap={onTap}
      onLongPress={onLongPress}
      meta={
        <>
          {selectMode ? (
            <ItemMeta>{qtyStr(qty)}</ItemMeta>
          ) : (
            <AmountChip
              label={qtyStr(qty)}
              ariaLabel={t('today.change_qty_aria', 'Change quantity of {{name}}', {
                name: entry.foodName,
              })}
              onEdit={onQty}
            />
          )}
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
          extras={extras}
        />
      }
    />
  );
}

export function MealsList({ date, entries, extraMacros = [], isToday, isFastingDay, onChanged }: MealsListProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { openLog } = useLogSheet();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<FoodEntryResponse | null>(null);
  const [qtyTarget, setQtyTarget] = useState<FoodEntryResponse | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const sel = useSelection<number>();
  const selectedEntries = entries.filter((e) => sel.ids.has(e.foodEntryId));

  const saveError = () => t('log.save_error', 'Could not save. Check your connection and try again.');

  const toTemplateRequest = (entry: FoodEntryResponse) => {
    const qty = entry.quantity && entry.quantity > 0 ? entry.quantity : 1;
    return {
      templateName: entry.foodName,
      portionDescription: entry.portionDescription?.slice(0, 100) || t('today.portion_default', '1 serving'),
      defaultQuantity: qty,
      caloriesKcal: round1(entry.caloriesKcal / qty),
      proteinGrams: round1(entry.proteinGrams / qty),
      fatGrams: round1(entry.fatGrams / qty),
      carbsGrams: round1(entry.carbsGrams / qty),
      alcoholGrams: round1(entry.alcoholGrams / qty),
      sugarGrams: entry.sugarGrams !== null ? round1(entry.sugarGrams / qty) : null,
      waterMl: entry.waterMl !== null ? round1(entry.waterMl / qty) : null,
      autoAddToNewDay: false,
    };
  };

  const saveTemplates = useMutation({
    mutationFn: async (items: FoodEntryResponse[]) => {
      // Sequential on purpose: template creation is cheap and this keeps the
      // server-assigned ordering deterministic.
      for (const entry of items) await foodTemplateService.create(toTemplateRequest(entry));
      return items.length;
    },
    onSuccess: (n) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.foodTemplates() });
      sel.clear();
      toast('success', t('select.saved_templates', 'Saved to Templates ({{n}})', { n }));
    },
    onError: (err) => toast('error', extractApiError(err, saveError())),
  });

  // Copy a past day's meals onto today in one batch (single recalculation).
  const addToToday = useMutation({
    mutationFn: (items: FoodEntryResponse[]) =>
      dailyLogService.confirmParsedFoods(toDateString(), {
        items: items.map((e) => ({
          foodName: e.foodName,
          portionDescription: e.portionDescription,
          quantity: e.quantity,
          caloriesKcal: e.caloriesKcal,
          proteinGrams: e.proteinGrams,
          fatGrams: e.fatGrams,
          carbsGrams: e.carbsGrams,
          alcoholGrams: e.alcoholGrams,
          sugarGrams: e.sugarGrams,
          waterMl: e.waterMl,
          notes: e.notes,
        })),
      }),
    onSuccess: (_res, items) => {
      onChanged();
      sel.clear();
      toast('success', t('select.added_to_today', 'Added to today ({{n}})', { n: items.length }));
    },
    onError: (err) => toast('error', extractApiError(err, saveError())),
  });

  const deleteBatch = useMutation({
    mutationFn: (ids: number[]) => foodService.removeBatch(date, ids),
    onSuccess: () => {
      setConfirmingDelete(false);
      sel.clear();
      onChanged();
      toast('success', t('today.deleted', 'Deleted'));
    },
    onError: (err) => {
      setConfirmingDelete(false);
      toast('error', extractApiError(err, saveError()));
    },
  });

  const busy = saveTemplates.isPending || addToToday.isPending || deleteBatch.isPending;

  const selectionActions: SelectionAction[] = [
    {
      icon: 'bookmark',
      label: t('select.action_template', 'Template'),
      onSelect: () => saveTemplates.mutate(selectedEntries),
    },
    // Copying makes sense from a closed day ("log yesterday's lunch again");
    // on today itself it would only duplicate what is already there.
    ...(!isToday
      ? [
          {
            icon: 'copy' as const,
            label: t('select.action_add_today', 'To today'),
            onSelect: () => addToToday.mutate(selectedEntries),
          },
        ]
      : []),
    {
      icon: 'trash',
      label: t('common.delete', 'Delete'),
      destructive: true,
      onSelect: () => setConfirmingDelete(true),
    },
  ];

  return (
    <section>
      <Card padded={false} className="overflow-hidden">
        {entries.length === 0 && isFastingDay ? (
          <FastingState date={date} isToday={isToday} />
        ) : entries.length === 0 ? (
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
          >
            {/* The escape hatch for deliberate zero-intake days: without it, a
                real fast is indistinguishable from a day never tracked. */}
            <MarkFastingButton date={date} isToday={isToday} />
          </EmptyState>
        ) : (
          <div className="divide-y divide-hairline/50">
            {entries.map((e) => (
              <MealRow
                key={e.foodEntryId}
                entry={e}
                extraMacros={extraMacros}
                selectMode={sel.selecting}
                selected={sel.ids.has(e.foodEntryId)}
                onTap={() => (sel.selecting ? sel.toggle(e.foodEntryId) : setEditing(e))}
                onLongPress={() => (sel.selecting ? sel.toggle(e.foodEntryId) : sel.start(e.foodEntryId))}
                onQty={() => setQtyTarget(e)}
              />
            ))}
          </div>
        )}
      </Card>

      {!sel.selecting && entries.length > 0 && (
        <p className="mt-2 px-1 text-[12px] text-ink-3">
          {t('select.hint', 'Tap to edit. Hold to select several.')}
        </p>
      )}

      {sel.selecting && (
        <SelectionBar
          count={selectedEntries.length}
          actions={selectionActions}
          onClear={sel.clear}
          busy={busy}
        />
      )}

      <ConfirmSheet
        open={confirmingDelete}
        onClose={() => setConfirmingDelete(false)}
        title={t('select.delete_meals_title', 'Delete {{n}} meals?', { n: selectedEntries.length })}
        body={t('select.delete_meals_body', 'They are removed from this day and your totals update. This cannot be undone.')}
        confirmLabel={t('common.delete', 'Delete')}
        cancelLabel={t('common.cancel', 'Cancel')}
        loading={deleteBatch.isPending}
        onConfirm={() => deleteBatch.mutate(selectedEntries.map((e) => e.foodEntryId))}
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
          saving={false}
          onSave={(qty) => {
            quickQtySave(qtyTarget, qty);
          }}
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

  // One-tap quantity change. Uses the API's scale-by-quantity so the
  // server rescales every macro from the entry's stored base amount.
  function quickQtySave(entry: FoodEntryResponse, qty: number) {
    const base: UpdateFoodEntryRequest = {
      foodName: entry.foodName,
      portionDescription: entry.portionDescription,
      quantity: qty,
      caloriesKcal: entry.caloriesKcal,
      proteinGrams: entry.proteinGrams,
      fatGrams: entry.fatGrams,
      carbsGrams: entry.carbsGrams,
      alcoholGrams: entry.alcoholGrams,
      sugarGrams: entry.sugarGrams,
      waterMl: entry.waterMl,
      notes: entry.notes,
    };
    const request =
      entry.quantity && entry.quantity > 0
        ? foodService.update(date, entry.foodEntryId, { ...base, scaleByQuantity: true })
        : // No stored quantity: treat current macros as the amount for 1 unit
          foodService.update(date, entry.foodEntryId, {
            ...base,
            caloriesKcal: round1(entry.caloriesKcal * qty),
            proteinGrams: round1(entry.proteinGrams * qty),
            fatGrams: round1(entry.fatGrams * qty),
            carbsGrams: round1(entry.carbsGrams * qty),
            alcoholGrams: round1(entry.alcoholGrams * qty),
            sugarGrams: entry.sugarGrams !== null ? round1(entry.sugarGrams * qty) : null,
            waterMl: entry.waterMl !== null ? round1(entry.waterMl * qty) : null,
            scaleByQuantity: false,
          });
    request
      .then(() => {
        setQtyTarget(null);
        onChanged();
        toast('success', t('common.saved', 'Saved'));
      })
      .catch((err) => toast('error', extractApiError(err, saveError())));
  }
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
  const queryClient = useQueryClient();
  const [name, setName] = useState(entry.foodName);
  const [qty, setQty] = useState(entry.quantity && entry.quantity > 0 ? entry.quantity : 1);
  const [kcal, setKcal] = useState(String(entry.caloriesKcal));
  const [protein, setProtein] = useState(String(entry.proteinGrams));
  const [fat, setFat] = useState(String(entry.fatGrams));
  const [carbs, setCarbs] = useState(String(entry.carbsGrams));
  const [sugar, setSugar] = useState(entry.sugarGrams !== null ? String(entry.sugarGrams) : '');
  const [water, setWater] = useState(entry.waterMl !== null ? String(entry.waterMl) : '');
  const [error, setError] = useState<string | null>(null);

  // Only entries that carry the optional macros show their fields; an old
  // entry from before tracking keeps its honest "not captured" state.
  const hasSugar = entry.sugarGrams !== null;
  const hasWater = entry.waterMl !== null;

  // Changing quantity scales every macro proportionally (what you see is what is saved)
  const applyQty = (nextQty: number) => {
    const ratio = nextQty / qty;
    setQty(nextQty);
    setKcal((v) => String(round1(num(v) * ratio)));
    setProtein((v) => String(round1(num(v) * ratio)));
    setFat((v) => String(round1(num(v) * ratio)));
    setCarbs((v) => String(round1(num(v) * ratio)));
    if (hasSugar) setSugar((v) => String(round1(num(v) * ratio)));
    if (hasWater) setWater((v) => String(round1(num(v) * ratio)));
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
        sugarGrams: hasSugar ? num(sugar) : null,
        waterMl: hasWater ? num(water) : null,
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

  const del = useMutation({
    mutationFn: () => foodService.remove(date, entry.foodEntryId),
    onSuccess: () => {
      onChanged();
      toast('success', t('today.deleted', 'Deleted'));
      onClose();
    },
    onError: (err) => setError(extractApiError(err, t('log.save_error', 'Could not save. Check your connection and try again.'))),
  });

  // Templates what is ON SCREEN (unsaved edits included): what you see is
  // what gets saved. Macros are stored per 1 portion, so divide by quantity.
  const saveAsTemplate = useMutation({
    mutationFn: () => {
      const q = qty > 0 ? qty : 1;
      return foodTemplateService.create({
        templateName: name.trim() || entry.foodName,
        portionDescription:
          entry.portionDescription?.slice(0, 100) || t('today.portion_default', '1 serving'),
        defaultQuantity: q,
        caloriesKcal: round1(num(kcal) / q),
        proteinGrams: round1(num(protein) / q),
        fatGrams: round1(num(fat) / q),
        carbsGrams: round1(num(carbs) / q),
        alcoholGrams: round1(entry.alcoholGrams / q),
        sugarGrams: hasSugar ? round1(num(sugar) / q) : null,
        waterMl: hasWater ? round1(num(water) / q) : null,
        autoAddToNewDay: false,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.foodTemplates() });
      toast('success', t('today.saved_as_template', 'Saved to Templates'));
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
        {(hasSugar || hasWater) && (
          <div className="grid grid-cols-2 gap-3">
            {hasSugar && (
              <DecimalField label={t('log.sugar', 'Sugar')} suffix="g" value={sugar} onValueChange={setSugar} />
            )}
            {hasWater && (
              <DecimalField label={t('log.water', 'Water')} suffix="ml" value={water} onValueChange={setWater} />
            )}
          </div>
        )}
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
        <Button
          variant="soft"
          size="md"
          fullWidth
          icon="bookmark"
          loading={saveAsTemplate.isPending}
          disabled={name.trim().length === 0}
          onClick={() => saveAsTemplate.mutate()}
        >
          {t('today.save_as_template', 'Save as template')}
        </Button>
        <Button variant="ghost" size="md" fullWidth loading={del.isPending} onClick={() => del.mutate()}>
          <span className="text-danger">{t('today.delete_entry', 'Delete this meal')}</span>
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
  selectMode,
  selected,
  onTap,
  onLongPress,
  onDuration,
}: {
  entry: ActivityEntryResponse;
  hasCalorieEstimate: boolean;
  selectMode: boolean;
  selected: boolean;
  onTap: () => void;
  onLongPress: () => void;
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
      ariaLabel={
        selectMode
          ? t('select.entry_aria', '{{name}}, toggle selection', { name: entry.activityName })
          : t('today.entry_tap_aria', '{{name}}, tap to edit, hold to select', { name: entry.activityName })
      }
      selectMode={selectMode}
      selected={selected}
      onTap={onTap}
      onLongPress={onLongPress}
      meta={
        // A watch import without duration has no minutes to show or edit.
        entry.durationMinutes !== null ? (
          selectMode ? (
            <ItemMeta>
              {t('today.duration_meta', '{{min}} min', { min: qtyStr(entry.durationMinutes) })}
            </ItemMeta>
          ) : (
            <AmountChip
              label={t('today.duration_meta', '{{min}} min', {
                min: qtyStr(entry.durationMinutes),
              })}
              ariaLabel={t('today.change_duration_aria', 'Change duration of {{name}}', {
                name: entry.activityName,
              })}
              onEdit={onDuration}
            />
          )
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
  const [editing, setEditing] = useState<ActivityEntryResponse | null>(null);
  const [durationTarget, setDurationTarget] = useState<ActivityEntryResponse | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const sel = useSelection<number>();
  const selectedEntries = entries.filter((e) => sel.ids.has(e.activityEntryId));

  const saveError = () => t('log.save_error', 'Could not save. Check your connection and try again.');

  const saveTemplates = useMutation({
    mutationFn: async (items: ActivityEntryResponse[]) => {
      for (const entry of items)
        await activityService.createTemplate({
          templateName: entry.activityName,
          autoAddToNewDay: false,
          defaultDurationMinutes: entry.durationMinutes ?? 30,
          defaultMET: entry.metValue ?? 3.5,
        });
      return items.length;
    },
    onSuccess: (n) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.activityTemplates() });
      sel.clear();
      toast('success', t('select.saved_templates', 'Saved to Templates ({{n}})', { n }));
    },
    onError: (err) => toast('error', extractApiError(err, saveError())),
  });

  // Copy a past day's activities onto today (single recalculation). MET-based
  // entries re-derive their burn from today's weight; a flat watch import
  // keeps its stated calories, since no MET exists to recompute from.
  const addToToday = useMutation({
    mutationFn: (items: ActivityEntryResponse[]) =>
      dailyLogService.confirmParsedActivities(toDateString(), {
        items: items.map((e) => ({
          activityTemplateId: e.activityTemplateId,
          activityName: e.activityName,
          durationMinutes: e.durationMinutes,
          metValue: e.metValue,
          caloriesKcal: e.metValue === null ? e.calculatedCaloriesKcal : null,
        })),
      }),
    onSuccess: (_res, items) => {
      onChanged();
      sel.clear();
      toast('success', t('select.added_to_today', 'Added to today ({{n}})', { n: items.length }));
    },
    onError: (err) => toast('error', extractApiError(err, saveError())),
  });

  const deleteBatch = useMutation({
    mutationFn: (ids: number[]) => activityService.removeBatch(date, ids),
    onSuccess: () => {
      setConfirmingDelete(false);
      sel.clear();
      onChanged();
      toast('success', t('today.deleted', 'Deleted'));
    },
    onError: (err) => {
      setConfirmingDelete(false);
      toast('error', extractApiError(err, saveError()));
    },
  });

  const busy = saveTemplates.isPending || addToToday.isPending || deleteBatch.isPending;

  const selectionActions: SelectionAction[] = [
    {
      icon: 'bookmark',
      label: t('select.action_template', 'Template'),
      onSelect: () => saveTemplates.mutate(selectedEntries),
    },
    ...(!isToday
      ? [
          {
            icon: 'copy' as const,
            label: t('select.action_add_today', 'To today'),
            onSelect: () => addToToday.mutate(selectedEntries),
          },
        ]
      : []),
    {
      icon: 'trash',
      label: t('common.delete', 'Delete'),
      destructive: true,
      onSelect: () => setConfirmingDelete(true),
    },
  ];

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
                selectMode={sel.selecting}
                selected={sel.ids.has(a.activityEntryId)}
                onTap={() => (sel.selecting ? sel.toggle(a.activityEntryId) : setEditing(a))}
                onLongPress={() => (sel.selecting ? sel.toggle(a.activityEntryId) : sel.start(a.activityEntryId))}
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

      {sel.selecting && (
        <SelectionBar
          count={selectedEntries.length}
          actions={selectionActions}
          onClear={sel.clear}
          busy={busy}
        />
      )}

      <ConfirmSheet
        open={confirmingDelete}
        onClose={() => setConfirmingDelete(false)}
        title={t('select.delete_activities_title', 'Delete {{n}} activities?', { n: selectedEntries.length })}
        body={t('select.delete_activities_body', 'They are removed from this day and your burn updates. This cannot be undone.')}
        confirmLabel={t('common.delete', 'Delete')}
        cancelLabel={t('common.cancel', 'Cancel')}
        loading={deleteBatch.isPending}
        onConfirm={() => deleteBatch.mutate(selectedEntries.map((e) => e.activityEntryId))}
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
          saving={false}
          onSave={(minutes) => {
            activityService
              .update(date, durationTarget.activityEntryId, {
                activityName: durationTarget.activityName,
                durationMinutes: minutes,
                metValue: durationTarget.metValue,
              })
              .then(() => {
                setDurationTarget(null);
                onChanged();
                toast('success', t('common.saved', 'Saved'));
              })
              .catch((err) => toast('error', extractApiError(err, saveError())));
          }}
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
  const queryClient = useQueryClient();
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

  const del = useMutation({
    mutationFn: () => activityService.remove(date, entry.activityEntryId),
    onSuccess: () => {
      onChanged();
      toast('success', t('today.deleted', 'Deleted'));
      onClose();
    },
    onError: (err) => setError(extractApiError(err, t('log.save_error', 'Could not save. Check your connection and try again.'))),
  });

  // Templates what is ON SCREEN (unsaved edits included), like the meal sheet.
  const saveAsTemplate = useMutation({
    mutationFn: () =>
      activityService.createTemplate({
        templateName: name.trim() || entry.activityName,
        autoAddToNewDay: false,
        defaultDurationMinutes: duration > 0 ? duration : 30,
        defaultMET: num(met) >= 0.5 && num(met) <= 50 ? num(met) : 3.5,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.activityTemplates() });
      toast('success', t('today.saved_as_template', 'Saved to Templates'));
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
        <Button
          variant="soft"
          size="md"
          fullWidth
          icon="bookmark"
          loading={saveAsTemplate.isPending}
          disabled={name.trim().length === 0}
          onClick={() => saveAsTemplate.mutate()}
        >
          {t('today.save_as_template', 'Save as template')}
        </Button>
        <Button variant="ghost" size="md" fullWidth loading={del.isPending} onClick={() => del.mutate()}>
          <span className="text-danger">{t('today.delete_activity_entry', 'Delete this activity')}</span>
        </Button>
      </div>
    </Sheet>
  );
}
