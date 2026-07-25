import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Sheet } from '@/components/ui/Sheet';
import { Button } from '@/components/ui/Button';
import { Field, DecimalField } from '@/components/ui/Field';
import { QuantityField } from '@/components/ui/QuantityField';
import { Switch } from '@/components/ui/Switch';
import { InlineError } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';
import { activityService } from '@/services/activityService';
import { queryKeys } from '@/lib/queryKeys';
import { extractApiError } from '@/utils/apiError';
import type { ActivityTemplateResponse } from '@/types';

const num = (raw: string): number => {
  const n = Number(raw.replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};

interface ActivityTemplateSheetProps {
  /** null = create mode */
  template: ActivityTemplateResponse | null;
  onClose: () => void;
}

/** Create or edit an activity template. Duration and MET are required by the API. */
export function ActivityTemplateSheet({ template, onClose }: ActivityTemplateSheetProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [name, setName] = useState(template?.templateName ?? '');
  const [duration, setDuration] = useState(
    template?.defaultDurationMinutes && template.defaultDurationMinutes > 0
      ? template.defaultDurationMinutes
      : 30,
  );
  const [met, setMet] = useState(template?.defaultMET ? String(template.defaultMET) : '');
  const [metHint, setMetHint] = useState<string | null>(null);
  const [autoAdd, setAutoAdd] = useState(template?.autoAddToNewDay ?? false);
  const [error, setError] = useState<string | null>(null);
  const [estimateError, setEstimateError] = useState<string | null>(null);

  const estimate = useMutation({
    mutationFn: () =>
      activityService
        .estimateMet({ activityName: name.trim(), durationMinutes: duration })
        .then((r) => r.data),
    onSuccess: (data) => {
      setEstimateError(null);
      setMet(String(data.metValue));
      setMetHint(data.explanation);
    },
    onError: (err) =>
      setEstimateError(
        extractApiError(err, t('templates.save_error', 'Could not save. Check your connection and try again.')),
      ),
  });

  const save = useMutation({
    mutationFn: () => {
      const data = {
        templateName: name.trim(),
        autoAddToNewDay: autoAdd,
        defaultDurationMinutes: duration,
        defaultMET: num(met),
      };
      return template
        ? activityService.updateTemplate(template.activityTemplateId, data)
        : activityService.createTemplate(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.activityTemplates() });
      queryClient.invalidateQueries({ queryKey: queryKeys.routines() });
      toast('success', t('templates.saved', 'Saved'));
      onClose();
    },
    onError: (err) =>
      setError(
        extractApiError(err, t('templates.save_error', 'Could not save. Check your connection and try again.')),
      ),
  });

  const metValue = num(met);
  const valid = name.trim().length > 0 && duration >= 5 && metValue > 0 && metValue <= 50;

  return (
    <Sheet
      open
      onClose={onClose}
      title={
        template
          ? t('templates.edit_activity', 'Edit activity template')
          : t('templates.new_activity', 'New activity template')
      }
    >
      <div className="space-y-3.5">
        <Field
          label={t('templates.name', 'Name')}
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="off"
        />
        <div>
          <p className="text-[13px] font-semibold text-ink-2 mb-1.5">
            {t('templates.duration', 'Duration')}
          </p>
          <QuantityField
            value={duration}
            onCommit={setDuration}
            min={5}
            max={1440}
            step={5}
            suffix={t('templates.min_suffix', 'min')}
          />
        </div>
        <DecimalField
          label={t('templates.met', 'Intensity (MET)')}
          value={met}
          onValueChange={setMet}
          hint={metHint ?? t('templates.met_hint', 'How intense it is. A walk is about 3.5.')}
        />
        <Button
          variant="soft"
          icon="sparkles"
          fullWidth
          loading={estimate.isPending}
          disabled={name.trim().length === 0}
          onClick={() => {
            setEstimateError(null);
            estimate.mutate();
          }}
        >
          {t('templates.estimate_met', 'Estimate intensity for me')}
        </Button>
        {estimateError && <InlineError message={estimateError} />}
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
          disabled={!valid}
          onClick={() => save.mutate()}
        >
          {t('common.save', 'Save')}
        </Button>
      </div>
    </Sheet>
  );
}
