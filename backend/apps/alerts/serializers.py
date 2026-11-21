from urllib.parse import urlparse

from rest_framework import serializers

from apps.monitors.models import Circuit

from .models import AlertChannel

_SECRET_KEYS = ("smtp_password", "webhook_url")
_DISCORD_HOST_SUFFIXES = (".discord.com", ".discordapp.com")


def _discord_webhook_ok(url: str) -> bool:
    host = (urlparse(url).hostname or "").lower()
    if host in ("discord.com", "discordapp.com"):
        return True
    return any(host.endswith(suf) for suf in _DISCORD_HOST_SUFFIXES)


class AlertChannelSerializer(serializers.ModelSerializer):
    circuit = serializers.PrimaryKeyRelatedField(
        queryset=Circuit.objects.all(),
        allow_null=True,
        required=False,
    )

    class Meta:
        model = AlertChannel
        fields = [
            "id",
            "name",
            "type",
            "circuit",
            "config",
            "is_enabled",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        request = self.context.get("request")
        if request and getattr(request, "user", None) and request.user.is_authenticated:
            self.fields["circuit"].queryset = Circuit.objects.filter(owner=request.user)
        else:
            self.fields["circuit"].queryset = Circuit.objects.none()

    def validate(self, attrs):
        channel_type = attrs.get("type") or getattr(self.instance, "type", None)
        config = attrs.get("config")
        if config is None and self.instance is not None:
            config = dict(self.instance.config or {})
        else:
            config = dict(config or {})

        circuit = attrs.get("circuit", getattr(self.instance, "circuit", None))
        if circuit is not None:
            # Circuit-bound channels are Discord-only for now.
            if channel_type != AlertChannel.Type.DISCORD:
                raise serializers.ValidationError(
                    {"type": "Circuit alerts are Discord webhooks only."}
                )
            request = self.context.get("request")
            if request and circuit.owner_id != request.user.id:
                raise serializers.ValidationError({"circuit": "Circuit not found."})

        if channel_type == AlertChannel.Type.EMAIL:
            if not (config.get("to") or "").strip():
                raise serializers.ValidationError({"config": "Email channels need config.to"})
        elif channel_type == AlertChannel.Type.DISCORD:
            url = (config.get("webhook_url") or "").strip()
            if not url.startswith("https://") or not _discord_webhook_ok(url):
                raise serializers.ValidationError(
                    {"config": "Discord channels need an https discord.com / discordapp.com webhook_url"}
                )
            config["webhook_url"] = url
        attrs["config"] = config
        return attrs

    def update(self, instance, validated_data):
        incoming = validated_data.get("config")
        if incoming is not None:
            merged = dict(instance.config or {})
            for key, val in incoming.items():
                if key in _SECRET_KEYS and (val is None or val == "" or val == "********"):
                    continue
                merged[key] = val
            validated_data["config"] = merged
        return super().update(instance, validated_data)

    def to_representation(self, instance):
        data = super().to_representation(instance)
        cfg = dict(data.get("config") or {})
        if cfg.get("smtp_password"):
            cfg["smtp_password"] = "********"
            cfg["smtp_password_set"] = True
        else:
            cfg["smtp_password_set"] = False
        if cfg.get("webhook_url"):
            cfg["webhook_url"] = "********"
            cfg["webhook_url_set"] = True
        else:
            cfg["webhook_url_set"] = False
        data["config"] = cfg
        return data
