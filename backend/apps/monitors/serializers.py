from rest_framework import serializers

from .models import Monitor


class MonitorSerializer(serializers.ModelSerializer):
    class Meta:
        model = Monitor
        fields = [
            "id",
            "name",
            "type",
            "target",
            "interval_seconds",
            "timeout_seconds",
            "expected_status_code",
            "heartbeat_grace_seconds",
            "status",
            "last_checked_at",
            "last_heartbeat_at",
            "consecutive_failures",
            "is_enabled",
            "created_at",
            "updated_at",
            "api_key_prefix",
        ]
        read_only_fields = [
            "id",
            "status",
            "last_checked_at",
            "last_heartbeat_at",
            "consecutive_failures",
            "created_at",
            "updated_at",
            "api_key_prefix",
        ]

    def validate(self, attrs):
        monitor_type = attrs.get("type") or getattr(self.instance, "type", None)
        target = attrs.get("target")
        if target is None and self.instance is not None:
            target = self.instance.target

        if monitor_type in (Monitor.Type.HTTP, Monitor.Type.TCP) and not (target or "").strip():
            raise serializers.ValidationError(
                {"target": "Target is required for HTTP and TCP monitors."}
            )
        if monitor_type == Monitor.Type.HTTP and target:
            if not (target.startswith("http://") or target.startswith("https://")):
                raise serializers.ValidationError(
                    {"target": "HTTP monitors must use http:// or https:// URLs."}
                )
        return attrs
