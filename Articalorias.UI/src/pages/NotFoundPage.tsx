import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { EmptyState } from '@/components/ui/States';

export default function NotFoundPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  return (
    <div className="min-h-dvh flex items-center justify-center px-6">
      <EmptyState
        icon="search"
        title={t('not_found.title', 'This page does not exist')}
        body={t('not_found.body', 'The link may be old or mistyped. Your data is fine.')}
        actionLabel={t('not_found.cta', 'Go to Today')}
        onAction={() => navigate('/today', { replace: true })}
      />
    </div>
  );
}
