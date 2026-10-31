from __future__ import annotations

from uuid import UUID

from django.contrib.auth.models import AbstractBaseUser

from .models import AuditEvent


def log_audit(
    owner: AbstractBaseUser,
    kind: str,
    message: str,
    *,
    monitor_id: UUID | str | None = None,
) -> None:
    mid = None
    if monitor_id is not None:
        mid = monitor_id if isinstance(monitor_id, UUID) else UUID(str(monitor_id))
    AuditEvent.objects.create(
        owner=owner,
        kind=kind,
        message=(message or "")[:500],
        monitor_id=mid,
    )
