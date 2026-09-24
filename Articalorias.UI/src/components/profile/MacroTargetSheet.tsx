import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Sheet } from '@/components/ui/Sheet';
import { Button } from '@/components/ui/Button';
import { DecimalField } from '@/components/ui/Field';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Icon } from '@/components/ui/Icon';
import { InlineError } from '@/components/ui/States';
import { useMacros } from '@/hooks/useMacros';
import { getAgeProteinMinimum } from '@/config/proteinPresets';
import { formatMacroAmount, macroUnitSuffix, pickLabel, previewAutoTarget } from '@/utils/macros';
import { cn } from '@/utils/cn';
import type {
  MacroDefinition,
  MacroPreference,
  MacroTargetMode,
  UpdateMacroPreferenceItem,
  UserProfileResponse,
} from '@/types';

interface MacroTargetSheetProps {
  open: boolean;
  onClose: () => void;
  def: MacroDefinition;
  pref: MacroPreference;
  profile: UserProfileResponse | null | undefined;
  onSave: (item: UpdateMacroPreferenceItem) => void;
  saving: boolean;
}

const num = (raw: string): number | null => {
  if (raw.trim() === '') return null;
  const n = Number(raw.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};

/**
 * The target editor for ANY macro (protein presets, water auto, caffeine
 * limit, custom grams...). Auto shows the formula presets when the macro has
 * them, otherwise what the formula yields; Custom takes a number in the
 * macro unit, validated against the catalog range. Saving applies from
 * today; past days keep the targets they were lived under.
 */
export function MacroTargetSheet({ open, onClose, def, pref, profile, onSave, saving }: MacroTargetSheetProps) {
  const { t, i18n } = useTranslation();
  const { label } = useMacros();
  const name = label(def);
  const hasAuto = def.targetFormula.hasAutoTarget;
  const presets = def.autoPresets;

  const initialParam = () =>
    presets.find((p) => p.param === pref.autoParam)?.param ??
    presets.find((p) => p.param === def.targetFormula.defaultParam)?.param ??
    presets[0]?.param ??
    null;

  const [mode, setMode] = useState<MacroTargetMode>(pref.targetMode);
  const [param, setParam] = useState<number | null>(initialParam);
  const [custom, setCustom] = useState(
    pref.customTargetValue !== null ? String(Math.round(pref.customTargetValue)) : '',
  );
  const [error, setError] = useState<string | null>(null);

  // Re-derive on every open: the preference may have been saved since mount.
  /* eslint-disable react-hooks/set-state-in-effect -- bounded open-transition reset */
  useEffect(() => {
    if (!open) return;
    setMode(pref.targetMode);
    setParam(
      presets.find((p) => p.param === pref.autoParam)?.param ??
        presets.find((p) => p.param === def.targetFormula.defaultParam)?.param ??
        presets[0]?.param ??
        null,
    );
    setCustom(pref.customTargetValue !== null ? String(Math.round(pref.customTargetValue)) : '');
    setError(null);
  }, [open, pref.targetMode, pref.autoParam, pref.customTargetValue, presets, def.targetFormula.defaultParam]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const unit = macroUnitSuffix(def);
  const preview = (p: number) => previewAutoTarget(def, p, profile, getAgeProteinMinimum);
  const isPerKg = def.targetFormula.kind === 'perKgBodyWeight';
  const noWeight = isPerKg && (profile?.currentWeightKg ?? null) === null;

  const save = () => {
    if (mode === 'custom') {
      const v = num(custom);
      if (v === null || v < def.customTargetMin || v > def.customTargetMax) {
        setError(
          t('macros.custom_range_error', 'Enter a value between {{min}} and {{max}} {{unit}}.', {
            min: def.customTargetMin,
            max: def.customTargetMax,
            unit,
          }),
        );
        return;
      }
      onSave({ macroKey: def.key, isTracked: true, targetMode: 'custom', customTargetValue: v });
      return;
    }

    onSave({
      macroKey: def.key,
      isTracked: true,
      targetMode: 'auto',
      ...(def.targetFormula.hasAutoParam && param !== null ? { autoParam: param } : {}),
    });
  };

  return (
    <Sheet open={open} onClose={onClose} title={t('macros.target_sheet_title', '{{macro}} target', { macro: name })}>
      <SegmentedControl<MacroTargetMode>
        aria-label={t('macros.target_mode_aria', '{{macro}} target mode', { macro: name })}
        options={[
          { value: 'auto', label: hasAuto ? t('profile.mode_auto', 'Auto') : t('macros.mode_no_limit', 'No target') },
          { value: 'custom', label: t('macros.mode_custom', 'Custom') },
        ]}
        value={mode}
        onChange={(m) => {
          setMode(m);
          setError(null);
        }}
      />

      {mode === 'auto' && presets.length > 0 && (
        <div className="mt-3 space-y-2" role="radiogroup" aria-label={name}>
          {presets.map((p) => {
            const active = param === p.param;
            const grams = preview(p.param);
            const sub =
              (isPerKg ? t('macros.preset_per_kg', '{{param}} g/kg', { param: p.param }) : '') +
              (grams !== null ? ` ${t('macros.preset_equals', '= {{value}}', { value: formatMacroAmount(def, grams) })}` : '');
            return (
              <button
                key={p.id}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => {
                  setParam(p.param);
                  setError(null);
                }}
                className={cn(
                  'pressable w-full rounded-card px-4 py-3 text-left flex items-center gap-3',
                  active ? 'bg-primary-soft ring-2 ring-primary/60' : 'bg-inset',
                )}
              >
                <span className="flex-1 min-w-0">
                  <span className="text-[15px] font-bold text-ink">{pickLabel(p.labels.name, i18n.language, p.id)}</span>
                  {sub.trim() !== '' && <span className="block text-[12px] text-ink-2 mt-0.5">{sub.trim()}</span>}
                  <span className="block text-[12px] text-ink-3 mt-0.5 leading-snug">
                    {pickLabel(p.labels.description, i18n.language)}
                  </span>
                </span>
                {active && <Icon name="checkCircle" size={20} className="text-primary shrink-0" />}
              </button>
            );
          })}
        </div>
      )}

      {mode === 'auto' && presets.length === 0 && (
        <p className="mt-3 text-[13px] text-ink-3 leading-relaxed">
          {!hasAuto
            ? t('macros.no_formula_hint', 'Shows the amount only. Set a custom value if you want a limit to watch.')
            : pref.autoTargetValue !== null
              ? t('macros.auto_hint', 'Calculated from your profile: {{value}} per day. Updates when your weight or goal changes.', {
                  value: formatMacroAmount(def, pref.autoTargetValue),
                })
              : t('macros.target_pending', 'Activates once your body details are set.')}
        </p>
      )}

      {mode === 'auto' && noWeight && (
        <p className="mt-3 text-[13px] text-ink-3 leading-relaxed">
          {t('macros.no_weight_hint', 'No weight on your profile yet: the target switches on by itself the moment you add one.')}
        </p>
      )}

      {mode === 'custom' && (
        <div className="mt-3">
          <DecimalField
            label={t('macros.custom_label', 'Per day')}
            suffix={unit}
            placeholder={
              pref.autoTargetValue !== null ? String(Math.round(pref.autoTargetValue)) : String(def.customTargetMin)
            }
            value={custom}
            onValueChange={(v) => {
              setCustom(v);
              setError(null);
            }}
          />
        </div>
      )}

      {/* Any target the app derives for the user, goal or limit, is public-health guidance and
          not a prescription (kidney disease changes protein, bowel conditions change fibre...). */}
      {mode === 'auto' && def.targetFormula.hasAutoTarget && (
        <p className="mt-3 text-[12px] text-ink-3 leading-relaxed">
          {t('macros.guidance_disclaimer', 'General guidance, not medical advice. Pregnancy, medication and health conditions change what is right for you.')}
        </p>
      )}

      {error && <InlineError message={error} />}

      <Button variant="primary" size="lg" fullWidth className="mt-4" loading={saving} onClick={save}>
        {t('common.save', 'Save')}
      </Button>

      {pref.isTracked && (
        <Button
          variant="ghost"
          size="md"
          fullWidth
          className="mt-2"
          loading={saving}
          onClick={() => onSave({ macroKey: def.key, isTracked: false, targetMode: pref.targetMode })}
        >
          {t('macros.stop_tracking', 'Stop tracking {{macro}}', { macro: name.toLowerCase() })}
        </Button>
      )}
    </Sheet>
  );
}
