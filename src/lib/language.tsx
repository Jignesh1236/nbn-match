import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export type Language = 'bn' | 'en';

type LanguageContextValue = {
  language: Language;
  toggleLanguage: () => void;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>(() => {
    try {
      return localStorage.getItem('nbn-language') === 'en' ? 'en' : 'bn';
    } catch {
      return 'bn';
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('nbn-language', language);
    } catch {
      // The current page still works when browser storage is unavailable.
    }
    document.documentElement.lang = language;
  }, [language]);

  const toggleLanguage = () => setLanguage((current) => current === 'bn' ? 'en' : 'bn');

  return (
    <LanguageContext.Provider value={{ language, toggleLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used inside LanguageProvider');
  }
  return context;
}
