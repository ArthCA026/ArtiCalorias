import type { PolicyDocument } from '../types';
import { POLICY_VERSIONS } from '../policyVersions';

export const termsEn: PolicyDocument = {
  version: POLICY_VERSIONS.terms,
  effectiveDate: '2026-09-18',
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
      heading: 'Subscription and payment',
      paragraphs: [
        'ArtiCalorias is a paid service: using the app requires an active subscription. Creating an account, completing the initial setup, downloading your data and deleting your account never require a payment.',
      ],
      bullets: [
        'Plans and prices: a monthly plan at USD 9.99 per month and a yearly plan at USD 29.99 per year. The plan and the price that apply to you are the ones shown in the app when you subscribe, and the amount shown before you pay is the total amount we charge.',
        'Prices are in US dollars. Your bank or card issuer may apply currency conversion or other fees that we do not control.',
        'Automatic renewal: your subscription renews by itself at the end of each period, monthly or yearly, and the payment method you provided is charged the price of your plan. This continues until you cancel.',
        'Cancellation: you can cancel at any time inside the app, under Profile, Subscription. Cancelling stops all future charges. You keep access until the end of the period you already paid for, and you can undo the cancellation before that date.',
        'Failed payments: if a renewal payment fails, the charge may be retried and you keep access for a short grace period, currently 3 days. If the payment still cannot be collected, access is suspended until you subscribe again. Your data is kept.',
        'Refunds: payments are not refunded for periods that are partially used, except where the law that applies to you grants a right of withdrawal or a refund. Nothing in these terms limits those rights. To ask for a refund write to r2chaves026@gmail.com.',
        'Price changes: if the price of your plan changes, we tell you in the app or by email at least 30 days before it applies to you, and it only applies from a renewal after that notice. If you do not agree you can cancel before that renewal.',
        'Deleting your account cancels your subscription immediately and ends your access. The time left on the subscription is not refunded, except where the law requires it.',
        'Complimentary access: we may let some accounts use the app without a subscription, at our discretion, and we may end that access at any time.',
      ],
    },
    {
      heading: 'How payments are processed',
      paragraphs: [
        'Payments are processed by ONVO Pay, a payment processor based in Costa Rica. You type your card details directly into ONVO Pay’s payment form. ArtiCalorias never receives or stores your card number, its expiry date or its security code. The Privacy Notice explains what is shared with ONVO Pay.',
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
        'Nutrient targets and limits shown in the app, for example for protein, caffeine or sodium, are general public-health reference values, not personalized recommendations. Pregnancy, medication and medical conditions change what is right for you.',
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
        'The service may change, be temporarily interrupted, or be discontinued. We will make reasonable efforts to give advance notice of significant changes. If the service is discontinued, renewals stop and the unused part of any period already paid is refunded.',
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
