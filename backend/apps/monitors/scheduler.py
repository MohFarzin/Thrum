"""Due-check scheduling — sleep until next due; no Celery beat/prefork."""

from __future__ import annotations

import logging

from django.db import close_old_connections
from django.utils import timezone

from .models import Monitor
from .services import run_monitor_check

logger = logging.getLogger(__name__)

# How often we re-scan for newly created monitors while sleeping.
MAX_SLEEP_SECONDS = 5.0


def _http_tcp_monitors():
    return (
        Monitor.objects.filter(
            is_enabled=True,
            type__in=[Monitor.Type.HTTP, Monitor.Type.TCP],
        )
        .only("id", "interval_seconds", "last_checked_at")
        .order_by("last_checked_at")[:500]
    )


def due_http_tcp_ids(*, limit: int = 200) -> list[str]:
    now = timezone.now()
    ids: list[str] = []
    for monitor in _http_tcp_monitors():
        if monitor.last_checked_at is None or (
            (now - monitor.last_checked_at).total_seconds() >= monitor.interval_seconds
        ):
            ids.append(str(monitor.id))
            if len(ids) >= limit:
                break
    return ids


def seconds_until_next_due(*, max_sleep: float = MAX_SLEEP_SECONDS) -> float:
    """Return sleep time until the soonest HTTP/TCP check is due (capped)."""
    now = timezone.now()
    soonest: float | None = None
    for monitor in _http_tcp_monitors():
        if monitor.last_checked_at is None:
            return 0.0
        remaining = monitor.interval_seconds - (now - monitor.last_checked_at).total_seconds()
        if remaining <= 0:
            return 0.0
        if soonest is None or remaining < soonest:
            soonest = remaining
    if soonest is None:
        return max_sleep
    return max(0.05, min(float(soonest), max_sleep))


def run_due_checks(*, limit: int = 200) -> int:
    """Run due probes one-at-a-time (Django DB is not thread-friendly here)."""
    ids = due_http_tcp_ids(limit=limit)
    if not ids:
        return 0
    for mid in ids:
        close_old_connections()
        try:
            run_monitor_check(mid)
        except Exception:  # noqa: BLE001 — one bad monitor must not kill the loop
            logger.exception("check failed monitor=%s", mid)
        finally:
            close_old_connections()
    return len(ids)
