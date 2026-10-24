import uuid

from django.conf import settings
from django.db import models


class AlertChannel(models.Model):
    class Type(models.TextChoices):
        EMAIL = "email", "Email"
        DISCORD = "discord", "Discord"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="alert_channels",
    )
    name = models.CharField(max_length=200)
    type = models.CharField(max_length=20, choices=Type.choices)
    config = models.JSONField(default=dict, blank=True)
    is_enabled = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"{self.name} ({self.type})"


class AlertEvent(models.Model):
    class Kind(models.TextChoices):
        DOWN = "down", "Down"
        UP = "up", "Recovery"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    monitor = models.ForeignKey(
        "monitors.Monitor",
        on_delete=models.CASCADE,
        related_name="alert_events",
    )
    channel = models.ForeignKey(
        AlertChannel,
        on_delete=models.CASCADE,
        related_name="events",
    )
    kind = models.CharField(max_length=10, choices=Kind.choices)
    sent_at = models.DateTimeField(auto_now_add=True)
    success = models.BooleanField(default=False)
    error = models.CharField(max_length=500, blank=True, default="")

    class Meta:
        ordering = ["-sent_at"]
        indexes = [
            models.Index(fields=["monitor", "sent_at"]),
        ]

    def __str__(self) -> str:
        return f"{self.kind} → {self.channel_id} ok={self.success}"
