from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


def backfill_profiles(apps, schema_editor):  # noqa: ARG001
    User = apps.get_model(settings.AUTH_USER_MODEL)
    Profile = apps.get_model("accounts", "Profile")
    for u in User.objects.all().iterator():
        Profile.objects.get_or_create(
            user_id=u.id,
            # Existing accounts stay usable after deploy.
            defaults={"is_approved": True},
        )


def noop_reverse(apps, schema_editor):  # noqa: ARG001
    pass


class Migration(migrations.Migration):
    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("accounts", "0002_rename_auditevent_index"),
    ]

    operations = [
        migrations.CreateModel(
            name="Profile",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("is_approved", models.BooleanField(default=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "user",
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="profile",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
        ),
        migrations.AddIndex(
            model_name="profile",
            index=models.Index(fields=["is_approved"], name="accounts_pr_is_appr_idx"),
        ),
        migrations.AlterField(
            model_name="auditevent",
            name="kind",
            field=models.CharField(
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
                    ("user_approve", "User approved"),
                    ("user_deny", "User denied"),
                    ("user_password", "Password set by admin"),
                    ("user_update", "User updated by admin"),
                ],
                max_length=32,
            ),
        ),
        migrations.RunPython(backfill_profiles, noop_reverse),
    ]
