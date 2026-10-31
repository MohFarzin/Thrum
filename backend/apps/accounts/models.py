"""Account-scoped audit trail (private)."""

from __future__ import annotations

from django.conf import settings
from django.db import models


class AuditEvent(models.Model):
    class Kind(models.TextChoices):
        LOGIN = "login", "Login"
        LOGOUT = "logout", "Logout"
        REGISTER = "register", "Register"
        MONITOR_CREATE = "monitor_create", "Monitor created"
        MONITOR_UPDATE = "monitor_update", "Monitor updated"
        MONITOR_DELETE = "monitor_delete", "Monitor deleted"
        STATUS_CHANGE = "status_change", "Status change"
        SHARE_ON = "share_on", "Share enabled"
        SHARE_OFF = "share_off", "Share disabled"

    id = models.BigAutoField(primary_key=True)
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="audit_events",
    )
    kind = models.CharField(max_length=32, choices=Kind.choices)
    message = models.CharField(max_length=500)
    monitor_id = models.UUIDField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["owner", "created_at"]),
        ]

    def __str__(self) -> str:
        return f"{self.kind} @ {self.created_at}"
