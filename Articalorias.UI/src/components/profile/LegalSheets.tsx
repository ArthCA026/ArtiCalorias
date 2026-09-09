import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Sheet } from '@/components/ui/Sheet';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Skeleton } from '@/components/ui/Skeleton';
import { consentService } from '@/services/consentService';
import { queryKeys } from '@/lib/queryKeys';
import { cn } from '@/utils/cn';
import type { ConsentStateItem, ConsentTypeName } from '@/types';

function typeLabel(t: (k: string, d: string) => string, type: ConsentTypeName): string {
  switch (type) {
    case 'terms':
      return t('legal.type_terms', 'Terms of Use');
    case 'privacy':
      return t('legal.type_privacy', 'Privacy Notice');
    case 'health_data':
      return t('legal.type_health', 'Health data processing');
  }
}

function statusLabel(t: (k: string, d: string) => string, item: ConsentStateItem): string {
  if (item.isCurrent) return t('legal.status_granted', 'Active');
  if (item.status === 'revoked') return t('legal.status_revoked', 'Withdrawn');
  if (item.status === 'granted') return t('legal.status_stale', 'Needs review');
  return t('legal.status_none', 'Not given');
}

interface ConsentStatusSheetProps {
  open: boolean;
  onClose: () => void;
  onWithdraw: () => void;
}

/**
 * Shows the latest consent state per document plus the full audit trail
 * (what was accepted or withdrawn, at which version, when). The trail is the
 * user-facing view of the append-only UserConsent log.
 */
export function ConsentStatusSheet({ open, onClose, onWithdraw }: ConsentStatusSheetProps) {
  const { t, i18n } = useTranslation();

  const stateQuery = useQuery({
    queryKey: queryKeys.consent(),
    queryFn: () => consentService.getState().then((r) => r.data),
    enabled: open,
    // Always fresh when the sheet opens: this is the audit view.
    staleTime: 0,
  });

  // DB datetimes arrive without a zone suffix but are UTC; normalize before
  // parsing so the sheet shows local time instead of shifting by the offset.
  const formatDate = (iso: string) => {
    const normalized = /Z$|[+-]\d\d:\d\d$/.test(iso) ? iso : `${iso}Z`;
    return new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium', timeStyle: 'short' }).format(
      new Date(normalized),
    );
  };

  const state = stateQuery.data;

  return (
    <Sheet open={open} onClose={onClose} title={t('legal.status_title', 'Consent and your data')}>
      {stateQuery.isLoading && (
        <div className="space-y-2">
          <Skeleton className="h-14 rounded-card" />
          <Skeleton className="h-14 rounded-card" />
          <Skeleton className="h-14 rounded-card" />
        </div>
      )}

      {state && (
        <>
          <div className="rounded-card bg-inset overflow-hidden divide-y divide-hairline/50">
            {state.consents.map((item) => (
              <div key={item.consentType} className="px-4 py-3 flex items-center gap-3">
                <span className="flex-1 min-w-0">
                  <span className="block text-[14px] font-semibold text-ink">{typeLabel(t, item.consentType)}</span>
                  {item.policyVersion && item.recordedAtUtc && (
                    <span className="block text-[12px] text-ink-3 mt-0.5">
                      {t('legal.status_line', 'Version {{version}}, {{date}}', {
                        version: item.policyVersion,
                        date: formatDate(item.recordedAtUtc),
                      })}
                    </span>
                  )}
                </span>
                <span
                  className={cn(
                    'shrink-0 text-[12px] font-bold px-2 py-1 rounded-lg',
                    item.isCurrent ? 'bg-primary-soft text-primary-soft-ink' : 'bg-warning-soft text-warning',
                  )}
                >
                  {statusLabel(t, item)}
                </span>
              </div>
            ))}
          </div>

          {state.history.length > 0 && (
            <>
              <h3 className="text-[13px] font-bold text-ink-2 uppercase tracking-wide mt-5 mb-2">
                {t('legal.history_title', 'History')}
              </h3>
              <div className="rounded-card bg-inset overflow-hidden divide-y divide-hairline/50">
                {state.history.map((h, i) => (
                  <div key={i} className="px-4 py-2.5 flex items-center gap-2.5">
                    <Icon
                      name={h.action === 'granted' ? 'checkCircle' : 'close'}
                      size={15}
                      className={cn('shrink-0', h.action === 'granted' ? 'text-primary-soft-ink' : 'text-warning')}
                    />
                    <span className="flex-1 min-w-0 text-[12px] text-ink-2 leading-snug">
                      {h.action === 'granted'
                        ? t('legal.history_granted', '{{doc}} accepted, version {{version}}', {
                            doc: typeLabel(t, h.consentType),
                            version: h.policyVersion,
                          })
                        : t('legal.history_revoked', '{{doc}} withdrawn, version {{version}}', {
                            doc: typeLabel(t, h.consentType),
                            version: h.policyVersion,
                          })}
                      <span className="block text-ink-3">{formatDate(h.createdAtUtc)}</span>
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}

          <Button variant="secondary" size="lg" fullWidth className="mt-5 text-danger" onClick={onWithdraw}>
            {t('legal.withdraw_button', 'Withdraw health data consent')}
          </Button>
        </>
      )}
    </Sheet>
  );
}

interface WithdrawConsentSheetProps {
  open: boolean;
  onClose: () => void;
  onWithdrawAndDelete: () => void;
  onWithdrawOnly: () => void;
  deleting: boolean;
  withdrawing: boolean;
}

/**
 * Withdrawal flow (Ley 8968 revocation). Deletion is the primary path because
 * the app cannot operate on health data without consent; withdraw-only keeps
 * the account but blocks it at the consent gate until re-consent, with data
 * retained. The copy states exactly that, no surprises.
 */
export function WithdrawConsentSheet({
  open,
  onClose,
  onWithdrawAndDelete,
  onWithdrawOnly,
  deleting,
  withdrawing,
}: WithdrawConsentSheetProps) {
  const { t } = useTranslation();
  const busy = deleting || withdrawing;

  return (
    <Sheet open={open} onClose={onClose} title={t('legal.withdraw_title', 'Withdraw your consent?')}>
      <p className="text-[15px] text-ink-2 leading-relaxed">
        {t(
          'legal.withdraw_body',
          'ArtiCalorias cannot work without processing your health data. If you withdraw consent, the app stops saving anything new and signs you out. Your data stays stored until you delete it or consent again. Deleting the account erases everything permanently.',
        )}
      </p>
      <div className="mt-5 space-y-2.5">
        <Button variant="danger" size="lg" fullWidth loading={deleting} disabled={busy && !deleting} onClick={onWithdrawAndDelete}>
          {t('legal.withdraw_delete_confirm', 'Withdraw and delete my account')}
        </Button>
        <Button variant="secondary" size="lg" fullWidth loading={withdrawing} disabled={busy && !withdrawing} onClick={onWithdrawOnly}>
          {t('legal.withdraw_only_confirm', 'Withdraw only and sign out')}
        </Button>
        <Button variant="secondary" size="lg" fullWidth onClick={onClose} disabled={busy}>
          {t('common.cancel', 'Cancel')}
        </Button>
      </div>
    </Sheet>
  );
}
