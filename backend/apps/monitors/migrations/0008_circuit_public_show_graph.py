from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("monitors", "0007_circuit_membership_m2m"),
    ]

    operations = [
        migrations.AddField(
            model_name="circuit",
            name="public_show_graph",
            field=models.BooleanField(default=False),
        ),
    ]
