import api from './api';
import type {
  ActivityEntryResponse,
  CreateActivityEntryRequest,
  UpdateActivityEntryRequest,
  ActivityTemplateResponse,
  ActivityTemplateRequest,
  ParseActivityRequest,
  ParsedActivityItem,
  EstimateMetRequest,
  EstimateMetResponse,
} from '@/types';

export const activityService = {
  // --- Activity entries for a specific day ---

  getByDate(date: string) {
    return api.get<ActivityEntryResponse[]>(`/activities/daily/${date}`);
  },

  create(date: string, data: CreateActivityEntryRequest) {
    return api.post<ActivityEntryResponse>(`/activities/daily/${date}`, data);
  },

  update(date: string, activityEntryId: number, data: UpdateActivityEntryRequest) {
    return api.put<ActivityEntryResponse>(`/activities/daily/${date}/${activityEntryId}`, data);
  },

  remove(date: string, activityEntryId: number) {
    return api.delete(`/activities/daily/${date}/${activityEntryId}`);
  },

  // --- Activity templates ---

  getTemplates() {
    return api.get<ActivityTemplateResponse[]>('/activities/templates');
  },

  createTemplate(data: ActivityTemplateRequest) {
    return api.post<ActivityTemplateResponse>('/activities/templates', data);
  },

  updateTemplate(templateId: number, data: ActivityTemplateRequest) {
    return api.put<ActivityTemplateResponse>(`/activities/templates/${templateId}`, data);
  },

  removeTemplate(templateId: number) {
    return api.delete(`/activities/templates/${templateId}`);
  },

  // --- AI activity parsing ---

  parseActivity(data: ParseActivityRequest) {
    return api.post<ParsedActivityItem[]>('/activities/parse-activity', data);
  },

  estimateMet(data: EstimateMetRequest) {
    return api.post<EstimateMetResponse>('/activities/estimate-met', data);
  },
};
