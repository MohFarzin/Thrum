from django.contrib import admin

from .models import CheckResult, Monitor


@admin.register(Monitor)
class MonitorAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "type",
        "status",
        "owner",
        "is_enabled",
        "last_checked_at",
        "created_at",
    )
    list_filter = ("type", "status", "is_enabled")
    search_fields = ("name", "target", "owner__username")
    readonly_fields = ("id", "api_key_prefix", "api_key_hash", "created_at", "updated_at")


@admin.register(CheckResult)
class CheckResultAdmin(admin.ModelAdmin):
    list_display = ("monitor", "checked_at", "success", "latency_ms", "status_code")
    list_filter = ("success",)
    search_fields = ("monitor__name", "error_message")
