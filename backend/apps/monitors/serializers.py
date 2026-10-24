from rest_framework import serializers

from .models import CheckResult, Monitor
from .ssrf import assert_safe_http_url, parse_tcp_target


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
            try:
                assert_safe_http_url(target)
            except ValueError as exc:
                raise serializers.ValidationError({"target": str(exc)}) from exc
        if monitor_type == Monitor.Type.TCP and target:
            try:
                parse_tcp_target(target)
            except ValueError as exc:
                raise serializers.ValidationError({"target": str(exc)}) from exc
        return attrs


class CheckResultSerializer(serializers.ModelSerializer):
    class Meta:
        model = CheckResult
        fields = [
            "id",
            "checked_at",
            "success",
            "latency_ms",
            "error_message",
            "status_code",
        ]
        read_only_fields = fields
