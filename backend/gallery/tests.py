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

        # Token auth makes unauthenticated requests 401; session/basic use 403.
        self.assertIn(resp.status_code, (401, 403))

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

class AccountCreditApiTests(TestCase):
    """Register/login, subscribe for credits, and credit-based checkout."""

    def setUp(self):
        self.client = APIClient()
        self.images = [
            GalleryImage.objects.create(title=f"Cartoon {i}", image=make_image_file())
            for i in range(3)
        ]

    def register(self, email="user@example.com", password="password123"):
        return self.client.post(
            reverse("auth-register"),
            {"email": email, "password": password},
            format="json",
        )

    def auth(self, token):
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {token}")

    def test_register_returns_token_and_zero_credits(self):
        resp = self.register()
        self.assertEqual(resp.status_code, 201)
        self.assertTrue(resp.data["token"])
        self.assertEqual(resp.data["user"]["credits"], 0)

    def test_duplicate_email_rejected(self):
        self.register()
        resp = self.register()
        self.assertEqual(resp.status_code, 400)

    def test_login_returns_token_and_credits(self):
        self.register()
        resp = self.client.post(
            reverse("auth-login"),
            {"email": "user@example.com", "password": "password123"},
            format="json",
        )
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["user"]["credits"], 0)

    def test_login_wrong_password_rejected(self):
        self.register()
        resp = self.client.post(
            reverse("auth-login"),
            {"email": "user@example.com", "password": "wrong-password"},
            format="json",
        )
        self.assertEqual(resp.status_code, 400)

    def test_me_requires_auth(self):
        resp = self.client.get(reverse("me"))
        self.assertIn(resp.status_code, (401, 403))

    def test_subscribe_grants_plan_credits(self):
        token = self.register().data["token"]
        self.auth(token)
        resp = self.client.post(reverse("subscribe"), {"plan_size": 10}, format="json")
        self.assertEqual(resp.status_code, 201)
        # Credits are dollars: the $110 plan grants 110 credits.
        self.assertEqual(resp.data["credits"], 110)
        me = self.client.get(reverse("me"))
        self.assertEqual(me.data["credits"], 110)

    def test_subscribe_unknown_plan_rejected(self):
        token = self.register().data["token"]
        self.auth(token)
        resp = self.client.post(reverse("subscribe"), {"plan_size": 15}, format="json")
        self.assertEqual(resp.status_code, 400)

    def test_checkout_deducts_engraved_cost(self):
        token = self.register().data["token"]
        self.auth(token)
        self.client.post(reverse("subscribe"), {"plan_size": 10}, format="json")

        resp = self.client.post(
            reverse("checkout"),
            {
                "image_ids": [str(img.id) for img in self.images],
                "engraving": True,
                "url": "acme.com",
            },
            format="json",
        )
        self.assertEqual(resp.status_code, 201)
        self.assertEqual(resp.data["order"]["engraved_url"], "acme.com")
        # 3 images at the 10-pack tier: 3 x ($1 + $10) = $33 = 33 credits.
        self.assertEqual(resp.data["credits"], 110 - 33)
        self.assertEqual(resp.data["order"]["credits_used"], 33)
        self.assertEqual(resp.data["order"]["image_count"], 3)
        self.assertEqual(len(resp.data["order"]["items"]), 3)
        self.assertTrue(resp.data["order"]["engraving"])

    def test_checkout_two_engraved_images_costs_22_credits(self):
        token = self.register().data["token"]
        self.auth(token)
        self.client.post(reverse("subscribe"), {"plan_size": 10}, format="json")

        resp = self.client.post(
            reverse("checkout"),
            {
                "image_ids": [str(img.id) for img in self.images[:2]],
                "engraving": True,
                "url": "acme.com",
            },
            format="json",
        )
        self.assertEqual(resp.status_code, 201)
        self.assertEqual(resp.data["order"]["credits_used"], 22)
        self.assertEqual(resp.data["credits"], 88)

    def test_checkout_uses_subscribed_tier_rate(self):
        token = self.register().data["token"]
        self.auth(token)
        # 20-pack: $420 -> 420 credits; URL rate is $20/cartoon.
        sub = self.client.post(reverse("subscribe"), {"plan_size": 20}, format="json")
        self.assertEqual(sub.data["credits"], 420)

        resp = self.client.post(
            reverse("checkout"),
            {
                "image_ids": [str(img.id) for img in self.images[:2]],
                "engraving": True,
                "url": "acme.com",
            },
            format="json",
        )
        self.assertEqual(resp.status_code, 201)
        # 2 x ($1 + $20) = $42 = 42 credits.
        self.assertEqual(resp.data["order"]["credits_used"], 42)
        self.assertEqual(resp.data["credits"], 378)

    def test_checkout_requires_url_when_engraving(self):
        token = self.register().data["token"]
        self.auth(token)
        self.client.post(reverse("subscribe"), {"plan_size": 10}, format="json")

        resp = self.client.post(
            reverse("checkout"),
            {
                "image_ids": [str(img.id) for img in self.images[:2]],
                "engraving": True,
            },
            format="json",
        )
        self.assertEqual(resp.status_code, 400)
        self.assertIn("url", resp.data)

    def test_checkout_plain_images_cost_one_credit_each(self):
        token = self.register().data["token"]
        self.auth(token)
        self.client.post(reverse("subscribe"), {"plan_size": 10}, format="json")

        resp = self.client.post(
            reverse("checkout"),
            {"image_ids": [str(img.id) for img in self.images]},
            format="json",
        )
        self.assertEqual(resp.status_code, 201)
        self.assertEqual(resp.data["order"]["credits_used"], 3)
        self.assertEqual(resp.data["credits"], 107)

    def test_checkout_insufficient_credits(self):
        token = self.register().data["token"]
        self.auth(token)

        resp = self.client.post(
            reverse("checkout"),
            {"image_ids": [str(img.id) for img in self.images]},
            format="json",
        )
        self.assertEqual(resp.status_code, 400)
        self.assertEqual(resp.data["required"], 3)
        self.assertEqual(resp.data["credits"], 0)

    def test_checkout_requires_auth(self):
        resp = self.client.post(
            reverse("checkout"),
            {"image_ids": [str(img.id) for img in self.images]},
            format="json",
        )
        self.assertIn(resp.status_code, (401, 403))

    def test_checkout_rejects_unknown_image(self):
        token = self.register().data["token"]
        self.auth(token)
        self.client.post(reverse("subscribe"), {"plan_size": 10}, format="json")

        resp = self.client.post(
            reverse("checkout"),
            {"image_ids": ["00000000-0000-0000-0000-000000000000"]},
            format="json",
        )
        self.assertEqual(resp.status_code, 400)
