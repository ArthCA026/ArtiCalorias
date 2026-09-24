import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { InlineError } from '@/components/ui/States';
import { ConfirmSheet } from '@/components/ui/ActionSheet';
import { ConsentCheckboxes, type ConsentValues } from '@/components/legal/ConsentCheckboxes';
import { PolicySheet } from '@/components/legal/PolicySheet';
import { CancelSubscriptionSheet } from '@/components/billing/CancelSubscriptionSheet';
import { deleteAccountBody } from '@/components/billing/billingCopy';
import type { PolicyDocKey } from '@/legal/documents';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/hooks/useLanguage';
import { useBillingStatus } from '@/hooks/useBilling';
import { consentService } from '@/services/consentService';
import { userService } from '@/services/userService';
import { queryKeys } from '@/lib/queryKeys';
import { POLICY_VERSIONS, CONSENT_TYPES } from '@/legal/policyVersions';
import { extractApiError } from '@/utils/apiError';

/**
 * Blocking consent gate (Ley 8968). Existing accounts created before consent
 * existed, and every user after a policy version bump, land here from
 * RequireConsented and cannot reach the app until they accept. The escape
 * hatches are honest ones: sign out, or delete the account entirely. A
 * subscriber gets a third: cancel the subscription. Nobody should keep paying
 * for an app they are locked out of because they declined new terms.
 */
export default function ConsentPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { logout } = useAuth();
  const { language } = useLanguage();

  const [consents, setConsents] = useState<ConsentValues>({ termsAccepted: false, healthAccepted: false });
  const [termsError, setTermsError] = useState<string | undefined>();
  const [healthError, setHealthError] = useState<string | undefined>();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [openDoc, setOpenDoc] = useState<PolicyDocKey | null>(null);

  const from = (location.state as { from?: string } | null)?.from ?? '/today';

  // Billing stays reachable without consent (it holds no health data).
  const billing = useBillingStatus();
  const subState = billing.data?.subscription?.state;
  const canCancelSubscription = subState === 'active' || subState === 'past_due';

  const accept = useMutation({
    mutationFn: () =>
      consentService
        .record({
          consents: CONSENT_TYPES.map((type) => ({
            consentType: type,
            policyVersion: POLICY_VERSIONS[type],
            action: 'granted' as const,
          })),
          locale: language,
          source: 'reconsent',
        })
        .then((r) => r.data),
    onSuccess: (state) => {
      queryClient.setQueryData(queryKeys.consent(), state);
      navigate(from, { replace: true });
    },
  });

  const deleteAccount = useMutation({
    mutationFn: () => userService.deleteAccount(),
    onSuccess: () => {
      queryClient.clear();
      logout();
    },
  });

  const handleAccept = () => {
    const missingTerms = !consents.termsAccepted;
    const missingHealth = !consents.healthAccepted;
    setTermsError(
      missingTerms ? t('legal.error_terms_required', 'Please accept the terms and the privacy notice to continue.') : undefined,
    );
    setHealthError(
      missingHealth
        ? t('legal.error_health_required', 'The app cannot work without your consent to process health data.')
        : undefined,
    );
    if (missingTerms || missingHealth) return;
    accept.mutate();
  };

  return (
    <main className="mx-auto max-w-md min-h-dvh px-5 pt-6 pb-10 pt-safe flex flex-col">
      <div className="flex-1 space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-primary-soft text-primary-soft-ink flex items-center justify-center">
          <Icon name="shieldCheck" size={24} />
        </div>
        <div>
          <h1 className="text-xl font-extrabold text-ink">
            {t('legal.consent_title', 'Your data needs your OK')}
          </h1>
          <p className="text-sm text-ink-2 mt-1">
            {t(
              'legal.consent_sub',
              'ArtiCalorias works with health data: your weight, meals and activity. Costa Rican law requires your express consent before we can keep processing it.',
            )}
          </p>
        </div>

        <Card className="space-y-2.5">
          <p className="text-sm text-ink-2 leading-relaxed">
            {t(
              'legal.consent_summary',
              'What you log stays in your account and is used only to compute your budgets and progress. Meal photos and descriptions you send for analysis go to OpenAI in the United States. Nothing is sold and there are no ad trackers.',
            )}
          </p>
          <div className="flex flex-col items-start gap-1.5 pt-1">
            <button
              type="button"
              onClick={() => setOpenDoc('privacy')}
              className="pressable text-[13px] font-semibold text-primary-soft-ink underline underline-offset-2"
            >
              {t('legal.link_privacy', 'Read the Privacy Notice')}
            </button>
            <button
              type="button"
              onClick={() => setOpenDoc('terms')}
              className="pressable text-[13px] font-semibold text-primary-soft-ink underline underline-offset-2"
            >
              {t('legal.link_terms', 'Read the Terms of Use')}
            </button>
          </div>
        </Card>

        <ConsentCheckboxes
          values={consents}
          onChange={(next) => {
            setConsents(next);
            setTermsError(undefined);
            setHealthError(undefined);
          }}
          termsError={termsError}
          healthError={healthError}
        />

        {accept.isError && (
          <InlineError
            message={extractApiError(
              accept.error,
              t('legal.consent_error', 'Could not save your consent. Check your connection and try again.'),
            )}
          />
        )}

        <Button type="button" variant="primary" size="lg" fullWidth loading={accept.isPending} onClick={handleAccept}>
          {t('legal.consent_accept', 'Accept and continue')}
        </Button>
      </div>

      <div className="mt-8 space-y-2.5 text-center">
        <button type="button" className="pressable text-[13px] font-semibold text-ink-3" onClick={() => logout()}>
          {t('profile.row_logout', 'Sign out')}
        </button>
        {canCancelSubscription && (
          <button
            type="button"
            className="pressable block w-full text-[13px] font-semibold text-ink-3"
            onClick={() => setConfirmCancel(true)}
          >
            {t('billing.consent_cancel', 'Cancel my subscription')}
          </button>
        )}
        <button
          type="button"
          className="pressable block w-full text-[13px] font-semibold text-danger"
          onClick={() => setConfirmDelete(true)}
        >
          {t('legal.consent_delete_instead', 'I do not agree, delete my account')}
        </button>
      </div>

      <PolicySheet doc={openDoc} onClose={() => setOpenDoc(null)} />
      <CancelSubscriptionSheet open={confirmCancel} onClose={() => setConfirmCancel(false)} />

      <ConfirmSheet
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title={t('profile.delete_account_title', 'Delete your account?')}
        body={deleteAccountBody(t, billing.data)}
        confirmLabel={t('profile.delete_account_confirm', 'Delete my account forever')}
        cancelLabel={t('common.cancel', 'Cancel')}
        loading={deleteAccount.isPending}
        onConfirm={() => deleteAccount.mutate()}
      />
    </main>
  );
}
