/**
 * Rank labels used to be brand red everywhere, which said nothing about the
 * belt. They are now tinted with the belt's own colour — but a raw belt hex is
 * often unreadable on the dark card (#2e2e2e-ish brown, near-black black belt),
 * so the tint is derived in OKLCH: keep the hue and chroma, raise the lightness
 * until the measured contrast against the card background clears WCAG AA 4.5:1.
 *
 * The maths lives here (not in a Tailwind class) precisely so it can be measured
 * by a script over every seeded rank rather than asserted by eye.
 */

/** The shipped dark card background: --card: oklch(0.18 0.006 260). */
export const CARD_BG_OKLCH = { l: 0.18, c: 0.006, h: 260 };

type Rgb = { r: number; g: number; b: number };
type Oklch = { l: number; c: number; h: number };

export function hexToRgb(hex: string): Rgb {
  const s = hex.trim().replace("#", "");
  const full = s.length === 3 ? s.split("").map((ch) => ch + ch).join("") : s;
  const n = Number.parseInt(full.slice(0, 6), 16);
  if (!Number.isFinite(n)) return { r: 0, g: 0, b: 0 };
  return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255 };
}

const toLinear = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const toGamma = (v: number) => (v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055);

export function rgbToOklch({ r, g, b }: Rgb): Oklch {
  const lr = toLinear(r), lg = toLinear(g), lb = toLinear(b);
  const l_ = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m_ = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s_ = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  const L = 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_;
  const a = 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_;
  const bb = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_;
  const c = Math.hypot(a, bb);
  let h = (Math.atan2(bb, a) * 180) / Math.PI;
  if (h < 0) h += 360;
  return { l: L, c, h };
}

export function oklchToRgb({ l, c, h }: Oklch): Rgb {
  const hr = (h * Math.PI) / 180;
  const a = c * Math.cos(hr);
  const b2 = c * Math.sin(hr);
  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b2) ** 3;
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b2) ** 3;
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b2) ** 3;
  const lr = 4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_;
  const lg = -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_;
  const lb = -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_;
  const clamp = (v: number) => Math.min(1, Math.max(0, toGamma(v)));
  return { r: clamp(lr), g: clamp(lg), b: clamp(lb) };
}

export function rgbToHex({ r, g, b }: Rgb): string {
  const px = (v: number) =>
    Math.round(Math.min(1, Math.max(0, v)) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${px(r)}${px(g)}${px(b)}`;
}

/** WCAG relative luminance. */
export function relativeLuminance({ r, g, b }: Rgb): number {
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

export function contrastRatio(a: Rgb, b: Rgb): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

const CARD_RGB = oklchToRgb(CARD_BG_OKLCH);

/**
 * The readable tint for one belt. `pattern`/`accent` matter because a stripe or
 * camo belt's *primary* is the near-white or camo base — the rank's identity is
 * its accent stripe, and a near-white tint would be indistinguishable from plain
 * body text anyway.
 */
export function beltLabelColor(
  colorPrimary: string,
  colorAccent?: string | null,
  minRatio = 4.5,
): string {
  let base = rgbToOklch(hexToRgb(colorPrimary));
  // On a stripe or camo belt the *accent* is the rank's identity — the primary is
  // the shared white/olive base, so tinting by it would give every rank in the
  // system the same badge. Only stripe/camo ranks carry an accent, so its mere
  // presence is the signal.
  if (colorAccent && colorAccent.toLowerCase() !== colorPrimary.toLowerCase()) {
    base = rgbToOklch(hexToRgb(colorAccent));
  }

  // Achromatic belts (white/black) get a neutral light grey rather than a
  // pointless hue guess.
  const hue = base.c < 0.01 ? { l: base.l, c: 0, h: base.h } : base;
  for (let l = Math.max(hue.l, 0.5); l <= 1.0001; l += 0.01) {
    const candidate = { ...hue, l: Math.min(1, l) };
    const rgb = oklchToRgb(candidate);
    if (contrastRatio(rgb, CARD_RGB) >= minRatio) return rgbToHex(rgb);
  }
  return "#ffffff";
}

/** Inline style for a rank badge: belt-tinted text with a matching soft border. */
export function beltLabelStyle(colorPrimary: string, colorAccent?: string | null) {
  const color = beltLabelColor(colorPrimary, colorAccent);
  return {
    color,
    borderColor: `color-mix(in srgb, ${color} 45%, transparent)`,
  } as const;
}

