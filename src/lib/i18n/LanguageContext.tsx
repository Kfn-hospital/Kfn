'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { translations, type Language, type TranslationKey } from './translations';

interface LanguageContextValue {
  lang: Language;
  toggleLang: () => void;
  t: (key: TranslationKey) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLang] = useState<Language>('ar');

  // نقرأ اللغة المحفوظة (لو موجودة) بعد ما الصفحة تحمّل في المتصفح، وبعدين
  // نحدّث اتجاه واللغة على مستوى الصفحة كلها (<html dir/lang>) تلقائيًا
  useEffect(() => {
    const saved = localStorage.getItem('appLang') as Language | null;
    if (saved === 'ar' || saved === 'en') setLang(saved);
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  }, [lang]);

  function toggleLang() {
    const next: Language = lang === 'ar' ? 'en' : 'ar';
    setLang(next);
    localStorage.setItem('appLang', next);
  }

  function t(key: TranslationKey): string {
    return translations[lang][key] || translations.ar[key] || key;
  }

  return (
    <LanguageContext.Provider value={{ lang, toggleLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage لازم تتنادى جوّه LanguageProvider');
  return ctx;
}
