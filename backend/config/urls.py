from pathlib import Path

from django.conf import settings
from django.contrib import admin
from django.http import FileResponse, Http404
from django.urls import include, path

urlpatterns = [
    # Django admin — login at /admin/ to upload gallery images.
    path("admin/", admin.site.urls),
    # REST API under /api/v1/ (see gallery/urls.py).
    path("api/v1/", include("gallery.urls")),
    path("api-auth/", include("rest_framework.urls")),
]


def media_serve(request, path):
    """Serve uploaded media through gunicorn (production + dev).

    The backend container owns the media volume, so nginx never needs to
    read host paths for /media/.
    """
    media_root = Path(settings.MEDIA_ROOT).resolve()
    file_path = (media_root / path).resolve()
    if not file_path.is_relative_to(media_root) or not file_path.is_file():
        raise Http404
    return FileResponse(file_path.open("rb"))


urlpatterns += [
    path("media/<path:path>", media_serve, name="media-serve"),
]