from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("monitors", "0003_monitor_public_share"),
    ]

    operations = [
        migrations.RenameIndex(
            model_name="checkresult",
            new_name="monitors_ch_monitor_bb7722_idx",
            old_name="monitors_ch_monitor_j0k1l2_idx",
        ),
        migrations.RenameIndex(
            model_name="monitor",
            new_name="monitors_mo_owner_i_ab0c07_idx",
            old_name="monitors_mo_owner_i_8f8c3e_idx",
        ),
        migrations.RenameIndex(
            model_name="monitor",
            new_name="monitors_mo_status_1ab706_idx",
            old_name="monitors_mo_status_a1b2c3_idx",
        ),
        migrations.RenameIndex(
            model_name="monitor",
            new_name="monitors_mo_last_ch_6c5b16_idx",
            old_name="monitors_mo_last_ch_d4e5f6_idx",
        ),
        migrations.RenameIndex(
            model_name="monitor",
            new_name="monitors_mo_type_7175b3_idx",
            old_name="monitors_mo_type_g7h8i9_idx",
        ),
        migrations.RenameIndex(
            model_name="monitor",
            new_name="monitors_mo_owner_i_9d5552_idx",
            old_name="monitors_mo_owner_i_fav_idx",
        ),
        migrations.RenameIndex(
            model_name="monitor",
            new_name="monitors_mo_is_publ_be6346_idx",
            old_name="monitors_mo_public_slug_idx",
        ),
    ]
