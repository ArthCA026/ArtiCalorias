import type { PolicyDocument } from '../types';
import { POLICY_VERSIONS } from '../policyVersions';

export const termsEn: PolicyDocument = {
  version: POLICY_VERSIONS.terms,
  effectiveDate: '2026-09-09',
  title: 'Terms of Use',
  draftBanner:
    'DRAFT FOR LEGAL REVIEW. This document is pending validation by a legal professional in Costa Rica and its text may change.',
  intro: [
    'These terms govern the use of ArtiCalorias. By creating an account you accept these terms and the Privacy Notice.',
  ],
  sections: [
    {
      heading: 'What ArtiCalorias is',
      paragraphs: [
        'ArtiCalorias is an application for logging meals and activities, computing calorie and macronutrient budgets, and following body progress over time. The service is operated by Arthuro Chaves Aguilar (r2chaves026@gmail.com).',
      ],
    },
    {
      heading: 'Age requirement',
      paragraphs: [
        'You must be at least 18 years old to use ArtiCalorias. By creating an account you declare that you are over 18. Accounts belonging to minors will be deleted.',
      ],
    },
    {
      heading: 'Your account',
      bullets: [
        'You are responsible for keeping your password safe and for all activity performed with your account.',
        'The information you log must be your own. Do not log other people’s health data.',
        'You can delete your account at any time from Profile. Deletion is immediate and permanent.',
      ],
    },
    {
      heading: 'Acceptable use',
      bullets: [
        'Do not attempt to access other users’ data or interfere with the operation of the service.',
        'Do not use the service in unintended ways, such as automating bulk requests or reselling access.',
        'We may suspend or delete accounts that violate these terms.',
      ],
    },
    {
      heading: 'Not medical advice',
      paragraphs: [
        'ArtiCalorias provides informational estimates based on general formulas. It is not a medical device and does not replace advice from medical or nutrition professionals.',
        'Consult a professional before making significant changes to your diet or exercise, especially if you have a health condition or a history of eating disorders. The app applies minimum safety limits to calorie goals, but that does not turn its calculations into medical recommendations.',
      ],
    },
    {
      heading: 'Artificial intelligence features',
      paragraphs: [
        'AI analysis of meals and activities produces estimates that can be inaccurate. Review and correct the values before saving them. The data you submit for analysis is shared with OpenAI as described in the Privacy Notice.',
      ],
    },
    {
      heading: 'Service availability and changes',
      paragraphs: [
        'The service may change, be temporarily interrupted, or be discontinued. We will make reasonable efforts to give advance notice of significant changes.',
      ],
    },
    {
      heading: 'Limitation of liability',
      paragraphs: [
        'To the maximum extent permitted by Costa Rican law, the service is provided as is, without guarantees about the accuracy of estimates, and the operator assumes no liability for health decisions made based on the app.',
      ],
    },
    {
      heading: 'Governing law',
      paragraphs: ['These terms are governed by the laws of the Republic of Costa Rica.'],
    },
    {
      heading: 'Changes to these terms',
      paragraphs: [
        'If we change these terms, we will ask you to review and accept the new version before continuing to use the app. Each version is identified by its date.',
      ],
    },
    {
      heading: 'Contact',
      paragraphs: ['For any question about these terms, write to r2chaves026@gmail.com.'],
    },
  ],
};
