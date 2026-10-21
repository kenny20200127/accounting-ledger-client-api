import type { CSSProperties } from 'react';
import type { Company } from './types';
export const brandingUpdateKey = 'ledger.company.brandingUpdated';
export const brandingUpdateEvent = 'ledger:company-branding-updated';
function color(value: string | undefined, fallback: string) {
  return value && /^#[\da-f]{6}$/i.test(value) ? value : fallback;
}
function rgb(hex: string) {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
}
function blend(a: string, b: string, weight: number) {
  const x = rgb(a),
    y = rgb(b);
  return (
    '#' +
    x
      .map((v, i) =>
        Math.round(v * (1 - weight) + y[i] * weight)
          .toString(16)
          .padStart(2, '0'),
      )
      .join('')
  );
}
function luminance(hex: string) {
  const channels = rgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}
function ratio(a: string, b: string) {
  const x = luminance(a),
    y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
function foreground(background: string) {
  return ratio('#ffffff', background) >= ratio('#000000', background)
    ? '#ffffff'
    : '#000000';
}
function readableAccent(primary: string, background = '#ffffff') {
  for (let weight = 0; weight <= 1; weight += 0.05) {
    const candidate = blend(primary, '#000000', weight);
    if (ratio(candidate, background) >= 4.5) return candidate;
  }
  return '#17221c';
}
/** Company colors and readable foregrounds shared by the entire company workspace. */
export function companyTheme(company: Company | undefined): CSSProperties {
  const primary = color(company?.primaryColor, '#176246'),
    secondary = color(company?.secondaryColor, '#edf5ef');
  const contrast = foreground(primary),
    hover = blend(
      primary,
      contrast === '#ffffff' ? '#000000' : '#ffffff',
      0.12,
    );
  return {
    '--company-primary': primary,
    '--company-secondary': secondary,
    '--company-contrast': contrast,
    '--company-secondary-ink': foreground(secondary),
    '--company-accent-ink': readableAccent(primary),
    '--company-primary-hover': hover,
    '--company-soft': blend(primary, '#ffffff', 0.93),
    '--company-soft-ink': readableAccent(
      primary,
      blend(primary, '#ffffff', 0.93),
    ),
    '--company-border': blend(primary, '#ffffff', 0.78),
    '--company-canvas': blend(secondary, '#ffffff', 0.9),
    '--company-sidebar': primary,
    '--company-sidebar-ink': contrast,
    '--company-sidebar-hover': hover,
    '--forest': primary,
    '--forest-deep': hover,
    '--lime': secondary,
    '--canvas': blend(secondary, '#ffffff', 0.9),
  } as CSSProperties;
}
export function notifyCompanyBrandingChanged(companyId?: string) {
  const update = {
    companyId,
    at: Date.now(),
    nonce: Math.random().toString(36).slice(2),
  };
  window.dispatchEvent(
    new CustomEvent(brandingUpdateEvent, { detail: update }),
  );
  try {
    localStorage.setItem(brandingUpdateKey, JSON.stringify(update));
  } catch {
    /* Focus refresh still works when storage is unavailable. */
  }
}
