import { useEffect, useState } from "react";
import { activityService } from "@/services/activityService";
import type { ActivityTemplateResponse, ActivityTemplateRequest, ParsedActivityItem } from "@/types";
import LoadingSpinner from "@/components/LoadingSpinner";
import ErrorMessage from "@/components/ErrorMessage";
import { extractApiError } from "@/utils/apiError";
import { fmt } from "@/utils/format";

export default function ActivitiesPage() {
  const [templates, setTemplates] = useState<ActivityTemplateResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [busy, setBusy] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<number | null>(null);

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
    activityType: "MET_SIMPLE",
    templateName: "",
    autoAddToNewDay: false,
    defaultDurationMinutes: null,
    defaultMET: null,
    segments: [],
  });

  function friendlyName(name: string) {
    const map: Record<string, string> = { Sleep: "Sleep" };
    return map[name] ?? name;
  }

  function friendlyHint(name: string): string | null {
    const hints: Record<string, string> = {
      "Daily movement": "Walking around, chores, errands, and other non-exercise movement",
      Sleep: "Rest and recovery — your body uses energy even while sleeping",
    };
    return hints[name] ?? null;
  }

  function load() {
    setLoading(true);
    setError(null);
    activityService
      .getTemplates()
      .then(({ data }) => setTemplates(data))
      .catch((err) => setError(extractApiError(err, "Failed to load your saved activities.")))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  // --- AI parse handlers ---

  async function handleAiParse() {
    if (!aiText.trim()) return;
    setAiParsing(true);
    setAiError(null);
    try {
      const { data } = await activityService.parseActivity({ freeText: aiText });
      if (!data.length) {
        setAiError("We couldn't recognize any activities. Try describing them a bit differently.");
        return;
      }
      setAiParsed(data);
    } catch (err) {
      setAiError(extractApiError(err, "We couldn't recognize those activities. Try describing them a bit differently."));
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
          activityType: p.activityType,
          templateName: p.activityName,
          autoAddToNewDay: false,
          defaultDurationMinutes: p.durationMinutes,
          defaultMET: p.metValue,
          segments: p.segments.map((s) => ({
            segmentOrder: s.segmentOrder,
            segmentName: s.segmentName,
            metValue: s.metValue,
            durationMinutes: s.durationMinutes,
          })),
        });
      }
      setAiText("");
      setAiParsed(null);
      load();
    } catch (err) {
      setAiError(extractApiError(err, "Something went wrong saving your activities. Please try again."));
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
      load();
    } catch { /* ignore */ }
    setBusy(false);
  }

  function handleEditTemplate(t: ActivityTemplateResponse) {
    setEditingTemplateId(t.activityTemplateId);
    setShowAdd(true);
    setForm({
      templateScope: t.templateScope,
      activityType: t.activityType,
      templateName: t.templateName,
      autoAddToNewDay: t.autoAddToNewDay,
      defaultDurationMinutes: t.defaultDurationMinutes,
      defaultMET: t.defaultMET,
      segments: t.segments.map((s) => ({
        segmentOrder: s.segmentOrder,
        segmentName: s.segmentName,
        metValue: s.metValue,
        durationMinutes: s.durationMinutes,
      })),
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
      load();
    } catch { /* ignore */ }
    setBusy(false);
  }

  function resetForm() {
    setShowAdd(false);
    setEditingTemplateId(null);
    setForm({ templateScope: "USER", activityType: "MET_SIMPLE", templateName: "", autoAddToNewDay: false, defaultDurationMinutes: null, defaultMET: null, segments: [] });
    setDurationUnit("minutes");
    setMetExplanation(null);
    setShowManualAdvanced(false);
  }

  async function handleDelete(id: number) {
    setBusy(true);
    try {
      await activityService.removeTemplate(id);
      load();
    } catch { /* ignore */ }
    setBusy(false);
  }

  if (loading) return <LoadingSpinner message="Loading your saved activities..." />;
  if (error) return <ErrorMessage message={error} onRetry={load} />;

  const userTemplates = templates.filter((t) => t.templateScope === "USER");
  const systemTemplates = templates.filter((t) => t.templateScope === "SYSTEM");

  return (
    <div className="space-y-3">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Your Saved Activities</h1>
        <p className="mt-1.5 text-sm text-gray-400">
          Create shortcuts for the activities you do regularly — they'll show up on your{" "}
          <a href="/today" className="font-medium text-indigo-600 hover:text-indigo-800 transition-colors">Daily page</a>
          {" "}so you can log them in one tap.
        </p>
      </div>

      {/* Quick create — AI-powered */}
      <Card
        title="Quick create"
        subtitle="Describe your activities in plain text — we'll estimate the details for you"
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
            className="flex-1 rounded-lg border border-gray-300 bg-gray-50/50 px-4 py-2.5 text-sm shadow-sm placeholder:text-gray-400 focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:outline-none resize-none transition-colors"
            aria-label="Describe the activities you want to save"
          />
          <button
            onClick={handleAiParse}
            disabled={aiParsing || !aiText.trim()}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors sm:w-auto w-full sm:self-end"
          >
            {aiParsing ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                Creating…
              </>
            ) : (
              <>
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                Create
              </>
            )}
          </button>
        </div>
        <p className="mt-1.5 text-xs text-gray-400">You can always adjust the details before saving</p>

        {aiError && <p className="mt-2 text-sm text-red-600" role="alert">{aiError}</p>}

        {aiParsed && aiParsed.length > 0 && (
          <div className="mt-4 space-y-3 rounded-lg border border-indigo-100 bg-indigo-50/30 p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">Review &amp; adjust</p>
              <p className="text-xs text-gray-400">You can edit these before saving</p>
            </div>
            
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto rounded-lg border border-gray-200 bg-white">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50/80 border-b border-gray-200 text-xs font-semibold uppercase tracking-wider text-gray-500">
                    <th className="py-2.5 px-3 text-left">Activity name</th>
                    <th className="py-2.5 px-2 text-right">
                      Duration
                      <select value={durationUnit} onChange={(e) => setDurationUnit(e.target.value as "minutes" | "hours")} className="ml-1 rounded border border-gray-200 px-1 py-0.5 text-xs font-normal focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none">
                        <option value="minutes">min</option>
                        <option value="hours">hr</option>
                      </select>
                    </th>
                    <th className="py-2.5 px-2 text-right">Intensity</th>
                    <th className="py-2.5 px-2 w-8"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {aiParsed.map((p, i) => (
                    <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                      <td className="py-2.5 px-3">
                        <input value={p.activityName} onChange={(e) => handleEditAiParsed(i, "activityName", e.target.value)} className="w-full rounded-md border border-gray-200 px-2.5 py-1.5 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none" aria-label="Activity name" />
                      </td>
                      <td className="py-2.5 px-2">
                        <input type="number" step={durationUnit === "hours" ? "0.25" : "1"} value={p.durationMinutes != null ? (durationUnit === "hours" ? +(p.durationMinutes / 60).toFixed(2) : p.durationMinutes) : ""} onChange={(e) => { const raw = e.target.value ? parseFloat(e.target.value) : null; handleEditAiParsed(i, "durationMinutes", raw != null ? String(durationUnit === "hours" ? raw * 60 : raw) : ""); }} className="w-20 rounded-md border border-gray-200 px-2 py-1.5 text-right text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none" aria-label="Duration" />
                      </td>
                      <td className="py-2.5 px-2">
                        <input type="number" step="0.1" value={p.metValue ?? ""} onChange={(e) => handleEditAiParsed(i, "metValue", e.target.value)} placeholder="Auto" className="w-16 rounded-md border border-gray-200 px-2 py-1.5 text-right text-sm placeholder:text-gray-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none" aria-label="MET value" />
                      </td>
                      <td className="py-2.5 px-2">
                        <button onClick={() => handleRemoveAiParsed(i)} title="Remove" aria-label={`Remove ${p.activityName}`} className="rounded-md p-1.5 text-gray-300 hover:text-red-600 hover:bg-red-50 transition-colors">
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
                <div key={i} className="rounded-lg border border-gray-200 bg-white p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <input value={p.activityName} onChange={(e) => handleEditAiParsed(i, "activityName", e.target.value)} className="flex-1 rounded-md border border-gray-200 px-2.5 py-1.5 text-sm font-medium focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none" aria-label="Activity name" />
                    <button onClick={() => handleRemoveAiParsed(i)} aria-label={`Remove ${p.activityName}`} className="rounded-md p-2 text-gray-300 hover:text-red-600 hover:bg-red-50 transition-colors flex-shrink-0">
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] uppercase tracking-wide text-gray-400">Duration</label>
                      <div className="flex gap-1 mt-0.5">
                        <input type="number" step={durationUnit === "hours" ? "0.25" : "1"} value={p.durationMinutes != null ? (durationUnit === "hours" ? +(p.durationMinutes / 60).toFixed(2) : p.durationMinutes) : ""} onChange={(e) => { const raw = e.target.value ? parseFloat(e.target.value) : null; handleEditAiParsed(i, "durationMinutes", raw != null ? String(durationUnit === "hours" ? raw * 60 : raw) : ""); }} className="w-full rounded-md border border-gray-200 px-2 py-1 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none" aria-label="Duration" />
                        <select value={durationUnit} onChange={(e) => setDurationUnit(e.target.value as "minutes" | "hours")} className="rounded-md border border-gray-200 px-1 py-1 text-xs focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none">
                          <option value="minutes">min</option>
                          <option value="hours">hr</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] uppercase tracking-wide text-gray-400">Intensity</label>
                      <input type="number" step="0.1" value={p.metValue ?? ""} onChange={(e) => handleEditAiParsed(i, "metValue", e.target.value)} placeholder="Auto" className="w-full mt-0.5 rounded-md border border-gray-200 px-2 py-1 text-sm text-right placeholder:text-gray-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none" aria-label="MET value" />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row justify-end gap-2 pt-1">
              <button onClick={() => { setAiParsed(null); setAiError(null); }} className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-white/60 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500">Cancel</button>
              <button onClick={handleAiConfirmAsTemplates} disabled={aiSaving || aiParsed.length === 0} className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-600">
                {aiSaving ? (
                  <>
                    <svg className="animate-spin h-4 w-4 inline mr-1.5" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                    Saving…
                  </>
                ) : (
                  `Save ${aiParsed.length === 1 ? "activity" : `${aiParsed.length} activities`}`
                )}
              </button>
            </div>
          </div>
        )}
      </Card>

      {/* Manual create form */}
      {showAdd && (
        <Card
          title={editingTemplateId ? "Edit activity" : "Create custom activity"}
          subtitle={editingTemplateId ? undefined : "Set each detail yourself — great when you want precise control"}
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Activity name *</label>
                <input value={form.templateName} onChange={(e) => setForm({ ...form, templateName: e.target.value })} placeholder='e.g. "Morning run", "Yoga class"' aria-label="Activity name" className="w-full rounded-lg border border-gray-300 bg-gray-50/50 px-3.5 py-2.5 text-sm shadow-sm placeholder:text-gray-400 focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:outline-none transition-colors" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Typical duration</label>
                <div className="flex gap-2">
                  <input type="number" step={durationUnit === "hours" ? "0.25" : "1"} value={form.defaultDurationMinutes != null ? (durationUnit === "hours" ? +(form.defaultDurationMinutes / 60).toFixed(2) : form.defaultDurationMinutes) : ""} onChange={(e) => { const v = e.target.value ? +e.target.value : null; setForm({ ...form, defaultDurationMinutes: v != null ? (durationUnit === "hours" ? v * 60 : v) : null }); }} aria-label="Duration" className="flex-1 rounded-lg border border-gray-300 bg-gray-50/50 px-3.5 py-2.5 text-sm shadow-sm focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:outline-none transition-colors" />
                  <select value={durationUnit} onChange={(e) => setDurationUnit(e.target.value as "minutes" | "hours")} aria-label="Duration unit" className="rounded-lg border border-gray-300 bg-gray-50/50 px-3 py-2.5 text-sm shadow-sm focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:outline-none transition-colors">
                    <option value="minutes">min</option>
                    <option value="hours">hr</option>
                  </select>
                </div>
              </div>
            </div>

            <label className="flex items-center gap-2.5 text-sm text-gray-700 cursor-pointer select-none group">
              <input type="checkbox" checked={form.autoAddToNewDay} onChange={(e) => setForm({ ...form, autoAddToNewDay: e.target.checked })} className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 transition-colors" />
              <span className="group-hover:text-gray-900 transition-colors">Include every day automatically</span>
            </label>
            <p className="text-xs text-gray-400 ml-7">Great for things like sleep or daily movement that happen every day</p>

            {/* Advanced options */}
            <button
              onClick={() => setShowManualAdvanced((v) => !v)}
              aria-expanded={showManualAdvanced}
              aria-controls="manual-advanced-options"
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-indigo-600 font-medium rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500 transition-colors"
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
              Advanced options
            </button>

            {showManualAdvanced && (
              <div id="manual-advanced-options" role="region" aria-label="Advanced activity options" className="space-y-3 rounded-lg border border-gray-200 bg-gray-50/40 p-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-sm font-medium text-gray-700">Intensity (MET)</label>
                    <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer">
                      <input type="checkbox" checked={autoMet} onChange={(e) => { setAutoMet(e.target.checked); if (e.target.checked) { setForm({ ...form, defaultMET: null }); setMetExplanation(null); } }} className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 h-3 w-3" />
                      Auto-estimate
                    </label>
                  </div>
                  {autoMet ? (
                    <div className="flex gap-2">
                      <input type="number" step="0.1" value={form.defaultMET ?? ""} readOnly placeholder="Auto" className="flex-1 rounded-md border border-gray-200 bg-gray-100 px-3 py-2 text-sm text-gray-500 placeholder:text-gray-400" aria-label="MET value (auto)" />
                      <button type="button" onClick={handleEstimateMet} disabled={estimatingMet || !form.templateName.trim()} className="rounded-md bg-indigo-100 px-3 py-2 text-xs font-medium text-indigo-700 hover:bg-indigo-200 disabled:opacity-50 whitespace-nowrap transition-colors">
                        {estimatingMet ? "Estimating…" : "Estimate now"}
                      </button>
                    </div>
                  ) : (
                    <input type="number" step="0.1" min="0.5" max="50" value={form.defaultMET ?? ""} onChange={(e) => setForm({ ...form, defaultMET: e.target.value ? +e.target.value : null })} placeholder="e.g. 3.5" aria-label="MET value" className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none" />
                  )}
                  {metExplanation && <p className="mt-1.5 text-xs text-indigo-600 italic">{metExplanation}</p>}
                  <p className="mt-1.5 text-xs text-gray-400">Only change this if you want to fine-tune the calorie estimate. Leave on Auto for a sensible default.</p>
                </div>
              </div>
            )}

            <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-2">
              <button onClick={resetForm} className="rounded-lg px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500">Cancel</button>
              <button onClick={editingTemplateId ? handleUpdate : handleAdd} disabled={busy || !form.templateName.trim()} className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-green-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-600">
                {busy ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                    {editingTemplateId ? "Saving…" : "Saving…"}
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                    {editingTemplateId ? "Save changes" : "Save activity"}
                  </>
                )}
              </button>
            </div>
          </div>
        </Card>
      )}

      {/* Your saved activities */}
      <Card
        title="Your saved activities"
        subtitle="These show up as one-tap shortcuts when you log activities on your Daily page"
        icon={
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
          </svg>
        }
      >
        {userTemplates.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <p className="text-sm font-medium text-gray-500">Nothing saved yet</p>
            <p className="mt-1 text-sm text-gray-400">Describe an activity above and we'll save it for you</p>
            <p className="mt-3 text-xs text-gray-400 italic">Try something like: "30 min walking" or "1 hour yoga"</p>
            {!showAdd && (
              <button onClick={() => { setEditingTemplateId(null); setShowAdd(true); }} className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                Create manually
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="divide-y divide-gray-100 rounded-lg border border-gray-100 overflow-hidden">
              {userTemplates.map((t) => (
                <div key={t.activityTemplateId} className="flex items-center justify-between bg-white px-4 py-3 hover:bg-indigo-50/30 transition-colors group">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-gray-900 text-sm">{friendlyName(t.templateName)}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {t.defaultDurationMinutes != null ? (t.defaultDurationMinutes >= 60 ? `Usually ${+(t.defaultDurationMinutes / 60).toFixed(1)} h` : `Usually ${fmt(t.defaultDurationMinutes)} min`) : "No duration set"}
                      {t.autoAddToNewDay && (
                        <>
                          <span className="mx-1 text-gray-300">·</span>
                          <span className="text-indigo-500 font-medium">included daily</span>
                        </>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button onClick={() => handleEditTemplate(t)} disabled={busy} title="Edit" aria-label={`Edit ${friendlyName(t.templateName)}`} className="rounded-md p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500">
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                    </button>
                    <button onClick={() => handleDelete(t.activityTemplateId)} disabled={busy} title="Delete" aria-label={`Delete ${friendlyName(t.templateName)}`} className="rounded-md p-2 text-gray-300 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-500">
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
            {!showAdd && (
              <button onClick={() => { setEditingTemplateId(null); setShowAdd(true); }} className="mt-3 inline-flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-800 font-medium rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                Create custom activity
              </button>
            )}
          </>
        )}
      </Card>

      {/* Built-in activities */}
      {systemTemplates.length > 0 && (
        <Card
          title="Built-in activities"
          subtitle="Things like sleep and daily movement happen every day and affect your calorie estimate. Including them keeps your daily numbers accurate."
          icon={
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
            </svg>
          }
          variant="muted"
        >
          <div className="divide-y divide-gray-100 rounded-lg border border-gray-100 bg-white/80 overflow-hidden">
            {systemTemplates.map((t) => (
              <div key={t.activityTemplateId} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-gray-700 text-sm">{friendlyName(t.templateName)}</p>
                    <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500 ring-1 ring-inset ring-gray-200">built-in</span>
                  </div>
                  {t.defaultDurationMinutes != null && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      Usually {t.defaultDurationMinutes >= 60 ? `${+(t.defaultDurationMinutes / 60).toFixed(1)} h` : `${fmt(t.defaultDurationMinutes)} min`}
                    </p>
                  )}
                  {friendlyHint(t.templateName) && (
                    <p className="text-xs text-gray-400 italic mt-0.5">{friendlyHint(t.templateName)}</p>
                  )}
                </div>
                <label className="flex items-center gap-2 text-xs text-gray-500 cursor-pointer select-none flex-shrink-0 group">
                  <input
                    type="checkbox"
                    checked={t.autoAddToNewDay}
                    disabled={busy}
                    onChange={async () => {
                      setBusy(true);
                      try {
                        await activityService.updateTemplate(t.activityTemplateId, {
                          templateScope: t.templateScope,
                          activityType: t.activityType,
                          templateName: t.templateName,
                          autoAddToNewDay: !t.autoAddToNewDay,
                          defaultDurationMinutes: t.defaultDurationMinutes,
                          defaultMET: t.defaultMET,
                          segments: t.segments ?? [],
                        });
                        load();
                      } catch (err) {
                        setError(extractApiError(err, "Failed to update this activity."));
                      } finally {
                        setBusy(false);
                      }
                    }}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 transition-colors"
                  />
                  <span className="group-hover:text-gray-700 transition-colors">Include every day</span>
                </label>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-gray-400">
            You can adjust the duration for built-in activities on your{" "}
            <a href="/today" className="font-medium text-indigo-600 hover:text-indigo-800 transition-colors">Daily page</a>
            {" "}if your actual time differs from the default.
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
      ? "rounded-xl border-2 border-indigo-200 bg-white shadow-md ring-1 ring-indigo-100"
      : variant === "muted"
        ? "rounded-xl border border-gray-100 bg-gray-50/60 shadow-none"
        : "rounded-xl border border-gray-200 bg-white shadow-sm";
  const titleClass =
    variant === "primary"
      ? "text-sm font-bold uppercase tracking-wide text-indigo-600"
      : variant === "muted"
        ? "text-xs font-semibold uppercase tracking-wide text-gray-400"
        : "text-sm font-semibold uppercase tracking-wide text-gray-500";

  return (
    <section className={`${sectionClass} p-4 sm:p-5`}>
      <div className="flex items-center gap-2 mb-1">
        {icon && <span className={variant === "muted" ? "text-gray-400" : "text-indigo-500"} aria-hidden="true">{icon}</span>}
        <h2 className={titleClass}>{title}</h2>
      </div>
      {subtitle && <p className="mb-3 text-xs text-gray-400">{subtitle}</p>}
      {!subtitle && <div className="mb-2" />}
      {children}
    </section>
  );
}
