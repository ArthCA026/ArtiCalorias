import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Sheet } from '@/components/ui/Sheet';
import { Button } from '@/components/ui/Button';
import { DecimalField } from '@/components/ui/Field';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Switch } from '@/components/ui/Switch';
import { Icon } from '@/components/ui/Icon';
import { InlineError } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';
import { useMacroPreferences, useUpdateMacroPreferences } from '@/hooks/useMacroPreferences';
import { MACRO_META, formatMacroAmount, macroLabel } from '@/utils/macros';
import { extractApiError } from '@/utils/apiError';
import type { MacroKey, MacroPreference, MacroTargetMode } from '@/types';

interface MacrosSheetProps {
  open: boolean;
  onClose: () => void;
}

interface DraftRow {
  macroKey: MacroKey;
  isTracked: boolean;
  targetMode: MacroTargetMode;
  customValue: string;
  autoTargetValue: number | null;
  direction: 'hit' | 'limit';
}

const toDraft = (prefs: MacroPreference[]): DraftRow[] =>
  prefs.map((p) => ({
    macroKey: p.macroKey,
    isTracked: p.isTracked,
    targetMode: p.targetMode,
    customValue: p.customTargetValue !== null ? String(Math.round(p.customTargetValue)) : '',
    autoTargetValue: p.autoTargetValue,
    direction: p.direction,
  }));

/**
 * What gets tracked beyond calories and protein. Off by default: every
 * enabled macro is another number to look at and (for sugar and water)
 * extra work for the AI parser, so tracking is a deliberate choice.
 * Changes apply from today; past days keep what they were lived under.
 */
export function MacrosSheet({ open, onClose }: MacrosSheetProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const prefsQuery = useMacroPreferences();
  const update = useUpdateMacroPreferences();

  const [rows, setRows] = useState<DraftRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Fresh draft on every open, from the latest server state.
  /* eslint-disable react-hooks/set-state-in-effect -- bounded open-transition reset */
  useEffect(() => {
    if (!open) return;
    setRows(prefsQuery.data ? toDraft(prefsQuery.data) : []);
    setError(null);
  }, [open, prefsQuery.data]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const patchRow = (key: MacroKey, patch: Partial<DraftRow>) => {
    setRows((rs) => rs.map((r) => (r.macroKey === key ? { ...r, ...patch } : r)));
    setError(null);
  };

  const save = () => {
    for (const r of rows) {
      if (r.isTracked && r.targetMode === 'custom') {
        const v = Number(r.customValue.replace(',', '.'));
        if (!Number.isFinite(v) || v <= 0 || v > 20000) {
          setError(
            t('macros.custom_error', 'Enter a value above zero for {{macro}} or switch it to Auto.', {
              macro: macroLabel(t, r.macroKey),
            }),
          );
          return;
        }
      }
    }

    update.mutate(
      {
        items: rows.map((r) => ({
          macroKey: r.macroKey,
          isTracked: r.isTracked,
          targetMode: r.targetMode,
          customTargetValue:
            r.customValue.trim() !== '' ? Number(r.customValue.replace(',', '.')) : null,
        })),
      },
      {
        onSuccess: () => {
          toast('success', t('macros.saved', 'Tracking updated. Applies from today.'));
          onClose();
        },
        onError: (err) =>
          setError(extractApiError(err, t('log.save_error', 'Could not save. Check your connection and try again.'))),
      },
    );
  };

  return (
    <Sheet open={open} onClose={onClose} title={t('macros.sheet_title', 'Macro tracking')}>
      <p className="text-[13px] text-ink-2 leading-relaxed mb-3">
        {t('macros.sheet_intro', 'Pick what you want to see next to calories and protein. Tracked macros get a bar on your day and their own targets.')}
      </p>

      <div className="space-y-2.5">
        {rows.map((r) => {
          const meta = MACRO_META[r.macroKey];
          const noFormula = r.autoTargetValue === null;
          return (
            <div key={r.macroKey} className="rounded-card bg-inset p-3.5">
              <div className="flex items-center gap-3">
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-card"
                  style={{ color: meta.color }}
                >
                  <Icon name={meta.icon} size={18} />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-[15px] font-bold text-ink">{macroLabel(t, r.macroKey)}</p>
                  <p className="text-[12px] text-ink-2">
                    {r.direction === 'limit'
                      ? t('macros.kind_limit', 'A limit: warns when you go over')
                      : t('macros.kind_hit', 'A goal: fill the bar to reach it')}
                  </p>
                </div>
                <Switch
                  checked={r.isTracked}
                  onChange={(on) => patchRow(r.macroKey, { isTracked: on })}
                  label={t('macros.track_toggle_aria', 'Track {{macro}}', { macro: macroLabel(t, r.macroKey) })}
                />
              </div>

              {r.isTracked && (
                <div className="mt-3 border-t border-hairline/50 pt-3 space-y-2.5">
                  <SegmentedControl<MacroTargetMode>
                    aria-label={t('macros.target_mode_aria', '{{macro}} target mode', { macro: macroLabel(t, r.macroKey) })}
                    options={[
                      {
                        value: 'auto',
                        label: noFormula
                          ? t('macros.mode_no_limit', 'No target')
                          : t('profile.mode_auto', 'Auto'),
                      },
                      { value: 'custom', label: t('macros.mode_custom', 'Custom') },
                    ]}
                    value={r.targetMode}
                    onChange={(mode) => patchRow(r.macroKey, { targetMode: mode })}
                  />
                  {r.targetMode === 'auto' ? (
                    <p className="text-[12px] text-ink-3 leading-relaxed">
                      {noFormula
                        ? t('macros.no_formula_hint', 'Shows the amount only. Set a custom value if you want a limit to watch.')
                        : t('macros.auto_hint', 'Calculated from your profile: {{value}} per day. Updates when your weight or goal changes.', {
                            value: formatMacroAmount(r.macroKey, r.autoTargetValue ?? 0),
                          })}
                    </p>
                  ) : (
                    <DecimalField
                      aria-label={t('macros.custom_value_aria', '{{macro}} custom target', { macro: macroLabel(t, r.macroKey) })}
                      suffix={meta.unit}
                      placeholder={r.autoTargetValue !== null ? String(Math.round(r.autoTargetValue)) : '0'}
                      value={r.customValue}
                      onValueChange={(v) => patchRow(r.macroKey, { customValue: v })}
                    />
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="mt-3 text-[13px] text-ink-3 leading-relaxed">
        {t('macros.applies_hint', 'Changes count from today. Older days keep showing exactly what was tracked back then.')}
      </p>

      {error && <InlineError message={error} className="mt-2" />}

      <Button
        variant="primary"
        size="lg"
        fullWidth
        className="mt-4"
        loading={update.isPending}
        disabled={rows.length === 0}
        onClick={save}
      >
        {t('common.save', 'Save')}
      </Button>
    </Sheet>
  );
}
