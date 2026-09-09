import type { Language } from '@/hooks/useLanguage';
import type { PolicyDocument } from './types';
import { privacyEs } from './content/privacy.es';
import { privacyEn } from './content/privacy.en';
import { termsEs } from './content/terms.es';
import { termsEn } from './content/terms.en';

export type PolicyDocKey = 'privacy' | 'terms';

const DOCS: Record<PolicyDocKey, Record<Language, PolicyDocument>> = {
  privacy: { es: privacyEs, en: privacyEn },
  terms: { es: termsEs, en: termsEn },
};

export function getPolicyDocument(doc: PolicyDocKey, language: Language): PolicyDocument {
  return DOCS[doc][language];
}
