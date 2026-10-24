import uuid

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="Monitor",
            fields=[
                (
                    "id",
                    models.UUIDField(
                        default=uuid.uuid4,
                        editable=False,
                        primary_key=True,
                        serialize=False,
                    ),
                ),
                ("name", models.CharField(max_length=200)),
                (
                    "type",
                    models.CharField(
                        choices=[
                            ("http", "HTTP"),
                            ("tcp", "TCP"),
                            ("heartbeat", "Heartbeat"),
                        ],
                        max_length=20,
                    ),
                ),
                (
                    "target",
                    models.CharField(
                        blank=True,
                        help_text="URL for HTTP, host:port for TCP; empty for heartbeat-only.",
                        max_length=2048,
                    ),
                ),
                ("interval_seconds", models.PositiveIntegerField(default=60)),
                ("timeout_seconds", models.PositiveIntegerField(default=10)),
                ("expected_status_code", models.PositiveSmallIntegerField(default=200)),
                ("heartbeat_grace_seconds", models.PositiveIntegerField(default=60)),
                ("api_key_prefix", models.CharField(blank=True, default="", max_length=12)),
                ("api_key_hash", models.CharField(blank=True, default="", max_length=128)),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("up", "Up"),
                            ("down", "Down"),
                            ("unknown", "Unknown"),
                        ],
                        default="unknown",
                        max_length=20,
                    ),
                ),
                ("last_checked_at", models.DateTimeField(blank=True, null=True)),
                ("last_heartbeat_at", models.DateTimeField(blank=True, null=True)),
                ("consecutive_failures", models.PositiveIntegerField(default=0)),
                ("is_enabled", models.BooleanField(default=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "owner",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="monitors",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "ordering": ["-created_at"],
            },
        ),
        migrations.CreateModel(
            name="CheckResult",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("checked_at", models.DateTimeField(auto_now_add=True)),
                ("success", models.BooleanField()),
                ("latency_ms", models.PositiveIntegerField(blank=True, null=True)),
                ("error_message", models.CharField(blank=True, default="", max_length=500)),
                ("status_code", models.PositiveSmallIntegerField(blank=True, null=True)),
                (
                    "monitor",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="check_results",
                        to="monitors.monitor",
                    ),
                ),
            ],
            options={
                "ordering": ["-checked_at"],
            },
        ),
        migrations.AddIndex(
            model_name="monitor",
            index=models.Index(fields=["owner"], name="monitors_mo_owner_i_8f8c3e_idx"),
        ),
        migrations.AddIndex(
            model_name="monitor",
            index=models.Index(fields=["status"], name="monitors_mo_status_a1b2c3_idx"),
        ),
        migrations.AddIndex(
            model_name="monitor",
            index=models.Index(
                fields=["last_checked_at"], name="monitors_mo_last_ch_d4e5f6_idx"
            ),
        ),
        migrations.AddIndex(
            model_name="monitor",
            index=models.Index(fields=["type"], name="monitors_mo_type_g7h8i9_idx"),
        ),
        migrations.AddIndex(
            model_name="checkresult",
            index=models.Index(
                fields=["monitor", "checked_at"],
                name="monitors_ch_monitor_j0k1l2_idx",
            ),
        ),
    ]
