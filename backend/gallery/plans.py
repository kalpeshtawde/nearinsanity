"""Funnel plan catalog — server-side source of truth for credits and prices.

Mirrors the frontend's PACK_PRICING: cartoons are $1 each, URL engraving is
priced per cartoon by tier, and each plan grants credits equal to its size.
"""

from decimal import Decimal

PLANS: dict[int, dict] = {
    10: {
        "name": "10-Cartoon Starter Pack",
        "size": 10,
        "base_price": Decimal("10"),
        "engraving_per_cartoon": Decimal("10"),
        "total_with_engraving": Decimal("110"),
        "vanity_domain": "nearinsanitypics.com",
        "credits": 10,
    },
    20: {
        "name": "20-Cartoon Growth Pack",
        "size": 20,
        "base_price": Decimal("20"),
        "engraving_per_cartoon": Decimal("20"),
        "total_with_engraving": Decimal("420"),
        "vanity_domain": "nearinsanitynow.com",
        "credits": 20,
    },
    30: {
        "name": "30-Cartoon Pro Pack",
        "size": 30,
        "base_price": Decimal("30"),
        "engraving_per_cartoon": Decimal("30"),
        "total_with_engraving": Decimal("930"),
        "vanity_domain": "nearinsanitymagic.com",
        "credits": 30,
    },
    50: {
        "name": "50-Cartoon Agency Pack",
        "size": 50,
        "base_price": Decimal("50"),
        "engraving_per_cartoon": Decimal("50"),
        "total_with_engraving": Decimal("2550"),
        "vanity_domain": "nearinsanity4u.com",
        "credits": 50,
    },
}


def plan_for_count(count: int) -> int:
    """Smallest plan that covers `count` images (10 -> 20 -> 30 -> 50)."""
    for size in sorted(PLANS):
        if size >= count:
            return size
    return max(PLANS)
