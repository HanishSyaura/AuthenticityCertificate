export const DEFAULT_THEME_PRIMARY_HEX = '#1a1939';

export function normalizeHexColor(value) {
  const color = String(value || '').trim();

  if (/^#[0-9a-fA-F]{6}$/.test(color)) {
    return color.toLowerCase();
  }

  return DEFAULT_THEME_PRIMARY_HEX;
}

function hexToRgb(hex) {
  const normalized = normalizeHexColor(hex);
  const value = normalized.slice(1);

  return {
    r: parseInt(value.slice(0, 2), 16),
    g: parseInt(value.slice(2, 4), 16),
    b: parseInt(value.slice(4, 6), 16)
  };
}

function darken({ r, g, b }, factor = 0.7) {
  return {
    r: Math.round(r * factor),
    g: Math.round(g * factor),
    b: Math.round(b * factor)
  };
}

function toHex({ r, g, b }) {
  return (
    '#' +
    [r, g, b]
      .map((value) => Math.max(0, Math.min(255, value)).toString(16).padStart(2, '0'))
      .join('')
  );
}

function toRgbString({ r, g, b }) {
  return `${r}, ${g}, ${b}`;
}

export function applyTheme(themePrimaryHex = DEFAULT_THEME_PRIMARY_HEX) {
  if (typeof document === 'undefined') return;

  const primary = normalizeHexColor(themePrimaryHex);
  const rgb = hexToRgb(primary);
  const deepRgb = darken(rgb, 0.65);
  const midRgb = darken(rgb, 0.82);

  const root = document.documentElement;

  root.style.setProperty('--ac-brand', primary);
  root.style.setProperty('--ac-brand-rgb', toRgbString(rgb));
  root.style.setProperty('--ac-brand-deep', toHex(deepRgb));
  root.style.setProperty('--ac-brand-deep-rgb', toRgbString(deepRgb));
  root.style.setProperty('--ac-brand-mid', toHex(midRgb));
  root.style.setProperty('--ac-brand-soft', `rgba(${toRgbString(rgb)}, 0.08)`);
  root.style.setProperty('--ac-brand-soft-alt', `rgba(${toRgbString(rgb)}, 0.14)`);
  root.style.setProperty('--ac-accent', primary);
  root.style.setProperty('--ac-accent-rgb', toRgbString(rgb));
  root.style.setProperty('--ac-accent-soft', `rgba(${toRgbString(rgb)}, 0.08)`);
  root.style.setProperty('--ac-hero-start', toHex(deepRgb));
  root.style.setProperty('--ac-hero-mid', toHex(midRgb));
  root.style.setProperty('--ac-hero-end', primary);
  root.style.setProperty('--ac-hero-glow', `rgba(${toRgbString(rgb)}, 0.34)`);
  root.style.setProperty('--ac-hero-glow-soft', `rgba(${toRgbString(rgb)}, 0.16)`);
}
