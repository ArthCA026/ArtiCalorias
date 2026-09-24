import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/Card';
import { IconButton } from '@/components/ui/Button';
import { Switch } from '@/components/ui/Switch';
import { Icon, iconOrFallback } from '@/components/ui/Icon';
import { ErrorState } from '@/components/ui/States';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { MacroTargetSheet } from '@/components/profile/MacroTargetSheet';
import { useMacros } from '@/hooks/useMacros';
import { useMacroPreferences, useUpdateMacroPreference } from '@/hooks/useMacroPreferences';
import { formatMacroAmount, macroColor, macroSoftColor } from '@/utils/macros';
import { extractApiError, extractApiErrorCode } from '@/utils/apiError';
import { cn } from '@/utils/cn';
import { profileService } from '@/services/profileService';
import { queryKeys } from '@/lib/queryKeys';
import type { MacroDefinition, MacroPreference } from '@/types';

/** A preference stand-in for a macro with no stored row yet (catalog defaults). */
const defaultPref = (def: MacroDefinition): MacroPreference => ({
  macroKey: def.key,
  isTracked: def.defaultTracked,
  targetMode: 'auto',
  customTargetValue: null,
  autoParam: def.targetFormula.defaultParam,
  autoTargetValue: null,
  effectiveTarget: null,
  direction: def.direction,
});

/**
 * Macro tracking as its own page: every catalog macro gets a full-width card
 * with its switch (saves immediately: a switch that only "arms" a later save
 * reads as broken), what kind of target it is, and an Adjust button that
 * opens the target editor. Protein is just the first row now. Changes apply
 * from today; past days keep what they were lived under.
 *
 * At most `maxTracked` macros can be on at once (the server enforces it, the
 * catalog ships the number). The slot meter on top makes the limit visible
 * before it is hit; once it is, the remaining switches dim but stay
 * tappable, because a dead control explains nothing: the tap answers with
 * what to do instead. Accounts that were above the limit when it arrived
 * keep everything they track and only lose the ability to add more.
 */
export default function MacrosPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const catalog = useMacros();
  const prefsQuery = useMacroPreferences();
  const update = useUpdateMacroPreference();

  const { data: profile } = useQuery({
    queryKey: queryKeys.profile(),
    queryFn: () => profileService.get().then((r) => r.data),
    staleTime: 10 * 60 * 1000,
  });

  const [editingKey, setEditingKey] = useState<string | null>(null);

  const prefsByKey = new Map((prefsQuery.data ?? []).map((p) => [p.macroKey, p]));
  const prefFor = (def: MacroDefinition) => prefsByKey.get(def.key) ?? defaultPref(def);

  // Counted over the ACTIVE catalog, exactly like the server does: a retired
  // macro still marked as tracked holds no slot.
  const max = catalog.maxTracked;
  const hasLimit = Number.isFinite(max);
  const trackedCount = catalog.defs.filter((d) => prefFor(d).isTracked).length;
  const atLimit = hasLimit && trackedCount >= max;
  const limitMessage = () =>
    t('macros.limit_reached', 'You are tracking {{max}} of {{max}}. Turn one off to add another.', { max });

  const saved = () => toast('success', t('macros.saved', 'Tracking updated. Applies from today.'));
  const failed = (err: unknown) => {
    // The server has the last word on the limit (another device may have
    // taken the last slot): say so in the user's language and resync.
    if (extractApiErrorCode(err) === 'MACRO_TRACK_LIMIT') {
      // A tab opened before the limit shipped still holds a catalog without
      // the number: fall back to the server's own sentence and fetch the
      // current catalog so the meter appears.
      toast('info', hasLimit ? limitMessage() : extractApiError(err, t('log.save_error', 'Could not save. Check your connection and try again.')));
      void prefsQuery.refetch();
      catalog.refetch();
      return;
    }
    toast('error', extractApiError(err, t('log.save_error', 'Could not save. Check your connection and try again.')));
  };

  const targetLine = (def: MacroDefinition, pref: MacroPreference): string => {
    if (pref.targetMode === 'custom' && pref.customTargetValue !== null)
      return t('macros.target_custom', 'Custom {{value}}', { value: formatMacroAmount(def, pref.customTargetValue) });
    if (!def.targetFormula.hasAutoTarget) return t('macros.mode_no_limit', 'No target');
    if (pref.autoTargetValue === null) return t('macros.target_pending', 'Activates once your body details are set.');
    return def.direction === 'limit'
      ? t('macros.target_limit', '{{value}} limit', { value: formatMacroAmount(def, pref.autoTargetValue) })
      : t('macros.target_auto', '{{value}} auto', { value: formatMacroAmount(def, pref.autoTargetValue) });
  };

  const editingDef = editingKey !== null ? catalog.get(editingKey) : null;
  const showError = prefsQuery.isError || (catalog.isError && catalog.defs.length === 0);

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

      {prefsQuery.isLoading && !showError && <SkeletonCard rows={4} />}

      {showError && (
        <ErrorState
          title={t('macros.catalog_error_title', 'Could not load macro options')}
          body={t('macros.catalog_error_body', 'Check your connection and try again.')}
          retryLabel={t('common.retry', 'Retry')}
          onRetry={() => {
            catalog.refetch();
            void prefsQuery.refetch();
          }}
        />
      )}

      {!showError && prefsQuery.data && hasLimit && (
        <Card>
          <div className="flex items-center justify-between gap-3">
            <p className="text-[15px] font-bold text-ink">
              {t('macros.limit_count', '{{n}} of {{max}} tracked', { n: trackedCount, max })}
            </p>
            <div className="flex shrink-0 items-center gap-1" aria-hidden="true">
              {Array.from({ length: max }, (_, i) => (
                <span
                  key={i}
                  className={cn('h-2 w-4 rounded-full', i < trackedCount ? 'bg-primary' : 'bg-press')}
                />
              ))}
            </div>
          </div>
          <p className="mt-1.5 text-[13px] text-ink-2 leading-relaxed">
            {trackedCount > max
              ? t(
                  'macros.limit_over',
                  'The limit is {{max}} at a time. Everything you track keeps working; turn some off before adding others.',
                  { max },
                )
              : t(
                  'macros.limit_hint',
                  'Up to {{max}} at a time. A short list keeps your day readable and your meal estimates sharp.',
                  { max },
                )}
          </p>
        </Card>
      )}

      {!showError &&
        prefsQuery.data &&
        catalog.defs.map((def) => {
          const pref = prefFor(def);
          const name = catalog.label(def);
          // Out of slots: this switch cannot go on until another goes off.
          const locked = atLimit && !pref.isTracked;
          return (
            <Card key={def.key}>
              <div className="flex items-center gap-3">
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl"
                  style={{ background: macroSoftColor(def.key), color: macroColor(def.key) }}
                >
                  <Icon name={iconOrFallback(def.icon)} size={19} />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-[15px] font-bold text-ink">{name}</p>
                  <p className="text-[12px] text-ink-2">
                    {def.direction === 'limit'
                      ? t('macros.kind_limit', 'A limit: warns when you go over')
                      : t('macros.kind_hit', 'A goal: fill the bar to reach it')}
                  </p>
                </div>
                <span className={cn('shrink-0 flex', locked && 'opacity-50')}>
                  <Switch
                    checked={pref.isTracked}
                    // One switch at a time while the limit is in play: two
                    // quick taps must not both claim the last free slot.
                    disabled={update.pendingKey === def.key || (hasLimit && update.isPending)}
                    onChange={(on) => {
                      if (on && locked) {
                        toast('info', limitMessage());
                        return;
                      }
                      update.mutate(
                        { macroKey: def.key, isTracked: on, targetMode: pref.targetMode },
                        { onSuccess: saved, onError: failed },
                      );
                    }}
                    label={
                      locked
                        ? t('macros.track_toggle_locked_aria', 'Track {{macro}}. Limit reached, turn another macro off first', {
                            macro: name,
                          })
                        : t('macros.track_toggle_aria', 'Track {{macro}}', { macro: name })
                    }
                  />
                </span>
              </div>

              {pref.isTracked && (
                <div className="mt-3 border-t border-hairline/50 pt-3 flex items-center justify-between gap-3">
                  <p className="text-[13px] text-ink-2 leading-relaxed">{targetLine(def, pref)}</p>
                  <button
                    type="button"
                    onClick={() => setEditingKey(def.key)}
                    className="pressable shrink-0 rounded-full bg-inset px-3 py-1.5 text-[12px] font-bold text-primary-soft-ink"
                  >
                    {t('macros.adjust', 'Adjust')}
                  </button>
                </div>
              )}
            </Card>
          );
        })}

      {!showError && prefsQuery.data && (
        <p className="text-[13px] text-ink-3 leading-relaxed px-1">
          {t('macros.applies_hint', 'Changes count from today. Older days keep showing exactly what was tracked back then.')}
        </p>
      )}

      {editingDef && (
        <MacroTargetSheet
          open={editingKey !== null}
          onClose={() => setEditingKey(null)}
          def={editingDef}
          pref={prefFor(editingDef)}
          profile={profile}
          saving={update.isPending}
          onSave={(item) =>
            update.mutate(item, {
              onSuccess: () => {
                setEditingKey(null);
                saved();
              },
              onError: failed,
            })
          }
        />
      )}
    </div>
  );
}
