import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("alerts", "0002_rename_alertevent_index"),
        ("monitors", "0007_circuit_membership_m2m"),
    ]

    operations = [
        migrations.AddField(
            model_name="alertchannel",
            name="circuit",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="alert_channels",
                to="monitors.circuit",
            ),
        ),
        migrations.AddIndex(
            model_name="alertchannel",
            index=models.Index(fields=["circuit"], name="alerts_aler_circuit_idx"),
        ),
    ]
