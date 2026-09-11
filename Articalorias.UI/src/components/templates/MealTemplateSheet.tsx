import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { AxiosError } from 'axios';
import { Sheet } from '@/components/ui/Sheet';
import { Button } from '@/components/ui/Button';
import { Field, DecimalField } from '@/components/ui/Field';
import { MacroFieldsGrid } from '@/components/ui/MacroFieldsGrid';
import { QuantityField } from '@/components/ui/QuantityField';
import { Switch } from '@/components/ui/Switch';
import { InlineError } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';
import { useMacros } from '@/hooks/useMacros';
import { useMacroPreferences } from '@/hooks/useMacroPreferences';
import { foodTemplateService } from '@/services/foodTemplateService';
import { queryKeys } from '@/lib/queryKeys';
import { extractApiError, isAiRateLimited } from '@/utils/apiError';
import {
  macroFieldsFrom,
  parseMacroFields,
  perUnitMacros,
  sortKeysByCatalog,
  trackedKeysFromPrefs,
} from '@/utils/macros';
import type { FoodTemplateResponse } from '@/types';

const round1 = (n: number) => Math.round(n * 10) / 10;
const num = (raw: string): number => {
  const n = Number(raw.replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};

interface MealTemplateSheetProps {
  /** null = create mode (shows the AI fill path) */
  template: FoodTemplateResponse | null;
  onClose: () => void;
  /** Edit mode only: hands deletion back to the list (confirm + routine info). */
  onDelete?: () => void;
}

/** Create or edit a meal template. Macros are stored per 1 portion. */
export function MealTemplateSheet({ template, onClose, onDelete }: MealTemplateSheetProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { coreKeys, get } = useMacros();
  const { data: prefs } = useMacroPreferences();

  // Core macros, whatever the user tracks right now, plus anything this
  // template already stores: a template saved with sugar keeps showing (and
  // keeping) sugar even after sugar tracking is switched off.
  const keys = useMemo(
    () =>
      sortKeysByCatalog(
        new Set([...coreKeys, ...trackedKeysFromPrefs(prefs), ...Object.keys(template?.macros ?? {})]),
        get,
      ),
    [coreKeys, prefs, template, get],
  );

  const [name, setName] = useState(template?.templateName ?? '');
  const [portion, setPortion] = useState(template?.portionDescription ?? '');
  const [qty, setQty] = useState(
    template && template.defaultQuantity > 0 ? template.defaultQuantity : 1,
  );
  const [kcal, setKcal] = useState(template ? String(template.caloriesKcal) : '');
  const [macros, setMacros] = useState<Record<string, string>>(() =>
    macroFieldsFrom(template?.macros ?? {}, keys),
  );
  const [autoAdd, setAutoAdd] = useState(template?.autoAddToNewDay ?? false);
  const [error, setError] = useState<string | null>(null);

  const [aiText, setAiText] = useState('');
  const [aiError, setAiError] = useState<string | null>(null);

  const aiNothing = t(
    'templates.ai_nothing',
    'Nothing recognizable there. Try adding amounts, like 200g rice.',
  );

  const ai = useMutation({
    mutationFn: (text: string) => foodTemplateService.parseFavoriteFood(text).then((r) => r.data),
    onSuccess: (data) => {
      const item = data.items.find((i) => i.type === 'food' && i.food !== null);
      const food = item?.food;
      if (!food) {
        setAiError(aiNothing);
        return;
      }
      // Parsed macros come already multiplied by quantity; store per-unit values.
      const q = food.quantity && food.quantity > 0 ? food.quantity : 1;
      setAiError(null);
      setName(food.foodName);
      if (food.portionDescription) setPortion(food.portionDescription);
      setQty(q);
      setKcal(String(round1(food.caloriesKcal / q)));
      setMacros(macroFieldsFrom(perUnitMacros(food.macros, q), keys));
    },
    onError: (err) => {
      if (err instanceof AxiosError && err.response?.status === 422) {
        setAiError(aiNothing);
      } else if (isAiRateLimited(err)) {
        setAiError(
          t('common.ai_rate_limited', "That's a lot of AI logging in a short time. Give it a minute and try again, or enter it manually."),
        );
      } else {
        setAiError(
          extractApiError(err, t('templates.save_error', 'Could not save. Check your connection and try again.')),
        );
      }
    },
  });

  const save = useMutation({
    mutationFn: () => {
      const data = {
        templateName: name.trim(),
        portionDescription: portion.trim() || t('templates.portion_default', '1 portion'),
        defaultQuantity: qty,
        caloriesKcal: num(kcal),
        // A blank core field is a real 0; any other blank stays "not captured".
        // Keys that showed up after mount (preferences loading late) are
        // merged in so a core macro is never missing from the saved map.
        macros: parseMacroFields({ ...macroFieldsFrom({}, keys), ...macros }, { zeroKeys: coreKeys }),
        autoAddToNewDay: autoAdd,
      };
      return template
        ? foodTemplateService.update(template.foodTemplateId, data)
        : foodTemplateService.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.foodTemplates() });
      queryClient.invalidateQueries({ queryKey: queryKeys.routines() });
      toast('success', t('templates.saved', 'Saved'));
      onClose();
    },
    onError: (err) =>
      setError(
        extractApiError(err, t('templates.save_error', 'Could not save. Check your connection and try again.')),
      ),
  });

  return (
    <Sheet
      open
      onClose={onClose}
      title={
        template
          ? t('templates.edit_meal', 'Edit meal template')
          : t('templates.new_meal', 'New meal template')
      }
    >
      <div className="space-y-3.5">
        {!template && (
          <>
            <Field
              label={t('templates.describe_it', 'Describe it')}
              placeholder={t('templates.describe_placeholder', 'Like 200g rice with a fried egg')}
              value={aiText}
              onChange={(e) => setAiText(e.target.value)}
              autoComplete="off"
            />
            <Button
              variant="soft"
              icon="sparkles"
              fullWidth
              loading={ai.isPending}
              disabled={aiText.trim().length === 0}
              onClick={() => {
                setAiError(null);
                ai.mutate(aiText.trim());
              }}
            >
              {t('templates.fill_ai', 'Fill with AI')}
            </Button>
            {aiError && <InlineError message={aiError} />}
            <div className="border-t border-hairline/60" />
          </>
        )}

        <Field
          label={t('templates.name', 'Name')}
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="off"
        />
        <Field
          label={t('templates.portion', 'Portion')}
          placeholder={t('templates.portion_placeholder', '1 cup, 100 g, 1 slice')}
          value={portion}
          onChange={(e) => setPortion(e.target.value)}
          autoComplete="off"
        />
        <div>
          <p className="text-[13px] font-semibold text-ink-2 mb-1.5">
            {t('templates.default_quantity', 'Default quantity')}
          </p>
          <QuantityField value={qty} onCommit={setQty} min={0.5} step={0.5} />
        </div>
        <div>
          <p className="text-[13px] font-semibold text-ink-2">
            {t('templates.macros', 'Nutrition')}
          </p>
          <p className="text-[13px] text-ink-3 mb-1.5">{t('templates.per_portion', 'Per 1 portion')}</p>
          <MacroFieldsGrid
            keys={keys}
            values={macros}
            onChange={(key, raw) => setMacros((prev) => ({ ...prev, [key]: raw }))}
            leading={
              <DecimalField
                label={t('templates.calories', 'Calories')}
                suffix="kcal"
                placeholder="0"
                value={kcal}
                onValueChange={setKcal}
              />
            }
          />
        </div>
        <div className="flex items-center justify-between gap-3 py-1">
          <span className="text-[15px] font-semibold text-ink">
            {t('templates.auto_add', 'Add automatically to each new day')}
          </span>
          <Switch
            checked={autoAdd}
            onChange={setAutoAdd}
            label={t('templates.auto_add', 'Add automatically to each new day')}
          />
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
        {template && onDelete && (
          <Button variant="ghost" size="md" fullWidth onClick={onDelete}>
            <span className="text-danger">{t('templates.delete_this', 'Delete this template')}</span>
          </Button>
        )}
      </div>
    </Sheet>
  );
}
