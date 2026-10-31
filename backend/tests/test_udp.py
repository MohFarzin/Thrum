from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from apps.monitors.checkers import check_udp
from apps.monitors.models import Monitor

User = get_user_model()


@override_settings(
    CACHES={"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}},
)
class UdpMonitorTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user("udp", password="testpass123")
        self.client = APIClient()
        self.client.login(username="udp", password="testpass123")

    def test_create_udp_monitor(self):
        res = self.client.post(
            "/api/monitors/",
            {
                "name": "DNS-ish",
                "type": "udp",
                "target": "1.1.1.1:53",
                "interval_seconds": 60,
                "timeout_seconds": 2,
                "udp_payload": "",
                "is_enabled": True,
            },
            format="json",
        )
        self.assertEqual(res.status_code, 201, res.content)
        self.assertEqual(res.json()["type"], "udp")

    def test_udp_interval_floor(self):
        res = self.client.post(
            "/api/monitors/",
            {
                "name": "Too fast",
                "type": "udp",
                "target": "example.com:9999",
                "interval_seconds": 15,
                "timeout_seconds": 2,
                "is_enabled": True,
            },
            format="json",
        )
        self.assertEqual(res.status_code, 400)

    def test_udp_timeout_localhost_blocked(self):
        # SSRF blocks loopback — invalid target surfaces as probe failure message path.
        probe = check_udp("127.0.0.1:9", 1, "x")
        self.assertFalse(probe.success)
