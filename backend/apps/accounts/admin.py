from django.contrib import admin

from .models import AuditEvent, Profile


@admin.register(Profile)
class ProfileAdmin(admin.ModelAdmin):
    list_display = ("user", "is_approved", "created_at", "updated_at")
    list_filter = ("is_approved",)
    search_fields = ("user__username", "user__email")
    raw_id_fields = ("user",)


@admin.register(AuditEvent)
class AuditEventAdmin(admin.ModelAdmin):
    list_display = ("created_at", "owner", "kind", "message")
    list_filter = ("kind",)
    search_fields = ("message", "owner__username")
    readonly_fields = ("created_at",)
