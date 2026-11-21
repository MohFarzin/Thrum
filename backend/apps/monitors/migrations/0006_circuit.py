import uuid

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("monitors", "0005_udp_and_payload"),
    ]

    operations = [
        migrations.CreateModel(
            name="Circuit",
            fields=[
                (
                    "id",
                    models.UUIDField(
                        default=uuid.uuid4, editable=False, primary_key=True, serialize=False
                    ),
                ),
                ("name", models.CharField(max_length=200)),
                ("description", models.CharField(blank=True, default="", max_length=500)),
                ("sort_order", models.PositiveIntegerField(default=0)),
                ("is_public", models.BooleanField(default=False)),
                (
                    "public_slug",
                    models.CharField(
                        blank=True, default=None, max_length=32, null=True, unique=True
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "owner",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="circuits",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "ordering": ["sort_order", "name"],
            },
        ),
        migrations.AddField(
            model_name="monitor",
            name="circuit",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="monitors",
                to="monitors.circuit",
            ),
        ),
        migrations.AddIndex(
            model_name="circuit",
            index=models.Index(fields=["owner"], name="monitors_ci_owner_i_idx"),
        ),
        migrations.AddIndex(
            model_name="circuit",
            index=models.Index(
                fields=["is_public", "public_slug"], name="monitors_ci_is_publ_idx"
            ),
        ),
        migrations.AddIndex(
            model_name="monitor",
            index=models.Index(fields=["circuit"], name="monitors_mo_circuit_idx"),
        ),
    ]
