from rest_framework import serializers

from .keys import assign_new_key
from .models import CheckResult, Monitor
from .ssrf import assert_safe_http_url, parse_tcp_target


class MonitorSerializer(serializers.ModelSerializer):
    api_key = serializers.CharField(read_only=True, required=False)
    recent_results = serializers.SerializerMethodField()

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
            "is_favorite",
            "favorited_at",
            "is_public",
            "public_slug",
            "created_at",
            "updated_at",
            "api_key_prefix",
            "api_key",
            "recent_results",
        ]
        read_only_fields = [
            "id",
            "status",
            "last_checked_at",
            "last_heartbeat_at",
            "consecutive_failures",
            "is_favorite",
            "favorited_at",
            "is_public",
            "public_slug",
            "created_at",
            "updated_at",
            "api_key_prefix",
            "api_key",
            "recent_results",
        ]

    def get_recent_results(self, obj: Monitor):
        # Prefetched in the viewset when available. Cap covers ~1h at 30s interval.
        cached = getattr(obj, "_prefetched_objects_cache", {}).get("check_results")
        if cached is not None:
            rows = list(cached)[:120]
        else:
            rows = list(obj.check_results.all()[:120])
        return CheckResultSerializer(rows, many=True).data

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._raw_api_key: str | None = None

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
        if monitor_type == Monitor.Type.HEARTBEAT:
            interval = attrs.get("interval_seconds")
            if interval is None and self.instance is not None:
                interval = self.instance.interval_seconds
            grace = attrs.get("heartbeat_grace_seconds")
            if grace is None and self.instance is not None:
                grace = self.instance.heartbeat_grace_seconds
            if interval is not None and int(interval) < 10:
                raise serializers.ValidationError(
                    {"interval_seconds": "Heartbeat interval must be at least 10 seconds."}
                )
            if grace is not None and int(grace) < 10:
                raise serializers.ValidationError(
                    {"heartbeat_grace_seconds": "Heartbeat grace must be at least 10 seconds."}
                )
        return attrs

    def create(self, validated_data):
        monitor = Monitor(**validated_data)
        if monitor.type == Monitor.Type.HEARTBEAT:
            self._raw_api_key = assign_new_key(monitor)
        monitor.save()
        return monitor

    def to_representation(self, instance):
        data = super().to_representation(instance)
        if self._raw_api_key:
            data["api_key"] = self._raw_api_key
        else:
            data.pop("api_key", None)
        return data


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
