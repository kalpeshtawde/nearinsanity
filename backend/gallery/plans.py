"""Funnel plan catalog — server-side source of truth for credits and prices.

Credits are dollars: a plan grants credits equal to its full price, and a
checkout deducts $1 per cartoon plus the tier's URL-engraving rate when
engraving is selected. That makes a full engraved use exactly consume the
plan's credits (e.g. 10 x ($1 + $10) = $110 = 110 credits).

Plans (mirrors the frontend PACK_PRICING):
  - 10-pack nearinsanitypics.com:  $110 -> 110 credits ($10/cartoon URL)
  - 20-pack nearinsanitynow.com:   $420 -> 420 credits ($20/cartoon URL)
  - 30-pack nearinsanitymagic.com: $930 -> 930 credits ($30/cartoon URL)
  - 50-pack nearinsanity4u.com:    $2,550 -> 2,550 credits ($50/cartoon URL)
"""

from __future__ import annotations

from decimal import Decimal

PER_CARTOON_PRICE = Decimal("1")

PLANS: dict[int, dict] = {
    10: {
        "name": "10-Cartoon Starter Pack",
        "size": 10,
        "base_price": Decimal("10"),
        "engraving_per_cartoon": Decimal("10"),
        "total_with_engraving": Decimal("110"),
        "vanity_domain": "nearinsanitypics.com",
        "credits": 110,
    },
    20: {
        "name": "20-Cartoon Growth Pack",
        "size": 20,
        "base_price": Decimal("20"),
        "engraving_per_cartoon": Decimal("20"),
        "total_with_engraving": Decimal("420"),
        "vanity_domain": "nearinsanitynow.com",
        "credits": 420,
    },
    30: {
        "name": "30-Cartoon Pro Pack",
        "size": 30,
        "base_price": Decimal("30"),
        "engraving_per_cartoon": Decimal("30"),
        "total_with_engraving": Decimal("930"),
        "vanity_domain": "nearinsanitymagic.com",
        "credits": 930,
    },
    50: {
        "name": "50-Cartoon Agency Pack",
        "size": 50,
        "base_price": Decimal("50"),
        "engraving_per_cartoon": Decimal("50"),
        "total_with_engraving": Decimal("2550"),
        "vanity_domain": "nearinsanity4u.com",
        "credits": 2550,
    },
}


def plan_for_count(count: int) -> int:
    """Smallest plan that covers `count` images (10 -> 20 -> 30 -> 50)."""
    for size in sorted(PLANS):
        if size >= count:
            return size
    return max(PLANS)


def checkout_cost(count: int, engraving: bool, tier: int | None = None) -> tuple[int, int]:
    """Cost in credits for `count` images, and the plan tier that applies.

    The URL rate follows the plan the credits came from (`tier`); if no tier
    is known, fall back to the smallest plan covering the selection.
    """
    plan_size = tier if tier in PLANS else plan_for_count(count)
    rate = PLANS[plan_size]["engraving_per_cartoon"]
    per_image = PER_CARTOON_PRICE + (rate if engraving else Decimal("0"))
    return int(count * per_image), plan_size
