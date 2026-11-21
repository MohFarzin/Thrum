"""Account profile (approval) + private audit trail."""

from __future__ import annotations

from django.conf import settings
from django.db import models


class Profile(models.Model):
    """One profile per user. New signups start unapproved until staff approves."""

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="profile",
    )
    is_approved = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=["is_approved"]),
        ]

    def __str__(self) -> str:
        return f"profile:{self.user_id} approved={self.is_approved}"


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
        USER_APPROVE = "user_approve", "User approved"
        USER_DENY = "user_deny", "User denied"  # legacy audit rows
        USER_DELETE = "user_delete", "User deleted by admin"
        USER_PASSWORD = "user_password", "Password set by admin"
        USER_UPDATE = "user_update", "User updated by admin"

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
