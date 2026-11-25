from django.contrib import admin
from django.utils.html import format_html

from .models import GalleryImage


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