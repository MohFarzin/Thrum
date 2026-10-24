"""Heartbeat ingest — API key auth only (no session / CSRF)."""

from __future__ import annotations

import json

from django.core.cache import cache
from django.http import JsonResponse
from django.utils.decorators import method_decorator
from django.views import View
from django.views.decorators.csrf import csrf_exempt

from apps.monitors.keys import verify_api_key
from apps.monitors.models import Monitor
from apps.monitors.services import record_heartbeat

MAX_BODY = 64 * 1024
RATE_LIMIT = 120  # successful beats per monitor per minute
AUTH_FAIL_LIMIT = 60  # failed auth attempts per monitor per minute


def _extract_key(request) -> str:
    header = request.headers.get("Authorization", "")
    if header.lower().startswith("bearer "):
        return header[7:].strip()
    return (request.headers.get("X-Thrum-Key") or "").strip()


def _over_limit(key: str, limit: int) -> bool:
    if cache.add(key, 1, timeout=60):
        return False
    try:
        return cache.incr(key) > limit
    except ValueError:
        cache.set(key, 1, timeout=60)
        return False


@method_decorator(csrf_exempt, name="dispatch")
class HeartbeatIngestView(View):
    def post(self, request, monitor_id):
        raw = request.body or b""
        if len(raw) > MAX_BODY:
            return JsonResponse({"detail": "Payload too large"}, status=413)

        try:
            monitor = Monitor.objects.get(pk=monitor_id, type=Monitor.Type.HEARTBEAT)
        except (Monitor.DoesNotExist, ValueError):
            return JsonResponse({"detail": "Unauthorized"}, status=401)

        if not monitor.is_enabled:
            return JsonResponse({"detail": "Monitor disabled"}, status=400)

        mid = str(monitor.id)
        api_key = _extract_key(request)
        if not verify_api_key(api_key, monitor.api_key_hash):
            if _over_limit(f"thrum:hb:fail:{mid}", AUTH_FAIL_LIMIT):
                return JsonResponse({"detail": "Rate limit exceeded"}, status=429)
            return JsonResponse({"detail": "Unauthorized"}, status=401)

        if _over_limit(f"thrum:hb:{mid}", RATE_LIMIT):
            return JsonResponse({"detail": "Rate limit exceeded"}, status=429)

        message = ""
        if raw:
            try:
                payload = json.loads(raw.decode("utf-8"))
            except (UnicodeDecodeError, json.JSONDecodeError):
                return JsonResponse({"detail": "Invalid JSON"}, status=400)
            if not isinstance(payload, dict):
                return JsonResponse({"detail": "JSON object required"}, status=400)
            status_val = payload.get("status", "ok")
            if status_val not in (None, "ok", "up"):
                return JsonResponse({"detail": "status must be ok"}, status=400)
            message = str(payload.get("message") or "")[:200]

        record_heartbeat(monitor, message=message)
        return JsonResponse({"ok": True})
