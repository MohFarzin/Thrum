from __future__ import annotations

import logging

from celery import shared_task

from apps.monitors.models import Monitor

from .dispatch import build_alert_copy
from .models import AlertChannel, AlertEvent
from .senders import get_sender

logger = logging.getLogger(__name__)


@shared_task(name="alerts.send_alert", ignore_result=True)
def send_alert(monitor_id: str, channel_id: str, kind: str) -> None:
    try:
        monitor = Monitor.objects.select_related("owner").get(pk=monitor_id)
        channel = AlertChannel.objects.get(pk=channel_id, owner_id=monitor.owner_id)
    except (Monitor.DoesNotExist, AlertChannel.DoesNotExist):
        return
    if not channel.is_enabled:
        return

    subject, body = build_alert_copy(monitor, kind)
    event = AlertEvent(monitor=monitor, channel=channel, kind=kind)
    try:
        get_sender(channel.type).send(
            subject=subject,
            body=body,
            config=channel.config or {},
            kind=kind,
        )
        event.success = True
        event.error = ""
    except Exception as exc:  # noqa: BLE001 — record failure, never log secrets
        event.success = False
        event.error = str(exc)[:500]
        logger.warning("alert send failed monitor=%s channel=%s kind=%s", monitor_id, channel_id, kind)
    event.save()
