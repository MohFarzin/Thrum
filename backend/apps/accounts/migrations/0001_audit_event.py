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
            name="AuditEvent",
            fields=[
                ("id", models.BigAutoField(primary_key=True, serialize=False)),
                (
                    "kind",
                    models.CharField(
                        choices=[
                            ("login", "Login"),
                            ("logout", "Logout"),
                            ("register", "Register"),
                            ("monitor_create", "Monitor created"),
                            ("monitor_update", "Monitor updated"),
                            ("monitor_delete", "Monitor deleted"),
                            ("status_change", "Status change"),
                            ("share_on", "Share enabled"),
                            ("share_off", "Share disabled"),
                        ],
                        max_length=32,
                    ),
                ),
                ("message", models.CharField(max_length=500)),
                ("monitor_id", models.UUIDField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "owner",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="audit_events",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "ordering": ["-created_at"],
            },
        ),
        migrations.AddIndex(
            model_name="auditevent",
            index=models.Index(fields=["owner", "created_at"], name="accounts_au_owner_i_idx"),
        ),
    ]
