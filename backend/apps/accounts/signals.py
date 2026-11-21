from django.contrib.auth import get_user_model
from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import Profile

User = get_user_model()


@receiver(post_save, sender=User)
def ensure_profile(sender, instance, created, **kwargs):  # noqa: ANN001, ARG001
    if created:
        Profile.objects.get_or_create(
            user=instance,
            defaults={"is_approved": bool(instance.is_staff or instance.is_superuser)},
        )
    else:
        Profile.objects.get_or_create(user=instance, defaults={"is_approved": False})
