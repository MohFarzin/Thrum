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

# Always emit this many wall-clock slots (oldest → … → now).
# 10m≈20s/slot, 1h=1m, 1d=1h, 1w≈4h, 30d=1d — keeps bars skinny and even.
DEFAULT_BUCKETS: dict[str, int] = {
    # 10s cadence → 10m = 60 slots; 1h stays 60 (1m); longer ranges unchanged.
    "10m": 60,
    "1h": 60,
    "1d": 24,
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
    Full-window time slots [now-range, now], newest-first.

    Always returns N segments (never collapses to 1–2 fat blocks).
    Empty slots = tone empty (dim). Partials use success_rate 0..1 for green strength.
    """
    delta = RANGE_DELTAS.get(range_key)
    if not delta:
        return []
    n = buckets or DEFAULT_BUCKETS.get(range_key, 40)
    n = max(12, min(int(n), 120))

    now = timezone.now()
    since = now - delta
    rows = list(
        CheckResult.objects.filter(monitor=monitor, checked_at__gte=since).order_by(
            "checked_at"
        )
    )

    slot = delta / n
    segs: list[dict[str, Any]] = []
    for i in range(n):
        t0 = since + slot * i
        t1 = since + slot * (i + 1)
        if i == n - 1:
            chunk = [r for r in rows if t0 <= r.checked_at <= t1]
        else:
            chunk = [r for r in rows if t0 <= r.checked_at < t1]

        mid = t0 + (t1 - t0) / 2
        if not chunk:
            segs.append(
                {
                    "id": -(i + 1),
                    "checked_at": _iso(mid),
                    "success": None,
                    "tone": "empty",
                    "success_rate": None,
                    "latency_ms": None,
                    "error_message": "",
                    "status_code": None,
                    "bucket_start": _iso(t0),
                    "bucket_end": _iso(t1),
                }
            )
            continue

        total = len(chunk)
        ok = sum(1 for r in chunk if r.success)
        fails = total - ok
        rate = ok / total
        last = chunk[-1]
        if fails == 0:
            tone = "up"
            success: bool | None = True
            err = f"{ok}/{total} ok"
        elif ok == 0:
            tone = "down" if fails >= 2 else "warn"
            success = False
            err = f"0/{total} ok"
        elif rate >= 0.8:
            tone = "up"
            success = True
            err = f"{ok}/{total} ok"
        elif fails == 1:
            tone = "warn"
            success = False
            err = f"{ok}/{total} ok"
        else:
            tone = "down"
            success = False
            err = f"{ok}/{total} ok"

        latencies = [r.latency_ms for r in chunk if r.latency_ms is not None]
        segs.append(
            {
                "id": last.id,
                "checked_at": _iso(last.checked_at),
                "success": success,
                "tone": tone,
                "success_rate": round(rate, 3),
                "latency_ms": int(sum(latencies) / len(latencies)) if latencies else None,
                "error_message": err,
                "status_code": last.status_code,
                "bucket_start": _iso(t0),
                "bucket_end": _iso(t1),
            }
        )

    return list(reversed(segs))  # newest-first


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
