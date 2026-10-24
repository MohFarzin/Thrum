from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("monitors", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="monitor",
            name="favorited_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="monitor",
            name="is_favorite",
            field=models.BooleanField(default=False),
        ),
        migrations.AddIndex(
            model_name="monitor",
            index=models.Index(
                fields=["owner", "is_favorite"],
                name="monitors_mo_owner_i_fav_idx",
            ),
        ),
    ]
