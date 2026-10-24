"""Time-aligned availability buckets + uptime % for monitor bars."""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any

from django.utils import timezone

from .models import CheckResult, Monitor

RANGE_DELTAS: dict[str, timedelta] = {
    "10m": timedelta(minutes=10),
    "1h": timedelta(hours=1),
    "1d": timedelta(days=1),
    "7d": timedelta(days=7),
    "30d": timedelta(days=30),
    "60d": timedelta(days=60),
}

# Wall-clock slots per range (right edge = now).
DEFAULT_BUCKETS: dict[str, int] = {
    "10m": 20,
    "1h": 60,
    "1d": 48,
    "7d": 42,
    "30d": 30,
    "60d": 30,
}

UPTIME_RANGES = ("10m", "1h", "1d", "7d", "30d")


def _iso(dt: datetime) -> str:
    return dt.isoformat().replace("+00:00", "Z")


def time_buckets(
    monitor: Monitor,
    range_key: str,
    buckets: int | None = None,
) -> list[dict[str, Any]]:
    """
    Build chronological then newest-first segments covering [now-range, now].

    Empty slots before the monitor had any check are omitted from the left
    (no fake 'No check yet' padding). Gaps after monitoring started are
    tone=empty. Checks classify as up / warn (1 fail) / down (2+ fails).
    """
    delta = RANGE_DELTAS.get(range_key)
    if not delta:
        return []
    n = buckets or DEFAULT_BUCKETS.get(range_key, 40)
    n = max(4, min(int(n), 120))

    now = timezone.now()
    since = now - delta
    rows = list(
        CheckResult.objects.filter(monitor=monitor, checked_at__gte=since).order_by(
            "checked_at"
        )
    )
    first_ever = (
        CheckResult.objects.filter(monitor=monitor)
        .order_by("checked_at")
        .values_list("checked_at", flat=True)
        .first()
    )
    start_floor = monitor.created_at
    if first_ever and first_ever > start_floor:
        start_floor = first_ever

    slot = delta / n
    segs: list[dict[str, Any]] = []
    for i in range(n):
        t0 = since + slot * i
        t1 = since + slot * (i + 1)
        chunk = [r for r in rows if t0 <= r.checked_at < t1]
        # Last slot includes `now` edge.
        if i == n - 1:
            chunk = [r for r in rows if t0 <= r.checked_at <= t1]

        if not chunk:
            if t1 <= start_floor:
                # Before this monitor had data — skip (no left padding).
                continue
            segs.append(
                {
                    "id": -(i + 1),
                    "checked_at": _iso(t0 + (t1 - t0) / 2),
                    "success": None,
                    "tone": "empty",
                    "latency_ms": None,
                    "error_message": "",
                    "status_code": None,
                    "bucket_start": _iso(t0),
                    "bucket_end": _iso(t1),
                }
            )
            continue

        fails = sum(1 for r in chunk if not r.success)
        last = chunk[-1]
        if fails == 0:
            tone = "up"
            success: bool | None = True
            err = ""
        elif fails == 1:
            tone = "warn"
            success = False
            err = "soft fail"
        else:
            tone = "down"
            success = False
            err = f"{fails}/{len(chunk)} failed"
        latencies = [r.latency_ms for r in chunk if r.latency_ms is not None]
        segs.append(
            {
                "id": last.id,
                "checked_at": _iso(last.checked_at),
                "success": success,
                "tone": tone,
                "latency_ms": int(sum(latencies) / len(latencies)) if latencies else None,
                "error_message": err,
                "status_code": last.status_code,
                "bucket_start": _iso(t0),
                "bucket_end": _iso(t1),
            }
        )

    return list(reversed(segs))  # newest-first for the UI


def uptime_pct(monitor: Monitor, range_key: str) -> float | None:
    delta = RANGE_DELTAS.get(range_key)
    if not delta:
        return None
    since = timezone.now() - delta
    qs = CheckResult.objects.filter(monitor=monitor, checked_at__gte=since)
    total = qs.count()
    if total == 0:
        return None
    ok = qs.filter(success=True).count()
    return round(100.0 * ok / total, 1)


def uptime_summary(monitor: Monitor) -> dict[str, float | None]:
    return {key: uptime_pct(monitor, key) for key in UPTIME_RANGES}
