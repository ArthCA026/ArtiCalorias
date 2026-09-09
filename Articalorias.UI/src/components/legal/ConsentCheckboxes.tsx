import { useState, type ReactNode } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { Icon } from '@/components/ui/Icon';
import { InlineError } from '@/components/ui/States';
import { PolicySheet } from './PolicySheet';
import type { PolicyDocKey } from '@/legal/documents';
import { cn } from '@/utils/cn';

export interface ConsentValues {
  termsAccepted: boolean;
  healthAccepted: boolean;
}

interface ConsentCheckboxesProps {
  values: ConsentValues;
  onChange: (next: ConsentValues) => void;
  termsError?: string;
  healthError?: string;
}

function ConsentRow({
  checked,
  onToggle,
  label,
  error,
  children,
}: {
  checked: boolean;
  onToggle: () => void;
  /** Accessible name for the checkbox control itself. */
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <div
        className={cn(
          'pressable w-full rounded-card px-4 py-3 flex items-start gap-3 cursor-pointer',
          checked ? 'bg-primary-soft ring-2 ring-primary/60' : 'bg-inset',
        )}
        onClick={onToggle}
      >
        <button
          type="button"
          role="checkbox"
          aria-checked={checked}
          aria-label={label}
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
          className={cn(
            'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md',
            checked ? 'bg-primary text-white' : 'bg-card ring-1 ring-ink-3/40',
          )}
        >
          {checked && <Icon name="check" size={14} />}
        </button>
        <span className="text-[13px] text-ink-2 leading-snug">{children}</span>
      </div>
      {error && <InlineError message={error} />}
    </div>
  );
}

/**
 * The two consent checkboxes required to use the app (Ley 8968): the general
 * 18+/terms/privacy acceptance, and the SEPARATE express consent for health
 * data (Art. 9, sensitive data). Both start unchecked by design; consent must
 * be an action, never a default. The inline document links open a PolicySheet
 * OVER the form, so reading never navigates away or loses typed input.
 * Used by RegisterPage and ConsentPage.
 */
export function ConsentCheckboxes({ values, onChange, termsError, healthError }: ConsentCheckboxesProps) {
  const { t } = useTranslation();
  const [openDoc, setOpenDoc] = useState<PolicyDocKey | null>(null);

  const linkClass = 'font-semibold text-primary-soft-ink underline underline-offset-2';
  const openPolicy = (doc: PolicyDocKey) => (e: React.MouseEvent) => {
    e.stopPropagation();
    setOpenDoc(doc);
  };

  return (
    <div className="space-y-2.5">
      <ConsentRow
        checked={values.termsAccepted}
        onToggle={() => onChange({ ...values, termsAccepted: !values.termsAccepted })}
        label={t('legal.checkbox_terms_aria', 'Accept the terms of use and privacy notice')}
        error={termsError}
      >
        <Trans
          i18nKey="legal.checkbox_terms"
          defaults="I confirm I am 18 or older and I accept the <termsLink>Terms of Use</termsLink> and the <privacyLink>Privacy Notice</privacyLink>."
          components={{
            termsLink: <button type="button" className={linkClass} onClick={openPolicy('terms')} />,
            privacyLink: <button type="button" className={linkClass} onClick={openPolicy('privacy')} />,
          }}
        />
      </ConsentRow>

      <ConsentRow
        checked={values.healthAccepted}
        onToggle={() => onChange({ ...values, healthAccepted: !values.healthAccepted })}
        label={t('legal.checkbox_health_aria', 'Consent to health data processing')}
        error={healthError}
      >
        {t(
          'legal.checkbox_health',
          'I expressly consent to the processing of my health data (weight, height, age, sex, body composition, food and activity logs) to provide the service, including sending my meal photos and descriptions to OpenAI in the United States.',
        )}
      </ConsentRow>

      <PolicySheet doc={openDoc} onClose={() => setOpenDoc(null)} />
    </div>
  );
}
