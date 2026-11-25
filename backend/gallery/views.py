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