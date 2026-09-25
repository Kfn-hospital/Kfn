'use client';

import { useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

const LIGHTNESS: Record<number, number> = {
  50: 97,
  100: 93,
  300: 75,
  400: 63,
  500: 51,
  600: 39,
  800: 24,
};

function hexToRgb(hex: string) {
  const clean = hex.replace('#', '');
  const bigint = parseInt(clean, 16);
  return { r: (bigint >> 16) & 255, g: (bigint >> 8) & 255, b: bigint & 255 };
}

function rgbToHsl(r: number, g: number, b: number) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      default:
        h = (r - g) / d + 4;
    }
    h /= 6;
  }
  return { h: h * 360, s: s * 100, l: l * 100 };
}

function hslToHex(h: number, s: number, l: number) {
  s /= 100;
  l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const toHex = (x: number) => Math.round(x * 255).toString(16).padStart(2, '0');
  return `#${toHex(f(0))}${toHex(f(8))}${toHex(f(4))}`;
}

function deriveShade(baseHex: string, lightness: number) {
  try {
    const { r, g, b } = hexToRgb(baseHex);
    const { h, s } = rgbToHsl(r, g, b);
    return hslToHex(h, s, lightness);
  } catch {
    return baseHex;
  }
}

function applyTheme(primary: string, text: string, background: string) {
  const root = document.documentElement;
  Object.entries(LIGHTNESS).forEach(([shade, lightness]) => {
    root.style.setProperty(`--c-teal-${shade}`, deriveShade(primary, lightness));
  });
  root.style.setProperty('--c-[var(--c-teal-700)]', primary);
  root.style.setProperty('--c-[var(--c-teal-900)]', text);
  root.style.setProperty('--c-bg', background);
}

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const supabase = createClient();

  useEffect(() => {
    async function loadTheme() {
      let primary = '#0f766e';
      let text = '#134e4a';
      let background = '#f8fafc';

      const { data: setting } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'theme')
        .maybeSingle();
      if (setting?.value) {
        try {
          const parsed = JSON.parse(setting.value);
          primary = parsed.primary || primary;
          text = parsed.text || text;
          background = parsed.background || background;
        } catch {
          // تجاهل لو القيمة المحفوظة مش JSON صالح
        }
      }

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
