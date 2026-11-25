/**
 * Data + image helpers for the Near Insanity concept preview (multi-page
 * demo rooted at /cartoon-preview). Frontend-only: no payment, signup,
 * referral tracking, or downloadable image generation.
 */

/** Where Bob's cartoon images live (public assets, served at this path). */
export const ART_BASE = '/art';

/** Image formats probed in order, so Bob can drop jpg, png, or webp files. */
export const EXTS = ['jpg', 'png', 'webp'] as const;
export type Ext = (typeof EXTS)[number];
export type Resolution = Ext | 'missing';

export interface Cartoon {
  id: string;
  title: string;
  tag: string;
  base: string; // path without extension — the loader probes jpg → png → webp
  alt: string;
  /** Absolute image URL from the gallery API; bypasses the local-file probe. */
  imageUrl?: string;
}

// The supplied cartoons. "Too Much to Dream" is the featured bedroom cartoon;
// the two rock-and-roll cartoons sit alongside it. The gallery layout scales
// to Bob's full 50-cartoon catalog — just add more entries to this array.
export const CARTOONS: Cartoon[] = [
  {
    id: 'too-much-to-dream',
    title: '“Too Much to Dream”',
    tag: 'Strange everyday moments',
    base: `${ART_BASE}/cartoon-too-much-to-dream`,
    alt: 'Bob Johnson cartoon, “Too Much to Dream”: a bedroom scene where an ordinary night of sleep turns into an absurd, overflowing dream.',
  },
  {
    id: 'rock-1',
    title: 'Rock ’n’ Roll Chaos #1',
    tag: 'Rock-and-roll chaos',
    base: `${ART_BASE}/cartoon-rock-1`,
    alt: 'Bob Johnson rock-and-roll cartoon #1: onstage pandemonium — amps, noise, and energy running wild.',
  },
  {
    id: 'rock-2',
    title: 'Rock ’n’ Roll Chaos #2',
    tag: 'Rock-and-roll chaos',
    base: `${ART_BASE}/cartoon-rock-2`,
    alt: 'Bob Johnson rock-and-roll cartoon #2: a second scene of stage-side chaos and loud, absurd rock-and-roll.',
  },
];

/** The four pack sizes; 10 is the proposed starting offer. */
export const PACKS = [
  { size: 10, desc: 'A starter set of Bob’s best cartoons — the proposed starting pack.' },
  { size: 20, desc: 'A deeper run through the favourites.' },
  { size: 30, desc: 'A solid wall of absurdity.' },
  { size: 50, desc: 'The near-complete shared catalog.' },
] as const;

/**
 * Smallest pack that covers `count` selected images. Picks the base 10-pack,
 * then elevates to the next size as the selection grows (11 → 20, 21 → 30,
 * 31 → 50). Anything beyond the largest pack stays at 50.
 */
export function planForCount(count: number): number {
  const pack = PACKS.find((p) => p.size >= count);
  return pack ? pack.size : PACKS[PACKS.length - 1].size;
}

/**
 * Single source of truth for pricing.
 *
 * Every cartoon costs $1. Engraving (the buyer's website address printed on
 * the artwork) is an optional add-on charged per cartoon: $10 per image.
 */
export const PER_CARTOON_PRICE = 1;
export const ENGRAVING_PER_CARTOON = 10;

export interface PackPricing {
  size: number;
  /** One-time base price for the pack, USD ($1 per cartoon). */
  basePrice: number;
  /** Engraving add-on for the pack: $10 per cartoon. */
  engravingFee: number;
  /** Per-cartoon engraving rate. */
  engravingPerCartoon: number;
  /** basePrice + engravingFee. */
  totalWithEngraving: number;
  /** Funnel vanity-URL badge shown on the offer card. */
  vanityDomain: string;
}

function packPricing(size: number, vanityDomain: string): PackPricing {
  const basePrice = size * PER_CARTOON_PRICE;
  const engravingFee = size * ENGRAVING_PER_CARTOON;
  return {
    size,
    basePrice,
    engravingFee,
    engravingPerCartoon: ENGRAVING_PER_CARTOON,
    totalWithEngraving: basePrice + engravingFee,
    vanityDomain,
  };
}

/** Per-pack pricing — the interactive total calculator reads from here. */
export const PACK_PRICING: Record<number, PackPricing> = {
  10: packPricing(10, 'nearinsanitypics.com'),
  20: packPricing(20, 'nearinsanitynow.com'),
  30: packPricing(30, 'nearinsanitymagic.com'),
  50: packPricing(50, 'nearinsanity4u.com'),
};

/** Membership — Bob's proposed monthly price (details pending). */
export const MEMBERSHIP_PRICE = 25;

export interface Offer {
  key: string; // 'packs/10' | 'packs/20' | 'packs/30' | 'packs/50' | 'membership'
  label: string; // page heading
  offerName: string; // marketing name used in the offer list / panels
  href: string;
  size?: number; // pack size for pack offers
  blurb: string;
  vanityDomain?: string;
  basePrice?: number;
  totalWithEngraving?: number;
  monthlyPrice?: number;
}

/** The five offers that will live on nearinsanity.com. */
export const OFFERS: Offer[] = [
  {
    key: 'packs/10',
    label: '10-Cartoon Pack',
    offerName: '10-Cartoon Starter Pack',
    href: '/packs/10',
    size: 10,
    blurb: 'The proposed starting pack — a starter set of Bob’s best cartoons.',
    vanityDomain: PACK_PRICING[10].vanityDomain,
    basePrice: PACK_PRICING[10].basePrice,
    totalWithEngraving: PACK_PRICING[10].totalWithEngraving,
  },
  {
    key: 'packs/20',
    label: '20-Cartoon Pack',
    offerName: '20-Cartoon Growth Pack',
    href: '/packs/20',
    size: 20,
    blurb: 'A deeper run through the favourites.',
    vanityDomain: PACK_PRICING[20].vanityDomain,
    basePrice: PACK_PRICING[20].basePrice,
    totalWithEngraving: PACK_PRICING[20].totalWithEngraving,
  },
  {
    key: 'packs/30',
    label: '30-Cartoon Pack',
    offerName: '30-Cartoon Pro Pack',
    href: '/packs/30',
    size: 30,
    blurb: 'A solid wall of absurdity.',
    vanityDomain: PACK_PRICING[30].vanityDomain,
    basePrice: PACK_PRICING[30].basePrice,
    totalWithEngraving: PACK_PRICING[30].totalWithEngraving,
  },
  {
    key: 'packs/50',
    label: '50-Cartoon Pack',
    offerName: '50-Cartoon Agency Pack',
    href: '/packs/50',
    size: 50,
    blurb: 'The near-complete shared catalog.',
    vanityDomain: PACK_PRICING[50].vanityDomain,
    basePrice: PACK_PRICING[50].basePrice,
    totalWithEngraving: PACK_PRICING[50].totalWithEngraving,
  },
  {
    key: 'membership',
    label: 'Membership',
    offerName: 'All-Access Membership',
    href: '/membership',
    blurb: 'Ongoing access to the catalog — $25/month proposed.',
    vanityDomain: 'nearinsanity.com',
    monthlyPrice: MEMBERSHIP_PRICE,
  },
];

/** Fourth uploaded asset used in the fanned pack collages (the personalized
 * Thanksgiving frame with the plaque). */
export const THANKSGIVING_CARTOON: Cartoon = {
  id: 'thanksgiving-frame',
  title: 'Thanksgiving Frame',
  tag: 'Personalized',
  base: `${ART_BASE}/thanksgiving-frame`,
  alt: 'Bob Johnson’s framed Thanksgiving cartoon with a wooden plaque at the bottom.',
};

/** All four uploaded cartoon assets, cycled across the preview collages. */
export const COLLAGE_ASSETS: Cartoon[] = [
  CARTOONS[0],
  CARTOONS[1],
  CARTOONS[2],
  THANKSGIVING_CARTOON,
];

/** Resolved src for a cartoon given the current probe state. */
export function srcFor(cartoon: Cartoon, resolved: Record<string, Resolution>) {
  if (cartoon.imageUrl) return cartoon.imageUrl;
  const r = resolved[cartoon.id];
  if (!r || r === 'missing') return `${cartoon.base}.jpg`;
  return `${cartoon.base}.${r}`;
}

export function isMissing(cartoon: Cartoon, resolved: Record<string, Resolution>) {
  // API-backed cartoons always have a concrete URL — never "missing".
  return !cartoon.imageUrl && resolved[cartoon.id] === 'missing';
}

/** Advance the probe state for a failed image load (jpg → png → webp). */
export function advanceResolution(
  prev: Record<string, Resolution>,
  id: string,
): Record<string, Resolution> {
  const cur = prev[id];
  // No entry yet means the default .jpg probe is what just failed — advance
  // straight to the next candidate so the src actually changes.
  if (!cur) return { ...prev, [id]: EXTS[1] };
  const idx = cur === 'missing' ? -1 : EXTS.indexOf(cur);
  if (idx === -1 || idx >= EXTS.length - 1) {
    return { ...prev, [id]: 'missing' };
  }
  return { ...prev, [id]: EXTS[idx + 1] };
}