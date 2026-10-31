from django.contrib.auth import login, logout
from django.core.cache import cache
from django.middleware.csrf import get_token
from django.views.decorators.csrf import ensure_csrf_cookie
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response

from .audit import log_audit
from .models import AuditEvent
from .serializers import LoginSerializer, RegisterSerializer, UserSerializer

LOGIN_LIMIT = 30  # per IP per minute
REGISTER_LIMIT = 10


def _client_ip(request: Request) -> str:
    # Prefer nginx X-Real-IP — never trust leftmost X-Forwarded-For (spoofable).
    real = (request.META.get("HTTP_X_REAL_IP") or "").strip()
    if real:
        return real
    return request.META.get("REMOTE_ADDR") or "unknown"


def _rate_limited(bucket: str, limit: int) -> bool:
    key = f"thrum:auth:{bucket}"
    if cache.add(key, 1, timeout=60):
        return False
    try:
        return cache.incr(key) > limit
    except ValueError:
        cache.set(key, 1, timeout=60)
        return False


@api_view(["GET"])
@permission_classes([AllowAny])
@ensure_csrf_cookie
def csrf(request: Request) -> Response:
    return Response({"csrfToken": get_token(request)})


@api_view(["POST"])
@permission_classes([AllowAny])
def register(request: Request) -> Response:
    if _rate_limited(f"reg:{_client_ip(request)}", REGISTER_LIMIT):
        return Response({"detail": "Too many requests"}, status=status.HTTP_429_TOO_MANY_REQUESTS)
    serializer = RegisterSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    user = serializer.save()
    login(request, user)
    try:
        log_audit(user, AuditEvent.Kind.REGISTER, "Account created")
    except Exception:  # noqa: BLE001
        pass
    return Response(UserSerializer(user).data, status=status.HTTP_201_CREATED)


@api_view(["POST"])
@permission_classes([AllowAny])
def login_view(request: Request) -> Response:
    if _rate_limited(f"login:{_client_ip(request)}", LOGIN_LIMIT):
        return Response({"detail": "Too many requests"}, status=status.HTTP_429_TOO_MANY_REQUESTS)
    serializer = LoginSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    user = serializer.validated_data["user"]
    login(request, user)
    try:
        log_audit(user, AuditEvent.Kind.LOGIN, "Signed in")
    except Exception:  # noqa: BLE001
        pass
    return Response(UserSerializer(user).data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def logout_view(request: Request) -> Response:
    try:
        log_audit(request.user, AuditEvent.Kind.LOGOUT, "Signed out")
    except Exception:  # noqa: BLE001
        pass
    logout(request)
    return Response({"ok": True})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def me(request: Request) -> Response:
    return Response(UserSerializer(request.user).data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def audit_log(request: Request) -> Response:
    """Private audit trail — never exposed on public status pages."""
    qs = AuditEvent.objects.filter(owner=request.user).order_by("-created_at")
    try:
        limit = min(int(request.query_params.get("limit", 100)), 500)
    except ValueError:
        limit = 100
    rows = list(qs[:limit])
    if (request.query_params.get("format") or "").lower() == "csv":
        import csv
        from io import StringIO

        from django.http import HttpResponse

        buf = StringIO()
        w = csv.writer(buf)
        w.writerow(["created_at", "kind", "message", "monitor_id"])
        for r in rows:
            w.writerow(
                [
                    r.created_at.isoformat(),
                    r.kind,
                    r.message,
                    str(r.monitor_id or ""),
                ]
            )
        resp = HttpResponse(buf.getvalue(), content_type="text/csv; charset=utf-8")
        resp["Content-Disposition"] = 'attachment; filename="thrum-audit.csv"'
        return resp
    return Response(
        {
            "visibility": "private",
            "events": [
                {
                    "id": r.id,
                    "kind": r.kind,
                    "message": r.message,
                    "monitor_id": str(r.monitor_id) if r.monitor_id else None,
                    "created_at": r.created_at.isoformat().replace("+00:00", "Z"),
                }
                for r in rows
            ],
        }
    )
