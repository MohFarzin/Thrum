from django.contrib import admin

from .models import AlertChannel, AlertEvent


@admin.register(AlertChannel)
class AlertChannelAdmin(admin.ModelAdmin):
    list_display = ("name", "type", "owner", "is_enabled", "created_at")
    list_filter = ("type", "is_enabled")
    search_fields = ("name", "owner__username")
    readonly_fields = ("id", "created_at", "updated_at")


@admin.register(AlertEvent)
class AlertEventAdmin(admin.ModelAdmin):
    list_display = ("kind", "monitor", "channel", "success", "sent_at")
    list_filter = ("kind", "success")
    readonly_fields = ("id", "sent_at", "error")
