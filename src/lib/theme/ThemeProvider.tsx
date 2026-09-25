'use client';

import { useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { applyTheme, applyMode, getStoredMode, DEFAULT_THEME } from './colorUtils';

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const supabase = createClient();

  useEffect(() => {
    applyMode(getStoredMode());

    async function loadColors() {
      let primary = DEFAULT_THEME.primary;
      let text = DEFAULT_THEME.text;

      const { data: rows } = await supabase
        .from('app_settings')
        .select('key, value')
        .in('key', ['theme_primary', 'theme_text']);
      (rows as { key: string; value: string | null }[] | null)?.forEach((row) => {
        if (row.key === 'theme_primary' && row.value) primary = row.value;
        if (row.key === 'theme_text' && row.value) text = row.value;
      });

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('theme_primary, theme_text')
          .eq('id', user.id)
          .single();
        if (profile?.theme_primary) primary = profile.theme_primary;
        if (profile?.theme_text) text = profile.theme_text;
      }

      applyTheme(primary, text);
    }
    loadColors();
  }, [supabase]);

  return <>{children}</>;
}
