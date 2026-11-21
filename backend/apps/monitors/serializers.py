from rest_framework import serializers

from .keys import assign_new_key
from .models import (
    MAX_CIRCUITS_PER_MONITOR,
    CheckResult,
    Circuit,
    CircuitMembership,
    Monitor,
)
from .ssrf import assert_safe_http_url, parse_tcp_target


class MonitorSerializer(serializers.ModelSerializer):
    api_key = serializers.CharField(read_only=True, required=False)
    recent_results = serializers.SerializerMethodField()
    http_authorization = serializers.CharField(
        required=False, allow_blank=True, write_only=True, max_length=512
    )
    http_authorization_set = serializers.SerializerMethodField()
    circuits = serializers.PrimaryKeyRelatedField(
        queryset=Circuit.objects.all(),
        many=True,
        required=False,
    )

    class Meta:
        model = Monitor
        fields = [
            "id",
            "name",
            "type",
            "target",
            "circuits",
            "interval_seconds",
            "timeout_seconds",
            "expected_status_code",
            "http_authorization",
            "http_authorization_set",
            "http_assert_link_ok",
            "heartbeat_grace_seconds",
            "udp_payload",
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
            "http_authorization_set",
        ]

    def get_http_authorization_set(self, obj: Monitor) -> bool:
        return bool((obj.http_authorization or "").strip())

    def get_recent_results(self, obj: Monitor):
        from .bar import time_buckets

        cached = getattr(obj, "_prefetched_objects_cache", {}).get("check_results")
        if cached is not None:
            rows = list(cached)
        else:
            rows = list(obj.check_results.all()[:120])
        return time_buckets(obj, "1h", rows=rows)

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._raw_api_key: str | None = None
        request = self.context.get("request")
        if request and getattr(request, "user", None) and request.user.is_authenticated:
            self.fields["circuits"].queryset = Circuit.objects.filter(owner=request.user)
        else:
            self.fields["circuits"].queryset = Circuit.objects.none()

    def validate_circuits(self, circuits):
        if len(circuits) > MAX_CIRCUITS_PER_MONITOR:
            raise serializers.ValidationError(
                f"A pulse can belong to at most {MAX_CIRCUITS_PER_MONITOR} circuits."
            )
        request = self.context.get("request")
        if request:
            for c in circuits:
                if c.owner_id != request.user.id:
                    raise serializers.ValidationError("Circuit not found.")
        return circuits

    def validate(self, attrs):
        monitor_type = attrs.get("type") or getattr(self.instance, "type", None)
        target = attrs.get("target")
        if target is None and self.instance is not None:
            target = self.instance.target

        if monitor_type in (Monitor.Type.HTTP, Monitor.Type.TCP, Monitor.Type.UDP) and not (
            target or ""
        ).strip():
            raise serializers.ValidationError(
                {"target": "Target is required for HTTP, TCP, and UDP monitors."}
            )
        if monitor_type == Monitor.Type.HTTP and target:
            try:
                assert_safe_http_url(target)
            except ValueError as exc:
                raise serializers.ValidationError({"target": str(exc)}) from exc
        if monitor_type in (Monitor.Type.TCP, Monitor.Type.UDP) and target:
            try:
                parse_tcp_target(target)
            except ValueError as exc:
                raise serializers.ValidationError({"target": str(exc)}) from exc
        interval = attrs.get("interval_seconds")
        if interval is None and self.instance is not None:
            interval = self.instance.interval_seconds

        if (
            monitor_type in (Monitor.Type.TCP, Monitor.Type.UDP)
            and interval is not None
            and int(interval) < 60
        ):
            raise serializers.ValidationError(
                {"interval_seconds": f"{monitor_type.upper()} interval must be at least 60 seconds."}
            )

        if monitor_type == Monitor.Type.HEARTBEAT:
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
        elif monitor_type == Monitor.Type.HTTP and interval is not None and int(interval) < 10:
            raise serializers.ValidationError(
                {"interval_seconds": "HTTP interval must be at least 10 seconds."}
            )
        return attrs

    def create(self, validated_data):
        circuits = validated_data.pop("circuits", None)
        auth = validated_data.pop("http_authorization", None)
        monitor = Monitor(**validated_data)
        if auth is not None:
            monitor.http_authorization = (auth or "").strip()[:512]
        if monitor.type == Monitor.Type.HEARTBEAT:
            self._raw_api_key = assign_new_key(monitor)
        monitor.save()
        if circuits is not None:
            monitor.circuits.set(circuits)
        return monitor

    def update(self, instance, validated_data):
        circuits = validated_data.pop("circuits", None)
        auth = validated_data.pop("http_authorization", serializers.empty)
        for key, value in validated_data.items():
            setattr(instance, key, value)
        if auth is not serializers.empty:
            # Empty string clears; "********" keeps existing (UI placeholder).
            raw = (auth or "").strip()
            if raw and raw != "********":
                instance.http_authorization = raw[:512]
            elif not raw:
                instance.http_authorization = ""
        instance.save()
        if circuits is not None:
            instance.circuits.set(circuits)
        return instance

    def to_representation(self, instance):
        data = super().to_representation(instance)
        if self._raw_api_key:
            data["api_key"] = self._raw_api_key
        else:
            data.pop("api_key", None)
        data.pop("http_authorization", None)
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


class CircuitSerializer(serializers.ModelSerializer):
    monitor_count = serializers.SerializerMethodField()
    up_now = serializers.SerializerMethodField()
    down_now = serializers.SerializerMethodField()
    unknown_now = serializers.SerializerMethodField()
    health = serializers.SerializerMethodField()
    monitor_ids = serializers.ListField(
        child=serializers.UUIDField(),
        write_only=True,
        required=False,
    )

    class Meta:
        model = Circuit
        fields = [
            "id",
            "name",
            "description",
            "sort_order",
            "is_public",
            "public_slug",
            "public_show_graph",
            "monitor_count",
            "up_now",
            "down_now",
            "unknown_now",
            "health",
            "monitor_ids",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "is_public",
            "public_slug",
            "public_show_graph",
            "monitor_count",
            "up_now",
            "down_now",
            "unknown_now",
            "health",
            "created_at",
            "updated_at",
        ]

    def _monitors(self, obj: Circuit):
        cached = getattr(obj, "_prefetched_objects_cache", {}).get("monitors")
        if cached is not None:
            return list(cached)
        return list(obj.monitors.all())

    def get_monitor_count(self, obj: Circuit) -> int:
        return len(self._monitors(obj))

    def get_up_now(self, obj: Circuit) -> int:
        return sum(1 for m in self._monitors(obj) if m.status == Monitor.Status.UP)

    def get_down_now(self, obj: Circuit) -> int:
        return sum(1 for m in self._monitors(obj) if m.status == Monitor.Status.DOWN)

    def get_unknown_now(self, obj: Circuit) -> int:
        return sum(1 for m in self._monitors(obj) if m.status == Monitor.Status.UNKNOWN)

    def get_health(self, obj: Circuit):
        from .bar import health_for_monitor_ids

        range_key = self.context.get("health_range") or "1d"
        ids = [m.id for m in self._monitors(obj)]
        return health_for_monitor_ids(ids, range_key)

    def create(self, validated_data):
        monitor_ids = validated_data.pop("monitor_ids", None)
        circuit = Circuit.objects.create(**validated_data)
        if monitor_ids is not None:
            self._assign_monitors(circuit, monitor_ids)
        return circuit

    def update(self, instance, validated_data):
        monitor_ids = validated_data.pop("monitor_ids", None)
        for key, value in validated_data.items():
            setattr(instance, key, value)
        instance.save()
        if monitor_ids is not None:
            self._assign_monitors(instance, monitor_ids)
        return instance

    def _assign_monitors(self, circuit: Circuit, monitor_ids: list) -> None:
        request = self.context.get("request")
        owner = request.user if request else circuit.owner
        desired = set(
            Monitor.objects.filter(owner=owner, id__in=monitor_ids).values_list("id", flat=True)
        )
        current = set(circuit.monitors.values_list("id", flat=True))

        # Remove memberships no longer selected for this circuit.
        CircuitMembership.objects.filter(circuit=circuit, monitor_id__in=(current - desired)).delete()

        to_add = desired - current
        if not to_add:
            return

        # Cap: each pulse ≤ MAX circuits (counting ones already held).
        overcrowded = []
        for mid in to_add:
            count = CircuitMembership.objects.filter(monitor_id=mid).count()
            if count >= MAX_CIRCUITS_PER_MONITOR:
                overcrowded.append(str(mid))
        if overcrowded:
            raise serializers.ValidationError(
                {
                    "monitor_ids": (
                        f"Some pulses already sit in {MAX_CIRCUITS_PER_MONITOR} circuits: "
                        + ", ".join(overcrowded[:5])
                    )
                }
            )
        CircuitMembership.objects.bulk_create(
            [CircuitMembership(circuit=circuit, monitor_id=mid) for mid in to_add]
        )
