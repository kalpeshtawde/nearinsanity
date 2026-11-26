import uuid

from django.conf import settings
from django.db import models


class GalleryImage(models.Model):
    """A cartoon artwork shown in the storefront gallery.

    Every row is keyed by a UUID (per the project's "all IDs are UUIDs"
    rule). Images are uploaded through the Django admin and served to the
    public via the REST API below.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(max_length=200)
    slug = models.SlugField(
        max_length=220,
        unique=True,
        blank=True,
        help_text="URL-friendly identifier; auto-generated from the title if left blank.",
    )
    tag = models.CharField(
        max_length=100,
        blank=True,
        default="",
        help_text="Short category shown on the card, e.g. “Strange everyday moments”.",
    )
    description = models.TextField(
        blank=True,
        default="",
        help_text="Optional longer description of the cartoon.",
    )
    image = models.ImageField(
        upload_to="art/gallery/%Y/%m/",
        help_text="The cartoon artwork (jpg, png, or webp).",
    )
    alt_text = models.CharField(
        max_length=300,
        blank=True,
        default="",
        help_text="Accessible alt text; defaults to the title if left blank.",
    )
    is_published = models.BooleanField(
        default=True,
        help_text="Unpublished images are hidden from the public API.",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "gallery image"
        verbose_name_plural = "gallery images"

    def __str__(self) -> str:
        return self.title

    def save(self, *args, **kwargs) -> None:
        if not self.slug:
            from django.utils.text import slugify

            base = slugify(self.title) or "image"
            slug, n = base, 1
            while GalleryImage.objects.filter(slug=slug).exclude(pk=self.pk).exists():
                n += 1
                slug = f"{base}-{n}"
            self.slug = slug
        super().save(*args, **kwargs)

class CreditAccount(models.Model):
    """Credit balance attached to a user (their email account).

    One account per user. Credits are image credits: each subscription grants
    as many credits as cartoons in the plan, and checkout spends one credit
    per selected cartoon.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="credit_account",
    )
    balance = models.PositiveIntegerField(default=0)
    tier = models.PositiveIntegerField(
        default=10,
        help_text="Plan size the credits came from (10/20/30/50); sets the URL rate.",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "credit account"
        verbose_name_plural = "credit accounts"

    def __str__(self) -> str:
        return f"{self.user.email or self.user.username}: {self.balance} credits"


class CreditTransaction(models.Model):
    """Append-only ledger of credit changes (grants and spends)."""

    class Reason(models.TextChoices):
        SUBSCRIPTION = "subscription", "Subscription"
        CHECKOUT = "checkout", "Checkout"
        ADJUSTMENT = "adjustment", "Adjustment"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    account = models.ForeignKey(
        CreditAccount, on_delete=models.CASCADE, related_name="transactions"
    )
    delta = models.IntegerField()
    balance_after = models.PositiveIntegerField()
    reason = models.CharField(max_length=20, choices=Reason.choices)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "credit transaction"
        verbose_name_plural = "credit transactions"

    def __str__(self) -> str:
        sign = "+" if self.delta >= 0 else ""
        return f"{sign}{self.delta} ({self.reason})"


class Subscription(models.Model):
    """A funnel plan purchase. Payment is simulated for now."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="subscriptions"
    )
    plan_size = models.PositiveIntegerField(help_text="10 / 20 / 30 / 50 cartoons")
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    credits_granted = models.PositiveIntegerField()
    provider = models.CharField(
        max_length=20, default="simulated", help_text="simulated or stripe"
    )
    stripe_session_id = models.CharField(
        max_length=255,
        blank=True,
        default="",
        db_index=True,
        help_text="Stripe Checkout session that paid for this (idempotency key).",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"{self.user.email or self.user.username}: {self.plan_size}-pack"


class Order(models.Model):
    """A checkout: N selected cartoons paid for with credits."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="orders"
    )
    image_count = models.PositiveIntegerField()
    engraving = models.BooleanField(default=False)
    engraved_url = models.CharField(
        max_length=255,
        blank=True,
        default="",
        help_text="Website address printed on the artwork when engraving is on.",
    )
    credits_used = models.PositiveIntegerField()
    amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"Order {self.id} ({self.image_count} images)"


class OrderItem(models.Model):
    """One cartoon included in an order."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name="items")
    image = models.ForeignKey(GalleryImage, on_delete=models.PROTECT)

    def __str__(self) -> str:
        return f"{self.order_id} → {self.image_id}"
