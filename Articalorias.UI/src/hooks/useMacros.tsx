import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useMacroCatalog } from '@/hooks/useMacroCatalog';
import { fallbackDef, macroLabel } from '@/utils/macros';
import type { MacroDefinition } from '@/types';

export interface MacrosContextValue {
  /** Active macros in catalog order: what can be tracked and what settings list. */
  defs: MacroDefinition[];
  /** Every macro the catalog knows, retired ones included (history keeps rendering). */
  byKey: Map<string, MacroDefinition>;
  /** Never undefined: unknown keys get a neutral stand-in definition. */
  get: (key: string) => MacroDefinition;
  /** Localized name in the current language. */
  label: (keyOrDef: string | MacroDefinition, kind?: 'name' | 'shortName') => string;
  coreKeys: string[];
  /**
   * How many macros can be tracked at a time, protein included. Infinity
   * until the catalog arrives (or from an API that predates the limit), so
   * nothing locks up on a guess: the server is the one that enforces it.
   */
  maxTracked: number;
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
}

const MacrosContext = createContext<MacrosContextValue | null>(null);

export function MacroCatalogProvider({ children }: { children: ReactNode }) {
  const query = useMacroCatalog();
  // Subscribing to i18n here makes every catalog label re-render on a
  // language switch, since `label` closes over the current language.
  const { i18n } = useTranslation();
  const lang = i18n.language;

  const value = useMemo<MacrosContextValue>(() => {
    const all = query.data?.macros ?? [];
    const byKey = new Map(all.map((d) => [d.key, d]));
    const defs = all.filter((d) => d.isActive).sort((a, b) => a.sortOrder - b.sortOrder);
    const get = (key: string) => byKey.get(key) ?? fallbackDef(key);
    return {
      defs,
      byKey,
      get,
      label: (keyOrDef, kind = 'name') =>
        macroLabel(typeof keyOrDef === 'string' ? get(keyOrDef) : keyOrDef, kind, lang),
      coreKeys: defs.filter((d) => d.isCore).map((d) => d.key),
      maxTracked:
        typeof query.data?.maxTrackedMacros === 'number' && query.data.maxTrackedMacros > 0
          ? query.data.maxTrackedMacros
          : Number.POSITIVE_INFINITY,
      isLoading: query.isLoading,
      isError: query.isError,
      refetch: () => {
        void query.refetch();
      },
    };
  }, [query, lang]);

  return <MacrosContext.Provider value={value}>{children}</MacrosContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components -- provider + hook belong together
export function useMacros(): MacrosContextValue {
  const ctx = useContext(MacrosContext);
  if (!ctx) throw new Error('useMacros must be used inside MacroCatalogProvider');
  return ctx;
}
