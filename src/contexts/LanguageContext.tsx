import React, { createContext, useState, useContext, ReactNode } from 'react';
import { translations, Language } from '../services/translations';

// Helper per accedere alle chiavi nidificate (es. 'nav.home')
const getNestedTranslation = (obj: any, path: string): string => {
  return path.split('.').reduce((prev, curr) => {
    return prev ? prev[curr] : null;
  }, obj) || path;
};

const interpolate = (text: string, vars?: Record<string, string | number>): string => {
  if (!vars) return text;
  return Object.keys(vars).reduce((acc, key) => {
    return acc.replace(new RegExp(`{${key}}`, 'g'), String(vars[key]));
  }, text);
};

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useState<Language>('it');

  const t = (path: string, vars?: Record<string, string | number>): string => {
    const raw = getNestedTranslation(translations[language], path);
    return interpolate(raw, vars);
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};