export interface ActivityEntryResponse {
  activityEntryId: number;
  activityTemplateId: number | null;
  activityName: string;
  durationMinutes: number | null;
  metValue: number | null;
  calculatedCaloriesKcal: number;
  sortOrder: number;
}

export interface CreateActivityEntryRequest {
  activityTemplateId?: number | null;
  activityName: string;
  durationMinutes?: number | null;
  metValue?: number | null;
}

export interface UpdateActivityEntryRequest {
  activityName: string;
  durationMinutes?: number | null;
  metValue?: number | null;
}

export interface ActivityTemplateResponse {
  activityTemplateId: number;
  templateName: string;
  autoAddToNewDay: boolean;
  isActive: boolean;
  defaultDurationMinutes: number | null;
  defaultMET: number | null;
}

export interface ActivityTemplateRequest {
  templateName: string;
  autoAddToNewDay: boolean;
  defaultDurationMinutes?: number | null;
  defaultMET?: number | null;
}

// --- Activity parsing (AI) ---

export interface ParseActivityRequest {
  freeText: string;
}

export interface ParsedActivityItem {
  activityName: string;
  durationMinutes: number | null;
  metValue: number | null;
}

export interface ConfirmParsedActivitiesRequest {
  items: CreateActivityEntryRequest[];
}

export interface EstimateMetRequest {
  activityName: string;
  durationMinutes?: number | null;
}

export interface EstimateMetResponse {
  activityName: string;
  metValue: number;
  explanation: string | null;
}
