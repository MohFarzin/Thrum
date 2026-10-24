from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings

from apps.monitors.checkers import ProbeResult
from apps.monitors.models import CheckResult, Monitor
from apps.monitors.services import apply_probe, run_monitor_check
from apps.monitors.ssrf import assert_safe_http_url, parse_tcp_target

User = get_user_model()


class SsrfTests(TestCase):
    def test_rejects_metadata_ip(self):
        with self.assertRaises(ValueError):
            assert_safe_http_url("http://169.254.169.254/latest/meta-data")

    def test_rejects_non_http_scheme(self):
        with self.assertRaises(ValueError):
            assert_safe_http_url("ftp://example.com/")

    def test_tcp_parse(self):
        host, port = parse_tcp_target("example.com:443")
        self.assertEqual(host, "example.com")
        self.assertEqual(port, 443)


@override_settings(THRUM_FAILURES_BEFORE_DOWN=2)
class CheckerStatusTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user("checker", password="testpass123")
        self.monitor = Monitor.objects.create(
            owner=self.user,
            name="Example",
            type=Monitor.Type.HTTP,
            target="https://example.com",
            interval_seconds=60,
            timeout_seconds=5,
            expected_status_code=200,
        )

    def test_success_sets_up(self):
        apply_probe(self.monitor, ProbeResult(True, 42, 200))
        self.monitor.refresh_from_db()
        self.assertEqual(self.monitor.status, Monitor.Status.UP)
        self.assertEqual(self.monitor.consecutive_failures, 0)
        self.assertEqual(CheckResult.objects.filter(monitor=self.monitor).count(), 1)

    def test_two_failures_set_down(self):
        apply_probe(self.monitor, ProbeResult(False, 10, error_message="fail"))
        self.monitor.refresh_from_db()
        self.assertEqual(self.monitor.status, Monitor.Status.UNKNOWN)
        self.assertEqual(self.monitor.consecutive_failures, 1)

        apply_probe(self.monitor, ProbeResult(False, 10, error_message="fail"))
        self.monitor.refresh_from_db()
        self.assertEqual(self.monitor.status, Monitor.Status.DOWN)
        self.assertEqual(self.monitor.consecutive_failures, 2)

    @patch("apps.monitors.services.probe_monitor")
    def test_run_monitor_check_uses_probe(self, mock_probe):
        mock_probe.return_value = ProbeResult(True, 15, 200)
        result = run_monitor_check(self.monitor.id)
        self.assertIsNotNone(result)
        self.assertTrue(result.success)
        self.monitor.refresh_from_db()
        self.assertEqual(self.monitor.status, Monitor.Status.UP)
