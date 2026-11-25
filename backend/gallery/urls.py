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
    # Staff CRUD API (requires admin login)
    path("admin/", include(router.urls)),
    # OpenAPI schema (JSON)
    path(
        "schema/",
        get_schema_view(title="Near Insanity API", version="v1"),
        name="openapi-schema",
    ),
]