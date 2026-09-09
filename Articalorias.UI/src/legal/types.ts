export interface PolicySection {
  heading: string;
  paragraphs?: string[];
  bullets?: string[];
}

/**
 * A legal document rendered by PolicyPage. The canonical, attorney-facing
 * copies live in docs/legal/policies as markdown; these modules are their
 * in-app transcription and must carry the same version string.
 */
export interface PolicyDocument {
  /** ISO-date version; equals POLICY_VERSIONS.* while the doc is current. */
  version: string;
  effectiveDate: string;
  title: string;
  /** Shown as a warning banner until counsel signs off. */
  draftBanner?: string;
  intro: string[];
  sections: PolicySection[];
}
