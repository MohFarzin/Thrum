from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from apps.monitors.models import Monitor

User = get_user_model()


class MonitorOwnershipTests(TestCase):
    def setUp(self):
        self.a = User.objects.create_user("alice", password="testpass123")
        self.b = User.objects.create_user("bob", password="testpass123")
        self.monitor = Monitor.objects.create(
            owner=self.a,
            name="Alice HTTP",
            type=Monitor.Type.HTTP,
            target="https://example.com",
        )
        self.client = APIClient()

    def test_owner_can_list_own_monitor(self):
        self.client.login(username="alice", password="testpass123")
        res = self.client.get("/api/monitors/")
        self.assertEqual(res.status_code, 200)
        ids = [row["id"] for row in res.json()]
        self.assertIn(str(self.monitor.id), ids)

    def test_other_user_cannot_retrieve(self):
        self.client.login(username="bob", password="testpass123")
        res = self.client.get(f"/api/monitors/{self.monitor.id}/")
        self.assertEqual(res.status_code, 404)

    def test_other_user_cannot_update(self):
        self.client.login(username="bob", password="testpass123")
        res = self.client.patch(
            f"/api/monitors/{self.monitor.id}/",
            {"name": "Hijacked"},
            format="json",
        )
        self.assertEqual(res.status_code, 404)
        self.monitor.refresh_from_db()
        self.assertEqual(self.monitor.name, "Alice HTTP")
