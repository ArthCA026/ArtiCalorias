import { useTranslation } from 'react-i18next';
import { Icon } from '@/components/ui/Icon';

/**
 * Shown wherever money is discussed while the server runs on ONVO TEST keys.
 * Saying it out loud protects everyone: a tester knows which card to use, and
 * nobody can mistake a sandbox for a real purchase.
 */
export function TestModeNotice({ withCard = false }: { withCard?: boolean }) {
  const { t } = useTranslation();

  return (
    <div role="note" className="rounded-card bg-warning-soft px-4 py-3 flex items-start gap-2.5">
      <Icon name="info" size={17} className="mt-0.5 shrink-0 text-warning" />
      <p className="text-[13px] text-ink leading-snug">
        <span className="font-bold">{t('billing.test_mode_title', 'Test mode.')}</span>{' '}
        {t('billing.test_mode_body', 'Payments are simulated and no real money is charged.')}
        {withCard && (
          <>
            {' '}
            {t(
              'billing.test_mode_card',
              'Use card 4242 4242 4242 4242 with any future date and any CVV. 4000 0000 0000 0002 simulates a declined card.',
            )}
          </>
        )}
      </p>
    </div>
  );
}
