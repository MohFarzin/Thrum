from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .dispatch import build_alert_copy
from .models import AlertChannel, AlertEvent
from .serializers import AlertChannelSerializer
from .senders import get_sender
from apps.monitors.models import Monitor


class AlertChannelViewSet(viewsets.ModelViewSet):
    serializer_class = AlertChannelSerializer
    permission_classes = [IsAuthenticated]
    lookup_field = "id"
    lookup_value_regex = r"[0-9a-f-]{36}"

    def get_queryset(self):
        return AlertChannel.objects.filter(owner=self.request.user)

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)

    @action(detail=True, methods=["post"], url_path="test")
    def test_send(self, request, id=None):
        channel = self.get_object()
        monitor = (
            Monitor.objects.filter(owner=request.user).order_by("-updated_at").first()
        )
        if monitor is None:
            # Synthetic copy without a monitor row
            subject = "TEST · THRUM"
            body = (
                "This is a test alert from THRUM.\n\n"
                "If you received this, the channel is wired correctly."
            )
            kind = "up"
        else:
            subject, body = build_alert_copy(monitor, "up")
            subject = f"TEST · {subject}"
            kind = "up"

        event = AlertEvent(monitor=monitor, channel=channel, kind="up") if monitor else None
        try:
            get_sender(channel.type).send(
                subject=subject,
                body=body,
                config=channel.config or {},
                kind=kind,
            )
            if event is not None:
                event.success = True
                event.save()
            return Response({"ok": True})
        except Exception as exc:  # noqa: BLE001
            if event is not None:
                event.success = False
                event.error = str(exc)[:500]
                event.save()
            return Response({"detail": str(exc)[:300]}, status=status.HTTP_400_BAD_REQUEST)
