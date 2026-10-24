"""Apply probe results to Monitor + CheckResult rows."""

from __future__ import annotations

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from .checkers import ProbeResult, probe_monitor
from .models import CheckResult, Monitor


def failures_before_down() -> int:
    return max(1, int(getattr(settings, "THRUM_FAILURES_BEFORE_DOWN", 2)))


@transaction.atomic
def apply_probe(monitor: Monitor, probe: ProbeResult) -> CheckResult:
    monitor = Monitor.objects.select_for_update().get(pk=monitor.pk)
    result = CheckResult.objects.create(
        monitor=monitor,
        success=probe.success,
        latency_ms=probe.latency_ms,
        error_message=probe.error_message or "",
        status_code=probe.status_code,
    )
    monitor.last_checked_at = timezone.now()
    if probe.success:
        monitor.consecutive_failures = 0
        monitor.status = Monitor.Status.UP
    else:
        monitor.consecutive_failures = (monitor.consecutive_failures or 0) + 1
        if monitor.consecutive_failures >= failures_before_down():
            monitor.status = Monitor.Status.DOWN
    monitor.save(
        update_fields=[
            "last_checked_at",
            "consecutive_failures",
            "status",
            "updated_at",
        ]
    )
    return result


def run_monitor_check(monitor_id) -> CheckResult | None:
    try:
        monitor = Monitor.objects.get(pk=monitor_id)
    except Monitor.DoesNotExist:
        return None
    if not monitor.is_enabled:
        return None
    if monitor.type not in (Monitor.Type.HTTP, Monitor.Type.TCP):
        return None
    probe = probe_monitor(monitor)
    return apply_probe(monitor, probe)
