"""Apply probe / heartbeat results to Monitor + CheckResult rows."""

from __future__ import annotations

from django.conf import settings
from django.core.cache import cache
from django.db import transaction
from django.utils import timezone

from apps.alerts.dispatch import maybe_dispatch_transition

from .checkers import ProbeResult, probe_monitor
from .models import CheckResult, Monitor


def failures_before_down() -> int:
    return max(1, int(getattr(settings, "THRUM_FAILURES_BEFORE_DOWN", 2)))


def apply_probe(monitor: Monitor, probe: ProbeResult) -> CheckResult:
    now = timezone.now()
    # Steady UP + success: no row lock (common path on a quiet host).
    if probe.success and monitor.status == Monitor.Status.UP:
        Monitor.objects.filter(pk=monitor.pk).update(
            last_checked_at=now,
            consecutive_failures=0,
            status=Monitor.Status.UP,
            updated_at=now,
        )
        return CheckResult.objects.create(
            monitor_id=monitor.pk,
            success=True,
            latency_ms=probe.latency_ms,
            error_message="",
            status_code=probe.status_code,
        )

    with transaction.atomic():
        monitor = Monitor.objects.select_for_update().get(pk=monitor.pk)
        old_status = monitor.status
        result = CheckResult.objects.create(
            monitor=monitor,
            success=probe.success,
            latency_ms=probe.latency_ms,
            error_message=probe.error_message or "",
            status_code=probe.status_code,
        )
        monitor.last_checked_at = now
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
        maybe_dispatch_transition(monitor, old_status, monitor.status)
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


def record_heartbeat(monitor: Monitor, message: str = "") -> Monitor:
    """Touch liveness on every POST; write history at most once per interval.

    Agents often POST faster than interval. Already-UP beats use a single
    UPDATE (no row lock) to keep API CPU flat on small hosts.
    """
    now = timezone.now()
    old_status = monitor.status

    # Fast path: already up — no row lock; history at most once per interval (Redis gate).
    if old_status == Monitor.Status.UP and not message:
        Monitor.objects.filter(pk=monitor.pk).update(
            last_heartbeat_at=now,
            last_checked_at=now,
            consecutive_failures=0,
            status=Monitor.Status.UP,
            updated_at=now,
        )
        hist_key = f"thrum:hb-hist:{monitor.pk}"
        ttl = max(10, int(monitor.interval_seconds))
        if cache.add(hist_key, "1", timeout=ttl):
            CheckResult.objects.create(
                monitor_id=monitor.pk,
                success=True,
                latency_ms=None,
                error_message="",
                status_code=None,
            )
        monitor.last_heartbeat_at = now
        monitor.last_checked_at = now
        monitor.consecutive_failures = 0
        monitor.status = Monitor.Status.UP
        return monitor

    with transaction.atomic():
        monitor = Monitor.objects.select_for_update().get(pk=monitor.pk)
        old_status = monitor.status
        monitor.last_heartbeat_at = now
        monitor.last_checked_at = now
        monitor.consecutive_failures = 0
        monitor.status = Monitor.Status.UP
        monitor.save(
            update_fields=[
                "last_heartbeat_at",
                "last_checked_at",
                "consecutive_failures",
                "status",
                "updated_at",
            ]
        )
        CheckResult.objects.create(
            monitor=monitor,
            success=True,
            latency_ms=None,
            error_message=(message or "")[:500],
            status_code=None,
        )
        maybe_dispatch_transition(monitor, old_status, monitor.status)
    return monitor


@transaction.atomic
def mark_heartbeat_miss(monitor: Monitor) -> None:
    monitor = Monitor.objects.select_for_update().get(pk=monitor.pk)
    old_status = monitor.status
    monitor.consecutive_failures = (monitor.consecutive_failures or 0) + 1
    monitor.last_checked_at = timezone.now()
    if monitor.consecutive_failures >= failures_before_down():
        monitor.status = Monitor.Status.DOWN
    monitor.save(
        update_fields=["consecutive_failures", "last_checked_at", "status", "updated_at"]
    )
    CheckResult.objects.create(
        monitor=monitor,
        success=False,
        latency_ms=None,
        error_message="Heartbeat missed (watchdog)",
        status_code=None,
    )
    maybe_dispatch_transition(monitor, old_status, monitor.status)
