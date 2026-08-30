import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/Card';
import { Button, IconButton } from '@/components/ui/Button';
import { DecimalField } from '@/components/ui/Field';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Switch } from '@/components/ui/Switch';
import { Icon } from '@/components/ui/Icon';
import { InlineError } from '@/components/ui/States';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { ProteinSheet } from '@/components/profile/ProfileSheets';
import { useMacroPreferences, useUpdateMacroPreferences } from '@/hooks/useMacroPreferences';
import { MACRO_META, PROTEIN_META, formatMacroAmount, macroLabel } from '@/utils/macros';
import { effectiveAutoProteinGrams } from '@/config/proteinPresets';
import { extractApiError } from '@/utils/apiError';
import { profileService } from '@/services/profileService';
import { dailyLogService } from '@/services/dailyLogService';
import { queryKeys, invalidateDayData } from '@/lib/queryKeys';
import { toDateString } from '@/utils/format';
import { profileToRequest } from '@/utils/profile';
import type { MacroKey, MacroPreference, MacroTargetMode, UserProfileRequest } from '@/types';

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
 * Macro tracking as its own page (was a bottom sheet): every macro gets a
 * full-width card with room for its toggle, target mode and explanation, so
 * choosing what to track no longer happens in a cramped scroll. Protein sits
 * first: same optionality, but its goal lives on the profile, so its switch
 * saves immediately while the optional macros save together at the bottom.
 * Changes apply from today; past days keep what they were lived under.
 */
export default function MacrosPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const prefsQuery = useMacroPreferences();
  const update = useUpdateMacroPreferences();

  const { data: profile } = useQuery({
    queryKey: queryKeys.profile(),
    queryFn: () => profileService.get().then((r) => r.data),
    staleTime: 10 * 60 * 1000,
  });
  const proteinTracked = profile
    ? profile.proteinGoalGrams !== null || profile.autoCalculateProteinGoal
    : true;

  const [proteinSheetOpen, setProteinSheetOpen] = useState(false);
  const [rows, setRows] = useState<DraftRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  // Hydrate the draft once from the loaded preferences.
  useEffect(() => {
    if (hydrated || !prefsQuery.data) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot hydration from an async query
    setRows(toDraft(prefsQuery.data));
    setHydrated(true);
  }, [hydrated, prefsQuery.data]);

  // Protein saves through the profile endpoint (its own pipeline), applied
  // immediately: a switch that only "arms" a later save reads as broken.
  const saveProfile = useMutation({
    mutationFn: (patch: Partial<UserProfileRequest>) =>
      profileService.update({ ...profileToRequest(profile!), ...patch }).then((r) => r.data),
    onSuccess: async (updated) => {
      queryClient.setQueryData(queryKeys.profile(), updated);
      setProteinSheetOpen(false);
      try {
        await dailyLogService.refreshSnapshot(toDateString());
      } catch {
        /* non-critical: the next recalculation refreshes it */
      }
      invalidateDayData(queryClient);
      toast('success', t('macros.saved', 'Tracking updated. Applies from today.'));
    },
    onError: (err) =>
      setError(extractApiError(err, t('log.save_error', 'Could not save. Check your connection and try again.'))),
  });

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
          navigate('/profile');
        },
        onError: (err) =>
          setError(extractApiError(err, t('log.save_error', 'Could not save. Check your connection and try again.'))),
      },
    );
  };

  const proteinTargetLine = (() => {
    if (!profile) return '';
    if (profile.proteinGoalGrams !== null)
      return t('macros.protein_target_value', 'Target: {{g}} g per day.', {
        g: Math.round(profile.proteinGoalGrams),
      });
    const autoGrams = effectiveAutoProteinGrams(
      profile.currentWeightKg,
      profile.age,
      profile.proteinGoalGramsPerKg,
    );
    return autoGrams !== null
      ? t('macros.protein_target_auto_value', 'Target: {{g}} g per day, following your weight.', { g: autoGrams })
      : t('macros.protein_target_pending', 'Target activates when you add your weight.');
  })();

  return (
    <div className="space-y-4">
      <header className="flex items-center gap-2">
        <IconButton icon="arrowLeft" label={t('common.back', 'Back')} onClick={() => navigate('/profile')} />
        <div className="flex-1 min-w-0">
          <h1 className="text-[19px] font-extrabold text-ink leading-tight">
            {t('macros.sheet_title', 'Macro tracking')}
          </h1>
          <p className="text-[12px] text-ink-2">
            {t('macros.page_subtitle', 'What you track shows up next to calories on your day')}
          </p>
        </div>
      </header>

      {prefsQuery.isLoading && <SkeletonCard rows={4} />}

      {/* Protein: applies on toggle, target adjusted in its own sheet. */}
      {profile && (
        <Card>
          <div className="flex items-center gap-3">
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-inset"
              style={{ color: PROTEIN_META.color }}
            >
              <Icon name={PROTEIN_META.icon} size={19} />
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-[15px] font-bold text-ink">{t('today.protein', 'Protein')}</p>
              <p className="text-[12px] text-ink-2">
                {t('macros.kind_hit', 'A goal: fill the bar to reach it')}
              </p>
            </div>
            <Switch
              checked={proteinTracked}
              onChange={(on) =>
                saveProfile.mutate({
                  proteinGoalGrams: null,
                  autoCalculateProteinGoal: on,
                  // The multiplier survives an off-toggle (it is inert while
                  // off), so switching back on restores the chosen preset.
                  proteinGoalGramsPerKg: profile.proteinGoalGramsPerKg ?? (on ? 2.0 : null),
                })
              }
              disabled={saveProfile.isPending}
              label={t('macros.track_toggle_aria', 'Track {{macro}}', { macro: t('today.protein', 'Protein') })}
            />
          </div>
          {proteinTracked && (
            <div className="mt-3 border-t border-hairline/50 pt-3 flex items-center justify-between gap-3">
              <p className="text-[13px] text-ink-2 leading-relaxed">{proteinTargetLine}</p>
              <button
                type="button"
                onClick={() => setProteinSheetOpen(true)}
                className="pressable shrink-0 rounded-full bg-inset px-3 py-1.5 text-[12px] font-bold text-primary-soft-ink"
              >
                {t('macros.protein_adjust', 'Adjust')}
              </button>
            </div>
          )}
        </Card>
      )}

      {rows.map((r) => {
        const meta = MACRO_META[r.macroKey];
        const noFormula = r.autoTargetValue === null;
        return (
          <Card key={r.macroKey}>
            <div className="flex items-center gap-3">
              <span
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-inset"
                style={{ color: meta.color }}
              >
                <Icon name={meta.icon} size={19} />
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
              <div className="mt-3 border-t border-hairline/50 pt-3 space-y-3">
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
                  <p className="text-[13px] text-ink-3 leading-relaxed">
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
          </Card>
        );
      })}

      {rows.length > 0 && (
        <>
          <p className="text-[13px] text-ink-3 leading-relaxed px-1">
            {t('macros.applies_hint', 'Changes count from today. Older days keep showing exactly what was tracked back then.')}
          </p>

          {error && <InlineError message={error} />}

          <Button variant="primary" size="lg" fullWidth loading={update.isPending} onClick={save}>
            {t('common.save', 'Save')}
          </Button>
        </>
      )}

      {profile && (
        <ProteinSheet
          open={proteinSheetOpen}
          onClose={() => setProteinSheetOpen(false)}
          profile={profile}
          onSave={(patch) => saveProfile.mutate(patch)}
          saving={saveProfile.isPending}
        />
      )}
    </div>
  );
}
