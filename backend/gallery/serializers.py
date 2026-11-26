from typing import Optional

from django.contrib.auth import authenticate, get_user_model
from rest_framework import serializers

from .models import (
    CreditAccount,
    GalleryImage,
    Order,
    OrderItem,
    Subscription,
)
from .plans import PLANS

User = get_user_model()


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


# ---------------------------------------------------------------------------
# Accounts, credits, subscriptions, orders
# ---------------------------------------------------------------------------


class UserSerializer(serializers.Serializer):
    email = serializers.EmailField()
    credits = serializers.IntegerField()


class RegisterSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(min_length=8, write_only=True)

    def validate_email(self, value: str) -> str:
        email = value.strip().lower()
        if User.objects.filter(username=email).exists():
            raise serializers.ValidationError("An account with this email already exists.")
        return email

    def create(self, validated_data):
        email = validated_data["email"]
        user = User.objects.create_user(
            username=email, email=email, password=validated_data["password"]
        )
        CreditAccount.objects.create(user=user, balance=0)
        return user


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        user = authenticate(
            username=attrs["email"].strip().lower(), password=attrs["password"]
        )
        if user is None:
            raise serializers.ValidationError("Invalid email or password.")
        attrs["user"] = user
        return attrs


class SubscribeSerializer(serializers.Serializer):
    plan_size = serializers.IntegerField()

    def validate_plan_size(self, value: int) -> int:
        if value not in PLANS:
            raise serializers.ValidationError(
                f"Unknown plan size. Choose one of: {', '.join(map(str, PLANS))}."
            )
        return value


class CheckoutSerializer(serializers.Serializer):
    image_ids = serializers.ListField(
        child=serializers.UUIDField(), min_length=1, max_length=50
    )
    engraving = serializers.BooleanField(default=False)

    def validate_image_ids(self, value):
        unique = list(dict.fromkeys(value))
        if len(unique) != len(value):
            raise serializers.ValidationError("Duplicate images in the selection.")
        return value


class OrderItemSerializer(serializers.ModelSerializer):
    image_id = serializers.UUIDField(source="image.id", read_only=True)
    title = serializers.CharField(source="image.title", read_only=True)

    class Meta:
        model = OrderItem
        fields = ("id", "image_id", "title")


class OrderSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True, read_only=True)

    class Meta:
        model = Order
        fields = (
            "id",
            "image_count",
            "engraving",
            "credits_used",
            "amount",
            "created_at",
            "items",
        )


class SubscriptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Subscription
        fields = ("id", "plan_size", "amount", "credits_granted", "created_at")