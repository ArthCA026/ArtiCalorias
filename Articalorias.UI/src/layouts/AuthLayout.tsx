import { Outlet } from 'react-router';
import { useTranslation } from 'react-i18next';

/** Centered single-column shell for the auth screens. */
export default function AuthLayout() {
  const { t } = useTranslation();
  return (
    <main className="min-h-dvh flex flex-col justify-center mx-auto max-w-md px-5 py-8 pt-safe pb-safe">
      <header className="text-center mb-8">
        <h1 className="text-2xl font-extrabold text-ink tracking-tight">ArtiCalorias</h1>
        <p className="text-sm text-ink-2 mt-1">{t('auth.tagline', 'Calorie tracking that fits your week')}</p>
      </header>
      <Outlet />
    </main>
  );
}
