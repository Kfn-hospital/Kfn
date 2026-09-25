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

export const DEFAULT_THEME = {
  primary: '#0f766e',
  text: '#134e4a',
};

export function applyTheme(primary: string, text: string) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  Object.entries(LIGHTNESS).forEach(([shade, lightness]) => {
    root.style.setProperty(`--c-teal-${shade}`, deriveShade(primary, lightness));
  });
  root.style.setProperty('--c-teal-700', primary);
  root.style.setProperty('--c-teal-900', text);
}

export type ThemeMode = 'light' | 'dark';

export function applyMode(mode: ThemeMode) {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-theme', mode);
  try {
    localStorage.setItem('theme-mode', mode);
  } catch {
    // localStorage غير متاح
  }
}

export function getStoredMode(): ThemeMode {
  try {
    const stored = localStorage.getItem('theme-mode');
    if (stored === 'dark' || stored === 'light') return stored;
  } catch {
    // تجاهل
  }
  return 'light';
}
