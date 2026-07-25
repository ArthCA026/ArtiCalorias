import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import es from '@/locales/es.json';

/**
 * i18n strategy: English lives inline in the components as t() default
 * values, so a missing key can never render as a raw key. Spanish is the
 * single translation catalog (locales/es.json).
 */
i18n.use(initReactI18next).init({
  resources: {
    es: { translation: es },
  },
  lng: 'en',
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false, // React already escapes
  },
});

export default i18n;
