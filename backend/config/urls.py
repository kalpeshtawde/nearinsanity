from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    # Django admin — login at /admin/ to upload gallery images.
    path("admin/", admin.site.urls),
    # REST API under /api/v1/ (see gallery/urls.py).
    path("api/v1/", include("gallery.urls")),
    path("api-auth/", include("rest_framework.urls")),
]

# Serve uploaded media locally in development (production handles this
# via the web server / object storage).
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)