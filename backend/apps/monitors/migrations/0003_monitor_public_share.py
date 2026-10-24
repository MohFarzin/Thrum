from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("monitors", "0002_monitor_favorite"),
    ]

    operations = [
        migrations.AddField(
            model_name="monitor",
            name="is_public",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="monitor",
            name="public_slug",
            field=models.CharField(
                blank=True, default=None, max_length=32, null=True, unique=True
            ),
        ),
        migrations.AddIndex(
            model_name="monitor",
            index=models.Index(
                fields=["is_public", "public_slug"],
                name="monitors_mo_public_slug_idx",
            ),
        ),
    ]
