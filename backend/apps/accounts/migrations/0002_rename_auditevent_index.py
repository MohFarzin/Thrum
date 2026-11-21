from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0001_audit_event"),
    ]

    operations = [
        migrations.RenameIndex(
            model_name="auditevent",
            new_name="accounts_au_owner_i_d79c02_idx",
            old_name="accounts_au_owner_i_idx",
        ),
    ]
