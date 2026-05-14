import { useState, Fragment } from "react";
import { usePushNotifications } from "@/hooks/usePushNotifications";

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
        checked ? "bg-indigo-600" : "bg-gray-200"
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
        <p className="text-sm font-medium text-gray-900">{label}</p>
        {description && (
          <p className="mt-0.5 text-xs text-gray-400">{description}</p>
        )}
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );
}

interface SectionCardProps {
  index: number;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}

function SectionCard({ index, icon, title, subtitle, children }: SectionCardProps) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 sm:p-8 shadow-sm space-y-1">
      <div className="flex items-start gap-3 mb-4">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white flex-shrink-0 mt-0.5">
          {index}
        </span>
        <div>
          <div className="flex items-center gap-2">
            {icon}
            <h2 className="text-base font-semibold text-gray-900">{title}</h2>
          </div>
          <p className="mt-0.5 text-xs text-gray-400">{subtitle}</p>
        </div>
      </div>
      <div className="divide-y divide-gray-100">{children}</div>
    </div>
  );
}

/* ─── changelog data ───────────────────────────────────────── */

type ChangeType = "new" | "improved" | "fixed" | "removed";

interface ChangeItem {
  type: ChangeType;
  text: string;
}

interface Release {
  version: string;
  date: string;
  summary: string;
  changes: ChangeItem[];
}

const CHANGELOG: Release[] = [
  {
    version: "1.1.0",
    date: "2026-05-14",
    summary: "Lots of improvements, fixes, and new features.",
    changes: [
      { type: "new",      text: "Settings page" },
      { type: "new",      text: "Changelog" },
      { type: "new",      text: "Push notification support (demo)" },
      { type: "new",      text: "Photo logging with gallery picker (Beta)" },
      { type: "new",      text: "Activity logging redesigned with AI assistance" },
      { type: "new",      text: "Configurable NEAT and sleep in profile settings" },
      { type: "new",      text: "Calorie & protein goal selector for new users" },
      { type: "new",      text: "Minimum adjusted calorie floor" },
      { type: "new",      text: "Display mode toggle: Net, Goal, or Adjusted Goal" },
      { type: "improved", text: "Today page fully redesigned, more compact" },
      { type: "improved", text: "Profile page redesigned, more compact" },
      { type: "improved", text: "Monthly overview section compacted" },
      { type: "improved", text: "Profile changes now recalculate today's goals immediately" },
      { type: "improved", text: "Database queries optimized to reduce costs" },
      { type: "improved", text: "AI model upgraded to GPT-5.5" },
      { type: "improved", text: "AI returns per-unit kcal; server multiplies by quantity" },
      { type: "improved", text: "Protein goal recalibrated to realistic values" },
      { type: "fixed",    text: "Progress bar now uses adjusted goal" },
      { type: "fixed",    text: "Monthly \"No data\" message hidden for past months" },
      { type: "fixed",    text: "Navigation no longer resets to current month after viewing a past day" },
      { type: "fixed",    text: "Daily calorie bar adjusts based on weekly plan" },
      { type: "fixed",    text: "Profile layout fixed on mobile" },
      { type: "fixed",    text: "Chart border artifact removed" },
      { type: "fixed",    text: "History table: \"Result\" column renamed to \"Net Balance\"" },
    ],
  },
  {
    version: "1.0.0",
    date: "2025-07-01",
    summary: "ArtiCalorias is born.",
    changes: [
      { type: "new", text: "ArtiCalorias is born" },
    ],
  },
];

const CHANGE_BADGE: Record<ChangeType, { label: string; className: string; dotClassName: string }> = {
  new:      { label: "New",      className: "bg-indigo-50 text-indigo-700", dotClassName: "bg-indigo-400" },
  improved: { label: "Improved", className: "bg-blue-50 text-blue-700",    dotClassName: "bg-blue-400"   },
  fixed:    { label: "Fixed",    className: "bg-green-50 text-green-700",  dotClassName: "bg-green-400"  },
  removed:  { label: "Removed",  className: "bg-red-50 text-red-600",      dotClassName: "bg-red-400"    },
};

interface ChangelogEntryProps {
  release: Release;
  defaultOpen?: boolean;
}

function ChangelogEntry({ release, defaultOpen = false }: ChangelogEntryProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 bg-white hover:bg-gray-50 transition-colors text-left"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-700 flex-shrink-0">
            v{release.version}
          </span>
          <span className="text-sm font-medium text-gray-900 truncate">
            {release.summary}
          </span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-xs text-gray-400">{release.date}</span>
          <svg
            className={`h-3.5 w-3.5 text-gray-400 transition-transform ${open ? "rotate-90" : ""}`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </div>
      </button>

      {open && (
        <ul className="px-4 pb-4 pt-2 space-y-0 border-t border-gray-100 bg-gray-50/50">
          {release.changes.map((item, i) => {
            const badge = CHANGE_BADGE[item.type];
            return (
              <li key={i} className="flex items-center gap-2 text-sm py-2">
                {/* dot */}
                <span className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${badge.dotClassName}`} />

                {/* content */}
                <span
                  className={`flex-shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${badge.className}`}
                >
                  {badge.label}
                </span>
                <span className="text-gray-700 leading-snug">{item.text}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/* ─── page ─────────────────────────────────────────────────── */

export default function SettingsPage() {
  /* Appearance */
  const [theme, setTheme] = useState<"system" | "light" | "dark">("system");
  const [language, setLanguage] = useState("en");
  const [compactView, setCompactView] = useState(false);
  const [showCalorieDecimals, setShowCalorieDecimals] = useState(false);

  /* Notifications */
  const push = usePushNotifications();
  const [dailyReminder, setDailyReminder] = useState(true);
  const [weeklyReport, setWeeklyReport] = useState(false);
  const [goalAlerts, setGoalAlerts] = useState(true);
  const [reminderTime, setReminderTime] = useState("08:00");

  /* Units */
  const [weightUnit, setWeightUnit] = useState<"kg" | "lbs">("kg");
  const [energyUnit, setEnergyUnit] = useState<"kcal" | "kJ">("kcal");

  /* Privacy */
  const [shareAnonymousData, setShareAnonymousData] = useState(true);
  const [crashReports, setCrashReports] = useState(true);

  return (
    <div className="max-w-xl mx-auto">
      {/* ── Page header ── */}
      <div className="text-center mb-6 sm:mb-10">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-100">
          <svg
            className="h-6 w-6 text-indigo-600"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">
          Settings
        </h1>
        <p className="mt-3 text-base text-gray-500 max-w-md mx-auto">
          Customise how ArtiCalorias looks and behaves for you.
        </p>
      </div>

      <div className="space-y-6 sm:space-y-8">

        {/* ── Section 1: Appearance ── */}
        <SectionCard
          index={1}
          title="Appearance"
          subtitle="Control how the app looks on your device."
          icon={
            <svg className="h-4 w-4 text-indigo-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
            </svg>
          }
        >
          <SettingRow label="Theme" description="Choose between light, dark, or follow your system setting.">
            <select
              value={theme}
              onChange={(e) => setTheme(e.target.value as typeof theme)}
              className="rounded-md border border-gray-300 px-2.5 py-1.5 text-sm shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
            >
              <option value="system">System</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </SettingRow>

          <SettingRow label="Language" description="The language used throughout the app.">
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="rounded-md border border-gray-300 px-2.5 py-1.5 text-sm shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
            >
              <option value="en">English</option>
              <option value="es">Español</option>
              <option value="fr">Français</option>
              <option value="de">Deutsch</option>
              <option value="pt">Português</option>
            </select>
          </SettingRow>

          <SettingRow label="Compact view" description="Show more items on screen by reducing spacing.">
            <Toggle checked={compactView} onChange={setCompactView} />
          </SettingRow>

          <SettingRow label="Show calorie decimals" description="Display calories with one decimal place.">
            <Toggle checked={showCalorieDecimals} onChange={setShowCalorieDecimals} />
          </SettingRow>
        </SectionCard>

        {/* ── Section 2: Units ── */}
        <SectionCard
          index={2}
          title="Units"
          subtitle="Choose the measurement units that feel natural to you."
          icon={
            <svg className="h-4 w-4 text-indigo-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 3h18v18H3z" /><path d="M3 9h18M3 15h18M9 3v18M15 3v18" />
            </svg>
          }
        >
          <SettingRow label="Weight" description="Unit used for displaying your body weight.">
            <div className="flex rounded-lg border border-gray-300 overflow-hidden text-sm font-medium shadow-sm">
              {(["kg", "lbs"] as const).map((u) => (
                <button
                  key={u}
                  type="button"
                  onClick={() => setWeightUnit(u)}
                  className={`px-3 py-1.5 transition-colors ${
                    weightUnit === u
                      ? "bg-indigo-600 text-white"
                      : "bg-white text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {u}
                </button>
              ))}
            </div>
          </SettingRow>

          <SettingRow label="Energy" description="Unit used for displaying calorie counts.">
            <div className="flex rounded-lg border border-gray-300 overflow-hidden text-sm font-medium shadow-sm">
              {(["kcal", "kJ"] as const).map((u) => (
                <button
                  key={u}
                  type="button"
                  onClick={() => setEnergyUnit(u)}
                  className={`px-3 py-1.5 transition-colors ${
                    energyUnit === u
                      ? "bg-indigo-600 text-white"
                      : "bg-white text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {u}
                </button>
              ))}
            </div>
          </SettingRow>
        </SectionCard>

        {/* ── Section 3: Notifications ── */}
        <SectionCard
          index={3}
          title="Notifications"
          subtitle="Decide when and how ArtiCalorias reaches out to you."
          icon={
            <svg className="h-4 w-4 text-indigo-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
          }
        >
          <SettingRow
            label="Push notifications"
            description={
              !push.supported
                ? "Not supported in this browser."
                : push.permission === "denied"
                ? "Blocked by your browser — update site permissions to re-enable."
                : "Allow ArtiCalorias to send you notifications when installed as an app."
            }
          >
            <Toggle
              checked={push.subscribed}
              disabled={push.loading || !push.supported || push.permission === "denied"}
              onChange={(on) => (on ? push.subscribe() : push.unsubscribe())}
            />
          </SettingRow>

          {push.subscribed && (
            <>
              <SettingRow label="Daily log reminder" description="Get a nudge to log your meals each day.">
                <Toggle checked={dailyReminder} onChange={setDailyReminder} />
              </SettingRow>

              {dailyReminder && (
                <SettingRow label="Reminder time" description="The time you'd like to receive your daily reminder.">
                  <input
                    type="time"
                    value={reminderTime}
                    onChange={(e) => setReminderTime(e.target.value)}
                    className="rounded-md border border-gray-300 px-2.5 py-1.5 text-sm shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                  />
                </SettingRow>
              )}

              <SettingRow label="Weekly progress report" description="A summary of your week delivered every Sunday.">
                <Toggle checked={weeklyReport} onChange={setWeeklyReport} />
              </SettingRow>

              <SettingRow label="Goal alerts" description="Notify me when I'm close to hitting or exceeding my daily goal.">
                <Toggle checked={goalAlerts} onChange={setGoalAlerts} />
              </SettingRow>
            </>
          )}
        </SectionCard>

        {/* ── Section 4: Privacy & Data ── */}
        <SectionCard
          index={4}
          title="Privacy & data"
          subtitle="Control what information is shared to help improve the app."
          icon={
            <svg className="h-4 w-4 text-indigo-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          }
        >
          <SettingRow
            label="Share anonymous usage data"
            description="Help us understand how the app is used — no personal information is ever sent."
          >
            <Toggle checked={shareAnonymousData} onChange={setShareAnonymousData} />
          </SettingRow>

          <SettingRow
            label="Send crash reports"
            description="Automatically send reports when something goes wrong so we can fix it faster."
          >
            <Toggle checked={crashReports} onChange={setCrashReports} />
          </SettingRow>

          <div className="pt-3.5">
            <button
              type="button"
              className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
            >
              Download my data →
            </button>
            <p className="mt-0.5 text-xs text-gray-400">
              Request an export of everything ArtiCalorias has stored for your account.
            </p>
          </div>
        </SectionCard>

        {/* ── Section 5: About ── */}
        <SectionCard
          index={5}
          title="About"
          subtitle="Version information and useful links."
          icon={
            <svg className="h-4 w-4 text-indigo-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          }
        >
          <SettingRow label="Version" description="The version of ArtiCalorias you're currently running.">
            <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700">
              1.1.0
            </span>
          </SettingRow>

          <div className="pt-3.5 space-y-2">
            {[
              { label: "Privacy policy", href: "#" },
              { label: "Terms of service", href: "#" },
              { label: "Open-source licences", href: "#" },
            ].map(({ label, href }) => (
              <div key={label}>
                <a
                  href={href}
                  className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                >
                  {label} →
                </a>
              </div>
            ))}
          </div>

          {/* ── Changelog ── */}
          <div className="pt-4 border-t border-gray-100 space-y-3">
            <div>
              <p className="text-sm font-medium text-gray-900">Changelog</p>
              <p className="mt-0.5 text-xs text-gray-400">
                What's new in each release — tap a version to expand its notes.
              </p>
            </div>
            <div className="space-y-2">
              {CHANGELOG.map((release, i) => (
                <Fragment key={release.version}>
                  <ChangelogEntry release={release} defaultOpen={false} />
                </Fragment>
              ))}
            </div>
          </div>
        </SectionCard>

        {/* ── Danger zone ── */}
        <div className="rounded-xl border border-red-200 bg-white p-6 sm:p-8 shadow-sm space-y-4">
          <div className="flex items-start gap-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-red-100 flex-shrink-0 mt-0.5">
              <svg className="h-4 w-4 text-red-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900">Danger zone</h2>
              <p className="mt-0.5 text-xs text-gray-400">
                These actions are permanent and cannot be undone.
              </p>
            </div>
          </div>

          <div className="divide-y divide-gray-100">
            <SettingRow
              label="Clear all food log history"
              description="Permanently delete every daily log entry. Your profile settings are kept."
            >
              <button
                type="button"
                className="rounded-md border border-red-300 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
              >
                Clear history
              </button>
            </SettingRow>

            <SettingRow
              label="Delete account"
              description="Permanently remove your account and all associated data from ArtiCalorias."
            >
              <button
                type="button"
                className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-500 transition-colors"
              >
                Delete account
              </button>
            </SettingRow>
          </div>
        </div>

      </div>
    </div>
  );
}
