from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("monitors", "0008_circuit_public_show_graph"),
    ]

    operations = [
        migrations.AddField(
            model_name="monitor",
            name="http_authorization",
            field=models.CharField(blank=True, default="", max_length=512),
        ),
        migrations.AddField(
            model_name="monitor",
            name="http_assert_link_ok",
            field=models.BooleanField(default=False),
        ),
    ]
