import django.db.models.deletion
from django.db import migrations, models


def forwards_copy_fk(apps, schema_editor):
    Monitor = apps.get_model("monitors", "Monitor")
    CircuitMembership = apps.get_model("monitors", "CircuitMembership")
    for m in Monitor.objects.exclude(circuit_id=None).iterator():
        CircuitMembership.objects.get_or_create(circuit_id=m.circuit_id, monitor_id=m.id)


def backwards_noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):
    dependencies = [
        ("monitors", "0006_circuit"),
    ]

    operations = [
        migrations.CreateModel(
            name="CircuitMembership",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True, primary_key=True, serialize=False, verbose_name="ID"
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "circuit",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="memberships",
                        to="monitors.circuit",
                    ),
                ),
                (
                    "monitor",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="memberships",
                        to="monitors.monitor",
                    ),
                ),
            ],
        ),
        migrations.AddConstraint(
            model_name="circuitmembership",
            constraint=models.UniqueConstraint(
                fields=("circuit", "monitor"), name="uniq_circuit_monitor_membership"
            ),
        ),
        migrations.AddIndex(
            model_name="circuitmembership",
            index=models.Index(fields=["monitor"], name="monitors_ci_monitor_idx"),
        ),
        migrations.AddIndex(
            model_name="circuitmembership",
            index=models.Index(fields=["circuit"], name="monitors_ci_circuit_idx"),
        ),
        migrations.RunPython(forwards_copy_fk, backwards_noop),
        migrations.RemoveIndex(
            model_name="monitor",
            name="monitors_mo_circuit_idx",
        ),
        migrations.RemoveField(
            model_name="monitor",
            name="circuit",
        ),
        migrations.AddField(
            model_name="monitor",
            name="circuits",
            field=models.ManyToManyField(
                blank=True,
                related_name="monitors",
                through="monitors.CircuitMembership",
                to="monitors.circuit",
            ),
        ),
        migrations.AlterField(
            model_name="monitor",
            name="udp_payload",
            field=models.CharField(
                blank=True,
                default="",
                help_text=(
                    "UDP payload: empty = short probe; 'bedrock' = Minecraft Bedrock RakNet ping; "
                    "or hex:AABBCC…"
                ),
                max_length=512,
            ),
        ),
    ]
