'use client';

import { useLanguage } from '@/lib/i18n/LanguageContext';
import Card from '@/components/ui/Card';

export default function AssistantPage() {
  const { t } = useLanguage();

  return (
    <main className="p-6">
      <h1 className="text-2xl font-extrabold text-[var(--c-teal-900)] mb-4">🤖 {t('aiAssistantTitle')}</h1>
      <Card>
        <p className="text-[var(--c-text)]">{t('assistantPageHint')}</p>
      </Card>
    </main>
  );
}
