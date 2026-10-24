from unittest.mock import MagicMock, patch

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from django.db import transaction

from apps.alerts.models import AlertChannel, AlertEvent
from apps.alerts.tasks import send_alert
from apps.monitors.checkers import ProbeResult
from apps.monitors.models import Monitor
from apps.monitors.services import apply_probe

User = get_user_model()


@override_settings(
    CELERY_TASK_ALWAYS_EAGER=True,
    CELERY_TASK_EAGER_PROPAGATES=True,
    THRUM_FAILURES_BEFORE_DOWN=1,
    THRUM_PUBLIC_BASE_URL="http://testserver",
)
class AlertTransitionTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user("alerter", password="testpass123")
        self.monitor = Monitor.objects.create(
            owner=self.user,
            name="Web",
            type=Monitor.Type.HTTP,
            target="https://example.com",
            status=Monitor.Status.UP,
            consecutive_failures=0,
        )
        self.channel = AlertChannel.objects.create(
            owner=self.user,
            name="Discord",
            type=AlertChannel.Type.DISCORD,
            config={"webhook_url": "https://discord.com/api/webhooks/x/y"},
        )

    @patch("apps.alerts.senders.DiscordSender.send")
    def test_down_sends_once(self, mock_send: MagicMock):
        with self.captureOnCommitCallbacks(execute=True):
            apply_probe(self.monitor, ProbeResult(False, 10, error_message="fail"))
        self.monitor.refresh_from_db()
        self.assertEqual(self.monitor.status, Monitor.Status.DOWN)
        self.assertEqual(mock_send.call_count, 1)
        self.assertEqual(AlertEvent.objects.filter(kind="down", success=True).count(), 1)

    @patch("apps.alerts.senders.DiscordSender.send")
    def test_recovery_sends_once(self, mock_send: MagicMock):
        self.monitor.status = Monitor.Status.DOWN
        self.monitor.consecutive_failures = 2
        self.monitor.save()
        with self.captureOnCommitCallbacks(execute=True):
            apply_probe(self.monitor, ProbeResult(True, 12, 200))
        self.monitor.refresh_from_db()
        self.assertEqual(self.monitor.status, Monitor.Status.UP)
        self.assertEqual(mock_send.call_count, 1)
        self.assertEqual(AlertEvent.objects.filter(kind="up", success=True).count(), 1)

    @patch("apps.alerts.senders.DiscordSender.send")
    def test_unknown_to_up_does_not_alert(self, mock_send: MagicMock):
        self.monitor.status = Monitor.Status.UNKNOWN
        self.monitor.save()
        with self.captureOnCommitCallbacks(execute=True):
            apply_probe(self.monitor, ProbeResult(True, 5, 200))
        self.assertEqual(mock_send.call_count, 0)

    @patch("apps.alerts.senders.DiscordSender.send", side_effect=ValueError("boom"))
    def test_send_failure_recorded(self, _mock):
        send_alert(str(self.monitor.id), str(self.channel.id), "down")
        ev = AlertEvent.objects.get()
        self.assertFalse(ev.success)
        self.assertIn("boom", ev.error)
