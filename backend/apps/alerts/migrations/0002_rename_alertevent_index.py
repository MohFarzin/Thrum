from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("alerts", "0001_initial"),
    ]

    operations = [
        migrations.RenameIndex(
            model_name="alertevent",
            new_name="alerts_aler_monitor_c99745_idx",
            old_name="alerts_aler_monitor_7f0b1a_idx",
        ),
    ]
