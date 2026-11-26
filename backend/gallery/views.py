from django.shortcuts import get_object_or_404
from rest_framework import generics, viewsets
from rest_framework.permissions import IsAdminUser

from .models import GalleryImage
from .serializers import AdminGalleryImageSerializer, GalleryImageSerializer


class GalleryListView(generics.ListAPIView):
    """Public, read-only list of published gallery images."""

    serializer_class = GalleryImageSerializer
    queryset = GalleryImage.objects.filter(is_published=True)


class GalleryDetailView(generics.RetrieveAPIView):
    """Public, read-only detail for one published gallery image (by UUID)."""

    serializer_class = GalleryImageSerializer
    queryset = GalleryImage.objects.filter(is_published=True)
    lookup_field = "pk"
    lookup_url_kwarg = "pk"

    def get_object(self):
        queryset = self.get_queryset()
        return get_object_or_404(queryset, pk=self.kwargs["pk"])


class AdminGalleryViewSet(viewsets.ModelViewSet):
    """Full CRUD for staff — upload, edit, publish, or delete gallery images.

    Requires a logged-in staff/admin user (session auth from the Django
    admin). Route paths use the image's UUID.
    """

    permission_classes = [IsAdminUser]
    serializer_class = AdminGalleryImageSerializer
    queryset = GalleryImage.objects.all()
    lookup_field = "pk"
    lookup_url_kwarg = "pk"

# ---------------------------------------------------------------------------
# Accounts, credits, subscriptions, orders
# ---------------------------------------------------------------------------

from django.db import transaction  # noqa: E402
from rest_framework.authtoken.models import Token  # noqa: E402
from rest_framework.permissions import AllowAny, IsAuthenticated  # noqa: E402
from rest_framework.response import Response  # noqa: E402
from rest_framework.views import APIView  # noqa: E402

from .models import (  # noqa: E402
    CreditAccount,
    CreditTransaction,
    Order,
    OrderItem,
    Subscription,
)
from .plans import PLANS, checkout_cost  # noqa: E402
from .serializers import (  # noqa: E402
    CheckoutSerializer,
    LoginSerializer,
    OrderSerializer,
    RegisterSerializer,
    SubscribeSerializer,
    SubscriptionSerializer,
)


def _user_payload(user) -> dict:
    account, _ = CreditAccount.objects.get_or_create(user=user)
    return {
        "email": user.email or user.username,
        "credits": account.balance,
        "tier": account.tier,
    }


class RegisterView(APIView):
    """Create an email/password account and return an auth token."""

    permission_classes = [AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        token = Token.objects.create(user=user)
        return Response(
            {"token": token.key, "user": _user_payload(user)}, status=201
        )


class LoginView(APIView):
    """Email + password login returning an auth token."""

    permission_classes = [AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data["user"]
        token, _ = Token.objects.get_or_create(user=user)
        return Response({"token": token.key, "user": _user_payload(user)})


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        Token.objects.filter(user=request.user).delete()
        return Response(status=204)


class MeView(APIView):
    """Current account: email + credit balance."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(_user_payload(request.user))


class SubscribeView(APIView):
    """Purchase a funnel plan: grants credits equal to the plan size.

    Payment is simulated for now (no card processing).
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = SubscribeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        plan = PLANS[serializer.validated_data["plan_size"]]

        with transaction.atomic():
            account, _ = CreditAccount.objects.select_for_update().get_or_create(
                user=request.user
            )
            subscription = Subscription.objects.create(
                user=request.user,
                plan_size=plan["size"],
                amount=plan["total_with_engraving"],
                credits_granted=plan["credits"],
            )
            account.balance += plan["credits"]
            account.tier = plan["size"]
            account.save(update_fields=["balance", "tier", "updated_at"])
            CreditTransaction.objects.create(
                account=account,
                delta=plan["credits"],
                balance_after=account.balance,
                reason=CreditTransaction.Reason.SUBSCRIPTION,
            )

        return Response(
            {
                "subscription": SubscriptionSerializer(subscription).data,
                "credits": account.balance,
            },
            status=201,
        )


class CheckoutView(APIView):
    """Spend credits on the selected cartoons (one credit per image)."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = CheckoutSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        image_ids = serializer.validated_data["image_ids"]
        engraving = serializer.validated_data["engraving"]
        engraved_url = serializer.validated_data["url"]

        images = list(
            GalleryImage.objects.filter(id__in=image_ids, is_published=True)
        )
        if len(images) != len(image_ids):
            return Response(
                {"detail": "One or more selected images were not found."},
                status=400,
            )

        count = len(images)
        with transaction.atomic():
            account, _ = CreditAccount.objects.select_for_update().get_or_create(
                user=request.user
            )
            cost, _plan_size = checkout_cost(count, engraving, account.tier)
            if account.balance < cost:
                return Response(
                    {
                        "detail": f"Not enough credits: need {cost}, have {account.balance}.",
                        "credits": account.balance,
                        "required": cost,
                    },
                    status=400,
                )

            order = Order.objects.create(
                user=request.user,
                image_count=count,
                engraving=engraving,
                engraved_url=engraved_url,
                credits_used=cost,
                amount=cost,
            )
            OrderItem.objects.bulk_create(
                [OrderItem(order=order, image=image) for image in images]
            )

            account.balance -= cost
            account.save(update_fields=["balance", "updated_at"])
            CreditTransaction.objects.create(
                account=account,
                delta=-cost,
                balance_after=account.balance,
                reason=CreditTransaction.Reason.CHECKOUT,
            )

        return Response(
            {"order": OrderSerializer(order).data, "credits": account.balance},
            status=201,
        )


# ---------------------------------------------------------------------------
# Stripe payments
# ---------------------------------------------------------------------------

import stripe  # noqa: E402
from decimal import Decimal  # noqa: E402

from django.conf import settings  # noqa: E402
from django.contrib.auth import get_user_model  # noqa: E402

User = get_user_model()


class ConfigView(APIView):
    """Public runtime config the storefront needs (e.g. Stripe availability)."""

    permission_classes = [AllowAny]

    def get(self, request):
        return Response({"stripe_enabled": bool(settings.STRIPE_SECRET_KEY)})


class StripeCheckoutSessionView(APIView):
    """Create a Stripe Checkout Session for a plan purchase."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        if not settings.STRIPE_SECRET_KEY:
            return Response({"detail": "Stripe is not configured."}, status=400)

        serializer = SubscribeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        plan_size = serializer.validated_data["plan_size"]
        price_id = settings.STRIPE_PRICE_IDS.get(plan_size)
        if not price_id:
            return Response(
                {"detail": f"No Stripe price configured for the {plan_size}-pack."},
                status=400,
            )

        stripe.api_key = settings.STRIPE_SECRET_KEY
        try:
            session = stripe.checkout.Session.create(
                mode="payment",
                line_items=[{"price": price_id, "quantity": 1}],
                customer_email=request.user.email or None,
                client_reference_id=str(request.user.id),
                metadata={
                    "plan_size": str(plan_size),
                    "user_id": str(request.user.id),
                },
                success_url=f"{settings.FRONTEND_URL}/checkout?status=success",
                cancel_url=f"{settings.FRONTEND_URL}/pricing?status=cancelled",
            )
        except stripe.error.StripeError as exc:
            return Response({"detail": str(exc)}, status=502)

        return Response({"url": session.url, "id": session.id}, status=201)


class StripeWebhookView(APIView):
    """Grant credits when Stripe confirms a completed checkout.

    Idempotent: the Stripe session id is stored on the Subscription, so
    repeated webhook deliveries never double-grant credits.
    """

    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request):
        if not settings.STRIPE_WEBHOOK_SECRET:
            return Response(
                {"detail": "Stripe webhook secret is not configured."}, status=400
            )

        signature = request.headers.get("Stripe-Signature", "")
        try:
            event = stripe.Webhook.construct_event(
                request.body, signature, settings.STRIPE_WEBHOOK_SECRET
            )
        except (ValueError, stripe.error.SignatureVerificationError):
            return Response({"detail": "Invalid Stripe signature."}, status=400)

        if event["type"] == "checkout.session.completed":
            self._grant_credits(event["data"]["object"])

        return Response({"received": True})

    def _grant_credits(self, session) -> None:
        metadata = session.get("metadata") or {}
        try:
            plan_size = int(metadata.get("plan_size", 0))
        except (TypeError, ValueError):
            return
        user_id = metadata.get("user_id")
        session_id = session.get("id") or ""
        if plan_size not in PLANS or not user_id:
            return

        plan = PLANS[plan_size]
        with transaction.atomic():
            if session_id and Subscription.objects.filter(
                stripe_session_id=session_id
            ).exists():
                return  # already granted

            try:
                user = User.objects.get(pk=user_id)
            except (User.DoesNotExist, ValueError):
                return

            account, _ = CreditAccount.objects.select_for_update().get_or_create(
                user=user
            )
            amount = Decimal(session.get("amount_total") or 0) / Decimal("100")

            Subscription.objects.create(
                user=user,
                plan_size=plan_size,
                amount=amount,
                credits_granted=plan["credits"],
                provider="stripe",
                stripe_session_id=session_id,
            )
            account.balance += plan["credits"]
            account.tier = plan_size
            account.save(update_fields=["balance", "tier", "updated_at"])
            CreditTransaction.objects.create(
                account=account,
                delta=plan["credits"],
                balance_after=account.balance,
                reason=CreditTransaction.Reason.SUBSCRIPTION,
            )
