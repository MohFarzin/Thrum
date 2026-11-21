from django.contrib.auth import get_user_model, login, logout
from django.contrib.auth.password_validation import validate_password
from django.core.cache import cache
from django.core.exceptions import ValidationError as DjangoValidationError
from django.middleware.csrf import get_token
from django.shortcuts import get_object_or_404
from django.utils.html import escape
from django.views.decorators.csrf import ensure_csrf_cookie
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response

from .audit import log_audit
from .models import AuditEvent, Profile
from .permissions import IsStaffAdmin
from .serializers import (
    AdminSetPasswordSerializer,
    AdminUserSerializer,
    AdminUserUpdateSerializer,
    LoginSerializer,
    RegisterSerializer,
    UserSerializer,
)

User = get_user_model()

LOGIN_LIMIT = 30  # per IP per minute
REGISTER_LIMIT = 10
ADMIN_ACTION_LIMIT = 60


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


def _safe_msg(text: str, limit: int = 200) -> str:
    return escape((text or "").strip())[:limit]


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
        log_audit(user, AuditEvent.Kind.REGISTER, "Account created — pending approval")
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


# —— Staff admin console APIs ——


@api_view(["GET"])
@permission_classes([IsStaffAdmin])
def admin_users(request: Request) -> Response:
    if _rate_limited(f"admin:{request.user.id}", ADMIN_ACTION_LIMIT):
        return Response({"detail": "Too many requests"}, status=status.HTTP_429_TOO_MANY_REQUESTS)
    qs = (
        User.objects.all()
        .select_related("profile")
        .order_by("-date_joined")[:500]
    )
    pending = sum(
        1
        for u in qs
        if not u.is_staff and getattr(getattr(u, "profile", None), "is_approved", False) is False
    )
    return Response(
        {
            "users": AdminUserSerializer(qs, many=True).data,
            "pending_count": pending,
        }
    )


@api_view(["POST"])
@permission_classes([IsStaffAdmin])
def admin_approve_user(request: Request, user_id: int) -> Response:
    if _rate_limited(f"admin:{request.user.id}", ADMIN_ACTION_LIMIT):
        return Response({"detail": "Too many requests"}, status=status.HTTP_429_TOO_MANY_REQUESTS)
    target = get_object_or_404(User.objects.select_related("profile"), pk=user_id)
    profile, _ = Profile.objects.get_or_create(user=target)
    profile.is_approved = True
    profile.save(update_fields=["is_approved", "updated_at"])
    if not target.is_active:
        target.is_active = True
        target.save(update_fields=["is_active"])
    log_audit(
        request.user,
        AuditEvent.Kind.USER_APPROVE,
        f"Approved user id={target.id} ({_safe_msg(target.username)})",
    )
    return Response(AdminUserSerializer(target).data)


def _guard_privileged_target(request: Request, target: User, *, action: str) -> Response | None:
    """Block staff-on-staff / staff-on-superuser abuse unless actor is superuser."""
    if target.id == request.user.id:
        return Response(
            {"detail": f"Cannot {action} your own account."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    if target.is_superuser and not request.user.is_superuser:
        return Response(
            {"detail": f"Only a superuser can {action} a superuser."},
            status=status.HTTP_403_FORBIDDEN,
        )
    if target.is_staff and not request.user.is_superuser:
        return Response(
            {"detail": f"Only a superuser can {action} another admin."},
            status=status.HTTP_403_FORBIDDEN,
        )
    return None


@api_view(["POST"])
@permission_classes([IsStaffAdmin])
def admin_delete_user(request: Request, user_id: int) -> Response:
    if _rate_limited(f"admin:{request.user.id}", ADMIN_ACTION_LIMIT):
        return Response({"detail": "Too many requests"}, status=status.HTTP_429_TOO_MANY_REQUESTS)
    target = get_object_or_404(User.objects.select_related("profile"), pk=user_id)
    blocked = _guard_privileged_target(request, target, action="delete")
    if blocked:
        return blocked
    uid = target.id
    uname = target.username
    target.delete()
    log_audit(
        request.user,
        AuditEvent.Kind.USER_DELETE,
        f"Deleted user id={uid} ({_safe_msg(uname)})",
    )
    return Response({"ok": True, "user_id": uid})


@api_view(["POST"])
@permission_classes([IsStaffAdmin])
def admin_set_password(request: Request, user_id: int) -> Response:
    if _rate_limited(f"admin:{request.user.id}", ADMIN_ACTION_LIMIT):
        return Response({"detail": "Too many requests"}, status=status.HTTP_429_TOO_MANY_REQUESTS)
    target = get_object_or_404(User, pk=user_id)
    # Allow self password reset; block peer-admin / superuser takeover for non-superusers.
    if target.id != request.user.id:
        blocked = _guard_privileged_target(request, target, action="set the password for")
        if blocked:
            return blocked
    ser = AdminSetPasswordSerializer(data=request.data)
    ser.is_valid(raise_exception=True)
    password = ser.validated_data["password"]
    try:
        validate_password(password, user=target)
    except DjangoValidationError as exc:
        return Response({"password": list(exc.messages)}, status=status.HTTP_400_BAD_REQUEST)
    target.set_password(password)
    target.save(update_fields=["password"])
    log_audit(
        request.user,
        AuditEvent.Kind.USER_PASSWORD,
        f"Set password for user id={target.id} ({_safe_msg(target.username)})",
    )
    return Response({"ok": True, "user_id": target.id})


@api_view(["PATCH"])
@permission_classes([IsStaffAdmin])
def admin_update_user(request: Request, user_id: int) -> Response:
    if _rate_limited(f"admin:{request.user.id}", ADMIN_ACTION_LIMIT):
        return Response({"detail": "Too many requests"}, status=status.HTTP_429_TOO_MANY_REQUESTS)
    target = get_object_or_404(User.objects.select_related("profile"), pk=user_id)
    ser = AdminUserUpdateSerializer(data=request.data, partial=True)
    ser.is_valid(raise_exception=True)
    data = ser.validated_data

    if "email" in data:
        target.email = (data["email"] or "").strip()[:254]

    if "is_active" in data:
        if data["is_active"] is False:
            blocked = _guard_privileged_target(request, target, action="deactivate")
            if blocked:
                return blocked
        target.is_active = bool(data["is_active"])

    if "is_staff" in data:
        # Only superusers may grant/revoke staff.
        if not request.user.is_superuser:
            return Response(
                {"detail": "Only a superuser can change admin (staff) status."},
                status=status.HTTP_403_FORBIDDEN,
            )
        if target.id == request.user.id and data["is_staff"] is False:
            return Response(
                {"detail": "Cannot remove your own admin flag."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        target.is_staff = bool(data["is_staff"])

    target.save()

    if "is_approved" in data:
        profile, _ = Profile.objects.get_or_create(user=target)
        profile.is_approved = bool(data["is_approved"]) or bool(target.is_staff)
        profile.save(update_fields=["is_approved", "updated_at"])

    log_audit(
        request.user,
        AuditEvent.Kind.USER_UPDATE,
        f"Updated user id={target.id} ({_safe_msg(target.username)})",
    )
    target.refresh_from_db()
    return Response(AdminUserSerializer(target).data)
