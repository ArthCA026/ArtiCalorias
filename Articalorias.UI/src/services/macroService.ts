import api from './api';
import type { MacroCatalogResponse, MacroPreference, UpdateMacroPreferencesRequest } from '@/types';

export const macroService = {
  /** The macro registry: static per build, cacheable for a long time. */
  getCatalog() {
    return api.get<MacroCatalogResponse>('/macros/catalog');
  },

  getPreferences() {
    return api.get<MacroPreference[]>('/macropreferences');
  },

  /**
   * Upserts the submitted macros only (others keep their stored state).
   * Callers must follow up with dailyLogService.refreshSnapshot(today) so
   * the change applies from today only; past days keep the targets they
   * were lived under.
   */
  updatePreferences(data: UpdateMacroPreferencesRequest) {
    return api.put<MacroPreference[]>('/macropreferences', data);
  },
};
