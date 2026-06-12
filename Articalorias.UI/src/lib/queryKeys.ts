export const queryKeys = {
  dashboard: (date: string) => ['dashboard', date] as const,
  history: (from: string, to: string) => ['history', from, to] as const,
  historyAll: () => ['history'] as const,  // prefix — matches every history query
  activityTemplates: () => ['activity-templates'] as const,
  profile: () => ['profile'] as const,
  notificationSchedules: () => ['notification-schedules'] as const,
};
