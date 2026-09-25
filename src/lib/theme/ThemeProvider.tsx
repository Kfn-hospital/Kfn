'use client';

import { useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { applyTheme, DEFAULT_THEME } from './colorUtils';

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const supabase = createClient();

  useEffect(() => {
    async function loadTheme() {
      let primary = DEFAULT_THEME.primary;
      let text = DEFAULT_THEME.text;
      let background = DEFAULT_THEME.background;

      const { data: rows } = await supabase
        .from('app_settings')
        .select('key, value')
        .in('key', ['theme_primary', 'theme_text', 'theme_background']);
      (rows as { key: string; value: string | null }[] | null)?.forEach((row) => {
        if (row.key === 'theme_primary' && row.value) primary = row.value;
        if (row.key === 'theme_text' && row.value) text = row.value;
        if (row.key === 'theme_background' && row.value) background = row.value;
      });

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('theme_primary, theme_text, theme_background')
          .eq('id', user.id)
          .single();
        if (profile?.theme_primary) primary = profile.theme_primary;
        if (profile?.theme_text) text = profile.theme_text;
        if (profile?.theme_background) background = profile.theme_background;
      }

      applyTheme(primary, text, background);
    }
    loadTheme();
  }, [supabase]);

  return <>{children}</>;
}
