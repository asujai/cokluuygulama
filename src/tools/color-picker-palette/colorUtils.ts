/**
 * Color conversion and WCAG contrast utilities
 */

export interface RGB {
  r: number;
  g: number;
  b: number;
}

export interface HSL {
  h: number;
  s: number;
  l: number;
}

export interface HSV {
  h: number;
  s: number;
  v: number;
}

export interface CMYK {
  c: number;
  m: number;
  y: number;
  k: number;
}

export interface WCAGResult {
  ratio: number;
  aaSmall: boolean;
  aaLarge: boolean;
  aaaSmall: boolean;
  aaaLarge: boolean;
}

/**
 * Normalizes hex string to standard 6-digit uppercase #RRGGBB.
 */
export function normalizeHex(hex: string): string {
  let clean = hex.trim().replace(/^#/, '');
  if (clean.length === 3) {
    clean = clean
      .split('')
      .map((c) => c + c)
      .join('');
  }
  if (!/^[0-9A-Fa-f]{6}$/.test(clean)) {
    return '#000000';
  }
  return `#${clean.toUpperCase()}`;
}

export function hexToRgb(hex: string): RGB {
  const norm = normalizeHex(hex);
  const num = parseInt(norm.substring(1), 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

export function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (val: number) => Math.max(0, Math.min(255, Math.round(val)));
  const cr = clamp(r);
  const cg = clamp(g);
  const cb = clamp(b);
  return `#${((1 << 24) + (cr << 16) + (cg << 8) + cb).toString(16).slice(1).toUpperCase()}`;
}

export function rgbToHsl(r: number, g: number, b: number): HSL {
  const rNorm = r / 255;
  const gNorm = g / 255;
  const bNorm = b / 255;

  const max = Math.max(rNorm, gNorm, bNorm);
  const min = Math.min(rNorm, gNorm, bNorm);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rNorm:
        h = (gNorm - bNorm) / d + (gNorm < bNorm ? 6 : 0);
        break;
      case gNorm:
        h = (bNorm - rNorm) / d + 2;
        break;
      case bNorm:
        h = (rNorm - gNorm) / d + 4;
        break;
    }
    h /= 6;
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

export function hslToRgb(h: number, s: number, l: number): RGB {
  const hNorm = (h % 360) / 360;
  const sNorm = s / 100;
  const lNorm = l / 100;

  if (sNorm === 0) {
    const val = Math.round(lNorm * 255);
    return { r: val, g: val, b: val };
  }

  const hue2rgb = (p: number, q: number, t: number) => {
    let tNorm = t;
    if (tNorm < 0) tNorm += 1;
    if (tNorm > 1) tNorm -= 1;
    if (tNorm < 1 / 6) return p + (q - p) * 6 * tNorm;
    if (tNorm < 1 / 2) return q;
    if (tNorm < 2 / 3) return p + (q - p) * (2 / 3 - tNorm) * 6;
    return p;
  };

  const q = lNorm < 0.5 ? lNorm * (1 + sNorm) : lNorm + sNorm - lNorm * sNorm;
  const p = 2 * lNorm - q;

  return {
    r: Math.round(hue2rgb(p, q, hNorm + 1 / 3) * 255),
    g: Math.round(hue2rgb(p, q, hNorm) * 255),
    b: Math.round(hue2rgb(p, q, hNorm - 1 / 3) * 255),
  };
}

export function rgbToHsv(r: number, g: number, b: number): HSV {
  const rNorm = r / 255;
  const gNorm = g / 255;
  const bNorm = b / 255;

  const max = Math.max(rNorm, gNorm, bNorm);
  const min = Math.min(rNorm, gNorm, bNorm);
  const d = max - min;

  let h = 0;
  const s = max === 0 ? 0 : d / max;
  const v = max;

  if (max !== min) {
    switch (max) {
      case rNorm:
        h = (gNorm - bNorm) / d + (gNorm < bNorm ? 6 : 0);
        break;
      case gNorm:
        h = (bNorm - rNorm) / d + 2;
        break;
      case bNorm:
        h = (rNorm - gNorm) / d + 4;
        break;
    }
    h /= 6;
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    v: Math.round(v * 100),
  };
}

export function hsvToRgb(h: number, s: number, v: number): RGB {
  const hNorm = (h % 360) / 60;
  const sNorm = s / 100;
  const vNorm = v / 100;

  const i = Math.floor(hNorm);
  const f = hNorm - i;
  const p = vNorm * (1 - sNorm);
  const q = vNorm * (1 - sNorm * f);
  const t = vNorm * (1 - sNorm * (1 - f));

  let r = 0;
  let g = 0;
  let b = 0;

  switch (i % 6) {
    case 0:
      r = vNorm;
      g = t;
      b = p;
      break;
    case 1:
      r = q;
      g = vNorm;
      b = p;
      break;
    case 2:
      r = p;
      g = vNorm;
      b = t;
      break;
    case 3:
      r = p;
      g = q;
      b = vNorm;
      break;
    case 4:
      r = t;
      g = p;
      b = vNorm;
      break;
    case 5:
      r = vNorm;
      g = p;
      b = q;
      break;
  }

  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255),
  };
}

export function rgbToCmyk(r: number, g: number, b: number): CMYK {
  const rNorm = r / 255;
  const gNorm = g / 255;
  const bNorm = b / 255;

  const k = 1 - Math.max(rNorm, gNorm, bNorm);
  if (k === 1) {
    return { c: 0, m: 0, y: 0, k: 100 };
  }

  const c = (1 - rNorm - k) / (1 - k);
  const m = (1 - gNorm - k) / (1 - k);
  const y = (1 - bNorm - k) / (1 - k);

  return {
    c: Math.round(c * 100),
    m: Math.round(m * 100),
    y: Math.round(y * 100),
    k: Math.round(k * 100),
  };
}

export function cmykToRgb(c: number, m: number, y: number, k: number): RGB {
  const cNorm = c / 100;
  const mNorm = m / 100;
  const yNorm = y / 100;
  const kNorm = k / 100;

  const r = Math.round(255 * (1 - cNorm) * (1 - kNorm));
  const g = Math.round(255 * (1 - mNorm) * (1 - kNorm));
  const b = Math.round(255 * (1 - yNorm) * (1 - kNorm));

  return { r, g, b };
}

/**
 * Calculates WCAG 2.1 relative luminance for an RGB color.
 */
export function getLuminance(rgb: RGB): number {
  const channel = (val: number) => {
    const s = val / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(rgb.r) + 0.7152 * channel(rgb.g) + 0.0722 * channel(rgb.b);
}

/**
 * Calculates contrast ratio between two colors (1 to 21).
 */
export function getContrastRatio(hex1: string, hex2: string): number {
  const l1 = getLuminance(hexToRgb(hex1));
  const l2 = getLuminance(hexToRgb(hex2));
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  const ratio = (lighter + 0.05) / (darker + 0.05);
  return Math.round(ratio * 100) / 100;
}

export function getWcagRatings(ratio: number): WCAGResult {
  return {
    ratio,
    aaSmall: ratio >= 4.5,
    aaLarge: ratio >= 3.0,
    aaaSmall: ratio >= 7.0,
    aaaLarge: ratio >= 4.5,
  };
}

/**
 * Generates harmonious color palettes based on current color.
 */
export function generateHarmoniousPalettes(hex: string) {
  const rgb = hexToRgb(hex);
  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);

  const makeHex = (h: number, s: number, l: number) => {
    const validH = (h + 360) % 360;
    const r = hslToRgb(validH, s, l);
    return rgbToHex(r.r, r.g, r.b);
  };

  const complementary = [
    hex,
    makeHex(hsl.h + 180, hsl.s, hsl.l),
  ];

  const analogous = [
    makeHex(hsl.h - 30, hsl.s, hsl.l),
    hex,
    makeHex(hsl.h + 30, hsl.s, hsl.l),
  ];

  const triadic = [
    hex,
    makeHex(hsl.h + 120, hsl.s, hsl.l),
    makeHex(hsl.h + 240, hsl.s, hsl.l),
  ];

  const tetradic = [
    hex,
    makeHex(hsl.h + 60, hsl.s, hsl.l),
    makeHex(hsl.h + 180, hsl.s, hsl.l),
    makeHex(hsl.h + 240, hsl.s, hsl.l),
  ];

  const splitComplementary = [
    hex,
    makeHex(hsl.h + 150, hsl.s, hsl.l),
    makeHex(hsl.h + 210, hsl.s, hsl.l),
  ];

  const monochromatic = [
    makeHex(hsl.h, hsl.s, Math.max(10, hsl.l - 30)),
    makeHex(hsl.h, hsl.s, Math.max(20, hsl.l - 15)),
    hex,
    makeHex(hsl.h, hsl.s, Math.min(90, hsl.l + 15)),
    makeHex(hsl.h, hsl.s, Math.min(95, hsl.l + 30)),
  ];

  return {
    complementary,
    analogous,
    triadic,
    tetradic,
    splitComplementary,
    monochromatic,
  };
}
