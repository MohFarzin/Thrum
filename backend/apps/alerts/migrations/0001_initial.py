import uuid

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("monitors", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="AlertChannel",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("name", models.CharField(max_length=200)),
                ("type", models.CharField(choices=[("email", "Email"), ("discord", "Discord")], max_length=20)),
                ("config", models.JSONField(blank=True, default=dict)),
                ("is_enabled", models.BooleanField(default=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "owner",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="alert_channels",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={"ordering": ["-created_at"]},
        ),
        migrations.CreateModel(
            name="AlertEvent",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("kind", models.CharField(choices=[("down", "Down"), ("up", "Recovery")], max_length=10)),
                ("sent_at", models.DateTimeField(auto_now_add=True)),
                ("success", models.BooleanField(default=False)),
                ("error", models.CharField(blank=True, default="", max_length=500)),
                (
                    "channel",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="events",
                        to="alerts.alertchannel",
                    ),
                ),
                (
                    "monitor",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="alert_events",
                        to="monitors.monitor",
                    ),
                ),
            ],
            options={"ordering": ["-sent_at"]},
        ),
        migrations.AddIndex(
            model_name="alertevent",
            index=models.Index(fields=["monitor", "sent_at"], name="alerts_aler_monitor_7f0b1a_idx"),
        ),
    ]
