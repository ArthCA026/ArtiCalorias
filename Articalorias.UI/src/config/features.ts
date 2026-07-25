/**
 * Feature flags for development.
 * Flip a value and rebuild (or just save with the dev server running).
 */
export const FEATURES = {
  /**
   * Shows everything related to the Plus subscription:
   * the paywall page, the Profile banner, and the Progress upsell card.
   * Keep false while family members are using the app in development.
   */
  premium: false,
};
