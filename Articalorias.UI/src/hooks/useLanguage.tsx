import { createContext, useContext, useEffect, useState } from "react";
import i18n from "@/lib/i18n";

export type Language = "en" | "es";

const STORAGE_KEY = "ac-language";

interface LanguageContextValue {
  language: Language;
  setLanguage: (lang: Language) => void;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

function detectDefaultLanguage(): Language {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "en" || stored === "es") return stored;
    // Fall back to browser language
    if (navigator.language.startsWith("es")) return "es";
  } catch (_) {}
  return "en";
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>(detectDefaultLanguage);

  useEffect(() => {
    i18n.changeLanguage(language);
    try {
      localStorage.setItem(STORAGE_KEY, language);
    } catch (_) {}
  }, [language]);

  function setLanguage(lang: Language) {
    setLanguageState(lang);
  }

  return (
    <LanguageContext.Provider value={{ language, setLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used inside LanguageProvider");
  return ctx;
}
