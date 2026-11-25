import uuid

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