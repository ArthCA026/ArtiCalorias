import type { PolicyDocument } from '../types';
import { POLICY_VERSIONS } from '../policyVersions';

export const privacyEn: PolicyDocument = {
  version: POLICY_VERSIONS.privacy,
  effectiveDate: '2026-09-09',
  title: 'Privacy Notice',
  draftBanner:
    'DRAFT FOR LEGAL REVIEW. This document is pending validation by a legal professional in Costa Rica and its text may change.',
  intro: [
    'This notice explains what personal data ArtiCalorias collects, what it is used for, who it is shared with, and what rights you have over it, under Costa Rica Law 8968 on the Protection of Individuals regarding the Processing of their Personal Data.',
  ],
  sections: [
    {
      heading: 'Data controller',
      paragraphs: [
        'The party responsible for the ArtiCalorias database is Arthuro Chaves Aguilar, domiciled at [ADDRESS PENDING].',
        'For any question or request about your data, write to r2chaves026@gmail.com.',
        'Your data is stored in a database operated by the controller and hosted on Microsoft Azure servers located in the United States.',
      ],
    },
    {
      heading: 'What data we collect',
      paragraphs: ['Account data, required to create an account:'],
      bullets: [
        'Username and email address.',
        'Password, always stored hashed and salted, never in plain text.',
      ],
    },
    {
      heading: 'Health and body data',
      paragraphs: [
        'You provide this data voluntarily because it is the raw material of the service. The law treats it as sensitive data, which is why we ask for a separate, express consent to process it:',
      ],
      bullets: [
        'Weight, height, age, and biological sex.',
        'Body fat percentage and basal metabolic rate.',
        'Calorie and protein goals, target weight, and target date.',
        'Sleep hours and daily activity hours.',
        'Daily log of food and drinks, with calories, protein, fat, carbohydrates, alcohol, sugar, and water.',
        'Fasting days you mark.',
        'Logged physical activities and their duration.',
        'Body measurement history over time.',
        'Free-text notes you add to your meals.',
      ],
    },
    {
      heading: 'Technical and usage data',
      bullets: [
        'Device time zone and interface language.',
        'Country, if you set it.',
        'Date and time of your last activity in the app.',
        'Browser push notification subscription and reminder times, if you enable meal reminders.',
        'Meal photos you submit for analysis. Photos are processed on the spot and are not stored in our database.',
      ],
    },
    {
      heading: 'What we use your data for',
      bullets: [
        'Computing your calorie and macronutrient budget and showing your progress.',
        'Interpreting the meal or activity descriptions and photos you submit with artificial intelligence, to turn them into log entries.',
        'Sending you meal reminders, only if you enable them.',
        'Sending password recovery emails.',
        'Keeping your account secure.',
      ],
      paragraphs: [
        'We do not use your data for advertising, we do not sell it, and the app includes no third-party analytics trackers.',
      ],
    },
    {
      heading: 'Who your data is shared with',
      paragraphs: ['To work, ArtiCalorias sends certain data to these providers:'],
      bullets: [
        'OpenAI (United States): receives the text and photos of meals or activities you submit for analysis, together with your country if you set it. Used only to interpret your log entry.',
        'Open Food Facts (France): receives only the barcode you scan, to look up the product.',
        'Browser push services (Google, Mozilla, or Apple, depending on your browser): receive the technical identifier needed to deliver reminders.',
        'Email provider: receives your address to send you password recovery codes.',
        'Microsoft Azure (United States): hosts the application and the database.',
      ],
    },
    {
      heading: 'International transfers',
      paragraphs: [
        'The transfers above move data outside Costa Rica, mainly to the United States. By accepting this notice and giving your health data consent you authorize those transfers. We share your data with no one else, except under legal obligation.',
      ],
    },
    {
      heading: 'Required data, optional data, and what happens if you decline',
      bullets: [
        'Required: username, email, and password. Without them the account cannot be created.',
        'Optional but central: weight, height, age, sex, and the rest of your body data. You can skip some, but calculations become less precise or some features stop being available. For example, automatic protein goals need your weight.',
        'If you do not consent to the processing of your health data, the app cannot provide the service, because the service consists precisely of logging and computing with that data. You are free to decline, but in that case ArtiCalorias cannot be used.',
      ],
    },
    {
      heading: 'Record of your consent',
      paragraphs: [
        'We keep a record of every consent you grant or revoke: which document, at which version, in which language, and when. This lets us prove your consent and honor its revocation.',
      ],
    },
    {
      heading: 'Your rights and how to exercise them',
      bullets: [
        'Access: you can see your data inside the app and download all of it from Profile, Legal section, Download my data.',
        'Rectification: you can correct your profile and your entries directly in the app.',
        'Deletion: you can erase your history or your whole account from Profile. Account deletion is immediate and permanent.',
        'Revocation of consent: from Profile, Legal section. If you revoke the health data consent, the app stops saving new data and offers to delete your account.',
      ],
      paragraphs: [
        'You can also exercise any of these rights by writing to r2chaves026@gmail.com.',
      ],
    },
    {
      heading: 'How long we keep your data',
      paragraphs: [
        'We keep your data while your account exists. If you delete your history or your account, the data is removed from the database immediately and permanently. The hosting provider backups may take a limited additional time to purge.',
      ],
    },
    {
      heading: 'Security',
      paragraphs: [
        'Communications are encrypted over HTTPS, passwords are stored hashed and salted, and database access is restricted. No system is infallible, but we apply measures that are reasonable and proportional to the sensitivity of the data.',
      ],
    },
    {
      heading: 'Minors',
      paragraphs: [
        'ArtiCalorias is for people 18 or older. By registering you declare that you are of legal age. If we detect an account belonging to a minor, we will delete it.',
      ],
    },
    {
      heading: 'Changes to this notice',
      paragraphs: [
        'If we change this notice, we will ask you to review and accept the new version before continuing to use the app. Each version is identified by its date.',
      ],
    },
  ],
};
