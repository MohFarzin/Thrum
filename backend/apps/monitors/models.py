import uuid

from django.conf import settings
from django.db import models


class Monitor(models.Model):
    class Type(models.TextChoices):
        HTTP = "http", "HTTP"
        TCP = "tcp", "TCP"
        HEARTBEAT = "heartbeat", "Heartbeat"

    class Status(models.TextChoices):
        UP = "up", "Up"
        DOWN = "down", "Down"
        UNKNOWN = "unknown", "Unknown"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="monitors",
    )
    name = models.CharField(max_length=200)
    type = models.CharField(max_length=20, choices=Type.choices)
    target = models.CharField(
        max_length=2048,
        blank=True,
        help_text="URL for HTTP, host:port for TCP; empty for heartbeat-only.",
    )
    interval_seconds = models.PositiveIntegerField(default=60)
    timeout_seconds = models.PositiveIntegerField(default=10)
    expected_status_code = models.PositiveSmallIntegerField(default=200)
    heartbeat_grace_seconds = models.PositiveIntegerField(default=60)
    api_key_prefix = models.CharField(max_length=12, blank=True, default="")
    api_key_hash = models.CharField(max_length=128, blank=True, default="")
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.UNKNOWN,
    )
    last_checked_at = models.DateTimeField(null=True, blank=True)
    last_heartbeat_at = models.DateTimeField(null=True, blank=True)
    consecutive_failures = models.PositiveIntegerField(default=0)
    is_enabled = models.BooleanField(default=True)
    is_favorite = models.BooleanField(default=False)
    favorited_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["owner"]),
            models.Index(fields=["status"]),
            models.Index(fields=["last_checked_at"]),
            models.Index(fields=["type"]),
            models.Index(fields=["owner", "is_favorite"]),
        ]

    def __str__(self) -> str:
        return f"{self.name} ({self.type})"


class CheckResult(models.Model):
    monitor = models.ForeignKey(
        Monitor,
        on_delete=models.CASCADE,
        related_name="check_results",
    )
    checked_at = models.DateTimeField(auto_now_add=True)
    success = models.BooleanField()
    latency_ms = models.PositiveIntegerField(null=True, blank=True)
    error_message = models.CharField(max_length=500, blank=True, default="")
    status_code = models.PositiveSmallIntegerField(null=True, blank=True)

    class Meta:
        ordering = ["-checked_at"]
        indexes = [
            models.Index(fields=["monitor", "checked_at"]),
        ]

    def __str__(self) -> str:
        return f"{self.monitor_id} @ {self.checked_at} ok={self.success}"
