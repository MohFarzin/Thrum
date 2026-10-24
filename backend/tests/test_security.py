from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from apps.alerts.models import AlertChannel
from apps.alerts.serializers import AlertChannelSerializer
from apps.monitors.keys import assign_new_key
from apps.monitors.models import Monitor
from apps.monitors.ssrf import assert_safe_http_url, assert_safe_hostname

User = get_user_model()


class SsrfGuardsTests(TestCase):
    def test_blocks_loopback(self):
        with self.assertRaises(ValueError):
            assert_safe_hostname("127.0.0.1")
        with self.assertRaises(ValueError):
            assert_safe_hostname("localhost")
        with self.assertRaises(ValueError):
            assert_safe_http_url("http://127.0.0.1/admin")


class PublicShareLeakTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user("pub", password="testpass123")
        self.monitor = Monitor.objects.create(
            owner=self.user,
            name="Secret host",
            type=Monitor.Type.HTTP,
            target="https://internal.corp:8443/health",
            is_public=True,
            public_slug="testslug99",
        )
        self.client = APIClient()

    def test_public_status_omits_target(self):
        res = self.client.get("/api/public/status/testslug99/")
        self.assertEqual(res.status_code, 200)
        body = res.json()
        self.assertNotIn("target", body)
        self.assertEqual(body["name"], "Secret host")


@override_settings(
    CACHES={"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}},
)
class DiscordWebhookSanitizeTests(TestCase):
    def test_masks_webhook_and_rejects_non_discord(self):
        user = User.objects.create_user("al", password="testpass123")
        ch = AlertChannel.objects.create(
            owner=user,
            name="d",
            type=AlertChannel.Type.DISCORD,
            config={"webhook_url": "https://discord.com/api/webhooks/1/abc"},
        )
        data = AlertChannelSerializer(ch).data
        self.assertEqual(data["config"]["webhook_url"], "********")
        self.assertTrue(data["config"]["webhook_url_set"])

        ser = AlertChannelSerializer(
            data={
                "name": "bad",
                "type": "discord",
                "config": {"webhook_url": "https://evil.example/hook"},
                "is_enabled": True,
            }
        )
        self.assertFalse(ser.is_valid())
