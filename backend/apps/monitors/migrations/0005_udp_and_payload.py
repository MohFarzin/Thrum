from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("monitors", "0004_rename_indexes"),
    ]

    operations = [
        migrations.AddField(
            model_name="monitor",
            name="udp_payload",
            field=models.CharField(
                blank=True,
                default="",
                help_text="Optional UDP datagram payload (empty sends a short probe).",
                max_length=512,
            ),
        ),
        migrations.AlterField(
            model_name="monitor",
            name="target",
            field=models.CharField(
                blank=True,
                help_text="URL for HTTP, host:port for TCP/UDP; empty for heartbeat-only.",
                max_length=2048,
            ),
        ),
        migrations.AlterField(
            model_name="monitor",
            name="type",
            field=models.CharField(
                choices=[
                    ("http", "HTTP"),
                    ("tcp", "TCP"),
                    ("udp", "UDP"),
                    ("heartbeat", "Heartbeat"),
                ],
                max_length=20,
            ),
        ),
    ]
