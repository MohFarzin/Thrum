from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import CheckResult, Monitor
from .serializers import CheckResultSerializer, MonitorSerializer
from .services import run_monitor_check


class MonitorViewSet(viewsets.ModelViewSet):
    serializer_class = MonitorSerializer
    permission_classes = [IsAuthenticated]
    lookup_field = "id"
    lookup_value_regex = r"[0-9a-f-]{36}"

    def get_queryset(self):
        return Monitor.objects.filter(owner=self.request.user)

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)

    @action(detail=True, methods=["get"], url_path="results")
    def results(self, request, id=None):
        monitor = self.get_object()
        qs = CheckResult.objects.filter(monitor=monitor).order_by("-checked_at")
        try:
            limit = min(int(request.query_params.get("limit", 50)), 200)
        except ValueError:
            limit = 50
        page = qs[:limit]
        return Response(CheckResultSerializer(page, many=True).data)

    @action(detail=True, methods=["post"], url_path="check")
    def check_now(self, request, id=None):
        monitor = self.get_object()
        if monitor.type not in (Monitor.Type.HTTP, Monitor.Type.TCP):
            return Response(
                {"detail": "Only HTTP and TCP monitors can be checked from the server."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not monitor.is_enabled:
            return Response(
                {"detail": "Monitor is disabled."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        result = run_monitor_check(monitor.id)
        monitor.refresh_from_db()
        return Response(
            {
                "monitor": MonitorSerializer(monitor).data,
                "result": CheckResultSerializer(result).data if result else None,
            }
        )
