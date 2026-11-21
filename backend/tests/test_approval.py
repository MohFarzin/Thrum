from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from apps.accounts.models import Profile

User = get_user_model()


@override_settings(
    CACHES={"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}},
)
class ApprovalFlowTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_superuser("boss", password="testpass123")
        Profile.objects.update_or_create(user=self.admin, defaults={"is_approved": True})

    def test_register_is_unapproved(self):
        res = self.client.post(
            "/api/auth/register/",
            {"username": "newbie", "password": "testpass123", "email": ""},
            format="json",
        )
        self.assertEqual(res.status_code, 201, res.content)
        body = res.json()
        self.assertFalse(body["is_approved"])
        self.assertFalse(body["is_admin"])
        self.assertTrue(Profile.objects.get(user__username="newbie").is_approved is False)

    def test_unapproved_cannot_list_monitors(self):
        user = User.objects.create_user("pending", password="testpass123")
        Profile.objects.update_or_create(user=user, defaults={"is_approved": False})
        self.client.login(username="pending", password="testpass123")
        res = self.client.get("/api/monitors/")
        self.assertEqual(res.status_code, 403)

    def test_admin_approve(self):
        user = User.objects.create_user("pending2", password="testpass123")
        Profile.objects.update_or_create(user=user, defaults={"is_approved": False})
        self.client.login(username="boss", password="testpass123")
        res = self.client.post(f"/api/auth/admin/users/{user.id}/approve/")
        self.assertEqual(res.status_code, 200, res.content)
        self.assertTrue(res.json()["is_approved"])
        user.refresh_from_db()
        self.assertTrue(user.profile.is_approved)

    def test_member_cannot_hit_admin_api(self):
        user = User.objects.create_user("member", password="testpass123")
        Profile.objects.update_or_create(user=user, defaults={"is_approved": True})
        self.client.login(username="member", password="testpass123")
        res = self.client.get("/api/auth/admin/users/")
        self.assertEqual(res.status_code, 403)

    def test_admin_delete_user(self):
        user = User.objects.create_user("goner", password="testpass123")
        Profile.objects.update_or_create(user=user, defaults={"is_approved": True})
        uid = user.id
        self.client.login(username="boss", password="testpass123")
        res = self.client.post(f"/api/auth/admin/users/{uid}/delete/")
        self.assertEqual(res.status_code, 200, res.content)
        self.assertFalse(User.objects.filter(pk=uid).exists())

    def test_admin_cannot_delete_self(self):
        self.client.login(username="boss", password="testpass123")
        res = self.client.post(f"/api/auth/admin/users/{self.admin.id}/delete/")
        self.assertEqual(res.status_code, 400)
        self.assertTrue(User.objects.filter(pk=self.admin.id).exists())
