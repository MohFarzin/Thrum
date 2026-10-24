from __future__ import annotations

from datetime import timedelta

from celery import shared_task
from django.conf import settings
from django.utils import timezone

from .models import CheckResult, Monitor
from .services import mark_heartbeat_miss, run_monitor_check


@shared_task(name="monitors.run_check", ignore_result=True)
def run_check(monitor_id: str) -> None:
    run_monitor_check(monitor_id)


@shared_task(name="monitors.enqueue_due_checks", ignore_result=True)
def enqueue_due_checks() -> int:
    """Legacy Celery path — prefer `manage.py run_checker` on low-resource hosts."""
    from .scheduler import due_http_tcp_ids

    ids = due_http_tcp_ids(limit=200)
    for mid in ids:
        run_check.delay(mid)
    return len(ids)


@shared_task(name="monitors.heartbeat_watchdog", ignore_result=True)
def heartbeat_watchdog() -> int:
    """Mark heartbeat monitors down when interval + grace since last beat has passed."""
    now = timezone.now()
    monitors = Monitor.objects.filter(
        is_enabled=True,
        type=Monitor.Type.HEARTBEAT,
        last_heartbeat_at__isnull=False,
    ).only(
        "id",
        "interval_seconds",
        "heartbeat_grace_seconds",
        "last_heartbeat_at",
        "last_checked_at",
        "consecutive_failures",
        "status",
    )[:500]
    marked = 0
    for monitor in monitors:
        deadline = monitor.last_heartbeat_at + timedelta(
            seconds=monitor.interval_seconds + monitor.heartbeat_grace_seconds
        )
        if now <= deadline:
            continue
        if monitor.last_checked_at and (
            (now - monitor.last_checked_at).total_seconds() < monitor.interval_seconds
        ):
            continue
        mark_heartbeat_miss(monitor)
        marked += 1
    return marked


@shared_task(name="monitors.cleanup_check_results", ignore_result=True)
def cleanup_check_results() -> int:
    days = max(1, int(getattr(settings, "THRUM_CHECK_RETENTION_DAYS", 14)))
    cutoff = timezone.now() - timedelta(days=days)
    deleted, _ = CheckResult.objects.filter(checked_at__lt=cutoff).delete()
    return int(deleted)
