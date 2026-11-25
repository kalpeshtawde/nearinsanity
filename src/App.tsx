import { useEffect, useState } from 'react';
import { CartoonPreview } from './pages/CartoonPreview';

/** Parse the current pathname into a storefront route key. */
function parseRouteFromPath(): string {
  const path = window.location.pathname.replace(/\/+$/, '') || '/';
  if (path === '/gallery') return 'gallery';
  if (path === '/checkout') return 'checkout';
  if (path === '/pricing') return 'pricing';
  if (path.startsWith('/packs/')) return path.slice(1); // 'packs/10'
  if (path === '/membership') return 'membership';
  return 'home';
}

const TITLES: Record<string, string> = {
  home: 'Near Insanity — Digital Cartoons by Bob Johnson',
  gallery: 'The Gallery — Near Insanity Digital Cartoons',
  checkout: 'Checkout — Near Insanity Digital Cartoons',
  pricing: 'Pricing — Near Insanity Digital Cartoons',
  packs: 'Cartoon Packs — Near Insanity Digital Cartoons',
  membership: 'Membership — Near Insanity Digital Cartoons',
};

export default function App() {
  const [route, setRoute] = useState<string>(() => parseRouteFromPath());

  // Keep the route in sync with back/forward navigation on clean paths.
  useEffect(() => {
    const onPop = () => setRoute(parseRouteFromPath());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  // Per-page titles (the storefront is indexed, unlike the old demo route).
  useEffect(() => {
    const key = route.startsWith('packs/') ? 'packs' : route;
    document.title = TITLES[key] ?? TITLES.home;
    document.documentElement.lang = 'en';
  }, [route]);

  return <CartoonPreview route={route} />;
}