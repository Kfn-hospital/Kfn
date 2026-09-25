'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import Card from '@/components/ui/Card';

export default function AssistantPage() {
  const { t } = useLanguage();
  const supabase = createClient();
  const [iconEmoji, setIconEmoji] = useState('🤖');
  const [iconUrl, setIconUrl] = useState('');

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('app_settings')
        .select('key, value')
        .in('key', ['assistant_icon_emoji', 'assistant_icon_url']);
      (data as { key: string; value: string | null }[] | null)?.forEach((row) => {
        if (row.key === 'assistant_icon_emoji' && row.value) setIconEmoji(row.value);
        if (row.key === 'assistant_icon_url' && row.value) setIconUrl(row.value);
      });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="p-6">
      <h1 className="text-2xl font-extrabold text-[var(--c-teal-900)] mb-4 flex items-center gap-2">
        {iconUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={iconUrl} alt="" className="w-7 h-7 rounded-full object-cover" />
        ) : (
          <span>{iconEmoji}</span>
        )}
        {t('aiAssistantTitle')}
      </h1>
      <Card>
        <p className="text-[var(--c-text)]">{t('assistantPageHint')}</p>
      </Card>
    </main>
  );
}
