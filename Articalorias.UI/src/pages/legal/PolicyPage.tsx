import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/components/ui/Icon';
import { PolicyBody } from '@/components/legal/PolicyBody';
import { useLanguage } from '@/hooks/useLanguage';
import { getPolicyDocument, type PolicyDocKey } from '@/legal/documents';

/**
 * Public full-page reader for the legal documents. Reached from Profile and
 * from outside the app (the URL doubles as the hosted policy page app stores
 * require). In-flow reading (register, consent gate, onboarding) uses
 * PolicySheet instead, which overlays without navigating.
 */
export default function PolicyPage({ doc }: { doc: PolicyDocKey }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { language, setLanguage } = useLanguage();
  const policy = getPolicyDocument(doc, language);

  const goBack = () => {
    // Opened directly (new tab / external link) there is no history to pop.
    if (window.history.length > 1) navigate(-1);
    else navigate('/', { replace: true });
  };

  return (
    <main className="min-h-dvh mx-auto max-w-md px-5 py-4 pt-safe pb-safe">
      <header className="flex items-center justify-between mb-4">
        <button
          type="button"
          onClick={goBack}
          className="pressable w-10 h-10 -ml-2 rounded-xl flex items-center justify-center text-ink-2 active:bg-press"
          aria-label={t('common.back', 'Back')}
        >
          <Icon name="arrowLeft" size={20} />
        </button>
        <button
          type="button"
          onClick={() => setLanguage(language === 'es' ? 'en' : 'es')}
          className="pressable flex items-center gap-1.5 px-3 py-2 rounded-xl text-[13px] font-semibold text-ink-2 active:bg-press"
        >
          <Icon name="globe" size={16} />
          {language === 'es' ? 'English' : 'Español'}
        </button>
      </header>

      <h1 className="text-xl font-extrabold text-ink tracking-tight mb-3">{policy.title}</h1>

      <PolicyBody policy={policy} />
    </main>
  );
}
