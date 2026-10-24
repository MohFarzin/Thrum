from rest_framework import serializers

from .models import AlertChannel

_SECRET_KEYS = ("smtp_password",)


class AlertChannelSerializer(serializers.ModelSerializer):
    class Meta:
        model = AlertChannel
        fields = [
            "id",
            "name",
            "type",
            "config",
            "is_enabled",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def validate(self, attrs):
        channel_type = attrs.get("type") or getattr(self.instance, "type", None)
        config = attrs.get("config")
        if config is None and self.instance is not None:
            config = dict(self.instance.config or {})
        else:
            config = dict(config or {})

        if channel_type == AlertChannel.Type.EMAIL:
            if not (config.get("to") or "").strip():
                raise serializers.ValidationError({"config": "Email channels need config.to"})
            # Allow channel SMTP or server EMAIL_HOST at send time.
        elif channel_type == AlertChannel.Type.DISCORD:
            url = (config.get("webhook_url") or "").strip()
            if not url.startswith("https://"):
                raise serializers.ValidationError(
                    {"config": "Discord channels need https config.webhook_url"}
                )
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
        data["config"] = cfg
        return data
