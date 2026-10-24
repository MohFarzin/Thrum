from datetime import timedelta

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from apps.monitors.keys import assign_new_key, verify_api_key
from apps.monitors.models import CheckResult, Monitor
from apps.monitors.services import record_heartbeat
from apps.monitors.tasks import heartbeat_watchdog

User = get_user_model()


@override_settings(
    CACHES={"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}},
    THRUM_FAILURES_BEFORE_DOWN=2,
)
class HeartbeatIngestTests(TestCase):
    def setUp(self):
        cache.clear()
        self.user = User.objects.create_user("hbuser", password="testpass123")
        self.monitor = Monitor.objects.create(
            owner=self.user,
            name="Pulse",
            type=Monitor.Type.HEARTBEAT,
            interval_seconds=60,
            heartbeat_grace_seconds=30,
        )
        self.raw_key = assign_new_key(self.monitor)
        self.monitor.save()
        self.client = APIClient()

    def test_valid_key_ok(self):
        url = f"/api/v1/heartbeat/{self.monitor.id}/"
        res = self.client.post(
            url,
            {"status": "ok"},
            format="json",
            HTTP_AUTHORIZATION=f"Bearer {self.raw_key}",
        )
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json(), {"ok": True})
        self.monitor.refresh_from_db()
        self.assertEqual(self.monitor.status, Monitor.Status.UP)
        self.assertIsNotNone(self.monitor.last_heartbeat_at)

    def test_empty_body_ok(self):
        """PowerShell-safe agents POST with no body (JSON quoting is shell hell)."""
        url = f"/api/v1/heartbeat/{self.monitor.id}/"
        res = self.client.post(url, data=b"", content_type="application/octet-stream", HTTP_AUTHORIZATION=f"Bearer {self.raw_key}")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json(), {"ok": True})

    def test_x_thrum_key_header(self):
        url = f"/api/v1/heartbeat/{self.monitor.id}/"
        res = self.client.post(url, {}, format="json", HTTP_X_THRUM_KEY=self.raw_key)
        self.assertEqual(res.status_code, 200)

    def test_invalid_key_401(self):
        url = f"/api/v1/heartbeat/{self.monitor.id}/"
        res = self.client.post(
            url,
            {},
            format="json",
            HTTP_AUTHORIZATION="Bearer wrong-key",
        )
        self.assertEqual(res.status_code, 401)

    def test_rotate_key_invalidates_old(self):
        self.client.login(username="hbuser", password="testpass123")
        res = self.client.post(f"/api/monitors/{self.monitor.id}/rotate-key/")
        self.assertEqual(res.status_code, 200)
        new_key = res.json()["api_key"]
        self.assertTrue(new_key.startswith("thrum_"))
        self.assertFalse(verify_api_key(self.raw_key, Monitor.objects.get(pk=self.monitor.id).api_key_hash))
        self.assertTrue(verify_api_key(new_key, Monitor.objects.get(pk=self.monitor.id).api_key_hash))

    def test_watchdog_marks_down_after_misses(self):
        record_heartbeat(self.monitor)
        self.monitor.refresh_from_db()
        self.monitor.last_heartbeat_at = timezone.now() - timedelta(seconds=200)
        self.monitor.last_checked_at = timezone.now() - timedelta(seconds=200)
        self.monitor.consecutive_failures = 0
        self.monitor.status = Monitor.Status.UP
        self.monitor.save()

        heartbeat_watchdog()
        self.monitor.refresh_from_db()
        self.assertEqual(self.monitor.consecutive_failures, 1)

        self.monitor.last_checked_at = timezone.now() - timedelta(seconds=120)
        self.monitor.save(update_fields=["last_checked_at"])
        heartbeat_watchdog()
        self.monitor.refresh_from_db()
        self.assertEqual(self.monitor.status, Monitor.Status.DOWN)

    def test_heartbeat_history_sampled_per_interval(self):
        self.monitor.interval_seconds = 60
        self.monitor.save(update_fields=["interval_seconds"])
        record_heartbeat(self.monitor)
        record_heartbeat(self.monitor)
        self.assertEqual(CheckResult.objects.filter(monitor=self.monitor).count(), 1)
        # Age the history row so the next beat is due for a sample.
        CheckResult.objects.filter(monitor=self.monitor).update(
            checked_at=timezone.now() - timedelta(seconds=61)
        )
        record_heartbeat(self.monitor)
        self.assertEqual(CheckResult.objects.filter(monitor=self.monitor).count(), 2)
