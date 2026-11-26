import type { Cartoon } from './cartoon-data';

/**
 * Gallery API client.
 *
 * The Django backend exposes published images at /api/v1/gallery/. The base
 * URL defaults to the current origin — production, where nginx routes
 * /api/ to the backend container. Local frontend dev points at the local
 * backend via VITE_API_BASE (see .env.local).
 */
const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? '';

export interface GalleryImageDto {
  id: string;
  title: string;
  slug: string;
  tag: string;
  description: string;
  image: string | null;
  image_url: string | null;
  alt_text: string;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

interface GalleryListResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: GalleryImageDto[];
}

/** Map a backend image to the storefront's Cartoon shape. */
function toCartoon(dto: GalleryImageDto): Cartoon | null {
  if (!dto.image_url) return null;
  return {
    id: dto.id,
    title: dto.title,
    tag: dto.tag || 'From the catalog',
    alt: dto.alt_text || dto.title,
    base: '',
    imageUrl: dto.image_url,
  };
}

/**
 * Fetch published gallery images. Throws on network/HTTP errors so callers
 * can fall back to the bundled static list.
 */
export async function fetchGalleryCartoons(): Promise<Cartoon[]> {
  const res = await fetch(`${API_BASE}/api/v1/gallery/`, {
    // Public endpoint — no cookies needed (avoids session/CSRF interference).
    credentials: 'omit',
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`gallery API responded ${res.status}`);
  const data = (await res.json()) as GalleryListResponse;
  return data.results
    .map(toCartoon)
    .filter((c): c is Cartoon => c !== null);
}