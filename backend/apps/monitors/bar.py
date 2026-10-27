"""Time-aligned availability buckets + uptime % for monitor bars."""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any, Iterable

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

# Long ranges stay fixed; short ranges size slots from the monitor interval.
DEFAULT_BUCKETS: dict[str, int] = {
    "10m": 60,
    "1h": 60,
    "1d": 24,
    "7d": 42,
    "30d": 60,
    "60d": 60,
}

UPTIME_RANGES = ("10m", "1h", "1d", "7d", "30d")


def _iso(dt: datetime) -> str:
    return dt.isoformat().replace("+00:00", "Z")


def cover_seconds(monitor: Monitor) -> int:
    """How long a check 'owns' the timeline until the next expected pulse."""
    interval = max(10, int(monitor.interval_seconds or 60))
    if monitor.type == Monitor.Type.HEARTBEAT:
        grace = max(0, int(monitor.heartbeat_grace_seconds or 0))
        return interval + grace
    return interval


def suggested_buckets(range_key: str, interval_seconds: int) -> int:
    """Short windows: ~one slot per interval. Long windows: fixed defaults."""
    if range_key in ("10m", "1h"):
        delta = RANGE_DELTAS[range_key].total_seconds()
        iv = max(10, int(interval_seconds or 60))
        n = int(round(delta / iv))
        # 10m@60s → 10 slots; keep a small floor so tiny intervals still read well.
        lo = 6 if range_key == "10m" else 12
        return max(lo, min(n, 120))
    return DEFAULT_BUCKETS.get(range_key, 40)


def _seg_from_chunk(
    chunk: list[CheckResult],
    *,
    i: int,
    t0: datetime,
    t1: datetime,
) -> dict[str, Any]:
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
    return {
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


def _empty_seg(i: int, t0: datetime, t1: datetime) -> dict[str, Any]:
    mid = t0 + (t1 - t0) / 2
    return {
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


def _carry_fill(
    segs: list[dict[str, Any]],
    rows: list[CheckResult],
    cover: int,
) -> list[dict[str, Any]]:
    """Paint empty slots covered by the previous check's interval (no false gaps)."""
    if not rows or cover <= 0:
        return segs
    cover_td = timedelta(seconds=cover)
    out: list[dict[str, Any]] = []
    for seg in segs:
        if seg.get("tone") != "empty":
            out.append(seg)
            continue
        t0 = datetime.fromisoformat(seg["bucket_start"].replace("Z", "+00:00"))
        t1 = datetime.fromisoformat(seg["bucket_end"].replace("Z", "+00:00"))
        # Latest check that started before this slot ends and still covers into the slot.
        donor: CheckResult | None = None
        for r in rows:
            if r.checked_at >= t1:
                break
            if r.checked_at < t1 and r.checked_at + cover_td > t0:
                donor = r
        if donor is None:
            out.append(seg)
            continue
        tone = "up" if donor.success else "down"
        out.append(
            {
                "id": donor.id,
                "checked_at": _iso(donor.checked_at),
                "success": donor.success,
                "tone": tone,
                "success_rate": 1.0 if donor.success else 0.0,
                "latency_ms": donor.latency_ms,
                "error_message": "held from last check" if donor.success else (donor.error_message or "held fail"),
                "status_code": donor.status_code,
                "bucket_start": seg["bucket_start"],
                "bucket_end": seg["bucket_end"],
            }
        )
    return out


def time_buckets(
    monitor: Monitor,
    range_key: str,
    buckets: int | None = None,
    rows: Iterable[CheckResult] | None = None,
) -> list[dict[str, Any]]:
    """
    Full-window time slots [now-range, now], newest-first.

    Empty only when no check covers that slot (outside the monitor interval).
    Short ranges size N from interval; 30d/60d use 60 slots.
    """
    delta = RANGE_DELTAS.get(range_key)
    if not delta:
        return []
    if buckets is not None:
        n = max(12, min(int(buckets), 120))
    else:
        n = suggested_buckets(range_key, monitor.interval_seconds)
        n = max(12, min(int(n), 120))

    now = timezone.now()
    since = now - delta
    if rows is None:
        row_list = list(
            CheckResult.objects.filter(monitor=monitor, checked_at__gte=since).order_by(
                "checked_at"
            )
        )
    else:
        row_list = sorted(
            (r for r in rows if r.checked_at >= since),
            key=lambda r: r.checked_at,
        )

    slot = delta / n
    segs: list[dict[str, Any]] = []
    for i in range(n):
        t0 = since + slot * i
        t1 = since + slot * (i + 1)
        if i == n - 1:
            chunk = [r for r in row_list if t0 <= r.checked_at <= t1]
        else:
            chunk = [r for r in row_list if t0 <= r.checked_at < t1]

        if not chunk:
            segs.append(_empty_seg(i, t0, t1))
        else:
            segs.append(_seg_from_chunk(chunk, i=i, t0=t0, t1=t1))

    segs = _carry_fill(segs, row_list, cover_seconds(monitor))
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
