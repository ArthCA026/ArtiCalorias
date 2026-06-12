import { useTranslation } from 'react-i18next';

function BellIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

interface NotificationPermissionModalProps {
  onAllow: () => void;
  onDismiss: () => void;
}

const MEAL_BULLETS: { emoji: string; labelKey: string }[] = [
  { emoji: '🌅', labelKey: 'settings.reminder_breakfast' },
  { emoji: '☀️', labelKey: 'settings.reminder_lunch' },
  { emoji: '🌙', labelKey: 'settings.reminder_dinner' },
];

export function NotificationPermissionModal({ onAllow, onDismiss }: NotificationPermissionModalProps) {
  const { t } = useTranslation();

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center bg-black/50 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="notif-modal-title"
    >
      <div className="w-full max-w-sm mx-4 mb-6 sm:mb-0 rounded-2xl bg-white dark:bg-gray-900 shadow-2xl p-6 flex flex-col gap-4">
        {/* Icon */}
        <div className="flex justify-center">
          <span className="flex items-center justify-center w-14 h-14 rounded-full bg-indigo-100 dark:bg-indigo-900/40">
            <BellIcon className="w-7 h-7 text-indigo-600 dark:text-indigo-400" />
          </span>
        </div>

        {/* Title + body */}
        <div className="text-center">
          <h2 id="notif-modal-title" className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {t('settings.notification_modal_title')}
          </h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {t('settings.notification_modal_body')}
          </p>
        </div>

        {/* Meal bullets */}
        <ul className="flex flex-col gap-1.5 text-sm text-gray-700 dark:text-gray-300">
          {MEAL_BULLETS.map(({ emoji, labelKey }) => (
            <li key={labelKey} className="flex items-center gap-2">
              <span aria-hidden="true">{emoji}</span>
              <span>{t(labelKey)}</span>
            </li>
          ))}
        </ul>

        {/* CTA */}
        <button
          type="button"
          onClick={onAllow}
          className="w-full rounded-xl bg-indigo-600 py-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 active:bg-indigo-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 transition-colors"
        >
          {t('settings.notification_modal_allow')}
        </button>

        {/* Dismiss */}
        <button
          type="button"
          onClick={onDismiss}
          className="text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-center transition-colors"
        >
          {t('settings.notification_modal_dismiss')}
        </button>
      </div>
    </div>
  );
}
