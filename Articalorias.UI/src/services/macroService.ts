import api from './api';
import type { MacroPreference, UpdateMacroPreferencesRequest } from '@/types';

export const macroService = {
  getPreferences() {
    return api.get<MacroPreference[]>('/macropreferences');
  },

  /**
   * Saves tracking settings. Callers must follow up with
   * dailyLogService.refreshSnapshot(today) so the change applies from today
   * only; past days keep the targets they were lived under.
   */
  updatePreferences(data: UpdateMacroPreferencesRequest) {
    return api.put<MacroPreference[]>('/macropreferences', data);
  },
};
