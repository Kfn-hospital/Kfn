'use client';

import { useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  applyTheme,
  applyMode,
  getStoredMode,
  DEFAULT_THEME,
  applyBookingColors,
  applySidebarHover,
  DEFAULT_BOOKING_COLORS,
  DEFAULT_SIDEBAR_HOVER,
  type BookingColors,
} from './colorUtils';

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

    async function loadBookingAndSidebarColors() {
      const colors: BookingColors = { ...DEFAULT_BOOKING_COLORS };
      let sidebarHover = DEFAULT_SIDEBAR_HOVER;

      const { data: rows } = await supabase
        .from('app_settings')
        .select('key, value')
        .in('key', [
          'booking_color_pending',
          'booking_color_approved',
          'booking_color_rejected',
          'booking_color_cancelled',
          'sidebar_hover_color',
        ]);
      (rows as { key: string; value: string | null }[] | null)?.forEach((row) => {
        if (row.key === 'booking_color_pending' && row.value) colors.pending = row.value;
        if (row.key === 'booking_color_approved' && row.value) colors.approved = row.value;
        if (row.key === 'booking_color_rejected' && row.value) colors.rejected = row.value;
        if (row.key === 'booking_color_cancelled' && row.value) colors.cancelled = row.value;
        if (row.key === 'sidebar_hover_color' && row.value) sidebarHover = row.value;
      });

      applyBookingColors(colors);
      applySidebarHover(sidebarHover);
    }

    loadColors();
    loadBookingAndSidebarColors();
  }, [supabase]);

  return <>{children}</>;
}
