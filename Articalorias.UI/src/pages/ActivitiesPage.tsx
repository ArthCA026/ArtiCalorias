import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { activityService } from "@/services/activityService";
import type { ActivityTemplateResponse, ActivityTemplateRequest, ParsedActivityItem } from "@/types";
import LoadingSpinner from "@/components/LoadingSpinner";
import ErrorMessage from "@/components/ErrorMessage";
import { extractApiError } from "@/utils/apiError";
import { fmt } from "@/utils/format";
import { queryKeys } from "@/lib/queryKeys";

export default function ActivitiesPage() {
  const { t } = useTranslation();
  const queryClientInstance = useQueryClient();
  const templatesQuery = useQuery({
    queryKey: queryKeys.activityTemplates(),
    queryFn: () => activityService.getTemplates().then(r => r.data),
    staleTime: 10 * 60 * 1000,
  });
  const templates = templatesQuery.data ?? [];
  const [error, setError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [busy, setBusy] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<number | null>(null);

  function invalidateTemplates() {
    queryClientInstance.invalidateQueries({ queryKey: queryKeys.activityTemplates() });
  }

  // --- AI parse state ---
  const [aiText, setAiText] = useState("");
  const [aiParsed, setAiParsed] = useState<ParsedActivityItem[] | null>(null);
  const [aiParsing, setAiParsing] = useState(false);
  const [aiSaving, setAiSaving] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // --- Auto MET state ---
  const [autoMet, setAutoMet] = useState(true);
  const [estimatingMet, setEstimatingMet] = useState(false);
  const [metExplanation, setMetExplanation] = useState<string | null>(null);
  const [durationUnit, setDurationUnit] = useState<"minutes" | "hours">("minutes");
  const [showManualAdvanced, setShowManualAdvanced] = useState(false);

  const [form, setForm] = useState<ActivityTemplateRequest>({
    templateScope: "USER",
    templateName: "",
    autoAddToNewDay: false,
    defaultDurationMinutes: null,
    defaultMET: null,
  });

  // --- AI parse handlers ---

  async function handleAiParse() {
    if (!aiText.trim()) return;
    setAiParsing(true);
    setAiError(null);
    try {
      const { data } = await activityService.parseActivity({ freeText: aiText });
      if (!data.length) {
        setAiError(t('activities.quick_no_results'));
        return;
      }
      setAiParsed(data);
    } catch (err) {
      setAiError(extractApiError(err, t('activities.quick_error')));
    } finally {
      setAiParsing(false);
    }
  }

  function handleEditAiParsed(idx: number, field: keyof ParsedActivityItem, value: string) {
    if (!aiParsed) return;
    const updated = [...aiParsed];
    const numFields: (keyof ParsedActivityItem)[] = ["durationMinutes", "metValue"];
    if (numFields.includes(field)) {
      const item: Record<string, unknown> = { ...updated[idx] };
      const num = parseFloat(value);
      item[field] = isNaN(num) ? null : num;
      updated[idx] = item as unknown as ParsedActivityItem;
    } else {
      const item: Record<string, unknown> = { ...updated[idx] };
      item[field] = value;
      updated[idx] = item as unknown as ParsedActivityItem;
    }
    setAiParsed(updated);
  }

  function handleRemoveAiParsed(idx: number) {
    if (!aiParsed) return;
    setAiParsed(aiParsed.filter((_, i) => i !== idx));
  }

  async function handleAiConfirmAsTemplates() {
    if (!aiParsed?.length) return;
    setAiSaving(true);
    setAiError(null);
    try {
      for (const p of aiParsed) {
        await activityService.createTemplate({
          templateScope: "USER",
          templateName: p.activityName,
          autoAddToNewDay: false,
          defaultDurationMinutes: p.durationMinutes,
          defaultMET: p.metValue,
        });
      }
      setAiText("");
      setAiParsed(null);
      invalidateTemplates();
    } catch (err) {
      setAiError(extractApiError(err, t('activities.save_error')));
    } finally {
      setAiSaving(false);
    }
  }

  // --- Manual add with auto-MET ---

  async function handleEstimateMet() {
    if (!form.templateName.trim()) return;
    setEstimatingMet(true);
    setMetExplanation(null);
    try {
      const { data } = await activityService.estimateMet({
        activityName: form.templateName,
        durationMinutes: form.defaultDurationMinutes,
      });
      setForm((prev) => ({ ...prev, defaultMET: data.metValue }));
      setMetExplanation(data.explanation);
    } catch { /* ignore */ }
    setEstimatingMet(false);
  }

  async function handleAdd() {
    if (!form.templateName.trim()) return;
    setBusy(true);
    let submitForm = { ...form };
    if (autoMet && !form.defaultMET) {
      setEstimatingMet(true);
      try {
        const { data } = await activityService.estimateMet({
          activityName: form.templateName,
          durationMinutes: form.defaultDurationMinutes,
        });
        submitForm = { ...submitForm, defaultMET: data.metValue };
      } catch { /* ignore */ }
      setEstimatingMet(false);
    }
    try {
      await activityService.createTemplate(submitForm);
      resetForm();
      invalidateTemplates();
    } catch { /* ignore */ }
    setBusy(false);
  }

  function handleEditTemplate(t: ActivityTemplateResponse) {
    setEditingTemplateId(t.activityTemplateId);
    setShowAdd(true);
    setForm({
      templateScope: t.templateScope,
      templateName: t.templateName,
      autoAddToNewDay: t.autoAddToNewDay,
      defaultDurationMinutes: t.defaultDurationMinutes,
      defaultMET: t.defaultMET,
    });
    setAutoMet(!t.defaultMET);
    setMetExplanation(null);
  }

  async function handleUpdate() {
    if (!form.templateName.trim() || editingTemplateId == null) return;
    setBusy(true);
    let submitForm = { ...form };
    if (autoMet && !form.defaultMET) {
      setEstimatingMet(true);
      try {
        const { data } = await activityService.estimateMet({
          activityName: form.templateName,
          durationMinutes: form.defaultDurationMinutes,
        });
        submitForm = { ...submitForm, defaultMET: data.metValue };
      } catch { /* ignore */ }
      setEstimatingMet(false);
    }
    try {
      await activityService.updateTemplate(editingTemplateId, submitForm);
      resetForm();
      invalidateTemplates();
    } catch { /* ignore */ }
    setBusy(false);
  }

  function resetForm() {
    setShowAdd(false);
    setEditingTemplateId(null);
    setForm({ templateScope: "USER", templateName: "", autoAddToNewDay: false, defaultDurationMinutes: null, defaultMET: null });
    setDurationUnit("minutes");
    setMetExplanation(null);
    setShowManualAdvanced(false);
  }

  async function handleDelete(id: number) {
    setBusy(true);
    try {
      await activityService.removeTemplate(id);
      invalidateTemplates();
    } catch { /* ignore */ }
    setBusy(false);
  }

  if (templatesQuery.isPending) return <LoadingSpinner message={t('activities.loading')} />;
  if (templatesQuery.isError) return <ErrorMessage message={t('activities.load_error')} onRetry={() => templatesQuery.refetch()} />;
  if (error) return <ErrorMessage message={error} onRetry={() => setError(null)} />;

  const userTemplates = templates.filter((t) => t.templateScope === "USER");
  const systemTemplates = templates.filter((t) => t.templateScope === "SYSTEM");

  return (
    <div className="space-y-3 overflow-x-hidden">

      {/* Quick create — AI-powered */}
      <Card
        title={t('activities.quick_title')}
        subtitle={t('activities.quick_subtitle')}
        icon={
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
          </svg>
        }
      >
        <div className="flex flex-col sm:flex-row gap-2">
          <textarea
            value={aiText}
            onChange={(e) => setAiText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                handleAiParse();
              }
            }}
            placeholder='e.g. "30 min walking, 1 hour yoga, 20 min running"'
            rows={2}
            className="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50/50 dark:bg-gray-800/50 px-4 py-2.5 text-sm text-gray-900 dark:text-gray-100 shadow-sm placeholder:text-gray-400 focus:border-indigo-500 focus:bg-white dark:focus:bg-gray-800 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none resize-none transition-colors"
            aria-label={t('activities.quick_aria')}
          />
          <button
            onClick={handleAiParse}
            disabled={aiParsing || !aiText.trim()}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors sm:w-auto w-full sm:self-end"
          >
            {aiParsing ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                {t('activities.quick_parsing')}
              </>
            ) : (
              <>
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                {t('activities.quick_parse')}
              </>
            )}
          </button>
        </div>
        <p className="mt-1.5 text-xs text-gray-400 dark:text-gray-500">{t('activities.quick_adjust_note')}</p>

        {aiError && <p className="mt-2 text-sm text-red-600" role="alert">{aiError}</p>}

        {aiParsed && aiParsed.length > 0 && (
          <div className="mt-4 space-y-3 rounded-lg border border-indigo-100 dark:border-indigo-900 bg-indigo-50/30 dark:bg-indigo-950/20 p-4">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">{t('activities.review_title')}</p>
              <p className="text-xs text-gray-400 dark:text-gray-500">{t('activities.review_note')}</p>
            </div>
            
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50/80 dark:bg-gray-900/80 border-b border-gray-200 dark:border-gray-700 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    <th className="py-2.5 px-3 text-left">{t('activities.table_name')}</th>
                    <th className="py-2.5 px-2 text-right">
                      {t('activities.table_duration')}
                        <select value={durationUnit} onChange={(e) => setDurationUnit(e.target.value as "minutes" | "hours")} className="ml-1 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-1 py-0.5 text-xs font-normal focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none">
                        <option value="minutes">min</option>
                        <option value="hours">hr</option>
                      </select>
                    </th>
                    <th className="py-2.5 px-2 text-right">{t('activities.table_intensity')}</th>
                    <th className="py-2.5 px-2 w-8"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {aiParsed.map((p, i) => (
                    <tr key={i} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/40 transition-colors">
                      <td className="py-2.5 px-3">
                        <input value={p.activityName} onChange={(e) => handleEditAiParsed(i, "activityName", e.target.value)} className="w-full rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-2.5 py-1.5 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none" aria-label="Activity name" />
                      </td>
                      <td className="py-2.5 px-2">
                        <input type="number" step={durationUnit === "hours" ? "0.25" : "1"} value={p.durationMinutes != null ? (durationUnit === "hours" ? +(p.durationMinutes / 60).toFixed(2) : p.durationMinutes) : ""} onChange={(e) => { const raw = e.target.value ? parseFloat(e.target.value) : null; handleEditAiParsed(i, "durationMinutes", raw != null ? String(durationUnit === "hours" ? raw * 60 : raw) : ""); }} className="w-20 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-2 py-1.5 text-right text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none" aria-label="Duration" />
                      </td>
                      <td className="py-2.5 px-2">
                        <input type="number" step="0.1" value={p.metValue ?? ""} onChange={(e) => handleEditAiParsed(i, "metValue", e.target.value)} placeholder="Auto" className="w-16 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-2 py-1.5 text-right text-sm placeholder:text-gray-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none" aria-label="MET value" />
                      </td>
                      <td className="py-2.5 px-2">
                        <button onClick={() => handleRemoveAiParsed(i)} title="Remove" aria-label={`Remove ${p.activityName}`} className="rounded-md p-1.5 text-gray-300 dark:text-gray-600 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors">
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden space-y-2">
              {aiParsed.map((p, i) => (
                <div key={i} className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <input value={p.activityName} onChange={(e) => handleEditAiParsed(i, "activityName", e.target.value)} className="flex-1 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-2.5 py-1.5 text-sm font-medium focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none" aria-label="Activity name" />
                    <button onClick={() => handleRemoveAiParsed(i)} aria-label={`Remove ${p.activityName}`} className="rounded-md p-2 text-gray-300 dark:text-gray-600 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors flex-shrink-0">
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] uppercase tracking-wide text-gray-400 dark:text-gray-500">{t('activities.duration_label')}</label>
                      <div className="flex gap-1 mt-0.5">
                        <input type="number" step={durationUnit === "hours" ? "0.25" : "1"} value={p.durationMinutes != null ? (durationUnit === "hours" ? +(p.durationMinutes / 60).toFixed(2) : p.durationMinutes) : ""} onChange={(e) => { const raw = e.target.value ? parseFloat(e.target.value) : null; handleEditAiParsed(i, "durationMinutes", raw != null ? String(durationUnit === "hours" ? raw * 60 : raw) : ""); }} className="w-full rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-2 py-1 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none" aria-label="Duration" />
                        <select value={durationUnit} onChange={(e) => setDurationUnit(e.target.value as "minutes" | "hours")} className="rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-1 py-1 text-xs focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none">
                          <option value="minutes">min</option>
                          <option value="hours">hr</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] uppercase tracking-wide text-gray-400 dark:text-gray-500">{t('activities.intensity_label')}</label>
                      <input type="number" step="0.1" value={p.metValue ?? ""} onChange={(e) => handleEditAiParsed(i, "metValue", e.target.value)} placeholder="Auto" className="w-full mt-0.5 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-2 py-1 text-sm text-right placeholder:text-gray-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none" aria-label="MET value" />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row justify-end gap-2 pt-1">
              <button onClick={() => { setAiParsed(null); setAiError(null); }} className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-white/60 dark:hover:bg-gray-800/60 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500">{t('activities.cancel')}</button>
              <button onClick={handleAiConfirmAsTemplates} disabled={aiSaving || aiParsed.length === 0} className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-600">
                {aiSaving ? (
                  <>
                    <svg className="animate-spin h-4 w-4 inline mr-1.5" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                    {t('activities.saving')}
                  </>
                ) : (
                  aiParsed.length === 1 ? t('activities.save_one') : t('activities.save_many', { count: aiParsed.length })
                )}
              </button>
            </div>
          </div>
        )}
      </Card>

      {/* Manual create form */}
      {showAdd && (
        <Card
          title={editingTemplateId ? t('activities.edit_title') : t('activities.manual_title')}
          subtitle={editingTemplateId ? undefined : t('activities.manual_subtitle')}
          icon={
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          }
        >
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('activities.name_label')}</label>
                <input value={form.templateName} onChange={(e) => setForm({ ...form, templateName: e.target.value })} placeholder={t('activities.name_placeholder')} aria-label={t('activities.table_name')} className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50/50 dark:bg-gray-800/50 px-3.5 py-2.5 text-sm text-gray-900 dark:text-gray-100 shadow-sm placeholder:text-gray-400 focus:border-indigo-500 focus:bg-white dark:focus:bg-gray-800 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none transition-colors" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('activities.typical_duration')}</label>
                <div className="flex gap-2">
                  <input type="number" step={durationUnit === "hours" ? "0.25" : "1"} value={form.defaultDurationMinutes != null ? (durationUnit === "hours" ? +(form.defaultDurationMinutes / 60).toFixed(2) : form.defaultDurationMinutes) : ""} onChange={(e) => { const v = e.target.value ? +e.target.value : null; setForm({ ...form, defaultDurationMinutes: v != null ? (durationUnit === "hours" ? v * 60 : v) : null }); }} aria-label="Duration" className="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50/50 dark:bg-gray-800/50 text-gray-900 dark:text-gray-100 px-3.5 py-2.5 text-sm shadow-sm focus:border-indigo-500 focus:bg-white dark:focus:bg-gray-800 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none transition-colors" />
                  <select value={durationUnit} onChange={(e) => setDurationUnit(e.target.value as "minutes" | "hours")} aria-label="Duration unit" className="rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50/50 dark:bg-gray-800/50 text-gray-900 dark:text-gray-100 px-3 py-2.5 text-sm shadow-sm focus:border-indigo-500 focus:bg-white dark:focus:bg-gray-800 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none transition-colors">
                    <option value="minutes">min</option>
                    <option value="hours">hr</option>
                  </select>
                </div>
              </div>
            </div>

            <label className="flex items-center gap-2.5 text-sm text-gray-700 dark:text-gray-300 cursor-pointer select-none group">
              <input type="checkbox" checked={form.autoAddToNewDay} onChange={(e) => setForm({ ...form, autoAddToNewDay: e.target.checked })} className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 transition-colors" />
              <span className="group-hover:text-gray-900 transition-colors">{t('activities.auto_add_label')}</span>
            </label>
            <p className="text-xs text-gray-400 dark:text-gray-500 ml-7">{t('activities.auto_add_hint')}</p>

            {/* Advanced options */}
            <button
              onClick={() => setShowManualAdvanced((v) => !v)}
              aria-expanded={showManualAdvanced}
              aria-controls="manual-advanced-options"
              className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 hover:text-indigo-600 font-medium rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500 transition-colors"
            >
              <svg
                className={`h-3.5 w-3.5 transition-transform ${showManualAdvanced ? "rotate-90" : ""}`}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <polyline points="9 18 15 12 9 6" />
              </svg>
              {showManualAdvanced ? t('activities.advanced_options') : t('activities.advanced_options')}
            </button>

            {showManualAdvanced && (
              <div id="manual-advanced-options" role="region" aria-label="Advanced activity options" className="space-y-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50/40 dark:bg-gray-800/40 p-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('activities.met_label')}</label>
                      <label className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 cursor-pointer">
                      <input type="checkbox" checked={autoMet} onChange={(e) => { setAutoMet(e.target.checked); if (e.target.checked) { setForm({ ...form, defaultMET: null }); setMetExplanation(null); } }} className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 h-3 w-3" />
                      {t('activities.met_auto_label')}
                    </label>
                  </div>
                  {autoMet ? (
                    <div className="flex gap-2">
                      <input type="number" step="0.1" value={form.defaultMET ?? ""} readOnly placeholder="Auto" className="flex-1 rounded-md border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 px-3 py-2 text-sm text-gray-500 dark:text-gray-400 placeholder:text-gray-400" aria-label="MET value (auto)" />
                      <button type="button" onClick={handleEstimateMet} disabled={estimatingMet || !form.templateName.trim()} className="rounded-md bg-indigo-100 px-3 py-2 text-xs font-medium text-indigo-700 hover:bg-indigo-200 disabled:opacity-50 whitespace-nowrap transition-colors">
                        {estimatingMet ? t('activities.met_estimating') : t('activities.met_estimate')}
                      </button>
                    </div>
                  ) : (
                    <input type="number" step="0.1" min="0.5" max="50" value={form.defaultMET ?? ""} onChange={(e) => setForm({ ...form, defaultMET: e.target.value ? +e.target.value : null })} placeholder="e.g. 3.5" aria-label="MET value" className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none" />
                  )}
                  {metExplanation && <p className="mt-1.5 text-xs text-indigo-600 italic">{metExplanation}</p>}
                  <p className="mt-1.5 text-xs text-gray-400 dark:text-gray-500">Only change this if you want to fine-tune the calorie estimate. Leave on Auto for a sensible default.</p>
                </div>
              </div>
            )}

            <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-2">
              <button onClick={resetForm} className="rounded-lg px-4 py-2.5 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500">{t('activities.cancel')}</button>
              <button onClick={editingTemplateId ? handleUpdate : handleAdd} disabled={busy || !form.templateName.trim()} className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-green-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-600">
                {busy ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                    {t('activities.saving')}
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                    {editingTemplateId ? t('activities.update_button') : t('activities.add_button')}
                  </>
                )}
              </button>
            </div>
          </div>
        </Card>
      )}

      {/* Your saved activities */}
      <Card
        title={t('activities.user_templates_title')}
        subtitle={t('activities.user_templates_subtitle')}
        icon={
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
          </svg>
        }
      >
        {userTemplates.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-4 sm:py-8 text-center">
            <p className="text-sm font-medium text-gray-500">{t('activities.no_user_templates')}</p>
            {!showAdd && (
              <button onClick={() => { setEditingTemplateId(null); setShowAdd(true); }} className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                {t('activities.create_manually')}
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="divide-y divide-gray-100 dark:divide-gray-800 rounded-lg border border-gray-100 dark:border-gray-800 overflow-hidden">
              {userTemplates.map((tmpl) => (
                <div key={tmpl.activityTemplateId} className="flex items-center justify-between bg-white dark:bg-gray-900 px-4 py-3 hover:bg-indigo-50/30 dark:hover:bg-indigo-950/20 transition-colors group">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-gray-900 dark:text-gray-100 text-sm">{tmpl.templateName}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                      {tmpl.defaultDurationMinutes != null ? (tmpl.defaultDurationMinutes >= 60 ? t('activities.duration_usually_h', { amount: +(tmpl.defaultDurationMinutes / 60).toFixed(1) }) : t('activities.duration_usually_min', { amount: fmt(tmpl.defaultDurationMinutes) })) : t('activities.no_duration')}
                      {tmpl.autoAddToNewDay && (
                        <>
                          <span className="mx-1 text-gray-300 dark:text-gray-600">·</span>
                          <span className="text-indigo-500 font-medium">{t('activities.included_daily')}</span>
                        </>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button onClick={() => handleEditTemplate(tmpl)} disabled={busy} title={t('common.edit')} aria-label={`Edit ${tmpl.templateName}`} className="rounded-md p-2 text-gray-400 dark:text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500">
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                    </button>
                    <button onClick={() => handleDelete(tmpl.activityTemplateId)} disabled={busy} title={t('common.delete')} aria-label={`Delete ${tmpl.templateName}`} className="rounded-md p-2 text-gray-300 dark:text-gray-600 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-500">
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
            {!showAdd && (
              <button onClick={() => { setEditingTemplateId(null); setShowAdd(true); }} className="mt-3 inline-flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-800 font-medium rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                {t('activities.create_custom')}
              </button>
            )}
          </>
        )}
      </Card>

      {/* Built-in activities */}
      {systemTemplates.length > 0 && (
        <Card
          title={t('activities.system_templates_title')}
          subtitle={t('activities.system_templates_subtitle')}
          icon={
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
            </svg>
          }
          variant="muted"
        >
          <div className="divide-y divide-gray-100 dark:divide-gray-800 rounded-lg border border-gray-100 dark:border-gray-800 bg-white/80 dark:bg-gray-900/80 overflow-hidden">
            {systemTemplates.map((tmpl) => (
                <div key={tmpl.activityTemplateId} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-gray-700 dark:text-gray-300 text-sm">{tmpl.templateName}</p>
                    <span className="inline-flex items-center rounded-full bg-gray-100 dark:bg-gray-800 px-2 py-0.5 text-[10px] font-medium text-gray-500 dark:text-gray-400 ring-1 ring-inset ring-gray-200 dark:ring-gray-700">{t('activities.badge_builtin')}</span>
                  </div>
                  {tmpl.defaultDurationMinutes != null && (
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                      {tmpl.defaultDurationMinutes >= 60 ? t('activities.duration_usually_h', { amount: +(tmpl.defaultDurationMinutes / 60).toFixed(1) }) : t('activities.duration_usually_min', { amount: fmt(tmpl.defaultDurationMinutes) })}
                    </p>
                  )}
                </div>
                <label className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 cursor-pointer select-none flex-shrink-0 group whitespace-nowrap">
                  <input
                    type="checkbox"
                    checked={tmpl.autoAddToNewDay}
                    disabled={busy}
                    onChange={async () => {
                      setBusy(true);
                      try {
                        await activityService.updateTemplate(tmpl.activityTemplateId, {
                          templateScope: tmpl.templateScope,
                          templateName: tmpl.templateName,
                          autoAddToNewDay: !tmpl.autoAddToNewDay,
                          defaultDurationMinutes: tmpl.defaultDurationMinutes,
                          defaultMET: tmpl.defaultMET,
                        });
                        invalidateTemplates();
                      } catch (err) {
                        setError(extractApiError(err, t('activities.update_error')));
                      } finally {
                        setBusy(false);
                      }
                    }}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 transition-colors"
                  />
                  <span className="group-hover:text-gray-700 transition-colors">{t('activities.include_every_day')}</span>
                </label>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-gray-400 dark:text-gray-500">
            {t('activities.system_hint')}
          </p>
        </Card>
      )}
    </div>
  );
}

/* --- Card Component --- */
function Card({
  title,
  subtitle,
  icon,
  variant,
  children,
}: {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  variant?: "primary" | "muted";
  children: React.ReactNode;
}) {
  const sectionClass =
    variant === "primary"
      ? "rounded-xl border-2 border-indigo-200 dark:border-indigo-700 bg-white dark:bg-gray-900 shadow-md ring-1 ring-indigo-100 dark:ring-indigo-900"
      : variant === "muted"
        ? "rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-900/40 shadow-none"
        : "rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm";
  const titleClass =
    variant === "primary"
      ? "text-sm font-bold uppercase tracking-wide text-indigo-600"
      : variant === "muted"
        ? "text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500"
        : "text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400";

  return (
    <section className={`${sectionClass} p-4 sm:p-5 overflow-hidden`}>
      <div className="flex items-center gap-2 mb-1 flex-wrap">
        {icon && <span className={variant === "muted" ? "text-gray-400 dark:text-gray-500" : "text-indigo-500"} aria-hidden="true">{icon}</span>}
        <h2 className={titleClass}>{title}</h2>
      </div>
      {subtitle && <p className="mb-3 text-xs text-gray-400 dark:text-gray-500">{subtitle}</p>}
      {!subtitle && <div className="mb-2" />}
      {children}
    </section>
  );
}
