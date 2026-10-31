from django.contrib import admin

from .models import AuditEvent


@admin.register(AuditEvent)
class AuditEventAdmin(admin.ModelAdmin):
    list_display = ("created_at", "owner", "kind", "message")
    list_filter = ("kind",)
    search_fields = ("message", "owner__username")
    readonly_fields = ("created_at",)
