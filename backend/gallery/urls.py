from django.urls import include, path
from rest_framework.routers import DefaultRouter
from rest_framework.schemas import get_schema_view

from . import views

router = DefaultRouter()
router.register(r"gallery", views.AdminGalleryViewSet, basename="admin-gallery")

urlpatterns = [
    # Public read-only API (published images only)
    path("gallery/", views.GalleryListView.as_view(), name="gallery-list"),
    path("gallery/<uuid:pk>/", views.GalleryDetailView.as_view(), name="gallery-detail"),
    # Accounts + credits (token auth)
    path("auth/register/", views.RegisterView.as_view(), name="auth-register"),
    path("auth/login/", views.LoginView.as_view(), name="auth-login"),
    path("auth/logout/", views.LogoutView.as_view(), name="auth-logout"),
    path("me/", views.MeView.as_view(), name="me"),
    path("subscribe/", views.SubscribeView.as_view(), name="subscribe"),
    path("checkout/", views.CheckoutView.as_view(), name="checkout"),
    # Staff CRUD API (requires admin login)
    path("admin/", include(router.urls)),
    # OpenAPI schema (JSON)
    path(
        "schema/",
        get_schema_view(title="Near Insanity API", version="v1"),
        name="openapi-schema",
    ),
]