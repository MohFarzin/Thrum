from datetime import timedelta

from django.db.models import Prefetch
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .keys import assign_new_key
from .models import CheckResult, Monitor
from .serializers import CheckResultSerializer, MonitorSerializer
from .services import run_monitor_check

MAX_FAVORITES = 6

RANGE_DELTAS = {
    "10m": timedelta(minutes=10),
    "1h": timedelta(hours=1),
    "1d": timedelta(days=1),
    "7d": timedelta(days=7),
    "30d": timedelta(days=30),
    "60d": timedelta(days=60),
}


def _bucket_results(rows: list[CheckResult], buckets: int) -> list[dict]:
    """Collapse newest-first rows into chronological buckets for long-range bars."""
    if not rows or buckets < 1:
        return []
    chronological = list(reversed(rows))
    n = len(chronological)
    out: list[dict] = []
    for i in range(buckets):
        start = (i * n) // buckets
        end = ((i + 1) * n) // buckets
        chunk = chronological[start:end]
        if not chunk:
            continue
        fails = sum(1 for r in chunk if not r.success)
        last = chunk[-1]
        if fails == 0:
            success = True
            err = ""
        elif fails == 1 and len(chunk) > 1:
            success = False
            err = "soft fail"
        else:
            success = False
            err = f"{fails}/{len(chunk)} failed"
        latencies = [r.latency_ms for r in chunk if r.latency_ms is not None]
        out.append(
            {
                "id": last.id,
                "checked_at": last.checked_at.isoformat().replace("+00:00", "Z"),
                "success": success,
                "latency_ms": int(sum(latencies) / len(latencies)) if latencies else None,
                "error_message": err,
                "status_code": last.status_code,
            }
        )
    return list(reversed(out))  # newest-first


class MonitorViewSet(viewsets.ModelViewSet):
    serializer_class = MonitorSerializer
    permission_classes = [IsAuthenticated]
    lookup_field = "id"
    lookup_value_regex = r"[0-9a-f-]{36}"

    def get_queryset(self):
        return Monitor.objects.filter(owner=self.request.user).prefetch_related(
            Prefetch(
                "check_results",
                queryset=CheckResult.objects.order_by("-checked_at"),
            )
        )

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)

    @action(detail=True, methods=["post"], url_path="favorite")
    def favorite(self, request, id=None):
        monitor = self.get_object()
        want = request.data.get("is_favorite")
        if want is None:
            want = not monitor.is_favorite
        want = bool(want)
        if want and not monitor.is_favorite:
            count = Monitor.objects.filter(owner=request.user, is_favorite=True).count()
            if count >= MAX_FAVORITES:
                return Response(
                    {"detail": f"You can favorite at most {MAX_FAVORITES} monitors."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            monitor.is_favorite = True
            monitor.favorited_at = timezone.now()
        elif not want and monitor.is_favorite:
            monitor.is_favorite = False
            monitor.favorited_at = None
        monitor.save(update_fields=["is_favorite", "favorited_at", "updated_at"])
        return Response(MonitorSerializer(monitor).data)

    @action(detail=True, methods=["get"], url_path="results")
    def results(self, request, id=None):
        monitor = self.get_object()
        qs = CheckResult.objects.filter(monitor=monitor).order_by("-checked_at")

        range_key = (request.query_params.get("range") or "").strip().lower()
        if range_key in RANGE_DELTAS:
            since = timezone.now() - RANGE_DELTAS[range_key]
            qs = qs.filter(checked_at__gte=since)

        try:
            buckets = int(request.query_params.get("buckets", "0"))
        except ValueError:
            buckets = 0
        buckets = max(0, min(buckets, 120))

        try:
            limit = min(int(request.query_params.get("limit", 50)), 2000)
        except ValueError:
            limit = 50

        if buckets > 0:
            # Pull enough raw points to fill buckets for the selected window.
            rows = list(qs[: max(limit, buckets * 40)])
            return Response(_bucket_results(rows, buckets))

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

    @action(detail=True, methods=["post"], url_path="rotate-key")
    def rotate_key(self, request, id=None):
        monitor = self.get_object()
        if monitor.type != Monitor.Type.HEARTBEAT:
            return Response(
                {"detail": "Only heartbeat monitors have API keys."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        raw = assign_new_key(monitor)
        monitor.save(update_fields=["api_key_prefix", "api_key_hash", "updated_at"])
        data = MonitorSerializer(monitor).data
        data["api_key"] = raw
        return Response(data)
