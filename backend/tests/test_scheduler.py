from datetime import timedelta

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from django.utils import timezone

from apps.monitors.models import Monitor
from apps.monitors.scheduler import due_http_tcp_ids, seconds_until_next_due

User = get_user_model()


@override_settings(
    CACHES={"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}},
)
class SchedulerTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user("sched", password="testpass123")
        self.http = Monitor.objects.create(
            owner=self.user,
            name="Site",
            type=Monitor.Type.HTTP,
            target="https://example.com",
            interval_seconds=10,
            last_checked_at=timezone.now() - timedelta(seconds=11),
        )

    def test_due_when_interval_elapsed(self):
        ids = due_http_tcp_ids()
        self.assertIn(str(self.http.id), ids)
        self.assertEqual(seconds_until_next_due(), 0.0)

    def test_not_due_when_fresh(self):
        self.http.last_checked_at = timezone.now()
        self.http.save(update_fields=["last_checked_at"])
        self.assertEqual(due_http_tcp_ids(), [])
        wait = seconds_until_next_due(max_sleep=30)
        self.assertGreater(wait, 5)
        self.assertLessEqual(wait, 10)
