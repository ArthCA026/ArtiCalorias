export interface ActivityEntrySegmentDto {
  segmentOrder: number;
  segmentName: string;
  metValue: number;
  durationMinutes: number;
}

export interface ActivityEntryResponse {
  activityEntryId: number;
  activityTemplateId: number | null;
  activityType: string;
  activityName: string;
  durationMinutes: number | null;
  metValue: number | null;
  calculatedCaloriesKcal: number;
  isGlobalDefault: boolean;
  isFromSystemTemplate: boolean;
  notes: string | null;
  sortOrder: number;
  segments: ActivityEntrySegmentDto[];
}

export interface CreateActivityEntryRequest {
  activityTemplateId?: number | null;
  activityType: string;
  activityName: string;
  durationMinutes?: number | null;
  metValue?: number | null;
  notes?: string | null;
  segments: ActivityEntrySegmentDto[];
}

export interface UpdateActivityEntryRequest {
  activityType: string;
  activityName: string;
  durationMinutes?: number | null;
  metValue?: number | null;
  notes?: string | null;
  segments: ActivityEntrySegmentDto[];
}

export interface ActivityTemplateSegmentDto {
  segmentOrder: number;
  segmentName: string;
  metValue: number;
  durationMinutes: number;
}

export interface ActivityTemplateResponse {
  activityTemplateId: number;
  templateScope: string;
  activityType: string;
  templateName: string;
  autoAddToNewDay: boolean;
  isActive: boolean;
  defaultDurationMinutes: number | null;
  defaultMET: number | null;
  segments: ActivityTemplateSegmentDto[];
}

export interface ActivityTemplateRequest {
  templateScope: string;
  activityType: string;
  templateName: string;
  autoAddToNewDay: boolean;
  defaultDurationMinutes?: number | null;
  defaultMET?: number | null;
  segments: ActivityTemplateSegmentDto[];
}

// --- Activity parsing (AI) ---

export interface ParseActivityRequest {
  freeText: string;
}

export interface ParsedActivitySegment {
  segmentOrder: number;
  segmentName: string;
  metValue: number;
  durationMinutes: number;
}

export interface ParsedActivityItem {
  activityName: string;
  activityType: string;
  durationMinutes: number | null;
  metValue: number | null;
  notes: string | null;
  segments: ParsedActivitySegment[];
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
