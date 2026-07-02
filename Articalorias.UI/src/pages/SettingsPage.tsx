import { useState, Fragment } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { useTheme } from "@/hooks/useTheme";
import { useLanguage } from "@/hooks/useLanguage";
import type { Language } from "@/hooks/useLanguage";
import { useUnits } from "@/hooks/useUnits";
import { useNotificationSettings } from "@/hooks/useNotificationSettings";
import { NotificationPermissionModal } from "@/components/NotificationPermissionModal";
import { formatLocalTime } from "@/utils/notifications";
import { useCalorieMode } from "@/hooks/useCalorieMode";
import { useSafeguardToggle } from "@/hooks/useSafeguardToggle";
import { useAuth } from "@/hooks/useAuth";
import { userService } from "@/services/userService";

/* ─── tiny helpers ─────────────────────────────────────────── */

interface ToggleProps {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}

function Toggle({ checked, onChange, disabled = false }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:opacity-50 ${
        checked ? "bg-indigo-600" : "bg-gray-200 dark:bg-gray-700"
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition-transform ${
          checked ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
}

interface SettingRowProps {
  label: string;
  description?: string;
  children: React.ReactNode;
}

function SettingRow({ label, description, children }: SettingRowProps) {
  return (
    <div className="flex items-center justify-between gap-4 py-3.5">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{label}</p>
        {description && (
          <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">{description}</p>
        )}
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );
}

interface SectionBlockProps {
  title: string;
  subtitle?: string;
  wip?: boolean;
  icon?: React.ReactNode;
  children: React.ReactNode;
}

function SectionBlock({ title, subtitle, wip = false, icon, children }: SectionBlockProps) {
  return (
    <div className="px-6 py-5 sm:px-8 sm:py-6">
      <div className="mb-4">
        <div className="flex items-center gap-2">
          {icon && <span className="flex-shrink-0 text-indigo-500">{icon}</span>}
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
          {wip && (
            <span className="rounded-full bg-amber-100 dark:bg-amber-900/50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">
              WIP
            </span>
          )}
        </div>
        {subtitle && <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">{subtitle}</p>}
      </div>
      <div className="divide-y divide-gray-100 dark:divide-gray-800">{children}</div>
    </div>
  );
}

function PillToggle<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { key: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden text-sm font-medium shadow-sm">
      {options.map(({ key, label }) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          className={`px-3 py-1.5 transition-colors ${
            value === key
              ? "bg-indigo-600 text-white"
              : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

const SELECT_CLS =
  "rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 " +
  "text-gray-900 dark:text-gray-100 px-2 py-1.5 text-sm shadow-sm " +
  "focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none";

function TimePicker12h({
  hour,
  minute,
  onChange,
}: {
  hour: number;
  minute: number;
  onChange: (hour: number, minute: number) => void;
}) {
  const isAm = hour < 12;
  const display12 = hour % 12 === 0 ? 12 : hour % 12;

  function setHour12(h12: number) {
    const h24 = isAm ? (h12 === 12 ? 0 : h12) : h12 === 12 ? 12 : h12 + 12;
    onChange(h24, minute);
  }
  function setAmPm(am: boolean) {
    let h24 = hour;
    if (am && hour >= 12) h24 = hour - 12;
    if (!am && hour < 12) h24 = hour + 12;
    onChange(h24, minute);
  }

  return (
    <div className="flex items-center gap-1">
      <select
        value={display12}
        onChange={(e) => setHour12(Number(e.target.value))}
        className={SELECT_CLS}
      >
        {[12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((h) => (
          <option key={h} value={h}>{h}</option>
        ))}
      </select>
      <span className="text-gray-400 dark:text-gray-500 text-sm font-semibold select-none">:</span>
      <select
        value={minute}
        onChange={(e) => onChange(hour, Number(e.target.value))}
        className={SELECT_CLS}
      >
        {Array.from({ length: 12 }, (_, i) => i * 5).map((m) => (
          <option key={m} value={m}>{String(m).padStart(2, "0")}</option>
        ))}
      </select>
      <select
        value={isAm ? "AM" : "PM"}
        onChange={(e) => setAmPm(e.target.value === "AM")}
        className={SELECT_CLS}
      >
        <option value="AM">AM</option>
        <option value="PM">PM</option>
      </select>
    </div>
  );
}

/* ─── page ─────────────────────────────────────────────────── */

export default function SettingsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { logout } = useAuth();
  /* Appearance */
  const { theme, setTheme } = useTheme();
  const { language, setLanguage } = useLanguage();

  /* Units */
  const { weightUnit, setWeightUnit, energyUnit, setEnergyUnit } = useUnits();

  /* Notifications */
  const push = usePushNotifications();
  const { schedules, updateSchedule, isSaving } = useNotificationSettings();
  const [showPermissionModal, setShowPermissionModal] = useState(false);

  function handlePushToggle(on: boolean) {
    if (on) {
      if (push.permission === 'granted') {
        push.subscribe();
      } else {
        const lastDismiss = Number(localStorage.getItem('ac-notification-dismiss') ?? 0);
        if (Date.now() - lastDismiss > 30 * 24 * 60 * 60 * 1000) {
          setShowPermissionModal(true);
        } else {
          push.subscribe();
        }
      }
    } else {
      push.unsubscribe();
    }
  }

  /* Display */
  const { mode: calorieMode, setMode: setCalorieMode, isSaving: calorieModeSaving } = useCalorieMode();
  const [weeklyResetDay, setWeeklyResetDay] = useState("monday");

  /* Tracking */
  const { enabled: minCalSafeguard, setEnabled: setSafeguardEnabled, isSaving: safeguardSaving } = useSafeguardToggle();
  const [showSafeguardWarning, setShowSafeguardWarning] = useState(false);

  /* Danger zone */
  const [showClearHistoryModal, setShowClearHistoryModal] = useState(false);
  const [showDeleteAccountModal, setShowDeleteAccountModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  const clearHistoryMutation = useMutation({
    mutationFn: () => userService.clearHistory(),
    onSuccess: () => {
      queryClient.clear();
      setShowClearHistoryModal(false);
    },
  });

  const deleteAccountMutation = useMutation({
    mutationFn: () => userService.deleteAccount(),
    onSuccess: () => {
      queryClient.clear();
      logout();
    },
  });

  return (
    <div className="max-w-xl mx-auto">

      {showPermissionModal && (
        <NotificationPermissionModal
          onAllow={() => {
            setShowPermissionModal(false);
            push.subscribe();
          }}
          onDismiss={() => {
            setShowPermissionModal(false);
            localStorage.setItem('ac-notification-dismiss', String(Date.now()));
          }}
        />
      )}

      {showSafeguardWarning && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="safeguard-warning-title"
        >
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-gray-900 shadow-2xl p-6 flex flex-col gap-4">
            <div className="flex justify-center">
              <span className="flex items-center justify-center w-14 h-14 rounded-full bg-amber-100 dark:bg-amber-900/40">
                <svg className="w-7 h-7 text-amber-600 dark:text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              </span>
            </div>
            <div className="text-center">
              <h2 id="safeguard-warning-title" className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Turn off minimum calories safeguard?
              </h2>
              <p className="mt-1.5 text-sm text-gray-500 dark:text-gray-400">
                Your daily adjusted calorie goal may drop below recommended health minimums (1&nbsp;200–1&nbsp;500 kcal). Only disable this if you're working with a medical or nutrition professional.
              </p>
            </div>
            <button
              type="button"
              onClick={() => { setShowSafeguardWarning(false); setSafeguardEnabled(false); }}
              className="w-full rounded-xl bg-amber-600 py-3 text-sm font-semibold text-white shadow-sm hover:bg-amber-700 active:bg-amber-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600 transition-colors"
            >
              Turn off anyway
            </button>
            <button
              type="button"
              onClick={() => setShowSafeguardWarning(false)}
              className="text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-center transition-colors"
            >
              Keep it on
            </button>
          </div>
        </div>
      )}

      {/* ── Clear history confirmation ── */}
      {showClearHistoryModal && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="clear-history-title"
        >
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-gray-900 shadow-2xl p-6 flex flex-col gap-4">
            <div className="flex justify-center">
              <span className="flex items-center justify-center w-14 h-14 rounded-full bg-red-100 dark:bg-red-900/40">
                <svg className="w-7 h-7 text-red-600 dark:text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4h6v2" />
                </svg>
              </span>
            </div>
            <div className="text-center">
              <h2 id="clear-history-title" className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Clear all history?
              </h2>
              <p className="mt-1.5 text-sm text-gray-500 dark:text-gray-400">
                Every daily log, food entry, and activity record will be permanently deleted. Your profile settings will be kept.
              </p>
            </div>
            {clearHistoryMutation.isError && (
              <p className="text-xs text-center text-red-500">Something went wrong. Please try again.</p>
            )}
            <button
              type="button"
              disabled={clearHistoryMutation.isPending}
              onClick={() => clearHistoryMutation.mutate()}
              className="w-full rounded-xl bg-red-600 py-3 text-sm font-semibold text-white shadow-sm hover:bg-red-700 active:bg-red-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {clearHistoryMutation.isPending ? "Clearing…" : "Yes, clear everything"}
            </button>
            <button
              type="button"
              onClick={() => setShowClearHistoryModal(false)}
              className="text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-center transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── Delete account confirmation ── */}
      {showDeleteAccountModal && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-account-title"
        >
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-gray-900 shadow-2xl p-6 flex flex-col gap-4">
            <div className="flex justify-center">
              <span className="flex items-center justify-center w-14 h-14 rounded-full bg-red-100 dark:bg-red-900/40">
                <svg className="w-7 h-7 text-red-600 dark:text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
                  <line x1="18" y1="8" x2="23" y2="13" /><line x1="23" y1="8" x2="18" y2="13" />
                </svg>
              </span>
            </div>
            <div className="text-center">
              <h2 id="delete-account-title" className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Delete your account?
              </h2>
              <p className="mt-1.5 text-sm text-gray-500 dark:text-gray-400">
                Your account, all logs, and every piece of data will be permanently erased. This cannot be undone.
              </p>
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 text-center">
                Type <span className="font-mono font-bold text-red-600">DELETE</span> to confirm
              </label>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="DELETE"
                autoCapitalize="characters"
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-center font-mono text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:border-red-500 focus:ring-1 focus:ring-red-500 focus:outline-none"
              />
            </div>
            {deleteAccountMutation.isError && (
              <p className="text-xs text-center text-red-500">Something went wrong. Please try again.</p>
            )}
            <button
              type="button"
              disabled={deleteConfirmText !== "DELETE" || deleteAccountMutation.isPending}
              onClick={() => deleteAccountMutation.mutate()}
              className="w-full rounded-xl bg-red-600 py-3 text-sm font-semibold text-white shadow-sm hover:bg-red-700 active:bg-red-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {deleteAccountMutation.isPending ? "Deleting…" : "Delete my account"}
            </button>
            <button
              type="button"
              onClick={() => setShowDeleteAccountModal(false)}
              className="text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-center transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="space-y-6 sm:space-y-8">

        {/* ── Main settings card ── */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm divide-y divide-gray-100 dark:divide-gray-800">

        {/* ── Appearance ── */}
        <SectionBlock
          title={t('settings.appearance_title')}
          subtitle={t('settings.appearance_subtitle')}
          icon={
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
            </svg>
          }
        >
          <SettingRow label={t('settings.theme_label')} description={t('settings.theme_description')}>
            <select
              value={theme}
              onChange={(e) => setTheme(e.target.value as typeof theme)}
              className="rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-2.5 py-1.5 text-sm shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
            >
              <option value="system">{t('settings.theme_system')}</option>
              <option value="light">{t('settings.theme_light')}</option>
              <option value="dark">{t('settings.theme_dark')}</option>
            </select>
          </SettingRow>

          <SettingRow label={t('settings.language_label')} description={t('settings.language_description')}>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as Language)}
              className="rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-2.5 py-1.5 text-sm shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
            >
              <option value="en">{t('settings.lang_en')}</option>
              <option value="es">{t('settings.lang_es')}</option>
            </select>
          </SettingRow>
        </SectionBlock>

        {/* ── Units ── */}
        <SectionBlock
          title={t('settings.units_title')}
          subtitle={t('settings.units_subtitle')}
          icon={
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 3h18v18H3z" /><path d="M3 9h18M3 15h18M9 3v18M15 3v18" />
            </svg>
          }
        >
          <SettingRow label={t('settings.weight_label')} description={t('settings.weight_description')}>
            <PillToggle
              options={[{ key: "kg", label: "kg" }, { key: "lbs", label: "lbs" }]}
              value={weightUnit}
              onChange={setWeightUnit}
            />
          </SettingRow>

          <SettingRow label={t('settings.energy_label')} description={t('settings.energy_description')}>
            <PillToggle
              options={[{ key: "kcal", label: "kcal" }, { key: "kJ", label: "kJ" }]}
              value={energyUnit}
              onChange={setEnergyUnit}
            />
          </SettingRow>
        </SectionBlock>

        {/* ── Notifications ── */}
        <SectionBlock
          title={t('settings.notifications_title')}
          subtitle={t('settings.notifications_subtitle')}
          icon={
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
          }
        >
          <SettingRow
            label={t('settings.push_label')}
            description={
              !push.supported
                ? t('settings.notification_push_unsupported')
                : push.permission === 'denied'
                ? t('settings.notification_push_denied')
                : t('settings.push_description')
            }
          >
            <Toggle
              checked={push.subscribed}
              disabled={push.loading || !push.supported || push.permission === 'denied'}
              onChange={handlePushToggle}
            />
          </SettingRow>

          {push.subscribed && (
            <>
              {schedules.map((reminder) => (
                <Fragment key={reminder.type}>
                  <SettingRow
                    label={`${{ breakfast: '🌅', lunch: '☀️', dinner: '🌙' }[reminder.type]} ${t(`settings.reminder_${reminder.type}`)}`}
                    description={reminder.enabled ? formatLocalTime(reminder.hour, reminder.minute) : t('settings.reminder_off')}
                  >
                    <Toggle
                      checked={reminder.enabled}
                      disabled={isSaving}
                      onChange={(on) => updateSchedule(reminder.type, { enabled: on })}
                    />
                  </SettingRow>

                  {reminder.enabled && (
                    <SettingRow label="" description={t('settings.reminder_time_label')}>
                      <TimePicker12h
                        hour={reminder.hour}
                        minute={reminder.minute}
                        onChange={(h, m) => updateSchedule(reminder.type, { hour: h, minute: m })}
                      />
                    </SettingRow>
                  )}
                </Fragment>
              ))}
            </>
          )}
        </SectionBlock>

        {/* ── Display ── */}
        <SectionBlock
          title={t('settings.display_title')}
          subtitle={t('settings.display_subtitle')}
          icon={
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8M12 17v4" />
            </svg>
          }
        >
          <SettingRow
            label={t('settings.calorie_mode_label')}
            description={t('settings.calorie_mode_description')}
          >
            <select
              value={calorieMode}
              disabled={calorieModeSaving}
              onChange={(e) => setCalorieMode(e.target.value as typeof calorieMode)}
              className="rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-2.5 py-1.5 text-sm shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="net">{t('settings.calorie_mode_net')}</option>
              <option value="goal">{t('settings.calorie_mode_goal')}</option>
              <option value="adjusted">{t('settings.calorie_mode_adjusted')}</option>
            </select>
          </SettingRow>

          {/* Calorie mode description */}
          {calorieMode === "net" && (
            <div className="flex items-start gap-2 rounded-lg bg-indigo-50 dark:bg-indigo-950 px-3 py-2.5 text-xs text-indigo-700 dark:text-indigo-300">
              <svg className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              <span><span className="font-semibold">Net Balance</span> — calories eaten minus calories burned through activity. Shows whether you're in a surplus or deficit for the day.</span>
            </div>
          )}
          {calorieMode === "goal" && (
            <div className="flex items-start gap-2 rounded-lg bg-indigo-50 dark:bg-indigo-950 px-3 py-2.5 text-xs text-indigo-700 dark:text-indigo-300">
              <svg className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              <span><span className="font-semibold">Daily Goal</span> — your fixed daily calorie target from your profile. A constant reference regardless of activity or weekly surplus/deficit.</span>
            </div>
          )}
          {calorieMode === "adjusted" && (
            <div className="flex items-start gap-2 rounded-lg bg-indigo-50 dark:bg-indigo-950 px-3 py-2.5 text-xs text-indigo-700 dark:text-indigo-300">
              <svg className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              <span><span className="font-semibold">Weekly Adjusted</span> — your daily goal is shifted up or down based on how over/under you've been so far this week, keeping your weekly total on track.</span>
            </div>
          )}

          {calorieMode === "adjusted" && (
            <SettingRow
              label="Weekly adjustment resets on"
              description="The day of the week your weekly calorie balance resets to zero."
            >
              <select
                value={weeklyResetDay}
                onChange={(e) => setWeeklyResetDay(e.target.value)}
                className="rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-2.5 py-1.5 text-sm shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
              >
                <option value="monday">Monday</option>
                <option value="tuesday">Tuesday</option>
                <option value="wednesday">Wednesday</option>
                <option value="thursday">Thursday</option>
                <option value="friday">Friday</option>
                <option value="saturday">Saturday</option>
                <option value="sunday">Sunday</option>
              </select>
            </SettingRow>
          )}
        </SectionBlock>

        {/* ── Tracking ── */}
        <SectionBlock
          title={t('settings.tracking_title')}
          subtitle={t('settings.tracking_subtitle')}
          icon={
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
            </svg>
          }
        >
          <SettingRow
            label="Minimum calories safeguard"
            description="Prevents your daily adjusted goal from dropping below a healthy floor. Turn off only if you know what you're doing."
          >
            <Toggle
              checked={minCalSafeguard}
              disabled={safeguardSaving}
              onChange={(newVal) => {
                if (!newVal) {
                  setShowSafeguardWarning(true);
                } else {
                  setSafeguardEnabled(true);
                }
              }}
            />
          </SettingRow>
        </SectionBlock>

        {/* ── About ── */}
        <SectionBlock
          title="About"
          subtitle="Version information and useful links."
          icon={
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          }
        >
          <SettingRow label="Version" description="The version of ArtiCalorias you're currently running.">
            <span className="rounded-full bg-indigo-50 dark:bg-indigo-950 px-2.5 py-1 text-xs font-semibold text-indigo-700 dark:text-indigo-300">
              1.3.0
            </span>
          </SettingRow>


        </SectionBlock>

        </div>{/* end main settings card */}

        {/* ── Danger zone ── */}
        <div className="rounded-xl border border-red-200 dark:border-red-900 bg-white dark:bg-gray-900 p-6 sm:p-8 shadow-sm space-y-4">
          <div className="flex items-center gap-2">
            <svg className="h-4 w-4 flex-shrink-0 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <div>
              <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Danger zone</h2>
              <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">
                These actions are permanent and cannot be undone.
              </p>
            </div>
          </div>

          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            <SettingRow
              label="Clear history"
              description="Permanently delete every daily log entry. Your profile settings are kept."
            >
              <button
                type="button"
                disabled={clearHistoryMutation.isPending}
                onClick={() => setShowClearHistoryModal(true)}
                className="rounded-md border border-red-300 dark:border-red-800 px-3 py-1.5 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {clearHistoryMutation.isPending ? "Clearing…" : "Clear history"}
              </button>
            </SettingRow>

            <SettingRow
              label="Delete account"
              description="Permanently remove your account and all associated data from ArtiCalorias."
            >
              <button
                type="button"
                disabled={deleteAccountMutation.isPending}
                onClick={() => { setDeleteConfirmText(""); setShowDeleteAccountModal(true); }}
                className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {deleteAccountMutation.isPending ? "Deleting…" : "Delete account"}
              </button>
            </SettingRow>
          </div>
        </div>

      </div>
    </div>
  );
}
