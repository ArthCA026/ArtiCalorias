import { useState, useRef } from 'react';
import { DeleteConfirmDialog } from '@/components/DeleteConfirmDialog';
import { Toast, useToast } from '@/components/Toast';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { activityService } from '@/services/activityService';
import { foodService } from '@/services/foodService';
import { foodTemplateService } from '@/services/foodTemplateService';
import { toDateString } from '@/utils/format';
import { extractApiError } from '@/utils/apiError';
import TemplatePickerDialog from '@/components/TemplatePickerDialog';
import FavoritesTabSkeleton from '@/components/FavoritesTabSkeleton';
import AiProcessingCard from '@/components/AiProcessingCard';
import { useDelayedBoolean } from '@/hooks/useDelayedBoolean';
import EmptyState from '@/components/EmptyState';
import { IconEdit, IconTrash, IconCheck, IconX, IconSpinner } from '@/components/icons';
import { ModalShell } from '@/components/ModalShell';
import { ModalLabel, ModalTextInput, ModalNumberInput } from '@/components/ModalFormField';
import { ModalFormActions } from '@/components/ModalFormActions';
import { SegmentedTabs } from '@/components/SegmentedTabs';
import type {
  ActivityTemplateResponse,
  ActivityTemplateRequest,
  FoodTemplateResponse,
  CreateFoodTemplateRequest,
  UpdateFoodTemplateRequest,
  FavoriteRoutineResponse,
  CreateFavoriteRoutineRequest,
  CreateFavoriteRoutineItemRequest,
} from '@/types';

// --- Icon components ---

function IconPlus({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function IconChevronUp({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="18 15 12 9 6 15" />
    </svg>
  );
}

function IconChevronDown({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function Checkbox({ id, checked, onChange, label }: { id: string; checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label htmlFor={id} className="flex items-center gap-2 cursor-pointer text-sm text-gray-700 dark:text-gray-300">
      <input id={id} type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)}
        className="rounded border-gray-300 dark:border-gray-600 text-indigo-600 focus:ring-indigo-500" />
      {label}
    </label>
  );
}

// --- Tab definitions ---
type Tab = 'activities' | 'foods' | 'routines';

// ============================================================
// ACTIVITIES TAB
// ============================================================

interface ActivityFormState {
  templateName: string;
  durationMinutes: number | '';
  durationUnit: 'minutes' | 'hours';
  autoAddToNewDay: boolean;
  met: number | '';
}

const EMPTY_ACTIVITY_FORM: ActivityFormState = {
  templateName: '',
  durationMinutes: '',
  durationUnit: 'minutes',
  autoAddToNewDay: false,
  met: '',
};

function ActivitiesTab({ search, onToast }: { search: string; onToast: (msg: string, type: 'success' | 'error') => void }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const today = toDateString();

  const { data: templates = [], isLoading } = useQuery({
    queryKey: queryKeys.activityTemplates(),
    queryFn: () => activityService.getTemplates().then(r => r.data),
  });

  const [formOpen, setFormOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<ActivityFormState>(EMPTY_ACTIVITY_FORM);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [deleteAffectedRoutines, setDeleteAffectedRoutines] = useState<string[]>([]);
  const [deletePrefetching, setDeletePrefetching] = useState(false);
  const [quickAddStates, setQuickAddStates] = useState<Record<number, 'idle' | 'loading' | 'success' | 'error'>>({});
  const [estimatingMet, setEstimatingMet] = useState(false);

  const activeTemplates = templates.filter(t => t.isActive);
  const lowerSearch = search.toLowerCase();
  const filtered = activeTemplates.filter(t => t.templateName.toLowerCase().includes(lowerSearch));

  const saveMutation = useMutation({
    mutationFn: async () => {
      const durationMins = form.durationMinutes !== ''
        ? (form.durationUnit === 'hours' ? Number(form.durationMinutes) * 60 : Number(form.durationMinutes))
        : null;
      const req: ActivityTemplateRequest = {
        templateName: form.templateName.trim(),
        autoAddToNewDay: form.autoAddToNewDay,
        defaultDurationMinutes: durationMins,
        defaultMET: form.met !== '' ? Number(form.met) : null,
      };
      if (editId !== null) {
        return activityService.updateTemplate(editId, req);
      }
      return activityService.createTemplate(req);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.activityTemplates() });
      setFormOpen(false);
      setEditId(null);
      setForm(EMPTY_ACTIVITY_FORM);
      setFormError(null);
      setShowAdvanced(false);
    },
    onError: (err) => setFormError(extractApiError(err, t('favorites.activities.save_error'))),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => activityService.removeTemplate(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.activityTemplates() });
      setDeleteConfirmId(null);
      setDeleteAffectedRoutines([]);
    },
  });

  function startEdit(tmpl: ActivityTemplateResponse) {
    setEditId(tmpl.activityTemplateId);
    const durationMins = tmpl.defaultDurationMinutes ?? '';
    setForm({
      templateName: tmpl.templateName,
      durationMinutes: durationMins,
      durationUnit: 'minutes',
      autoAddToNewDay: tmpl.autoAddToNewDay,
      met: tmpl.defaultMET ?? '',
    });
    setShowAdvanced(false);
    setFormError(null);
    setFormOpen(true);
  }

  function cancelForm() {
    setFormOpen(false);
    setEditId(null);
    setForm(EMPTY_ACTIVITY_FORM);
    setFormError(null);
    setShowAdvanced(false);
  }

  async function handleEstimateMet() {
    const name = form.templateName.trim();
    if (!name) return;
    const durationMins = form.durationMinutes !== ''
      ? (form.durationUnit === 'hours' ? Number(form.durationMinutes) * 60 : Number(form.durationMinutes))
      : undefined;
    setEstimatingMet(true);
    try {
      const res = await activityService.estimateMet({ activityName: name, durationMinutes: durationMins ?? null });
      setForm(f => ({ ...f, met: res.data.metValue }));
    } catch { /* ignore */ }
    setEstimatingMet(false);
  }

  async function handleQuickAdd(tmpl: ActivityTemplateResponse) {
    setQuickAddStates(s => ({ ...s, [tmpl.activityTemplateId]: 'loading' }));
    try {
      await activityService.create(today, {
        activityTemplateId: tmpl.activityTemplateId,
        activityName: tmpl.templateName,
        durationMinutes: tmpl.defaultDurationMinutes ?? null,
        metValue: tmpl.defaultMET ?? null,
      });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard(today) });
      qc.invalidateQueries({ queryKey: queryKeys.historyAll() });
      setQuickAddStates(s => ({ ...s, [tmpl.activityTemplateId]: 'success' }));
      setTimeout(() => setQuickAddStates(s => ({ ...s, [tmpl.activityTemplateId]: 'idle' })), 2000);
      onToast(t('favorites.activities.quick_add_success', { name: tmpl.templateName }), 'success');
    } catch {
      setQuickAddStates(s => ({ ...s, [tmpl.activityTemplateId]: 'error' }));
      setTimeout(() => setQuickAddStates(s => ({ ...s, [tmpl.activityTemplateId]: 'idle' })), 2000);
      onToast(t('favorites.activities.quick_add_error', { name: tmpl.templateName }), 'error');
    }
  }

  function toggleAutoAdd(tmpl: ActivityTemplateResponse) {
    const newValue = !tmpl.autoAddToNewDay;
    activityService.updateTemplate(tmpl.activityTemplateId, {
      templateName: tmpl.templateName,
      autoAddToNewDay: newValue,
      defaultDurationMinutes: tmpl.defaultDurationMinutes,
      defaultMET: tmpl.defaultMET,
    }).then(() => {
      qc.invalidateQueries({ queryKey: queryKeys.activityTemplates() });
      onToast(t(newValue ? 'favorites.activities.toast_auto_add_on' : 'favorites.activities.toast_auto_add_off'), 'success');
    }).catch(() => {
      onToast(t('favorites.activities.toast_auto_add_error'), 'error');
    });
  }

  async function handleDeleteClick(templateId: number) {
    setDeletePrefetching(true);
    try {
      const { data } = await activityService.getRoutinesForActivityTemplate(templateId);
      setDeleteAffectedRoutines(data);
    } catch {
      setDeleteAffectedRoutines([]);
    } finally {
      setDeletePrefetching(false);
    }
    setDeleteConfirmId(templateId);
  }

  const showActivitySkeleton = useDelayedBoolean(isLoading, 300);

  if (showActivitySkeleton && isLoading) {
    return (
      <>
        <AiInputSection tab="activities" onToast={onToast} />
        <FavoritesTabSkeleton />
      </>
    );
  }

  return (
    <>
      <AiInputSection tab="activities" onToast={onToast} />
    <div className="space-y-4">
      {formOpen && (
        <ModalShell onClose={cancelForm}>
          <h3 className="text-sm font-semibold text-fg-primary">
            {editId !== null ? t('favorites.activities.edit_button') : t('favorites.activities.add_button')}
          </h3>
          <div>
            <ModalLabel htmlFor="act-name" text={t('favorites.activities.name_label')} />
            <ModalTextInput id="act-name" value={form.templateName} onChange={v => setForm(f => ({ ...f, templateName: v }))} required maxLength={150} />
          </div>
          <div>
            <ModalLabel htmlFor="act-duration" text={t('favorites.activities.duration_label')} />
            <div className="flex gap-2">
              <ModalNumberInput id="act-duration" value={form.durationMinutes} onChange={v => setForm(f => ({ ...f, durationMinutes: v }))} min="0" />
              <select
                value={form.durationUnit}
                onChange={e => {
                  const newUnit = e.target.value as 'minutes' | 'hours';
                  setForm(f => {
                    if (f.durationMinutes === '') return { ...f, durationUnit: newUnit };
                    const val = Number(f.durationMinutes);
                    const converted = newUnit === 'hours'
                      ? Math.round(val / 60 * 100) / 100
                      : Math.round(val * 60);
                    return { ...f, durationUnit: newUnit, durationMinutes: converted };
                  });
                }}
                className="rounded-md border border-input-border bg-input-bg text-fg-secondary px-2 py-1.5 text-sm focus:border-accent-soft focus:ring-1 focus:ring-accent-soft focus:outline-none"
              >
                <option value="minutes">min</option>
                <option value="hours">hr</option>
              </select>
            </div>
          </div>
          <Checkbox id="act-auto" checked={form.autoAddToNewDay} onChange={v => setForm(f => ({ ...f, autoAddToNewDay: v }))} label={t('favorites.activities.auto_add_label')} />
          <div>
            <button
              type="button"
              onClick={() => setShowAdvanced(v => !v)}
              className="flex items-center gap-1 text-xs font-medium text-fg-secondary hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
            >
              {showAdvanced ? <IconChevronUp className="w-3.5 h-3.5" /> : <IconChevronDown className="w-3.5 h-3.5" />}
              {t('dashboard.activity_advanced_options')}
            </button>
            {showAdvanced && (
              <div className="mt-2 rounded-md border border-border bg-surface-muted px-3 py-2.5 space-y-2">
                <ModalLabel htmlFor="act-met" text={t('favorites.activities.met_label')} />
                <div className="flex gap-2 items-center">
                  <ModalNumberInput id="act-met" value={form.met} onChange={v => setForm(f => ({ ...f, met: v }))} min="0.5" max="50" placeholder="Auto" />
                  <button
                    type="button"
                    onClick={handleEstimateMet}
                    disabled={estimatingMet || !form.templateName.trim()}
                    className="shrink-0 rounded-md bg-surface-subtle px-2.5 py-1.5 text-xs font-medium text-fg-secondary hover:bg-indigo-100 dark:hover:bg-indigo-900/40 disabled:opacity-50 transition-colors"
                  >
                    {estimatingMet ? <IconSpinner className="w-3.5 h-3.5" /> : t('favorites.activities.estimate_met_button')}
                  </button>
                </div>
              </div>
            )}
          </div>
          <ModalFormActions
            onSave={() => saveMutation.mutate()}
            onCancel={cancelForm}
            isPending={saveMutation.isPending}
            saveDisabled={!form.templateName.trim() || form.durationMinutes === '' || form.met === ''}
            formError={formError}
          />
        </ModalShell>
      )}

      {filtered.length > 0 && (
        <section>
          <div className="space-y-2">
            {filtered.map(tmpl => (
              <TemplateCard
                key={tmpl.activityTemplateId}
                title={tmpl.templateName}
                subtitle={tmpl.defaultDurationMinutes ? `${tmpl.defaultDurationMinutes} min` : undefined}
                autoAdd={tmpl.autoAddToNewDay}
                onToggleAutoAdd={() => toggleAutoAdd(tmpl)}
                onEdit={() => startEdit(tmpl)}
                onDelete={() => void handleDeleteClick(tmpl.activityTemplateId)}
                onQuickAdd={() => handleQuickAdd(tmpl)}
                quickAddState={quickAddStates[tmpl.activityTemplateId] ?? 'idle'}
              />
            ))}
          </div>
        </section>
      )}

      {filtered.length === 0 && search && !formOpen && (
        <EmptyState message={t('common.no_results')} />
      )}

      <DeleteConfirmDialog
        open={deleteConfirmId !== null}
        itemName={(() => {
          const tmpl = templates.find(t => t.activityTemplateId === deleteConfirmId);
          if (!tmpl) return undefined;
          return tmpl.defaultDurationMinutes ? `${tmpl.templateName} · ${tmpl.defaultDurationMinutes} min` : tmpl.templateName;
        })()}
        message={t('favorites.activities.delete_confirm')}
        affectedRoutines={deleteAffectedRoutines}
        onConfirm={() => { if (deleteConfirmId !== null) deleteMutation.mutate(deleteConfirmId); }}
        onClose={() => { setDeleteConfirmId(null); setDeleteAffectedRoutines([]); }}
        isPending={deleteMutation.isPending || deletePrefetching}
      />
    </div>
    </>
  );
}

// ============================================================
// FOODS TAB
// ============================================================

interface FoodFormState {
  templateName: string;
  portionDescription: string;
  defaultQuantity: number | '';
  caloriesKcal: number | '';
  proteinGrams: number | '';
  fatGrams: number | '';
  carbsGrams: number | '';
  alcoholGrams: number | '';
  autoAddToNewDay: boolean;
}

const EMPTY_FOOD_FORM: FoodFormState = {
  templateName: '',
  portionDescription: '',
  defaultQuantity: 1,
  caloriesKcal: '',
  proteinGrams: '',
  fatGrams: '',
  carbsGrams: '',
  alcoholGrams: '',
  autoAddToNewDay: false,
};

function FoodsTab({ search, onToast }: { search: string; onToast: (msg: string, type: 'success' | 'error') => void }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const today = toDateString();

  const { data: foodTemplates = [], isLoading } = useQuery({
    queryKey: queryKeys.foodTemplates(),
    queryFn: () => foodTemplateService.getAll().then(r => r.data),
  });

  const [formOpen, setFormOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<FoodFormState>(EMPTY_FOOD_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [deleteAffectedRoutines, setDeleteAffectedRoutines] = useState<string[]>([]);
  const [deletePrefetching, setDeletePrefetching] = useState(false);
  const [quickAddStates, setQuickAddStates] = useState<Record<number, 'idle' | 'loading' | 'success' | 'error'>>({});

  const active = foodTemplates.filter(t => t.isActive);
  const lowerSearch = search.toLowerCase();
  const filtered = active.filter(t => t.templateName.toLowerCase().includes(lowerSearch));

  const saveMutation = useMutation({
    mutationFn: async () => {
      const req: CreateFoodTemplateRequest | UpdateFoodTemplateRequest = {
        templateName: form.templateName.trim(),
        portionDescription: form.portionDescription.trim(),
        defaultQuantity: form.defaultQuantity !== '' ? Number(form.defaultQuantity) : 1,
        caloriesKcal: form.caloriesKcal !== '' ? Number(form.caloriesKcal) : 0,
        proteinGrams: form.proteinGrams !== '' ? Number(form.proteinGrams) : 0,
        fatGrams: form.fatGrams !== '' ? Number(form.fatGrams) : 0,
        carbsGrams: form.carbsGrams !== '' ? Number(form.carbsGrams) : 0,
        alcoholGrams: form.alcoholGrams !== '' ? Number(form.alcoholGrams) : 0,
        autoAddToNewDay: form.autoAddToNewDay,
      };
      if (editId !== null) return foodTemplateService.update(editId, req);
      return foodTemplateService.create(req);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.foodTemplates() });
      setFormOpen(false);
      setEditId(null);
      setForm(EMPTY_FOOD_FORM);
      setFormError(null);
    },
    onError: (err) => setFormError(extractApiError(err, t('favorites.foods.save_error'))),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => foodTemplateService.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.foodTemplates() });
      setDeleteConfirmId(null);
      setDeleteAffectedRoutines([]);
    },
  });

  function startEdit(tmpl: FoodTemplateResponse) {
    setEditId(tmpl.foodTemplateId);
    setForm({
      templateName: tmpl.templateName,
      portionDescription: tmpl.portionDescription,
      defaultQuantity: tmpl.defaultQuantity,
      caloriesKcal: tmpl.caloriesKcal,
      proteinGrams: tmpl.proteinGrams,
      fatGrams: tmpl.fatGrams,
      carbsGrams: tmpl.carbsGrams,
      alcoholGrams: tmpl.alcoholGrams,
      autoAddToNewDay: tmpl.autoAddToNewDay,
    });
    setFormError(null);
    setFormOpen(true);
  }

  function cancelForm() {
    setFormOpen(false);
    setEditId(null);
    setForm(EMPTY_FOOD_FORM);
    setFormError(null);
  }

  async function handleQuickAdd(tmpl: FoodTemplateResponse) {
    setQuickAddStates(s => ({ ...s, [tmpl.foodTemplateId]: 'loading' }));
    try {
      await foodService.create(today, {
        foodName: tmpl.templateName,
        portionDescription: tmpl.portionDescription,
        quantity: tmpl.defaultQuantity,
        caloriesKcal: tmpl.caloriesKcal,
        proteinGrams: tmpl.proteinGrams,
        fatGrams: tmpl.fatGrams,
        carbsGrams: tmpl.carbsGrams,
        alcoholGrams: tmpl.alcoholGrams,
      });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard(today) });
      qc.invalidateQueries({ queryKey: queryKeys.historyAll() });
      setQuickAddStates(s => ({ ...s, [tmpl.foodTemplateId]: 'success' }));
      setTimeout(() => setQuickAddStates(s => ({ ...s, [tmpl.foodTemplateId]: 'idle' })), 2000);
      onToast(t('favorites.foods.quick_add_success', { name: tmpl.templateName }), 'success');
    } catch {
      setQuickAddStates(s => ({ ...s, [tmpl.foodTemplateId]: 'error' }));
      setTimeout(() => setQuickAddStates(s => ({ ...s, [tmpl.foodTemplateId]: 'idle' })), 2000);
      onToast(t('favorites.foods.quick_add_error', { name: tmpl.templateName }), 'error');
    }
  }

  function toggleAutoAdd(tmpl: FoodTemplateResponse) {
    const newValue = !tmpl.autoAddToNewDay;
    foodTemplateService.update(tmpl.foodTemplateId, {
      templateName: tmpl.templateName,
      portionDescription: tmpl.portionDescription,
      defaultQuantity: tmpl.defaultQuantity,
      caloriesKcal: tmpl.caloriesKcal,
      proteinGrams: tmpl.proteinGrams,
      fatGrams: tmpl.fatGrams,
      carbsGrams: tmpl.carbsGrams,
      alcoholGrams: tmpl.alcoholGrams,
      autoAddToNewDay: newValue,
    }).then(() => {
      qc.invalidateQueries({ queryKey: queryKeys.foodTemplates() });
      onToast(t(newValue ? 'favorites.foods.toast_auto_add_on' : 'favorites.foods.toast_auto_add_off'), 'success');
    }).catch(() => {
      onToast(t('favorites.foods.toast_auto_add_error'), 'error');
    });
  }

  async function handleDeleteClick(templateId: number) {
    setDeletePrefetching(true);
    try {
      const { data } = await foodTemplateService.getRoutinesForFoodTemplate(templateId);
      setDeleteAffectedRoutines(data);
    } catch {
      setDeleteAffectedRoutines([]);
    } finally {
      setDeletePrefetching(false);
    }
    setDeleteConfirmId(templateId);
  }

  const showFoodSkeleton = useDelayedBoolean(isLoading, 300);

  if (showFoodSkeleton && isLoading) {
    return (
      <>
        <AiInputSection tab="foods" onToast={onToast} />
        <FavoritesTabSkeleton />
      </>
    );
  }

  const numberField = (id: keyof FoodFormState, label: string) => (
    <div>
      <ModalLabel htmlFor={`food-${id}`} text={label} />
      <ModalNumberInput
        id={`food-${id}`}
        value={form[id] as number | ''}
        onChange={v => setForm(f => ({ ...f, [id]: v }))}
        min="0"
      />
    </div>
  );

  return (
    <>
      <AiInputSection tab="foods" onToast={onToast} />
    <div className="space-y-4">
      {formOpen && (
        <ModalShell onClose={cancelForm}>
          <h3 className="text-sm font-semibold text-fg-primary">
            {editId !== null ? t('favorites.foods.edit_button') : t('favorites.foods.add_button')}
          </h3>
          <div>
            <ModalLabel htmlFor="food-name" text={t('favorites.foods.name_label')} />
            <ModalTextInput id="food-name" value={form.templateName} onChange={v => setForm(f => ({ ...f, templateName: v }))} required maxLength={150} />
          </div>
          <div>
            <ModalLabel htmlFor="food-portion" text={t('favorites.foods.portion_label')} />
            <ModalTextInput id="food-portion" value={form.portionDescription} onChange={v => setForm(f => ({ ...f, portionDescription: v }))} maxLength={100} />
          </div>
          <div>
            <ModalLabel htmlFor="food-quantity" text={t('favorites.foods.quantity_label')} />
            <ModalNumberInput id="food-quantity" value={form.defaultQuantity} onChange={v => setForm(f => ({ ...f, defaultQuantity: v }))} min="0.001" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            {numberField('caloriesKcal', t('favorites.foods.calories_label'))}
            {numberField('proteinGrams', t('favorites.foods.protein_label'))}
            {numberField('fatGrams', t('favorites.foods.fat_label'))}
            {numberField('carbsGrams', t('favorites.foods.carbs_label'))}
          </div>
          {numberField('alcoholGrams', t('favorites.foods.alcohol_label'))}
          <Checkbox id="food-auto" checked={form.autoAddToNewDay} onChange={v => setForm(f => ({ ...f, autoAddToNewDay: v }))} label={t('favorites.foods.auto_add_label')} />
          <ModalFormActions
            onSave={() => saveMutation.mutate()}
            onCancel={cancelForm}
            isPending={saveMutation.isPending}
            saveDisabled={!form.templateName.trim()}
            formError={formError}
          />
        </ModalShell>
      )}

      {filtered.length > 0 && (
        <div className="space-y-2">
          {filtered.map(tmpl => (
            <TemplateCard
              key={tmpl.foodTemplateId}
              title={tmpl.templateName}
              subtitle={`${tmpl.defaultQuantity} - ${tmpl.portionDescription} · ${tmpl.caloriesKcal} kcal`}
              autoAdd={tmpl.autoAddToNewDay}
              onToggleAutoAdd={() => toggleAutoAdd(tmpl)}
              onEdit={() => startEdit(tmpl)}
              onDelete={() => void handleDeleteClick(tmpl.foodTemplateId)}
              onQuickAdd={() => handleQuickAdd(tmpl)}
              quickAddState={quickAddStates[tmpl.foodTemplateId] ?? 'idle'}
            />
          ))}
        </div>
      )}

      {filtered.length === 0 && search && !formOpen && (
        <EmptyState message={t('common.no_results')} />
      )}

      <DeleteConfirmDialog
        open={deleteConfirmId !== null}
        itemName={(() => {
          const tmpl = foodTemplates.find(t => t.foodTemplateId === deleteConfirmId);
          if (!tmpl) return undefined;
          return `${tmpl.templateName} · ${tmpl.defaultQuantity}${tmpl.portionDescription ? ' ' + tmpl.portionDescription : ''} · ${Math.round(tmpl.caloriesKcal)} kcal`;
        })()}
        message={t('favorites.foods.delete_confirm')}
        affectedRoutines={deleteAffectedRoutines}
        onConfirm={() => { if (deleteConfirmId !== null) deleteMutation.mutate(deleteConfirmId); }}
        onClose={() => { setDeleteConfirmId(null); setDeleteAffectedRoutines([]); }}
        isPending={deleteMutation.isPending || deletePrefetching}
      />
    </div>
    </>
  );
}

// ============================================================
// ROUTINES TAB (P3)
// ============================================================

function RoutinesTab({ search, onToast }: { search: string; onToast: (msg: string, type: 'success' | 'error') => void }) {
  const { t } = useTranslation();
  const qc = useQueryClient();

  const { data: routines = [], isLoading: routinesLoading } = useQuery({
    queryKey: queryKeys.routines(),
    queryFn: () => foodTemplateService.getRoutines().then(r => r.data),
  });

  const { data: activityTemplates = [] } = useQuery({
    queryKey: queryKeys.activityTemplates(),
    queryFn: () => activityService.getTemplates().then(r => r.data),
  });

  const { data: foodTemplates = [] } = useQuery({
    queryKey: queryKeys.foodTemplates(),
    queryFn: () => foodTemplateService.getAll().then(r => r.data),
  });

  const [formOpen, setFormOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [routineName, setRoutineName] = useState('');
  const [items, setItems] = useState<CreateFavoriteRoutineItemRequest[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [routinePickerType, setRoutinePickerType] = useState<'activity' | 'food' | null>(null);
  const [addToTodayStates, setAddToTodayStates] = useState<Record<number, 'idle' | 'loading' | 'success' | 'error'>>({});
  const [skippedNotice, setSkippedNotice] = useState<Record<number, number>>({});

  const lowerSearch = search.toLowerCase();
  const filtered = routines.filter(r => r.routineName.toLowerCase().includes(lowerSearch));

  const saveMutation = useMutation({
    mutationFn: async () => {
      const req: CreateFavoriteRoutineRequest = { routineName: routineName.trim(), items };
      if (editId !== null) return foodTemplateService.updateRoutine(editId, req);
      return foodTemplateService.createRoutine(req);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.routines() });
      setFormOpen(false);
      setEditId(null);
      setRoutineName('');
      setItems([]);
      setFormError(null);
    },
    onError: (err) => setFormError(extractApiError(err, t('favorites.routines.save_error'))),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => foodTemplateService.removeRoutine(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.routines() });
      setDeleteConfirmId(null);
    },
  });

  function startEdit(r: FavoriteRoutineResponse) {
    setEditId(r.favoriteRoutineId);
    setRoutineName(r.routineName);
    setItems(r.items.map(i => ({
      itemType: i.itemType,
      activityTemplateId: i.activityTemplate?.activityTemplateId ?? null,
      foodTemplateId: i.foodTemplate?.foodTemplateId ?? null,
      sortOrder: i.sortOrder,
    })));
    setFormError(null);
    setFormOpen(true);
  }

  function addActivityItem(activityTemplateId: number) {
    setItems(prev => [...prev, { itemType: 'activity', activityTemplateId, foodTemplateId: null, sortOrder: prev.length }]);
  }

  function addFoodItem(foodTemplateId: number) {
    setItems(prev => [...prev, { itemType: 'food', activityTemplateId: null, foodTemplateId, sortOrder: prev.length }]);
  }

  function removeItem(idx: number) {
    setItems(prev => prev.filter((_, i) => i !== idx).map((item, i) => ({ ...item, sortOrder: i })));
  }

  function itemLabel(item: CreateFavoriteRoutineItemRequest): string {
    if (item.itemType === 'activity') {
      return activityTemplates.find(t => t.activityTemplateId === item.activityTemplateId)?.templateName ?? '€“';
    }
    return foodTemplates.find(t => t.foodTemplateId === item.foodTemplateId)?.templateName ?? '€“';
  }

  function itemMeta(item: CreateFavoriteRoutineItemRequest): string | undefined {
    if (item.itemType === 'activity') {
      const tmpl = activityTemplates.find(t => t.activityTemplateId === item.activityTemplateId);
      return tmpl?.defaultDurationMinutes ? `${tmpl.defaultDurationMinutes} min` : undefined;
    }
    const tmpl = foodTemplates.find(t => t.foodTemplateId === item.foodTemplateId);
    if (!tmpl) return undefined;
    return `${tmpl.defaultQuantity}${tmpl.portionDescription ? ' ' + tmpl.portionDescription : ''} · ${Math.round(tmpl.caloriesKcal)} kcal`;
  }

  async function handleAddToToday(r: FavoriteRoutineResponse) {
    setAddToTodayStates(s => ({ ...s, [r.favoriteRoutineId]: 'loading' }));
    try {
      const res = await foodTemplateService.addRoutineToToday(r.favoriteRoutineId);
      qc.invalidateQueries({ queryKey: queryKeys.dashboard(toDateString()) });
      qc.invalidateQueries({ queryKey: queryKeys.historyAll() });
      if (res.data.skippedItems.length > 0) {
        setSkippedNotice(s => ({ ...s, [r.favoriteRoutineId]: res.data.skippedItems.length }));
        setTimeout(() => setSkippedNotice(s => { const n = { ...s }; delete n[r.favoriteRoutineId]; return n; }), 5000);
        onToast(t('favorites.routines.skipped_notice', { count: res.data.skippedItems.length }), 'success');
      } else {
        onToast(t('favorites.routines.quick_add_success'), 'success');
      }
      setAddToTodayStates(s => ({ ...s, [r.favoriteRoutineId]: 'success' }));
      setTimeout(() => setAddToTodayStates(s => ({ ...s, [r.favoriteRoutineId]: 'idle' })), 2000);
    } catch {
      setAddToTodayStates(s => ({ ...s, [r.favoriteRoutineId]: 'error' }));
      setTimeout(() => setAddToTodayStates(s => ({ ...s, [r.favoriteRoutineId]: 'idle' })), 2000);
      onToast(t('favorites.routines.quick_add_error'), 'error');
    }
  }

  const showRoutinesSkeleton = useDelayedBoolean(routinesLoading, 300);

  if (showRoutinesSkeleton && routinesLoading) {
    return <FavoritesTabSkeleton />;
  }

  const activeActivities = activityTemplates.filter(t => t.isActive);
  const activeFoods = foodTemplates.filter(t => t.isActive);

  return (
    <div className="space-y-4">
      {formOpen && (
        <ModalShell onClose={() => { setFormOpen(false); setEditId(null); setRoutineName(''); setItems([]); setFormError(null); }}>
          <h3 className="text-sm font-semibold text-fg-primary">
            {editId !== null ? t('common.edit') : t('favorites.routines.add_button')}
          </h3>
          <div>
            <ModalLabel htmlFor="routine-name" text={t('favorites.routines.name_label')} />
            <ModalTextInput id="routine-name" value={routineName} onChange={setRoutineName} required maxLength={150} />
          </div>

          {/* Items list */}
          {items.length > 0 && (
            <div className="space-y-2">
              {items.map((item, idx) => {
                const meta = itemMeta(item);
                return (
                  <div key={idx} className="flex items-center gap-3 rounded-xl border border-border bg-input-bg px-3 py-2.5">
                    <span className={`shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide ${
                      item.itemType === 'activity'
                        ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-300'
                        : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300'
                    }`}>
                      {item.itemType === 'activity' ? t('favorites.routines.activities_section').slice(0, 3) : t('favorites.routines.foods_section').slice(0, 4)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-fg-primary truncate">{itemLabel(item)}</p>
                      {meta && <p className="text-xs text-fg-subtle truncate">{meta}</p>}
                    </div>
                    <button
                      onClick={() => removeItem(idx)}
                      className="shrink-0 -mr-1 rounded-lg p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                      aria-label="Remove"
                    >
                      <IconX className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Add item pickers */}
          <div className="space-y-2">
            <ModalLabel htmlFor="routine-add-activity" text={t('favorites.routines.add_items_label')} />
            <div className="flex gap-2">
              {activeActivities.length > 0 && (
                <button
                  onClick={() => setRoutinePickerType('activity')}
                  className="flex-1 rounded-xl border border-indigo-300 dark:border-indigo-700 bg-input-bg px-3 py-2.5 text-sm text-indigo-700 dark:text-indigo-300 font-medium hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors text-center"
                >
                  {t('favorites.routines.pick_activity')}
                </button>
              )}
              {activeFoods.length > 0 && (
                <button
                  onClick={() => setRoutinePickerType('food')}
                  className="flex-1 rounded-xl border border-emerald-300 dark:border-emerald-700 bg-input-bg px-3 py-2.5 text-sm text-emerald-700 dark:text-emerald-300 font-medium hover:bg-emerald-50 dark:hover:bg-emerald-900/30 transition-colors text-center"
                >
                  {t('favorites.routines.pick_food')}
                </button>
              )}
            </div>
          </div>

          <TemplatePickerDialog
            open={routinePickerType !== null}
            title={routinePickerType === 'activity' ? t('favorites.routines.pick_activity') : t('favorites.routines.pick_food')}
            items={
              routinePickerType === 'activity'
                ? activeActivities.map(a => ({
                    id: a.activityTemplateId,
                    label: a.templateName,
                    meta: a.defaultDurationMinutes ? `${a.defaultDurationMinutes} min` : undefined,
                  }))
                : activeFoods.map(f => ({
                    id: f.foodTemplateId,
                    label: f.templateName,
                    meta: `${f.defaultQuantity}${f.portionDescription ? ' ' + f.portionDescription : ''} · ${Math.round(f.caloriesKcal)} kcal`,
                  }))
            }
            onSelect={id => routinePickerType === 'activity' ? addActivityItem(id) : addFoodItem(id)}
            onClose={() => setRoutinePickerType(null)}
          />

          <ModalFormActions
            onSave={() => saveMutation.mutate()}
            onCancel={() => { setFormOpen(false); setEditId(null); setRoutineName(''); setItems([]); setFormError(null); }}
            isPending={saveMutation.isPending}
            saveDisabled={!routineName.trim()}
            formError={formError}
            fullWidthSave
          />
        </ModalShell>
      )}

      {!formOpen && (
        <button
          onClick={() => { setEditId(null); setRoutineName(''); setItems([]); setFormOpen(true); }}
          className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-indigo-300 dark:border-indigo-700 px-3 py-2 text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"
        >
          <IconPlus className="w-3.5 h-3.5" />
          {t('favorites.routines.add_button')}
        </button>
      )}

      {filtered.length === 0 && !formOpen && (
        <EmptyState message={t('favorites.routines.empty')} />
      )}

      {filtered.map(r => {
        const foodItems = r.items.filter(i => i.itemType === 'food');
        const activityItems = r.items.filter(i => i.itemType === 'activity');
        return (
          <div key={r.favoriteRoutineId} className="rounded-xl border border-border bg-surface p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h4 className="font-semibold text-fg-primary text-sm">{r.routineName}</h4>
              <div className="flex gap-1">
                <button onClick={() => startEdit(r)} title={t('common.edit')} className="rounded-md p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/40 transition-colors">
                  <IconEdit className="w-4 h-4" />
                </button>
                <button onClick={() => setDeleteConfirmId(r.favoriteRoutineId)} title={t('common.delete')} className="rounded-md p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors">
                  <IconTrash className="w-4 h-4" />
                </button>
              </div>
            </div>

            {r.items.length > 0 && (
              <div className="space-y-2.5">
                {foodItems.length > 0 && (
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400 mb-1.5">
                      {t('favorites.routines.foods_section')}
                    </p>
                    <ul className="space-y-1">
                      {foodItems.map(item => {
                        const ft = item.foodTemplate;
                        return (
                          <li key={item.favoriteRoutineItemId} className="flex items-baseline justify-between gap-2">
                            <span className="text-sm text-gray-700 dark:text-gray-300 truncate">{ft?.templateName ?? '€“'}</span>
                            {ft && (
                              <span className="text-xs text-fg-subtle shrink-0 whitespace-nowrap">
                                {ft.defaultQuantity}{ft.portionDescription ? ` ${ft.portionDescription}` : ''} · {Math.round(ft.caloriesKcal)} kcal
                              </span>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
                {foodItems.length > 0 && activityItems.length > 0 && (
                  <hr className="border-surface-subtle" />
                )}
                {activityItems.length > 0 && (
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-indigo-600 dark:text-indigo-400 mb-1.5">
                      {t('favorites.routines.activities_section')}
                    </p>
                    <ul className="space-y-1">
                      {activityItems.map(item => {
                        const at = item.activityTemplate;
                        return (
                          <li key={item.favoriteRoutineItemId} className="flex items-baseline justify-between gap-2">
                            <span className="text-sm text-gray-700 dark:text-gray-300 truncate">{at?.templateName ?? '€“'}</span>
                            {at?.defaultDurationMinutes != null && (
                              <span className="text-xs text-fg-subtle shrink-0 whitespace-nowrap">
                                {at.defaultDurationMinutes} min
                              </span>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleAddToToday(r)}
                disabled={addToTodayStates[r.favoriteRoutineId] === 'loading'}
                className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors"
              >
                {addToTodayStates[r.favoriteRoutineId] === 'loading' ? <IconSpinner className="w-3.5 h-3.5" /> :
                 addToTodayStates[r.favoriteRoutineId] === 'success' ? <IconCheck className="w-3.5 h-3.5" /> : null}
                {t('favorites.routines.add_to_today_button')}
              </button>
              {addToTodayStates[r.favoriteRoutineId] === 'error' && (
                <span className="text-xs text-red-500">{t('favorites.routines.quick_add_error')}</span>
              )}
              {skippedNotice[r.favoriteRoutineId] !== undefined && (
                <span className="text-xs text-amber-600 dark:text-amber-400">
                  {t('favorites.routines.skipped_notice', { count: skippedNotice[r.favoriteRoutineId] })}
                </span>
              )}
            </div>
          </div>
        );
      })}

      <DeleteConfirmDialog
        open={deleteConfirmId !== null}
        itemName={routines.find(r => r.favoriteRoutineId === deleteConfirmId)?.routineName}
        message={t('favorites.routines.delete_confirm')}
        onConfirm={() => { if (deleteConfirmId !== null) deleteMutation.mutate(deleteConfirmId); }}
        onClose={() => setDeleteConfirmId(null)}
        isPending={deleteMutation.isPending}
      />
    </div>
  );
}

// ============================================================
// AI INPUT SECTION (T035)
// ============================================================

function AiInputSection({ tab, onToast }: { tab: 'activities' | 'foods'; onToast: (msg: string, type: 'success' | 'error') => void }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  async function handleParse() {
    const trimmed = text.trim();
    if (!trimmed) return;
    setLoading(true);
    setError(null);
    try {
      const res = tab === 'foods'
        ? await foodTemplateService.parseFavoriteFood(trimmed)
        : await foodTemplateService.parseFavoriteActivity(trimmed);
      // Dedicated endpoints only return the matching type €” no client-side filter needed
      const items = res.data.items;
      if (items.length === 0) {
        setError(t('favorites.ai_input.no_results'));
        return;
      }
      // Auto-save all parsed items immediately €” no confirmation gate (Constitution V)
      await Promise.allSettled(
        items.map(item =>
          item.type === 'activity' && item.activity
            ? activityService.createTemplate({
                templateName: item.activity.activityName,
                autoAddToNewDay: false,
                defaultDurationMinutes: item.activity.durationMinutes,
                defaultMET: item.activity.metValue,
              })
            : item.food
            ? foodTemplateService.create({
                templateName: item.food.foodName,
                portionDescription: item.food.portionDescription ?? '',
                defaultQuantity: item.food.quantity ?? 1,
                caloriesKcal: item.food.caloriesKcal,
                proteinGrams: item.food.proteinGrams,
                fatGrams: item.food.fatGrams,
                carbsGrams: item.food.carbsGrams,
                alcoholGrams: item.food.alcoholGrams,
                autoAddToNewDay: false,
              })
            : Promise.resolve()
        )
      );
      if (tab === 'activities') qc.invalidateQueries({ queryKey: queryKeys.activityTemplates() });
      else qc.invalidateQueries({ queryKey: queryKeys.foodTemplates() });
      onToast(t('favorites.ai_input.saved_count', { count: items.length }), 'success');
      setText('');
    } catch (err) {
      setError(extractApiError(err, t('favorites.ai_input.parse_error')));
    } finally {
      setLoading(false);
    }
  }

  const placeholder = t(
    tab === 'foods'
      ? 'favorites.ai_input.placeholder_foods'
      : 'favorites.ai_input.placeholder_activities'
  );

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 space-y-3">
      <div className="flex gap-2 items-start">
        <textarea
          ref={textareaRef}
          rows={2}
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleParse(); } }}
          placeholder={placeholder}
          aria-label={placeholder}
          className="flex-1 resize-none rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50/50 dark:bg-gray-800/50 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-indigo-500 focus:bg-white dark:focus:bg-gray-800 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none transition-colors"
        />
        <button
          onClick={handleParse}
          disabled={loading || !text.trim()}
          className="shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-full bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors"
        >
          {loading ? <IconSpinner className="w-4 h-4" /> : <IconPlus className="w-4 h-4" />}
        </button>
      </div>
      {error && <p className="text-sm text-red-600 dark:text-red-400" role="alert">{error}</p>}
      {loading && <AiProcessingCard context={tab === 'activities' ? 'activity' : 'food'} className="mt-2" />}
    </div>
  );
}

// ============================================================
// TEMPLATE CARD (shared between activities and foods)
// ============================================================

interface TemplateCardProps {
  title: string;
  subtitle?: string;
  autoAdd: boolean;
  onToggleAutoAdd: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onQuickAdd: () => void;
  quickAddState: 'idle' | 'loading' | 'success' | 'error';
  confirmDelete?: boolean;
  onConfirmDelete?: () => void;
  onCancelDelete?: () => void;
  deleteLabel?: string;
  isSystem?: boolean;
}

function TemplateCard({
  title, subtitle, autoAdd, onToggleAutoAdd, onEdit, onDelete, onQuickAdd, quickAddState,
  isSystem,
}: TemplateCardProps) {
  const { t } = useTranslation();

  return (
    <div className="rounded-lg border border-surface-subtle bg-surface px-3 py-2.5 shadow-sm">
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-fg-primary truncate">{title}</p>
          {subtitle && <p className="text-xs text-fg-subtle truncate">{subtitle}</p>}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {/* Auto-add toggle */}
          <button
            onClick={onToggleAutoAdd}
            title={t('favorites.activities.auto_add_label')}
            className={`rounded p-1 text-xs transition-colors ${autoAdd ? 'text-indigo-600 bg-indigo-50 dark:bg-indigo-900/40' : 'text-gray-300 dark:text-gray-600 hover:text-gray-500'}`}
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill={autoAdd ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </button>

          {/* Quick-add + */}
          <button
            onClick={onQuickAdd}
            disabled={quickAddState === 'loading'}
            title={t('favorites.activities.quick_add_aria', { name: title })}
            aria-label={t('favorites.activities.quick_add_aria', { name: title })}
            className={`rounded-md p-1.5 transition-colors ${
              quickAddState === 'success' ? 'text-green-600 bg-green-50 dark:bg-green-900/40' :
              quickAddState === 'error' ? 'text-red-500 bg-red-50 dark:bg-red-900/40' :
              'text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/40'
            } disabled:opacity-50`}
          >
            {quickAddState === 'loading' ? <IconSpinner className="w-4 h-4" /> :
             quickAddState === 'success' ? <IconCheck className="w-4 h-4" /> :
             <IconPlus className="w-4 h-4" />}
          </button>

          {/* Edit (user only) */}
          {!isSystem && onEdit && (
            <button onClick={onEdit} title={t('common.edit')} className="rounded-md p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/40 transition-colors">
              <IconEdit className="w-4 h-4" />
            </button>
          )}

          {/* Delete (user only) */}
          {!isSystem && onDelete && (
            <button onClick={onDelete} title={t('common.delete')} className="rounded-md p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors">
              <IconTrash className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// MAIN PAGE
// ============================================================

export default function FavoritesPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>('activities');
  const [search, setSearch] = useState('');
  const { toast, exiting, showToast } = useToast();

  function handleTabChange(newTab: Tab) {
    setTab(newTab);
    setSearch('');
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'activities', label: t('favorites.activities.tab_label') },
    { key: 'foods', label: t('favorites.foods.tab_label') },
    { key: 'routines', label: t('favorites.routines.tab_label') },
  ];

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 pb-24 space-y-5">
      {/* Search */}
      <div>
        <input
          type="search"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={t('favorites.search_placeholder')}
          aria-label={t('favorites.search_placeholder')}
          className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50/50 dark:bg-gray-800/50 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-indigo-500 focus:bg-white dark:focus:bg-gray-800 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none transition-colors"
        />
      </div>

      {/* Tab bar */}
      <SegmentedTabs
        variant="pill"
        tabs={tabs}
        activeTab={tab}
        onChange={key => handleTabChange(key as Tab)}
      />

      {/* Tab content */}
      {tab === 'activities' && <ActivitiesTab search={search} onToast={showToast} />}
      {tab === 'foods' && <FoodsTab search={search} onToast={showToast} />}
      {tab === 'routines' && <RoutinesTab search={search} onToast={showToast} />}
      {toast && <Toast message={toast.message} type={toast.type} exiting={exiting} />}
    </div>
  );
}


