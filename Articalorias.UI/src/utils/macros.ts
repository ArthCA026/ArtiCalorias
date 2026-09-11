import i18n from '@/lib/i18n';
import type { IconName } from '@/components/ui/Icon';
import type {
  DailyLogResponse,
  DayMacroTarget,
  LocalizedText,
  MacroAmounts,
  MacroDefinition,
  MacroKey,
  MacroPreference,
} from '@/types';

/**
 * Pure helpers over the macro catalog. Nothing here knows a specific macro:
 * every bar, strip, field grid and settings row asks the catalog definition
 * for its icon, unit, direction and copy, so a new macro on the server shows
 * up everywhere with no UI change.
 *
 * i18n exception, on purpose: macro NAMES (and preset / quick-add labels)
 * come from the API in both languages instead of the inline-English + es.json
 * convention used for the rest of the app. That is what makes adding a macro
 * a backend-only change. Generic macro copy ("A limit: warns when you go
 * over", "Adjust") still lives in t() calls.
 */

export const FALLBACK_ICON: IconName = 'sliders';

/** A stand-in definition for a key the catalog no longer knows: renders, never crashes. */
export function fallbackDef(key: string): MacroDefinition {
  return {
    key,
    sortOrder: Number.MAX_SAFE_INTEGER,
    unit: 'g',
    direction: 'hit',
    isCore: false,
    defaultTracked: false,
    icon: FALLBACK_ICON,
    labels: { name: { en: key, es: key }, shortName: { en: key, es: key } },
    targetFormula: {
      kind: 'none',
      hasAutoTarget: false,
      hasAutoParam: false,
      defaultParam: null,
      paramMin: null,
      paramMax: null,
      fixedValue: null,
    },
    autoPresets: [],
    customTargetMin: 0,
    customTargetMax: 20000,
    quickAdds: [],
    showInHeroBars: true,
    rowStrip: 'whenTracked',
    hasOwnCard: false,
    isActive: false,
  };
}

export function currentLang(): string {
  return i18n.language || 'en';
}

export function pickLabel(text: LocalizedText | undefined, lang: string = currentLang(), fallback = ''): string {
  if (!text) return fallback;
  const picked = lang.startsWith('es') ? text.es : text.en;
  return picked || text.en || fallback;
}

export function macroLabel(def: MacroDefinition, kind: 'name' | 'shortName' = 'name', lang?: string): string {
  return pickLabel(kind === 'name' ? def.labels.name : def.labels.shortName, lang, def.key);
}

const SAFE_TOKEN_KEY = /^[a-z][a-z0-9-]*$/i;
const tokenKey = (key: string) => (SAFE_TOKEN_KEY.test(key) ? key : 'macro-default');

/** Token-driven color with a neutral fallback, so a macro without its own token still renders. */
export function macroColor(key: string): string {
  return `var(--t-${tokenKey(key)}, var(--t-macro-default))`;
}

export function macroSoftColor(key: string): string {
  return `var(--t-${tokenKey(key)}-soft, var(--t-macro-default-soft))`;
}

export function macroUnitSuffix(def: MacroDefinition): string {
  return def.unit;
}

/** "35g" | "1,250 ml" | "95 mg" — the compact gram form is what the app always used. */
export function formatMacroAmount(def: MacroDefinition, value: number, lang: string = currentLang()): string {
  const rounded = Math.round(value);
  if (def.unit === 'g') return `${rounded}g`;
  return `${rounded.toLocaleString(lang)} ${def.unit}`;
}

/**
 * The day's consumed amount for a macro. Null only when the day genuinely has
 * no data for it (nothing logged carried the macro); a day whose frozen
 * targets include the macro reads null as an honest 0.
 */
export function macroTotalFor(log: Pick<DailyLogResponse, 'macroTotals'>, key: MacroKey): number | null {
  const v = log.macroTotals?.[key];
  return typeof v === 'number' ? v : null;
}

/** The day's frozen target entry for a macro, if it was tracked that day. */
export function dayTargetFor(log: Pick<DailyLogResponse, 'macroTargets'>, key: MacroKey): DayMacroTarget | undefined {
  return log.macroTargets.find((m) => m.macroKey === key);
}

export function trackedKeysFromTargets(targets: DayMacroTarget[] | undefined): Set<string> {
  return new Set((targets ?? []).map((m) => m.macroKey));
}

export function trackedKeysFromPrefs(prefs: MacroPreference[] | undefined): Set<string> {
  return new Set((prefs ?? []).filter((p) => p.isTracked).map((p) => p.macroKey));
}

/** Catalog order, unknown keys last (then alphabetical), duplicates removed. */
export function sortKeysByCatalog(keys: Iterable<string>, get: (key: string) => MacroDefinition): string[] {
  return [...new Set(keys)].sort((a, b) => {
    const da = get(a);
    const db = get(b);
    return da.sortOrder - db.sortOrder || a.localeCompare(b);
  });
}

const roundTo = (v: number, decimals: number) => {
  const f = 10 ** decimals;
  return Math.round(v * f) / f;
};

/** Multiplies every amount; absent keys stay absent. */
export function scaleMacros(map: MacroAmounts, ratio: number, decimals = 1): MacroAmounts {
  const out: MacroAmounts = {};
  for (const [k, v] of Object.entries(map)) out[k] = roundTo(v * ratio, decimals);
  return out;
}

/** Totals -> per-unit values (templates store per 1 portion). */
export function perUnitMacros(map: MacroAmounts, qty: number, decimals = 1): MacroAmounts {
  return scaleMacros(map, 1 / (qty > 0 ? qty : 1), decimals);
}

export function coreKeysOf(defs: MacroDefinition[]): string[] {
  return defs.filter((d) => d.isCore).map((d) => d.key);
}

export function coreZeros(defs: MacroDefinition[]): MacroAmounts {
  const out: MacroAmounts = {};
  for (const d of defs) if (d.isCore) out[d.key] = 0;
  return out;
}

/**
 * Keeps core keys plus the keys the day (or the user) tracks. This is the
 * generic form of "sugar only when the day tracks it": a quick-add or a
 * template never writes a 0 for a macro the user never asked for.
 */
export function filterMacrosForDay(
  map: MacroAmounts,
  tracked: Set<string>,
  get: (key: string) => MacroDefinition,
): MacroAmounts {
  const out: MacroAmounts = {};
  for (const [k, v] of Object.entries(map)) {
    if (get(k).isCore || tracked.has(k)) out[k] = v;
  }
  return out;
}

export interface MacroStripItem {
  key: string;
  /** Null = not captured on this item (renders as a dash). */
  value: number | null;
}

/**
 * Which macros a meal/template row strip shows, in catalog order: every
 * "always" macro plus the "whenTracked" ones the day or user tracks.
 */
export function rowStripItems(
  map: MacroAmounts,
  tracked: Set<string>,
  defs: MacroDefinition[],
): MacroStripItem[] {
  return defs
    .filter((d) => d.rowStrip === 'always' || (d.rowStrip === 'whenTracked' && tracked.has(d.key)))
    .map((d) => ({ key: d.key, value: typeof map[d.key] === 'number' ? map[d.key] : null }));
}

/** Form state from a map: absent -> '' (an honest blank), present -> its string. */
export function macroFieldsFrom(map: MacroAmounts, keys: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of keys) out[k] = typeof map[k] === 'number' ? String(map[k]) : '';
  return out;
}

/**
 * Form state back to a map. Empty fields stay absent unless the key is in
 * `zeroKeys` (core macros, or macros tracked right now on a NEW entry), in
 * which case blank means a real 0.
 */
export function parseMacroFields(
  values: Record<string, string>,
  opts: { zeroKeys?: Iterable<string> } = {},
): MacroAmounts {
  const zero = new Set(opts.zeroKeys ?? []);
  const out: MacroAmounts = {};
  for (const [k, raw] of Object.entries(values)) {
    const trimmed = raw.trim();
    if (trimmed === '') {
      if (zero.has(k)) out[k] = 0;
      continue;
    }
    const n = Number(trimmed.replace(',', '.'));
    if (Number.isFinite(n)) out[k] = n;
    else if (zero.has(k)) out[k] = 0;
  }
  return out;
}

/**
 * Client-side preview of an auto target for a given parameter, used to show
 * "1.6 g/kg = 112 g" next to presets before saving. Only per-kg formulas are
 * previewable here (they mirror the backend exactly, age floor included);
 * everything else shows the server's value once saved.
 */
export function previewAutoTarget(
  def: MacroDefinition,
  param: number,
  profile: { currentWeightKg: number | null; age: number | null } | null | undefined,
  ageFloor: (age: number) => number,
): number | null {
  if (def.targetFormula.kind !== 'perKgBodyWeight') return null;
  const weight = profile?.currentWeightKg ?? null;
  if (weight === null || weight <= 0) return null;
  const floor = def.key === 'protein' ? ageFloor(profile?.age ?? 30) : 0;
  return Math.round(weight * Math.max(param, floor));
}

export function isOverLimit(def: MacroDefinition, value: number, target: number | null): boolean {
  return def.direction === 'limit' && target !== null && value > target;
}

export function isGoalReached(def: MacroDefinition, value: number, target: number | null): boolean {
  return def.direction === 'hit' && target !== null && target > 0 && value >= target;
}
