"""Fire alerts only on monitor status transitions (down / recovery)."""

from __future__ import annotations

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from apps.monitors.models import Monitor

from .models import AlertChannel


def maybe_dispatch_transition(monitor: Monitor, old_status: str, new_status: str) -> None:
    if old_status == new_status:
        return
    kind: str | None = None
    if new_status == Monitor.Status.DOWN:
        kind = "down"
    elif new_status == Monitor.Status.UP and old_status == Monitor.Status.DOWN:
        kind = "up"
    if not kind:
        return

    monitor_id = str(monitor.id)
    owner_id = monitor.owner_id
    channel_ids = list(
        AlertChannel.objects.filter(owner_id=owner_id, is_enabled=True).values_list("id", flat=True)
    )
    if not channel_ids:
        return

    def _enqueue() -> None:
        from .tasks import send_alert

        for cid in channel_ids:
            send_alert.delay(monitor_id, str(cid), kind)

    transaction.on_commit(_enqueue)


def build_alert_copy(monitor: Monitor, kind: str) -> tuple[str, str]:
    base = getattr(settings, "THRUM_PUBLIC_BASE_URL", "").rstrip("/") or "http://localhost"
    link = f"{base}/monitors/{monitor.id}"
    target = monitor.target.strip() if monitor.target else "agent heartbeat"
    when = timezone.now().strftime("%Y-%m-%d %H:%M:%S UTC")

    if kind == "down":
        subject = f"DOWN · {monitor.name}"
        body = (
            f"{monitor.name} lost its pulse.\n\n"
            f"Type: {monitor.type}\n"
            f"Target: {target}\n"
            f"Detected: {when}\n"
            f"Consecutive failures: {monitor.consecutive_failures}\n\n"
            f"{link}"
        )
    else:
        subject = f"UP · {monitor.name}"
        body = (
            f"{monitor.name} is back.\n\n"
            f"Type: {monitor.type}\n"
            f"Target: {target}\n"
            f"Recovered: {when}\n\n"
            f"{link}"
        )
    return subject, body
