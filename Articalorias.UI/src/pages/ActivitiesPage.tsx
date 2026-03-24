import { useEffect, useState } from "react";
import { activityService } from "@/services/activityService";
import type { ActivityTemplateResponse, ActivityTemplateRequest, ParsedActivityItem } from "@/types";
import LoadingSpinner from "@/components/LoadingSpinner";
import ErrorMessage from "@/components/ErrorMessage";
import EmptyState from "@/components/EmptyState";
import { extractApiError } from "@/utils/apiError";

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

  const [form, setForm] = useState<ActivityTemplateRequest>({
    templateScope: "USER",
    activityType: "MET_SIMPLE",
    templateName: "",
    autoAddToNewDay: false,
    defaultDurationMinutes: null,
    defaultMET: null,
    segments: [],
  });

  function load() {
    setLoading(true);
    setError(null);
    activityService
      .getTemplates()
      .then(({ data }) => setTemplates(data))
      .catch((err) => setError(extractApiError(err, "Failed to load templates.")))
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
      setAiParsed(data);
    } catch (err) {
      setAiError(extractApiError(err, "Failed to parse activity text."));
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
      setAiError(extractApiError(err, "Failed to save templates."));
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
  }

  async function handleDelete(id: number) {
    setBusy(true);
    try {
      await activityService.removeTemplate(id);
      load();
    } catch { /* ignore */ }
    setBusy(false);
  }

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error} onRetry={load} />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Activity Catalog</h1>
          <p className="mt-1 text-sm text-gray-500">Manage your activity templates.</p>
        </div>
        <button onClick={() => { if (showAdd) { resetForm(); } else { setEditingTemplateId(null); setShowAdd(true); } }} className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 transition-colors">
          {showAdd ? "Cancel" : "+ New template"}
        </button>
      </div>

      {/* AI activity parsing for templates */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Create templates with AI</h2>
        <div className="flex gap-2">
          <textarea
            value={aiText}
            onChange={(e) => setAiText(e.target.value)}
            placeholder="Describe activities to create templates for, e.g. 'running 30 min, yoga 1 hour, HIIT circuit with warm-up and cool-down'"
            rows={2}
            className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none resize-none"
          />
          <button
            onClick={handleAiParse}
            disabled={aiParsing || !aiText.trim()}
            className="self-end rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors"
          >
            {aiParsing ? "Adding..." : "Add"}
          </button>
        </div>

        {aiError && <p className="text-sm text-red-600">{aiError}</p>}

        {aiParsed && aiParsed.length > 0 && (
          <div className="space-y-3">
            <p className="text-xs font-medium text-gray-500 uppercase">Review parsed activities - edit values before saving as templates</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-gray-500">
                    <th className="pb-2 pr-2">Name</th>
                    <th className="pb-2 pr-2">Type</th>
                    <th className="pb-2 pr-2 text-right">Duration <select value={durationUnit} onChange={(e) => setDurationUnit(e.target.value as "minutes" | "hours")} className="ml-1 rounded border border-gray-200 px-1 py-0.5 text-xs font-normal"><option value="minutes">min</option><option value="hours">hr</option></select></th>
                    <th className="pb-2 pr-2 text-right">MET</th>
                    <th className="pb-2 w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {aiParsed.map((p, i) => (
                    <tr key={i} className="border-b border-gray-100">
                      <td className="py-1.5 pr-2">
                        <input value={p.activityName} onChange={(e) => handleEditAiParsed(i, "activityName", e.target.value)} className="w-full rounded border border-gray-200 px-1.5 py-1 text-sm" />
                      </td>
                      <td className="py-1.5 pr-2">
                        <select value={p.activityType} onChange={(e) => handleEditAiParsed(i, "activityType", e.target.value)} className="rounded border border-gray-200 px-1 py-1 text-xs">
                          <option value="MET_SIMPLE">MET Simple</option>
                          <option value="MET_MULTIPLE">MET Multiple</option>
                        </select>
                      </td>
                      <td className="py-1.5 pr-2">
                        <input type="number" step={durationUnit === "hours" ? "0.25" : "1"} value={p.durationMinutes != null ? (durationUnit === "hours" ? +(p.durationMinutes / 60).toFixed(2) : p.durationMinutes) : ""} onChange={(e) => { const raw = e.target.value ? parseFloat(e.target.value) : null; handleEditAiParsed(i, "durationMinutes", raw != null ? String(durationUnit === "hours" ? raw * 60 : raw) : ""); }} className="w-20 rounded border border-gray-200 px-1.5 py-1 text-right text-sm" />
                      </td>
                      <td className="py-1.5 pr-2">
                        <input type="number" step="0.1" value={p.metValue ?? ""} onChange={(e) => handleEditAiParsed(i, "metValue", e.target.value)} className="w-14 rounded border border-gray-200 px-1.5 py-1 text-right text-sm" />
                      </td>
                      <td className="py-1.5">
                        <button onClick={() => handleRemoveAiParsed(i)} className="text-red-400 hover:text-red-600 text-xs">&times;</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {aiParsed.some((p) => p.segments.length > 0) && (
              <div className="text-xs text-gray-400 italic">Segments from AI parsing will be saved automatically.</div>
            )}
            <div className="flex justify-end gap-2">
              <button onClick={() => setAiParsed(null)} className="rounded-md px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100">Cancel</button>
              <button onClick={handleAiConfirmAsTemplates} disabled={aiSaving} className="rounded-md bg-green-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-green-500 disabled:opacity-50 transition-colors">
                {aiSaving ? "Saving..." : "Save as Templates"}
              </button>
            </div>
          </div>
        )}

        {aiParsed && aiParsed.length === 0 && (
          <p className="text-sm text-gray-400">No activities were recognized. Try rephrasing.</p>
        )}
      </div>

      {showAdd && (
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">{editingTemplateId ? "Edit template" : "Manual template creation"}</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Name *</label>
              <input value={form.templateName} onChange={(e) => setForm({ ...form, templateName: e.target.value })} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Type</label>
              <select value={form.activityType} onChange={(e) => setForm({ ...form, activityType: e.target.value })} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none">
                <option value="MET_SIMPLE">MET Simple</option>
                <option value="MET_MULTIPLE">MET Multiple</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Default duration</label>
              <div className="mt-1 flex gap-1">
                <input type="number" step={durationUnit === "hours" ? "0.25" : "1"} value={form.defaultDurationMinutes != null ? (durationUnit === "hours" ? +(form.defaultDurationMinutes / 60).toFixed(2) : form.defaultDurationMinutes) : ""} onChange={(e) => { const v = e.target.value ? +e.target.value : null; setForm({ ...form, defaultDurationMinutes: v != null ? (durationUnit === "hours" ? v * 60 : v) : null }); }} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none" />
                <select value={durationUnit} onChange={(e) => setDurationUnit(e.target.value as "minutes" | "hours")} className="rounded-md border border-gray-300 px-2 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none">
                  <option value="minutes">min</option>
                  <option value="hours">hr</option>
                </select>
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-gray-700">Default MET</label>
                <label className="flex items-center gap-1 text-xs text-gray-400">
                  <input type="checkbox" checked={autoMet} onChange={(e) => { setAutoMet(e.target.checked); if (e.target.checked) { setForm({ ...form, defaultMET: null }); setMetExplanation(null); } }} className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 h-3 w-3" />
                  Auto
                </label>
              </div>
              {autoMet ? (
                <div className="mt-1 flex gap-1">
                  <input type="number" step="0.1" value={form.defaultMET ?? ""} readOnly placeholder="Auto" className="w-full rounded-md border border-gray-200 bg-gray-100 px-3 py-2 text-sm text-gray-500" />
                  <button type="button" onClick={handleEstimateMet} disabled={estimatingMet || !form.templateName.trim()} className="rounded-md bg-indigo-100 px-2 py-2 text-xs text-indigo-700 hover:bg-indigo-200 disabled:opacity-50 whitespace-nowrap">
                    {estimatingMet ? "..." : "Estimate"}
                  </button>
                </div>
              ) : (
                <input type="number" step="0.1" value={form.defaultMET ?? ""} onChange={(e) => setForm({ ...form, defaultMET: e.target.value ? +e.target.value : null })} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none" />
              )}
              {metExplanation && <p className="mt-1 text-xs text-gray-400 italic">{metExplanation}</p>}
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={form.autoAddToNewDay} onChange={(e) => setForm({ ...form, autoAddToNewDay: e.target.checked })} className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
            Auto-add to new days
          </label>

          <div className="flex justify-end">
            <button onClick={editingTemplateId ? handleUpdate : handleAdd} disabled={busy || !form.templateName.trim()} className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-500 disabled:opacity-50 transition-colors">
              {busy ? (editingTemplateId ? "Saving..." : "Creating...") : (editingTemplateId ? "Save changes" : "Create template")}
            </button>
          </div>
        </div>
      )}

      {templates.length === 0 && !showAdd ? (
        <EmptyState message="No activity templates yet. Create one to get started." />
      ) : (
        <>
          {/* ── My Templates (USER) ── */}
          {(() => {
            const userTemplates = templates.filter((t) => t.templateScope === "USER");
            return (
              <div className="space-y-3">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">My Templates</h2>
                {userTemplates.length === 0 ? (
                  <EmptyState message="No custom templates yet. Create one above." />
                ) : (
                  userTemplates.map((t) => (
                    <div key={t.activityTemplateId} className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-5 py-4 shadow-sm">
                      <div>
                        <p className="font-medium text-gray-900">{t.templateName}</p>
                        <p className="text-xs text-gray-400">
                          {t.defaultDurationMinutes != null ? (t.defaultDurationMinutes >= 60 ? `${+(t.defaultDurationMinutes / 60).toFixed(1)}h` : `${t.defaultDurationMinutes} min`) : ""}
                          {t.defaultDurationMinutes != null && t.defaultMET != null ? " · " : ""}
                          {t.defaultMET != null ? `MET ${t.defaultMET}` : ""}
                          {t.autoAddToNewDay ? " · auto-add" : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => handleEditTemplate(t)} disabled={busy} title="Edit" className="text-indigo-400 hover:text-indigo-600 disabled:opacity-50"><svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
                        <button onClick={() => handleDelete(t.activityTemplateId)} disabled={busy} title="Delete" className="text-red-400 hover:text-red-600 disabled:opacity-50"><svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            );
          })()}

          {/* ── Default Templates (SYSTEM) ── */}
          {(() => {
            const systemTemplates = templates.filter((t) => t.templateScope === "SYSTEM");
            if (systemTemplates.length === 0) return null;
            return (
              <div className="space-y-3">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Default Templates</h2>
                {systemTemplates.map((t) => (
                  <div key={t.activityTemplateId} className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-5 py-4 shadow-sm">
                    <div>
                      <p className="font-medium text-gray-900">
                        {t.templateName}
                        <span className="ml-2 inline-flex items-center rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 ring-1 ring-inset ring-amber-600/20">system</span>
                      </p>
                      <p className="text-xs text-gray-400">
                        {t.defaultDurationMinutes != null ? (t.defaultDurationMinutes >= 60 ? `${+(t.defaultDurationMinutes / 60).toFixed(1)}h` : `${t.defaultDurationMinutes} min`) : ""}
                        {t.defaultDurationMinutes != null && t.defaultMET != null ? " · " : ""}
                        {t.defaultMET != null ? `MET ${t.defaultMET}` : ""}
                      </p>
                    </div>
                    <label className="flex items-center gap-2 text-xs text-gray-500 cursor-pointer select-none">
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
                            setError(extractApiError(err, "Failed to update auto-add."));
                          } finally {
                            setBusy(false);
                          }
                        }}
                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      Auto-add
                    </label>
                  </div>
                ))}
              </div>
            );
          })()}
        </>
      )}
    </div>
  );
}
