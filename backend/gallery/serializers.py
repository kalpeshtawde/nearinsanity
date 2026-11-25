from typing import Optional

from rest_framework import serializers

from .models import GalleryImage


class GalleryImageSerializer(serializers.ModelSerializer):
    """Public + admin representation of a gallery image.

    `id` is the UUID primary key; `image` is the absolute media URL.
    """

    image = serializers.ImageField(read_only=True)
    image_url = serializers.SerializerMethodField()
    # ModelSerializer drops the model's `default=True` for BooleanFields —
    # declare it explicitly so new uploads are published by default.
    is_published = serializers.BooleanField(default=True)

    class Meta:
        model = GalleryImage
        fields = (
            "id",
            "title",
            "slug",
            "tag",
            "description",
            "image",
            "image_url",
            "alt_text",
            "is_published",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")

    def get_image_url(self, obj: GalleryImage) -> Optional[str]:
        request = self.context.get("request")
        if not obj.image:
            return None
        url = obj.image.url
        if request is not None:
            return request.build_absolute_uri(url)
        return url


class AdminGalleryImageSerializer(GalleryImageSerializer):
    """Write-capable serializer for staff use (accepts an uploaded file)."""

    image = serializers.ImageField(required=False, allow_null=True)

    class Meta(GalleryImageSerializer.Meta):
        pass

    def validate(self, attrs):
        attrs = super().validate(attrs)
        instance = getattr(self, "instance", None)
        image = attrs.get("image")
        # Keep the existing file when an update doesn't supply a new one.
        if image is None and instance is not None and instance.image:
            attrs["image"] = instance.image
        return attrs