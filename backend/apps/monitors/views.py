from datetime import timedelta

from django.db.models import Prefetch
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import AllowAny

from apps.accounts.permissions import IsApproved
from rest_framework.response import Response

from .bar import (
    DEFAULT_BUCKETS,
    RANGE_DELTAS,
    health_for_monitor_ids,
    health_slice,
    incident_log,
    time_buckets,
    uptime_summary,
)
from .keys import assign_new_key
from .models import CheckResult, Circuit, Monitor
from .serializers import (
    CheckResultSerializer,
    CircuitSerializer,
    MonitorSerializer,
)
from .services import run_monitor_check

MAX_FAVORITES = 6
# List/dashboard bars only need ~1h of history — never prefetch the full retention window.
LIST_RESULTS_WINDOW = timedelta(hours=1)
LIST_RESULTS_CAP = 60


class MonitorViewSet(viewsets.ModelViewSet):
    serializer_class = MonitorSerializer
    permission_classes = [IsApproved]
    lookup_field = "id"
    lookup_value_regex = r"[0-9a-f-]{36}"

    def get_queryset(self):
        qs = Monitor.objects.filter(owner=self.request.user).prefetch_related("circuits")
        # Pulse dashboard: only monitors not in any circuit.
        if self.action == "list" and self.request.query_params.get("unassigned") in (
            "1",
            "true",
            "yes",
        ):
            qs = qs.filter(circuits__isnull=True)
        # Detail/update don't need embedded recent_results; list/retrieve do for bars.
        if self.action in ("list", "retrieve"):
            since = timezone.now() - LIST_RESULTS_WINDOW
            qs = qs.prefetch_related(
                Prefetch(
                    "check_results",
                    queryset=CheckResult.objects.filter(checked_at__gte=since)
                    .order_by("-checked_at")
                    .only("id", "monitor_id", "checked_at", "success"),
                )
            )
        return qs

    def perform_create(self, serializer):
        monitor = serializer.save(owner=self.request.user)
        try:
            from apps.accounts.audit import log_audit
            from apps.accounts.models import AuditEvent

            log_audit(
                self.request.user,
                AuditEvent.Kind.MONITOR_CREATE,
                f"Created {monitor.type} monitor “{monitor.name}”",
                monitor_id=monitor.id,
            )
        except Exception:  # noqa: BLE001
            pass

    def perform_update(self, serializer):
        monitor = serializer.save()
        try:
            from apps.accounts.audit import log_audit
            from apps.accounts.models import AuditEvent

            log_audit(
                self.request.user,
                AuditEvent.Kind.MONITOR_UPDATE,
                f"Updated monitor “{monitor.name}”",
                monitor_id=monitor.id,
            )
        except Exception:  # noqa: BLE001
            pass

    def perform_destroy(self, instance):
        name, mid = instance.name, instance.id
        instance.delete()
        try:
            from apps.accounts.audit import log_audit
            from apps.accounts.models import AuditEvent

            log_audit(
                self.request.user,
                AuditEvent.Kind.MONITOR_DELETE,
                f"Deleted monitor “{name}”",
                monitor_id=mid,
            )
        except Exception:  # noqa: BLE001
            pass

    @action(detail=False, methods=["get"], url_path="fleet-health")
    def fleet_health(self, request):
        """Aggregate up/down for ungrouped pulses (not in any circuit)."""
        range_key = (request.query_params.get("range") or "1d").strip().lower()
        if range_key not in DEFAULT_BUCKETS:
            range_key = "1d"
        ids = list(
            Monitor.objects.filter(owner=request.user, circuits__isnull=True)
            .values_list("id", flat=True)[:500]
        )
        return Response(health_for_monitor_ids(ids, range_key))

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

        # Time-aligned bar: ?range=10m&bar=1  (or &buckets=N). Omit buckets → interval-sized.
        if range_key in DEFAULT_BUCKETS and (want_bar or buckets_raw is not None):
            buckets = None
            if buckets_raw not in (None, ""):
                try:
                    buckets = max(12, min(int(buckets_raw), 120))
                except ValueError:
                    buckets = None
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
        range_key = (request.query_params.get("range") or "1d").strip().lower()
        if range_key not in DEFAULT_BUCKETS:
            range_key = "1d"
        return Response(
            {
                "summary": uptime_summary(monitor),
                "health": health_slice(monitor, range_key),
            }
        )

    @action(detail=True, methods=["get"], url_path="incidents")
    def incidents(self, request, id=None):
        monitor = self.get_object()
        range_key = (request.query_params.get("range") or "7d").strip().lower()
        if range_key not in DEFAULT_BUCKETS:
            range_key = "7d"
        return Response(
            {
                "range": range_key,
                "incidents": incident_log(monitor, range_key),
                "health": health_slice(monitor, range_key),
            }
        )

    @action(detail=True, methods=["post"], url_path="share")
    def share(self, request, id=None):
        """Enable / disable public status page, or rotate the share slug."""
        import secrets

        from apps.accounts.audit import log_audit
        from apps.accounts.models import AuditEvent

        monitor = self.get_object()
        if request.data.get("rotate_slug"):
            monitor.public_slug = secrets.token_urlsafe(9)
            monitor.is_public = True
            monitor.save(update_fields=["is_public", "public_slug", "updated_at"])
            try:
                log_audit(
                    request.user,
                    AuditEvent.Kind.SHARE_ON,
                    f"Rotated share link for “{monitor.name}”",
                    monitor_id=monitor.id,
                )
            except Exception:  # noqa: BLE001
                pass
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
        try:
            log_audit(
                request.user,
                AuditEvent.Kind.SHARE_ON if want else AuditEvent.Kind.SHARE_OFF,
                f"{'Enabled' if want else 'Disabled'} public share for “{monitor.name}”",
                monitor_id=monitor.id,
            )
        except Exception:  # noqa: BLE001
            pass
        return Response(MonitorSerializer(monitor).data)

    @action(detail=True, methods=["post"], url_path="check")
    def check_now(self, request, id=None):
        monitor = self.get_object()
        if monitor.type not in (Monitor.Type.HTTP, Monitor.Type.TCP, Monitor.Type.UDP):
            return Response(
                {"detail": "Only HTTP, TCP, and UDP monitors can be checked from the server."},
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


class CircuitViewSet(viewsets.ModelViewSet):
    serializer_class = CircuitSerializer
    permission_classes = [IsApproved]
    lookup_field = "id"
    lookup_value_regex = r"[0-9a-f-]{36}"
    http_method_names = ["get", "post", "put", "patch", "delete", "head", "options"]

    def get_queryset(self):
        return Circuit.objects.filter(owner=self.request.user).prefetch_related("monitors")

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        range_key = (self.request.query_params.get("range") or "1d").strip().lower()
        if range_key not in DEFAULT_BUCKETS:
            range_key = "1d"
        ctx["health_range"] = range_key
        return ctx

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)

    @action(detail=True, methods=["get"], url_path="health")
    def health(self, request, id=None):
        circuit = self.get_object()
        range_key = (request.query_params.get("range") or "1d").strip().lower()
        if range_key not in DEFAULT_BUCKETS:
            range_key = "1d"
        ids = list(circuit.monitors.values_list("id", flat=True)[:500])
        return Response(health_for_monitor_ids(ids, range_key))

    @action(detail=True, methods=["get"], url_path="members")
    def members(self, request, id=None):
        """Circuit pulses with availability bars for the selected range (private view)."""
        circuit = self.get_object()
        range_key = (request.query_params.get("range") or "1h").strip().lower()
        if range_key not in DEFAULT_BUCKETS:
            range_key = "1h"
        rows = []
        for m in circuit.monitors.all()[:200]:
            rows.append(
                {
                    "id": str(m.id),
                    "name": m.name,
                    "type": m.type,
                    "status": m.status,
                    "is_enabled": m.is_enabled,
                    "interval_seconds": m.interval_seconds,
                    "last_checked_at": m.last_checked_at,
                    "bar": time_buckets(m, range_key),
                }
            )
        return Response({"range": range_key, "monitors": rows})

    @action(detail=True, methods=["post"], url_path="share")
    def share(self, request, id=None):
        """Enable / disable public circuit stats, rotate slug, or set show_graph."""
        import secrets

        from apps.accounts.audit import log_audit
        from apps.accounts.models import AuditEvent

        circuit = self.get_object()
        update_fields: list[str] = ["updated_at"]

        if "show_graph" in request.data:
            circuit.public_show_graph = bool(request.data.get("show_graph"))
            update_fields.append("public_show_graph")

        if request.data.get("rotate_slug"):
            circuit.public_slug = secrets.token_urlsafe(9)
            circuit.is_public = True
            update_fields.extend(["is_public", "public_slug"])
            circuit.save(update_fields=list(dict.fromkeys(update_fields)))
            try:
                log_audit(
                    request.user,
                    AuditEvent.Kind.SHARE_ON,
                    f"Rotated public share for circuit “{circuit.name}”",
                )
            except Exception:  # noqa: BLE001
                pass
            return Response(CircuitSerializer(circuit, context=self.get_serializer_context()).data)

        if "is_public" in request.data:
            want = bool(request.data.get("is_public"))
            if want and not circuit.public_slug:
                circuit.public_slug = secrets.token_urlsafe(9)
                update_fields.append("public_slug")
            circuit.is_public = want
            update_fields.append("is_public")
            circuit.save(update_fields=list(dict.fromkeys(update_fields)))
            try:
                log_audit(
                    request.user,
                    AuditEvent.Kind.SHARE_ON if want else AuditEvent.Kind.SHARE_OFF,
                    f"{'Enabled' if want else 'Disabled'} public share for circuit “{circuit.name}”",
                )
            except Exception:  # noqa: BLE001
                pass
            return Response(CircuitSerializer(circuit, context=self.get_serializer_context()).data)

        if "show_graph" in request.data:
            circuit.save(update_fields=list(dict.fromkeys(update_fields)))
            return Response(CircuitSerializer(circuit, context=self.get_serializer_context()).data)

        return Response(
            {"detail": "Provide is_public, show_graph, or rotate_slug."},
            status=status.HTTP_400_BAD_REQUEST,
        )


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
            # Intentionally omit target — share links must not leak internal hosts/URLs.
            "status": monitor.status,
            "last_checked_at": monitor.last_checked_at,
            "interval_seconds": monitor.interval_seconds,
            "range": range_key,
            "bar": time_buckets(monitor, range_key),
            "uptime": uptime_summary(monitor),
            "health": health_slice(monitor, range_key),
            "incidents": incident_log(monitor, range_key),
            "visibility": "public",
        }
    )


@api_view(["GET"])
@permission_classes([AllowAny])
def public_circuit_status(request, slug: str):
    """Public circuit stats — status (+ optional bars). Never targets/keys."""
    try:
        circuit = Circuit.objects.prefetch_related("monitors").get(
            public_slug=slug, is_public=True
        )
    except Circuit.DoesNotExist:
        return Response({"detail": "Not found"}, status=status.HTTP_404_NOT_FOUND)

    range_key = (request.query_params.get("range") or "1d").strip().lower()
    if range_key not in DEFAULT_BUCKETS:
        range_key = "1d"

    members = list(circuit.monitors.all()[:200])
    ids = [m.id for m in members]
    up_now = sum(1 for m in members if m.status == Monitor.Status.UP)
    down_now = sum(1 for m in members if m.status == Monitor.Status.DOWN)
    unknown_now = sum(1 for m in members if m.status == Monitor.Status.UNKNOWN)
    show_graph = bool(circuit.public_show_graph)

    monitor_rows = []
    for m in members:
        row: dict = {
            "name": m.name,
            "type": m.type,
            "status": m.status,
            "is_enabled": m.is_enabled,
        }
        if show_graph:
            row["bar"] = time_buckets(m, range_key)
        monitor_rows.append(row)

    return Response(
        {
            "name": circuit.name,
            "description": circuit.description,
            "range": range_key,
            "show_graph": show_graph,
            "health": health_for_monitor_ids(ids, range_key),
            "counts": {
                "total": len(members),
                "up": up_now,
                "down": down_now,
                "unknown": unknown_now,
            },
            "monitors": monitor_rows,
            "visibility": "public",
        }
    )
