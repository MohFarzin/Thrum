from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0003_profile_and_audit_kinds"),
    ]

    operations = [
        migrations.RenameIndex(
            model_name="profile",
            new_name="accounts_pr_is_appr_5f254f_idx",
            old_name="accounts_pr_is_appr_idx",
        ),
    ]
