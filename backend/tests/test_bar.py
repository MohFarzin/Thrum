from datetime import timedelta

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone

from apps.monitors.bar import cover_seconds, suggested_buckets, time_buckets
from apps.monitors.models import CheckResult, Monitor

User = get_user_model()


class BarBucketTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user("bar", password="testpass123")
        self.tcp = Monitor.objects.create(
            owner=self.user,
            name="MC",
            type=Monitor.Type.TCP,
            target="example.com:25565",
            interval_seconds=60,
            status=Monitor.Status.UP,
        )

    def test_suggested_buckets_follow_interval(self):
        self.assertEqual(suggested_buckets("10m", 60), 10)
        self.assertEqual(suggested_buckets("1h", 60), 60)
        self.assertEqual(suggested_buckets("30d", 60), 60)

    def test_30d_has_sixty_slots(self):
        segs = time_buckets(self.tcp, "30d")
        self.assertEqual(len(segs), 60)

    def test_carry_fill_covers_interval_gaps(self):
        now = timezone.now()
        when = now - timedelta(minutes=5)
        row = CheckResult.objects.create(monitor=self.tcp, success=True, latency_ms=10)
        CheckResult.objects.filter(pk=row.pk).update(checked_at=when)
        # 60 fine slots (10s each): a 60s cover should paint several neighbors.
        segs = time_buckets(self.tcp, "10m", buckets=60)
        filled = [s for s in segs if s["tone"] == "up"]
        self.assertGreaterEqual(len(filled), 5)
        self.assertTrue(any(s.get("error_message") == "held from last check" for s in segs))

    def test_cover_seconds_heartbeat_includes_grace(self):
        hb = Monitor.objects.create(
            owner=self.user,
            name="HB",
            type=Monitor.Type.HEARTBEAT,
            interval_seconds=30,
            heartbeat_grace_seconds=60,
        )
        self.assertEqual(cover_seconds(hb), 90)
