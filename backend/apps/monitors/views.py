from django.db.models import Prefetch
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from .bar import DEFAULT_BUCKETS, RANGE_DELTAS, time_buckets, uptime_summary
from .keys import assign_new_key
from .models import CheckResult, Monitor
from .serializers import CheckResultSerializer, MonitorSerializer
from .services import run_monitor_check

MAX_FAVORITES = 6


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
        range_key = (request.query_params.get("range") or "").strip().lower()
        want_bar = request.query_params.get("bar") in ("1", "true", "yes")
        buckets_raw = request.query_params.get("buckets")

        # Time-aligned bar: ?range=10m&bar=1  (or &buckets=N)
        if range_key in DEFAULT_BUCKETS and (want_bar or buckets_raw is not None):
            try:
                buckets = int(buckets_raw) if buckets_raw not in (None, "") else 0
            except ValueError:
                buckets = 0
            if buckets <= 0:
                buckets = DEFAULT_BUCKETS[range_key]
            return Response(time_buckets(monitor, range_key, buckets))

        qs = CheckResult.objects.filter(monitor=monitor).order_by("-checked_at")
        if range_key in RANGE_DELTAS:
            qs = qs.filter(checked_at__gte=timezone.now() - RANGE_DELTAS[range_key])
        try:
            limit = min(int(request.query_params.get("limit", 50)), 2000)
        except ValueError:
            limit = 50
        return Response(CheckResultSerializer(qs[:limit], many=True).data)

    @action(detail=True, methods=["get"], url_path="uptime")
    def uptime(self, request, id=None):
        monitor = self.get_object()
        return Response(uptime_summary(monitor))

    @action(detail=True, methods=["post"], url_path="share")
    def share(self, request, id=None):
        """Enable / disable public status page, or rotate the share slug."""
        import secrets

        monitor = self.get_object()
        if request.data.get("rotate_slug"):
            monitor.public_slug = secrets.token_urlsafe(9)
            monitor.is_public = True
            monitor.save(update_fields=["is_public", "public_slug", "updated_at"])
            return Response(MonitorSerializer(monitor).data)

        want = request.data.get("is_public")
        if want is None:
            want = not monitor.is_public
        want = bool(want)
        if want:
            if not monitor.public_slug:
                monitor.public_slug = secrets.token_urlsafe(9)
            monitor.is_public = True
        else:
            monitor.is_public = False
        monitor.save(update_fields=["is_public", "public_slug", "updated_at"])
        return Response(MonitorSerializer(monitor).data)

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


@api_view(["GET"])
@permission_classes([AllowAny])
def public_status(request, slug: str):
    """Public share page data — status + bar + uptime only (no keys / owner)."""
    try:
        monitor = Monitor.objects.get(public_slug=slug, is_public=True)
    except Monitor.DoesNotExist:
        return Response({"detail": "Not found"}, status=status.HTTP_404_NOT_FOUND)

    range_key = (request.query_params.get("range") or "1h").strip().lower()
    if range_key not in DEFAULT_BUCKETS:
        range_key = "1h"

    return Response(
        {
            "name": monitor.name,
            "type": monitor.type,
            "target": monitor.target,
            "status": monitor.status,
            "last_checked_at": monitor.last_checked_at,
            "interval_seconds": monitor.interval_seconds,
            "range": range_key,
            "bar": time_buckets(monitor, range_key),
            "uptime": uptime_summary(monitor),
        }
    )
