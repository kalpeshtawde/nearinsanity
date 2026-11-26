import { useEffect, useRef, useState, type FormEvent } from 'react';
import { fetchGalleryCartoons } from './gallery-api';
import { useAuth } from './auth';
import { useSelection } from './selection';
import {
  ART_BASE,
  CARTOONS,
  COLLAGE_ASSETS,
  OFFERS,
  PACK_PRICING,
  PACKS,
  PER_CARTOON_PRICE,
  advanceResolution,
  isMissing,
  planForCount,
  srcFor,
  type Cartoon,
  type Offer,
  type Resolution,
} from './cartoon-data';

/* ------------------------------------------------------------------ */
/* Shared bits                                                         */
/* ------------------------------------------------------------------ */

function scrollToSection(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
}

function SectionHeading({
  kicker,
  title,
  blurb,
}: {
  kicker: string;
  title: string;
  blurb?: string;
}) {
  return (
    <div className="ni-section-head">
      <span className="ni-kicker">{kicker}</span>
      <h2 className="ni-section-head__title">{title}</h2>
      {blurb && <p className="ni-section-head__blurb">{blurb}</p>}
    </div>
  );
}

/** Rendered when Bob's artwork file has not been dropped in yet. */
function ArtworkPlaceholder({ cartoon }: { cartoon: Cartoon }) {
  return (
    <span className="ni-placeholder">
      <svg
        className="ni-placeholder__scribble"
        viewBox="0 0 80 60"
        width="80"
        height="60"
        aria-hidden="true"
      >
        <path
          d="M10 44 C 22 18, 34 18, 40 32 S 58 46, 68 26"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <circle cx="18" cy="16" r="5" fill="none" stroke="currentColor" strokeWidth="2.5" />
        <path
          d="M64 44 q -3 -6 3 -8"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </svg>
      <span className="ni-placeholder__title">{cartoon.title}</span>
      <span className="ni-placeholder__hint">
        Artwork pending — save the file at <code>{`${cartoon.base}.jpg`}</code>
      </span>
    </span>
  );
}

function CartoonCard({
  cartoon,
  resolved,
  onError,
  onOpen,
  className = '',
  showTag = true,
  selected = false,
  onToggle,
}: {
  cartoon: Cartoon;
  resolved: Record<string, Resolution>;
  onError: () => void;
  onOpen: () => void;
  className?: string;
  showTag?: boolean;
  selected?: boolean;
  onToggle?: () => void;
}) {
  return (
    <div className="ni-card-wrap">
      <button type="button" className={`ni-card ${className}`} onClick={onOpen}>
        <span className="ni-card__frame">
          {isMissing(cartoon, resolved) ? (
            <ArtworkPlaceholder cartoon={cartoon} />
          ) : (
            <img
              src={srcFor(cartoon, resolved)}
              alt={cartoon.alt}
              loading="lazy"
              onError={onError}
            />
          )}
        </span>
        <span className="ni-card__caption">
          <span className="ni-card__title">{cartoon.title}</span>
          {showTag && <span className="ni-card__tag">{cartoon.tag}</span>}
        </span>
      </button>
      {onToggle && (
        <label
          className="ni-select-check"
          title={selected ? 'Remove from selection' : 'Add to selection'}
        >
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggle}
            aria-label={`${selected ? 'Remove' : 'Add'} ${cartoon.title} ${selected ? 'from' : 'to'} selection`}
          />
          <span className="ni-select-check__mark" aria-hidden="true" />
        </label>
      )}
    </div>
  );
}

/** Keep Tab inside a modal dialog. */
function trapFocus(e: KeyboardEvent, container: HTMLElement | null) {
  if (!container) return;
  const focusables = Array.from(
    container.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((el) => !el.hasAttribute('disabled'));
  if (focusables.length === 0) return;
  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
}

/* ------------------------------------------------------------------ */
/* Gallery page + lightbox                                             */
/* ------------------------------------------------------------------ */

function Lightbox({
  cartoons,
  index,
  resolved,
  onError,
  onClose,
  onPrev,
  onNext,
}: {
  cartoons: Cartoon[];
  index: number;
  resolved: Record<string, Resolution>;
  onError: () => void;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const cartoon = cartoons[index];

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowLeft') {
        onPrev();
      } else if (e.key === 'ArrowRight') {
        onNext();
      } else if (e.key === 'Tab') {
        trapFocus(e, dialogRef.current);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [index, onClose, onPrev, onNext]);

  return (
    <div className="ni-overlay" onClick={onClose}>
      <div
        className="ni-lightbox"
        role="dialog"
        aria-modal="true"
        aria-label={`Cartoon preview: ${cartoon.title}`}
        ref={dialogRef}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          ref={closeRef}
          type="button"
          className="ni-iconbtn ni-iconbtn--close"
          onClick={onClose}
          aria-label="Close cartoon preview"
        >
          ✕
        </button>
        <button
          type="button"
          className="ni-navbtn ni-navbtn--prev"
          onClick={onPrev}
          aria-label="Previous cartoon"
        >
          ←
        </button>
        <figure className="ni-lightbox__figure">
          {isMissing(cartoon, resolved) ? (
            <ArtworkPlaceholder cartoon={cartoon} />
          ) : (
            <img src={srcFor(cartoon, resolved)} alt={cartoon.alt} onError={onError} />
          )}
          <figcaption className="ni-lightbox__caption">
            <span className="ni-lightbox__title">{cartoon.title}</span>
            <span className="ni-lightbox__tag">{cartoon.tag}</span>
            <span className="ni-lightbox__credit">Bob Johnson · digital cartoon</span>
          </figcaption>
        </figure>
        <button
          type="button"
          className="ni-navbtn ni-navbtn--next"
          onClick={onNext}
          aria-label="Next cartoon"
        >
          →
        </button>
      </div>
    </div>
  );
}

export function GalleryPage() {
  const [resolved, setResolved] = useState<Record<string, Resolution>>({});
  const [cartoons, setCartoons] = useState<Cartoon[]>(CARTOONS);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const lastFocused = useRef<HTMLElement | null>(null);
  const { isSelected, toggle } = useSelection();

  // Load published images from the backend; keep the bundled list as a
  // fallback when the API is unreachable.
  useEffect(() => {
    let alive = true;
    fetchGalleryCartoons()
      .then((items) => {
        if (alive && items.length > 0) setCartoons(items);
      })
      .catch(() => {
        /* API unavailable — static fallback stays in place */
      });
    return () => {
      alive = false;
    };
  }, []);

  const handleImgError = (cartoon: Cartoon) => {
    setResolved((prev) => advanceResolution(prev, cartoon.id));
  };

  const openLightbox = (index: number) => {
    lastFocused.current = document.activeElement as HTMLElement | null;
    setLightboxIndex(index);
  };
  const closeLightbox = () => {
    setLightboxIndex(null);
    lastFocused.current?.focus();
  };
  const nextCartoon = () =>
    setLightboxIndex((i) => (i === null ? i : (i + 1) % cartoons.length));
  const prevCartoon = () =>
    setLightboxIndex((i) =>
      i === null ? i : (i - 1 + cartoons.length) % cartoons.length,
    );

  // Lock background scroll while the lightbox is open.
  useEffect(() => {
    if (lightboxIndex === null) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [lightboxIndex]);

  return (
    <>
      <section className="ni-section ni-section--band ni-page-head">
        <SectionHeading
          kicker="The cartoons"
          title="The Gallery."
          blurb="The shared catalog — full frames, captions intact. Tap any cartoon for a closer look."
        />
        <div className="ni-gallery">
          {cartoons.map((cartoon, i) => (
            <CartoonCard
              key={cartoon.id}
              cartoon={cartoon}
              resolved={resolved}
              onError={() => handleImgError(cartoon)}
              onOpen={() => openLightbox(i)}
              selected={isSelected(cartoon.id)}
              onToggle={() => toggle(cartoon)}
            />
          ))}
        </div>
        <p className="ni-gallery-note">
          The live catalog — cartoons added in the admin panel appear here
          automatically. Tick the checkbox on a cartoon to add it to your
          selection, then head to checkout.
        </p>
      </section>

      {lightboxIndex !== null && (
        <Lightbox
          cartoons={cartoons}
          index={lightboxIndex}
          resolved={resolved}
          onError={() => handleImgError(cartoons[lightboxIndex])}
          onClose={closeLightbox}
          onPrev={prevCartoon}
          onNext={nextCartoon}
        />
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Selection bar + checkout                                            */
/* ------------------------------------------------------------------ */

/** Floating bar shown once the user has picked cartoons. */
export function SelectionBar() {
  const { selected, clear, max } = useSelection();
  const count = selected.length;
  if (count === 0) return null;

  return (
    <div className="ni-select-bar">
      <span className="ni-select-bar__count">
        {count} selected{count >= max ? ` (max ${max})` : ''}
      </span>
      <button type="button" className="ni-select-bar__clear" onClick={clear}>
        Clear
      </button>
      <a className="ni-select-bar__cta" href="/checkout">
        Checkout <span aria-hidden="true">→</span>
      </a>
    </div>
  );
}

/** Checkout: review the selection, spend credits, see the matched pack. */
export function CheckoutPage() {
  const { selected, remove, clear } = useSelection();
  const { account, checkout } = useAuth();
  const [engraved, setEngraved] = useState(true);
  const [url, setUrl] = useState('');
  const [resolved, setResolved] = useState<Record<string, Resolution>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ orderId: string; credits: number } | null>(
    null,
  );
  const count = selected.length;

  const handleImgError = (cartoon: Cartoon) => {
    setResolved((prev) => advanceResolution(prev, cartoon.id));
  };

  if (result) {
    return (
      <section className="ni-section ni-section--band ni-page-head">
        <SectionHeading
          kicker="Checkout"
          title="Order complete."
          blurb={`${count} cartoon${count === 1 ? '' : 's'} checked out${
            engraved ? ` with your URL (${url.trim()}) engraved` : ''
          }. ${result.credits} credit${result.credits === 1 ? '' : 's'} remaining.`}
        />
        <p className="ni-checkout-order">
          Order <code>{result.orderId}</code>
        </p>
        <div className="ni-auth-actions">
          <a className="ni-btn ni-btn--primary" href="/gallery">
            Back to the gallery <span aria-hidden="true">→</span>
          </a>
          <a className="ni-btn" href="/pricing">
            Buy more credits
          </a>
        </div>
      </section>
    );
  }

  if (count === 0) {
    return (
      <section className="ni-section ni-section--band ni-page-head">
        <SectionHeading
          kicker="Checkout"
          title="Your selection is empty."
          blurb="Pick cartoons from the gallery first — the base plan starts at 10."
        />
        <a className="ni-btn ni-btn--primary" href="/gallery">
          Browse the gallery <span aria-hidden="true">→</span>
        </a>
      </section>
    );
  }

  // The URL rate follows the plan the credits came from; logged-out users
  // see a preview at the smallest plan covering the selection.
  const plan = account?.tier ?? planForCount(count);

  // $1 per selected cartoon; engraving adds the tier rate per cartoon.
  // Credits are dollars, so the dollar total is also the credit cost.
  const pricing = PACK_PRICING[plan];
  const cartoonsTotal = count * PER_CARTOON_PRICE;
  const engravingTotal = count * pricing.engravingPerCartoon;
  const total = engraved ? cartoonsTotal + engravingTotal : cartoonsTotal;
  const credits = account?.credits ?? 0;
  const enough = account !== null && credits >= total;
  const urlMissing = engraved && !url.trim();

  const complete = async () => {
    setError(null);
    setBusy(true);
    try {
      const res = await checkout(
        selected.map((c) => c.id),
        engraved,
        url.trim(),
      );
      setResult(res);
      clear();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Checkout failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="ni-section ni-section--band ni-page-head">
      <SectionHeading
        kicker="Checkout"
        title="Review your selection."
        blurb={
          account
            ? `${count} cartoon${count === 1 ? '' : 's'} selected — you're on the ${plan}-Cartoon Pack.`
            : `${count} cartoon${count === 1 ? '' : 's'} selected — sign in to check out with credits.`
        }
      />

      <div className="ni-checkout">
        <div className="ni-checkout__items">
          {selected.map((c) => (
            <div key={c.id} className="ni-checkout-item">
              <img
                src={srcFor(c, resolved)}
                alt={c.alt}
                loading="lazy"
                onError={() => handleImgError(c)}
              />
              <div className="ni-checkout-item__meta">
                <span className="ni-checkout-item__title">{c.title}</span>
                <span className="ni-checkout-item__tag">{c.tag}</span>
              </div>
              <button
                type="button"
                className="ni-iconbtn ni-checkout-item__remove"
                onClick={() => remove(c.id)}
                aria-label={`Remove ${c.title}`}
              >
                ✕
              </button>
            </div>
          ))}
        </div>

        <aside className="ni-checkout-summary">
          <h3>{plan}-Cartoon Pack</h3>
          <p className="ni-checkout-summary__sub">
            ${PER_CARTOON_PRICE} per cartoon · URL +$
            {pricing.engravingPerCartoon}/cartoon
          </p>

          {account ? (
            <div className="ni-credits-row">
              <span>
                Credits: <strong>{credits}</strong>
              </span>
              <span>
                This order: <strong>{total}</strong> credits
              </span>
            </div>
          ) : (
            <div className="ni-credits-row ni-credits-row--anon">
              <span>Sign in to check out with credits.</span>
            </div>
          )}

          <div className="ni-checkout-engrave">
            <h4>Add your website URL?</h4>
            <p>
              Prints your address on every cartoon — $
              {pricing.engravingPerCartoon} per cartoon.
            </p>
            <div
              className="ni-mode-toggle"
              role="radiogroup"
              aria-label="Engraving"
            >
              <button
                type="button"
                role="radio"
                aria-checked={engraved}
                className={engraved ? 'is-selected' : ''}
                onClick={() => setEngraved(true)}
              >
                Yes, add my URL
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={!engraved}
                className={!engraved ? 'is-selected' : ''}
                onClick={() => setEngraved(false)}
              >
                No thanks
              </button>
            </div>
            {engraved && (
              <label className="ni-checkout-url">
                Your website URL
                <input
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="yourbusiness.com"
                  autoComplete="url"
                  required
                />
              </label>
            )}
          </div>

          <dl className="ni-checkout-summary__rows">
            <div>
              <dt>
                {count} cartoon{count === 1 ? '' : 's'}
              </dt>
              <dd>${cartoonsTotal.toLocaleString()}</dd>
            </div>
            {engraved && (
              <div>
                <dt>Add your URL</dt>
                <dd>${engravingTotal.toLocaleString()}</dd>
              </div>
            )}
            <div className="ni-checkout-summary__total">
              <dt>Total</dt>
              <dd>${total.toLocaleString()}</dd>
            </div>
          </dl>

          {error && <p className="ni-auth-error">{error}</p>}

          {!account ? (
            <a
              className="ni-btn ni-btn--primary ni-checkout-summary__cta"
              href="/signin?next=/checkout"
            >
              Sign in to check out <span aria-hidden="true">→</span>
            </a>
          ) : enough ? (
            <>
              <button
                type="button"
                className="ni-btn ni-btn--primary ni-checkout-summary__cta"
                onClick={complete}
                disabled={busy || urlMissing}
              >
                {busy
                  ? 'Checking out…'
                  : `Complete checkout — uses ${total.toLocaleString()} credits`}
              </button>
              {urlMissing && (
                <p className="ni-auth-error">
                  Enter the website URL to engrave.
                </p>
              )}
            </>
          ) : (
            <>
              <p className="ni-auth-error">
                You need {(total - credits).toLocaleString()} more credit
                {total - credits === 1 ? '' : 's'} for this selection.
              </p>
              <a
                className="ni-btn ni-btn--primary ni-checkout-summary__cta"
                href="/pricing"
              >
                Buy credits <span aria-hidden="true">→</span>
              </a>
            </>
          )}
          <a className="ni-checkout-summary__link" href="/gallery">
            ← Continue shopping
          </a>
        </aside>
      </div>

      <button
        type="button"
        className="ni-btn ni-checkout__clear"
        onClick={clear}
      >
        Clear all selections
      </button>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Simplified offer section: tier rail + clean card                    */
/* ------------------------------------------------------------------ */

/** Large 2×2 showcase of all four uploaded cartoon assets. */
function ArtShowcase() {
  const [resolved, setResolved] = useState<Record<string, Resolution>>({});
  const handleImgError = (cartoon: Cartoon) => {
    setResolved((prev) => advanceResolution(prev, cartoon.id));
  };
  return (
    <div className="ni-showcase" aria-hidden="true">
      {COLLAGE_ASSETS.map((cartoon, i) => (
        <a
          key={cartoon.id}
          className={`ni-showcard ni-showcard--${i + 1}`}
          href="/gallery"
          tabIndex={-1}
        >
          <span className="ni-showcard__frame">
            {isMissing(cartoon, resolved) ? (
              <ArtworkPlaceholder cartoon={cartoon} />
            ) : (
              <img
                src={srcFor(cartoon, resolved)}
                alt=""
                onError={() => handleImgError(cartoon)}
              />
            )}
            {i === 0 && <span className="ni-plaque-tag">yourbusiness.com</span>}
          </span>
        </a>
      ))}
    </div>
  );
}

function tierPillLabel(o: Offer) {
  return o.size != null ? `${o.size} Cartoons` : 'Membership';
}

function tierPriceLine(o: Offer) {
  return o.size != null
    ? `$${o.basePrice} / $${o.totalWithEngraving?.toLocaleString()}`
    : `$${o.monthlyPrice}/mo`;
}

function stripLabel(o: Offer) {
  return o.size != null ? `${o.size}-Pack` : `$${o.monthlyPrice}/mo Membership`;
}

/** Compact vertical rail of all five offers beside the main card. */
function OfferRail({ activeKey }: { activeKey: string }) {
  return (
    <aside className="ni-offer-rail" aria-label="All offers">
      {OFFERS.map((o) => {
        const active = o.key === activeKey;
        return (
          <a
            key={o.key}
            className={`ni-offer-rail__item${active ? ' is-active' : ''}`}
            href={o.href}
            aria-current={active ? 'page' : undefined}
          >
            <span className="ni-offer-rail__line1">
              <span className="ni-offer-rail__title">{tierPillLabel(o)}</span>
              <span className="ni-offer-rail__price">{tierPriceLine(o)}</span>
            </span>
            <span className="ni-offer-rail__domain">{o.vanityDomain}</span>
            {!active && <span className="ni-offer-rail__arrow" aria-hidden="true">→</span>}
          </a>
        );
      })}
    </aside>
  );
}

/** The single clean 2-column offer card (zero nested boxes). */
function OfferCard({ activeKey }: { activeKey: string }) {
  const offer = OFFERS.find((o) => o.key === activeKey) ?? OFFERS[0];
  // Engraving is the default, highlighted version.
  const [engraved, setEngraved] = useState(true);

  // Membership card.
  if (offer.size == null) {
    return (
      <div className="ni-offer-card">
        <div className="ni-offer-card__top">
          <span className="ni-funnel-badge">{offer.vanityDomain}</span>
          <h2 className="ni-offer-card__title">{offer.offerName}</h2>
          <p className="ni-offer-card__desc">
            {offer.blurb} Details are pending — benefits, billing frequency,
            and sign-up arrive in a later phase.
          </p>
          <p className="ni-offer__pending">
            Lifetime pricing and specific benefits are left open for now.
          </p>
        </div>
        <div className="ni-offer-card__bottom">
          <div className="ni-offer-card__pricing">
            <p className="ni-price-display">
              ${offer.monthlyPrice}<span>/month</span>
            </p>
            <p className="ni-price-sub">Bob&rsquo;s proposed price for All-Access Membership.</p>
            <a className="ni-btn ni-btn--primary ni-offer-card__cta" href={offer.href}>
              Get Membership — ${offer.monthlyPrice}/mo <span aria-hidden="true">→</span>
            </a>
          </div>
        </div>
      </div>
    );
  }

  const pricing = PACK_PRICING[offer.size];
  const total = engraved ? pricing.totalWithEngraving : pricing.basePrice;

  return (
    <div className="ni-offer-card">
      {/* Top row: heading + large 2×2 artwork showcase */}
      <div className="ni-offer-card__top">
        <span className="ni-funnel-badge">{offer.vanityDomain}</span>
        <h2 className="ni-offer-card__title">{offer.offerName}</h2>
        <p className="ni-offer-card__desc">{offer.blurb}</p>
        <ArtShowcase />
      </div>

      {/* Bottom row: pricing & CTA alongside license checkmarks */}
      <div className="ni-offer-card__bottom">
        <div className="ni-offer-card__pricing">
          <div className="ni-mode-toggle" role="radiogroup" aria-label="Engraving">
            <button
              type="button"
              role="radio"
              aria-checked={engraved}
              className={engraved ? 'is-selected' : ''}
              onClick={() => setEngraved(true)}
            >
              With your URL
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={!engraved}
              className={!engraved ? 'is-selected' : ''}
              onClick={() => setEngraved(false)}
            >
              Without URL
            </button>
          </div>

          <p className="ni-price-display">${total.toLocaleString()}</p>
          <p className="ni-price-sub">
            {engraved
              ? `$${pricing.basePrice} for ${pricing.size} cartoons + $${pricing.engravingFee.toLocaleString()} to add your URL`
              : `$${pricing.basePrice} for ${pricing.size} cartoons`}
          </p>

          <a className="ni-btn ni-btn--primary ni-offer-card__cta" href={offer.href}>
            Get {offer.size}-Pack — ${total.toLocaleString()}{' '}
            <span aria-hidden="true">→</span>
          </a>
        </div>

        <ul className="ni-license">
          <li>Commercial rights for ads, social &amp; print</li>
          <li>Instant high-res download</li>
          <li>Pick your cartoons or use curated set</li>
        </ul>
      </div>
    </div>
  );
}

/** Understated strip referencing the other four funnel offers. */
function OtherOffersStrip({ activeKey }: { activeKey: string }) {
  const others = OFFERS.filter((o) => o.key !== activeKey);
  return (
    <p className="ni-other-strip">
      Other offers:{' '}
      {others.map((o, i) => (
        <span key={o.key}>
          {i > 0 && <span aria-hidden="true"> · </span>}
          <a href={o.href}>
            {stripLabel(o)} ({o.vanityDomain})
          </a>
        </span>
      ))}
    </p>
  );
}

/** Offer section: main card + vertical tier rail + cross-reference strip. */
export function OfferSection({ activeKey, id }: { activeKey: string; id?: string }) {
  return (
    <section className="ni-section ni-section--packs" id={id}>
      <div className="ni-offer-layout">
        <OfferCard activeKey={activeKey} />
        <OfferRail activeKey={activeKey} />
      </div>
      <OtherOffersStrip activeKey={activeKey} />
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Offer pages (packs + membership)                                    */
/* ------------------------------------------------------------------ */

export function PackOfferPage({ size }: { size: number }) {
  const offer = OFFERS.find((o) => o.size === size) ?? OFFERS[0];
  return (
    <>
      <section className="ni-section ni-section--band ni-page-head">
        <div className="ni-page-head__inner">
          <div className="ni-page-head__pills">
            <span className="ni-kicker">Cartoon pack</span>
            <span className="ni-funnel-badge">{offer.vanityDomain}</span>
          </div>
          <h1 className="ni-offer__title">{size}-Cartoon Pack</h1>
          <a className="ni-offer__gallery-link" href="/gallery">
            Browse the shared gallery →
          </a>
        </div>
      </section>
      <OfferSection activeKey={offer.key} />
    </>
  );
}

export function OfferPage({ route }: { route: string }) {
  const offer =
    OFFERS.find((o) => o.key === route) ?? OFFERS[0];

  if (offer.size != null) {
    return <PackOfferPage size={offer.size} />;
  }

  return (
    <>
      <section className="ni-section ni-section--band ni-page-head">
        <div className="ni-page-head__inner">
          <div className="ni-page-head__pills">
            <span className="ni-kicker">Membership</span>
            <span className="ni-funnel-badge">{offer.vanityDomain}</span>
          </div>
          <h1 className="ni-offer__title">Membership</h1>
          <a className="ni-offer__gallery-link" href="/gallery">
            Browse the shared gallery →
          </a>
        </div>
      </section>
      <OfferSection activeKey="membership" />
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Pricing page                                                        */
/* ------------------------------------------------------------------ */

export function PricingPage() {
  const membership = OFFERS.find((o) => o.key === 'membership');
  return (
    <section className="ni-section ni-section--band ni-page-head">
      <SectionHeading
        kicker="Pricing"
        title="Simple pricing."
        blurb={`Every cartoon is $${PER_CARTOON_PRICE}. Want your website printed on the artwork? Add your URL for an extra fee — totals below.`}
      />
      <div className="ni-pricing">
        {OFFERS.filter((o) => o.size != null).map((o) => {
          const pricing = PACK_PRICING[o.size as number];
          return (
            <article key={o.key} className="ni-pricing-card">
              <span className="ni-funnel-badge">{o.vanityDomain}</span>
              <h3 className="ni-pricing-card__name">{o.offerName}</h3>
              <p className="ni-pricing-card__blurb">{o.blurb}</p>

              <p className="ni-pricing-card__price">
                ${pricing.basePrice.toLocaleString()}
                <span> for {pricing.size} cartoons</span>
              </p>
              <p className="ni-pricing-card__addon">
                +${pricing.engravingFee.toLocaleString()} to add your URL
                <br />
                <strong>
                  ${pricing.totalWithEngraving.toLocaleString()} with your URL —{' '}
                  {pricing.credits.toLocaleString()} credits
                </strong>
              </p>

              <a
                className="ni-btn ni-btn--primary ni-pricing-card__cta"
                href={`/signin?plan=${o.size}`}
              >
                Choose this pack <span aria-hidden="true">→</span>
              </a>
            </article>
          );
        })}
        {membership && (
          <article className="ni-pricing-card ni-pricing-card--membership">
            <span className="ni-funnel-badge">{membership.vanityDomain}</span>
            <h3 className="ni-pricing-card__name">{membership.offerName}</h3>
            <p className="ni-pricing-card__blurb">{membership.blurb}</p>
            <p className="ni-pricing-card__price">
              ${membership.monthlyPrice}
              <span> / month</span>
            </p>
            <p className="ni-pricing-card__addon">
              Or upgrade to lifetime / unlimited.
            </p>
            <a
              className="ni-btn ni-btn--primary ni-pricing-card__cta"
              href={membership.href}
            >
              View membership <span aria-hidden="true">→</span>
            </a>
          </article>
        )}
      </div>
      <p className="ni-gallery-note">
        Prices in USD. Adding your URL prints your website address on every
        cartoon&rsquo;s plaque.
      </p>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Sign in / subscribe                                                 */
/* ------------------------------------------------------------------ */

export function SigninPage() {
  const { account, login, register, subscribe } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [subscribedCredits, setSubscribedCredits] = useState<number | null>(null);

  const params = new URLSearchParams(window.location.search);
  const planParam = Number(params.get('plan') ?? '');
  const plan = PACKS.some((p) => p.size === planParam) ? planParam : null;
  const next = params.get('next') || '/checkout';

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === 'register') {
        await register(email, password);
      } else {
        await login(email, password);
      }
      if (plan) {
        setSubscribedCredits(await subscribe(plan));
      } else {
        window.location.assign(next);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  const subscribeNow = async () => {
    if (!plan) return;
    setError(null);
    setBusy(true);
    try {
      setSubscribedCredits(await subscribe(plan));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  // Signed in and just bought a plan.
  if (subscribedCredits !== null) {
    return (
      <section className="ni-section ni-section--band ni-page-head">
        <SectionHeading
          kicker="Subscription"
          title="You're all set."
          blurb={`Your ${plan}-cartoon plan is active. You now have ${subscribedCredits} credits on ${account?.email}.`}
        />
        <div className="ni-auth-actions">
          <a className="ni-btn ni-btn--primary" href={next}>
            Continue to checkout <span aria-hidden="true">→</span>
          </a>
          <a className="ni-btn" href="/gallery">
            Browse the gallery
          </a>
        </div>
      </section>
    );
  }

  // Already signed in (e.g. arrived from a plan CTA).
  if (account) {
    return (
      <section className="ni-section ni-section--band ni-page-head">
        <SectionHeading
          kicker="Account"
          title="You're signed in."
          blurb={`${account.email} — ${account.credits} credit${account.credits === 1 ? '' : 's'} available.`}
        />
        {plan ? (
          <div className="ni-auth-card">
            <h3>Subscribe to the {plan}-Cartoon Pack</h3>
            <p>
              Add {PACK_PRICING[plan].credits.toLocaleString()} credits to your
              account for $
              {PACK_PRICING[plan].totalWithEngraving.toLocaleString()} (payment
              simulated).
            </p>
            {error && <p className="ni-auth-error">{error}</p>}
            <button
              type="button"
              className="ni-btn ni-btn--primary"
              onClick={subscribeNow}
              disabled={busy}
            >
              {busy
                ? 'Adding credits…'
                : `Subscribe — +${PACK_PRICING[plan].credits.toLocaleString()} credits`}
            </button>
          </div>
        ) : (
          <div className="ni-auth-actions">
            <a className="ni-btn ni-btn--primary" href="/checkout">
              Go to checkout <span aria-hidden="true">→</span>
            </a>
            <a className="ni-btn" href="/pricing">
              View plans
            </a>
          </div>
        )}
      </section>
    );
  }

  return (
    <section className="ni-section ni-section--band ni-page-head">
      <SectionHeading
        kicker={plan ? 'Subscribe' : 'Account'}
        title={plan ? `Get the ${plan}-Cartoon Pack.` : 'Sign in.'}
        blurb={
          plan
            ? `Create an account or sign in to receive ${PACK_PRICING[plan].credits.toLocaleString()} credits for $${PACK_PRICING[plan].totalWithEngraving.toLocaleString()} (payment simulated).`
            : 'Sign in to use your credits and check out cartoons.'
        }
      />
      <div className="ni-auth-card">
        <div className="ni-mode-toggle" role="radiogroup" aria-label="Account mode">
          <button
            type="button"
            role="radio"
            aria-checked={mode === 'login'}
            className={mode === 'login' ? 'is-selected' : ''}
            onClick={() => setMode('login')}
          >
            Sign in
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={mode === 'register'}
            className={mode === 'register' ? 'is-selected' : ''}
            onClick={() => setMode('register')}
          >
            Create account
          </button>
        </div>
        <form className="ni-auth-form" onSubmit={submit}>
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
              minLength={8}
              required
            />
          </label>
          {error && <p className="ni-auth-error">{error}</p>}
          <button type="submit" className="ni-btn ni-btn--primary" disabled={busy}>
            {busy
              ? 'Working…'
              : mode === 'register'
                ? plan
                  ? `Create account & subscribe — $${PACK_PRICING[plan].totalWithEngraving.toLocaleString()}`
                  : 'Create account'
                : plan
                  ? 'Sign in & subscribe'
                  : 'Sign in'}
          </button>
        </form>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Engraved samples showcase (homepage)                                */
/* ------------------------------------------------------------------ */

/** Four engraved Thanksgiving frames — the same cartoon, four domains. */
const ENGRAVE_SAMPLES = [
  { src: `${ART_BASE}/engrave/engrave-acmecoffee.png`, domain: 'acmecoffee.com' },
  { src: `${ART_BASE}/engrave/engrave-brightdental.png`, domain: 'brightdental.co' },
  { src: `${ART_BASE}/engrave/engrave-oakstreetlaw.png`, domain: 'oakstreetlaw.com' },
  { src: `${ART_BASE}/engrave/engrave-nearinsanity.png`, domain: 'nearinsanity.com' },
];

export function EngraveSection() {
  return (
    <section className="ni-section ni-section--personalize" id="ni-personalize">
      <SectionHeading
        kicker="Engraved samples"
        title="Put your website on the artwork."
        blurb="Your address engraved on the wooden plaque, right on the frame — the same cartoon, four different domains."
      />
      <div className="ni-engrave">
        {ENGRAVE_SAMPLES.map((sample) => (
          <figure key={sample.domain} className="ni-engrave-card">
            <span className="ni-engrave-card__frame">
              <img
                src={sample.src}
                alt={`Framed Thanksgiving cartoon with ${sample.domain} engraved on the plaque`}
                loading="lazy"
              />
            </span>
            <figcaption className="ni-engrave-card__caption">{sample.domain}</figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Homepage                                                            */
/* ------------------------------------------------------------------ */

export function HomePage() {
  const [resolved, setResolved] = useState<Record<string, Resolution>>({});
  const [featured, setFeatured] = useState<Cartoon>(CARTOONS[0]);

  // Use the latest published cartoon from the backend when available.
  useEffect(() => {
    let alive = true;
    fetchGalleryCartoons()
      .then((items) => {
        if (alive && items.length > 0) setFeatured(items[0]);
      })
      .catch(() => {
        /* API unavailable — static fallback stays in place */
      });
    return () => {
      alive = false;
    };
  }, []);

  const handleImgError = (cartoon: Cartoon) => {
    setResolved((prev) => advanceResolution(prev, cartoon.id));
  };

  return (
    <>
      {/* Hero */}
      <section className="ni-hero">
        <div className="ni-hero__copy">
          <span className="ni-kicker">Syndicated cartoons for marketing</span>
          <h1 className="ni-hero__title">
            Cartoons for an <em>absurd</em> world.
          </h1>
          <p className="ni-hero__lead">
            Bob Johnson&rsquo;s digital cartoons — strange everyday moments and
            rock-and-roll chaos — ready for your marketing, with your own
            website address on the artwork.
          </p>
          <div className="ni-hero__actions">
            <a className="ni-btn ni-btn--primary" href="/gallery">
              Browse Cartoons <span aria-hidden="true">→</span>
            </a>
          </div>
        </div>
        <div className="ni-hero__art-col">
          <a className="ni-card ni-hero__art" href="/gallery">
            <span className="ni-card__frame">
              {isMissing(featured, resolved) ? (
                <ArtworkPlaceholder cartoon={featured} />
              ) : (
                <img
                  src={srcFor(featured, resolved)}
                  alt={featured.alt}
                  onError={() => handleImgError(featured)}
                />
              )}
            </span>
            <span className="ni-card__caption">
              <span className="ni-card__title">{featured.title}</span>
              <span className="ni-card__tag">{featured.tag} — open the gallery</span>
              <span className="ni-card__callout">
                yourbusiness.com — engraved on every cartoon
              </span>
            </span>
          </a>
        </div>
      </section>

      {/* How it works */}
      <section className="ni-section ni-section--intro" id="how-it-works">
        <SectionHeading
          kicker="How it works"
          title="Your marketing, with a cartoon twist."
          blurb="Businesses use Bob’s absurd cartoons in ads, social posts, and packaging — then make them their own."
        />
        <div className="ni-steps">
          <div className="ni-step">
            <span className="ni-step__num">01</span>
            <span className="ni-step__title">Browse the gallery</span>
            <p className="ni-step__text">
              Full cartoon frames, captions included, from the shared catalog.
            </p>
            <a className="ni-step__link" href="/gallery">
              See the cartoons →
            </a>
          </div>
          <div className="ni-step">
            <span className="ni-step__num">02</span>
            <span className="ni-step__title">Pick a pack</span>
            <p className="ni-step__text">
              Choose the pack size that fits your marketing — starting with 10
              cartoons.
            </p>
            <a className="ni-step__link" href="/packs/10">
              The 10-cartoon pack →
            </a>
          </div>
          <div className="ni-step">
            <span className="ni-step__num">03</span>
            <span className="ni-step__title">Add your website address</span>
            <p className="ni-step__text">
              Optional: your address engraved on the wooden plaque. See four
              examples below.
            </p>
            <a className="ni-step__link" href="#ni-personalize" onClick={(e) => { e.preventDefault(); scrollToSection('ni-personalize'); }}>
              See engraved samples →
            </a>
          </div>
        </div>
      </section>

      {/* Engraved samples showcase */}
      <EngraveSection />

      {/* Unified offer: featured 10-pack + all five funnel offers */}
      <OfferSection activeKey="packs/10" id="ni-offers" />
    </>
  );
}