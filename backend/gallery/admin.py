from django.contrib import admin
from django.utils.html import format_html

from .models import (
    CreditAccount,
    CreditTransaction,
    GalleryImage,
    Order,
    OrderItem,
    Subscription,
)


@admin.register(GalleryImage)
class GalleryImageAdmin(admin.ModelAdmin):
    list_display = (
        "thumbnail",
        "title",
        "tag",
        "is_published",
        "created_at",
        "id",
    )
    list_display_links = ("thumbnail", "title")
    list_filter = ("is_published", "tag", "created_at")
    search_fields = ("title", "slug", "tag", "description", "alt_text")
    readonly_fields = ("id", "preview", "created_at", "updated_at")
    prepopulated_fields = {"slug": ("title",)}
    list_per_page = 25

    fieldsets = (
        (
            "Artwork",
            {
                "fields": (
                    "preview",
                    "image",
                    "title",
                    "slug",
                    "tag",
                    "description",
                    "alt_text",
                    "is_published",
                )
            },
        ),
        (
            "Metadata",
            {
                "fields": ("id", "created_at", "updated_at"),
                "classes": ("collapse",),
            },
        ),
    )

    @admin.display(description="Preview")
    def preview(self, obj: GalleryImage) -> str:
        if not obj.image:
            return "—"
        return format_html(
            '<img src="{}" style="max-height:120px;border-radius:4px;" alt="{}" />',
            obj.image.url,
            obj.title,
        )

    @admin.display(description="Thumb")
    def thumbnail(self, obj: GalleryImage) -> str:
        if not obj.image:
            return "—"
        return format_html(
            '<img src="{}" style="max-height:40px;border-radius:4px;" alt="" />',
            obj.image.url,
        )

# ---------------------------------------------------------------------------
# Accounts, credits, subscriptions, orders
# ---------------------------------------------------------------------------


class CreditTransactionInline(admin.TabularInline):
    model = CreditTransaction
    extra = 0
    can_delete = False
    fields = ("created_at", "delta", "balance_after", "reason")
    readonly_fields = ("created_at", "delta", "balance_after", "reason")

    def has_add_permission(self, request, obj=None):
        return False


@admin.register(CreditAccount)
class CreditAccountAdmin(admin.ModelAdmin):
    list_display = ("user_email", "balance", "tier", "updated_at")
    list_display_links = ("user_email",)
    search_fields = ("user__email", "user__username")
    list_filter = ("tier",)
    readonly_fields = ("id", "created_at", "updated_at")
    inlines = [CreditTransactionInline]
    ordering = ("-balance",)
    list_per_page = 50

    @admin.display(description="Email")
    def user_email(self, obj: CreditAccount) -> str:
        return obj.user.email or obj.user.username


@admin.register(CreditTransaction)
class CreditTransactionAdmin(admin.ModelAdmin):
    list_display = ("account", "delta", "balance_after", "reason", "created_at")
    list_filter = ("reason",)
    search_fields = ("account__user__email", "account__user__username")
    readonly_fields = ("id", "account", "delta", "balance_after", "reason", "created_at")
    ordering = ("-created_at",)

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False


@admin.register(Subscription)
class SubscriptionAdmin(admin.ModelAdmin):
    list_display = (
        "user_email",
        "plan_size",
        "credits_granted",
        "amount",
        "provider",
        "stripe_session_id",
        "created_at",
    )
    list_filter = ("plan_size", "provider")
    search_fields = ("user__email", "user__username", "stripe_session_id")
    readonly_fields = (
        "id",
        "user",
        "plan_size",
        "credits_granted",
        "amount",
        "provider",
        "stripe_session_id",
        "created_at",
    )
    ordering = ("-created_at",)

    @admin.display(description="Email")
    def user_email(self, obj: Subscription) -> str:
        return obj.user.email or obj.user.username

    def has_add_permission(self, request):
        return False


class OrderItemInline(admin.TabularInline):
    model = OrderItem
    extra = 0
    can_delete = False
    fields = ("image",)
    readonly_fields = ("image",)

    def has_add_permission(self, request, obj=None):
        return False


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = (
        "user_email",
        "image_count",
        "engraving",
        "engraved_url",
        "credits_used",
        "amount",
        "created_at",
    )
    list_filter = ("engraving", "created_at")
    search_fields = ("user__email", "user__username", "engraved_url")
    readonly_fields = (
        "id",
        "user",
        "image_count",
        "engraving",
        "engraved_url",
        "credits_used",
        "amount",
        "created_at",
    )
    inlines = [OrderItemInline]
    ordering = ("-created_at",)

    @admin.display(description="Email")
    def user_email(self, obj: Order) -> str:
        return obj.user.email or obj.user.username

    def has_add_permission(self, request):
        return False
