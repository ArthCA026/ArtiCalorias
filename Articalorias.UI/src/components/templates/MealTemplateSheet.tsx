import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { AxiosError } from 'axios';
import { Sheet } from '@/components/ui/Sheet';
import { Button } from '@/components/ui/Button';
import { Field, DecimalField } from '@/components/ui/Field';
import { Stepper } from '@/components/ui/Stepper';
import { Switch } from '@/components/ui/Switch';
import { InlineError } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';
import { foodTemplateService } from '@/services/foodTemplateService';
import { queryKeys } from '@/lib/queryKeys';
import { extractApiError } from '@/utils/apiError';
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
}

/** Create or edit a meal template. Macros are stored per 1 portion. */
export function MealTemplateSheet({ template, onClose }: MealTemplateSheetProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [name, setName] = useState(template?.templateName ?? '');
  const [portion, setPortion] = useState(template?.portionDescription ?? '');
  const [qty, setQty] = useState(
    template && template.defaultQuantity > 0 ? template.defaultQuantity : 1,
  );
  const [kcal, setKcal] = useState(template ? String(template.caloriesKcal) : '');
  const [protein, setProtein] = useState(template ? String(template.proteinGrams) : '');
  const [fat, setFat] = useState(template ? String(template.fatGrams) : '');
  const [carbs, setCarbs] = useState(template ? String(template.carbsGrams) : '');
  const [alcohol, setAlcohol] = useState(template?.alcoholGrams ?? 0);
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
      setProtein(String(round1(food.proteinGrams / q)));
      setFat(String(round1(food.fatGrams / q)));
      setCarbs(String(round1(food.carbsGrams / q)));
      setAlcohol(round1(food.alcoholGrams / q));
    },
    onError: (err) => {
      if (err instanceof AxiosError && err.response?.status === 422) {
        setAiError(aiNothing);
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
        proteinGrams: num(protein),
        fatGrams: num(fat),
        carbsGrams: num(carbs),
        alcoholGrams: alcohol,
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
          <Stepper
            value={qty}
            step={0.5}
            min={0.5}
            onChange={setQty}
            decreaseLabel={t('templates.less', 'Less')}
            increaseLabel={t('templates.more', 'More')}
          />
        </div>
        <div>
          <p className="text-[13px] font-semibold text-ink-2">
            {t('templates.macros', 'Nutrition')}
          </p>
          <p className="text-[13px] text-ink-3 mb-1.5">{t('templates.per_portion', 'Per 1 portion')}</p>
          <div className="grid grid-cols-2 gap-3">
            <DecimalField
              label={t('templates.calories', 'Calories')}
              suffix="kcal"
              value={kcal}
              onValueChange={setKcal}
            />
            <DecimalField
              label={t('templates.protein', 'Protein')}
              suffix="g"
              value={protein}
              onValueChange={setProtein}
            />
            <DecimalField
              label={t('templates.fat', 'Fat')}
              suffix="g"
              value={fat}
              onValueChange={setFat}
            />
            <DecimalField
              label={t('templates.carbs', 'Carbs')}
              suffix="g"
              value={carbs}
              onValueChange={setCarbs}
            />
          </div>
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
      </div>
    </Sheet>
  );
}
