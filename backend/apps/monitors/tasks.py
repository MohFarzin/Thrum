from __future__ import annotations

from datetime import timedelta

from celery import shared_task
from django.conf import settings
from django.utils import timezone

from .models import CheckResult, Monitor
from .services import run_monitor_check


@shared_task(name="monitors.run_check", ignore_result=True)
def run_check(monitor_id: str) -> None:
    run_monitor_check(monitor_id)


@shared_task(name="monitors.enqueue_due_checks", ignore_result=True)
def enqueue_due_checks() -> int:
    """Find HTTP/TCP monitors past their interval and enqueue one check each."""
    now = timezone.now()
    candidates = (
        Monitor.objects.filter(
            is_enabled=True,
            type__in=[Monitor.Type.HTTP, Monitor.Type.TCP],
        )
        .only("id", "interval_seconds", "last_checked_at")
        .order_by("last_checked_at")[:500]
    )
    count = 0
    for monitor in candidates:
        if monitor.last_checked_at is None or (
            (now - monitor.last_checked_at).total_seconds() >= monitor.interval_seconds
        ):
            run_check.delay(str(monitor.id))
            count += 1
            if count >= 200:
                break
    return count


@shared_task(name="monitors.cleanup_check_results", ignore_result=True)
def cleanup_check_results() -> int:
    days = max(1, int(getattr(settings, "THRUM_CHECK_RETENTION_DAYS", 14)))
    cutoff = timezone.now() - timedelta(days=days)
    deleted, _ = CheckResult.objects.filter(checked_at__lt=cutoff).delete()
    return int(deleted)
