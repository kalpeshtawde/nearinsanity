from io import BytesIO

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from django.urls import reverse
from PIL import Image
from rest_framework.test import APIClient

from .models import GalleryImage


def make_image_file(name="cartoon.png") -> SimpleUploadedFile:
    """A tiny valid PNG for uploads."""
    buf = BytesIO()
    Image.new("RGB", (8, 8), color="orange").save(buf, format="PNG")
    return SimpleUploadedFile(name, buf.getvalue(), content_type="image/png")


class GalleryApiTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_superuser(
            username="admin", email="admin@example.com", password="pass"
        )
        self.staff_client = APIClient()
        self.staff_client.force_authenticate(self.user)
        self.anon_client = APIClient()

    def create_image(self, title="Published cartoon", published=True):
        return GalleryImage.objects.create(
            title=title, image=make_image_file(), is_published=published
        )

    def test_public_list_only_returns_published(self):
        self.create_image(title="visible", published=True)
        self.create_image(title="hidden", published=False)

        resp = self.anon_client.get(reverse("gallery-list"))

        self.assertEqual(resp.status_code, 200)
        titles = [item["title"] for item in resp.data["results"]]
        self.assertEqual(titles, ["visible"])

    def test_public_detail_by_uuid(self):
        img = self.create_image()

        resp = self.anon_client.get(
            reverse("gallery-detail", kwargs={"pk": img.pk})
        )

        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["id"], str(img.pk))
        self.assertTrue(resp.data["image_url"].endswith(img.image.url))

    def test_public_detail_hides_unpublished(self):
        img = self.create_image(published=False)

        resp = self.anon_client.get(
            reverse("gallery-detail", kwargs={"pk": img.pk})
        )

        self.assertEqual(resp.status_code, 404)

    def test_anonymous_cannot_create(self):
        resp = self.anon_client.post(
            reverse("admin-gallery-list"), {"title": "nope"}, format="multipart"
        )

        self.assertEqual(resp.status_code, 403)

    def test_staff_can_upload_and_defaults_to_published(self):
        resp = self.staff_client.post(
            reverse("admin-gallery-list"),
            {"title": "New upload", "tag": "Test", "image": make_image_file()},
            format="multipart",
        )

        self.assertEqual(resp.status_code, 201)
        self.assertTrue(resp.data["is_published"])
        self.assertTrue(GalleryImage.objects.filter(title="New upload").exists())

    def test_staff_can_update_and_delete(self):
        img = self.create_image()
        detail_url = reverse("admin-gallery-detail", kwargs={"pk": img.pk})

        patch = self.staff_client.patch(detail_url, {"title": "Renamed"}, format="json")
        self.assertEqual(patch.status_code, 200)
        self.assertEqual(patch.data["title"], "Renamed")

        delete = self.staff_client.delete(detail_url)
        self.assertEqual(delete.status_code, 204)
        self.assertFalse(GalleryImage.objects.filter(pk=img.pk).exists())