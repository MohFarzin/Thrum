"""HTTP and TCP probe implementations."""

from __future__ import annotations

import socket
import time
import urllib.error
import urllib.request
from dataclasses import dataclass
from typing import Any
from urllib.parse import urljoin

from .ssrf import assert_safe_http_url, parse_tcp_target

MAX_REDIRECTS = 3
MAX_ERROR_LEN = 480


@dataclass(frozen=True)
class ProbeResult:
    success: bool
    latency_ms: int | None
    status_code: int | None = None
    error_message: str = ""


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):  # noqa: ANN001, ARG002
        return None


def _clip(msg: str) -> str:
    msg = (msg or "").replace("\n", " ").strip()
    return msg[:MAX_ERROR_LEN]


def check_http(url: str, timeout_seconds: int, expected_status: int) -> ProbeResult:
    started = time.monotonic()
    try:
        current = assert_safe_http_url(url)
    except ValueError as exc:
        return ProbeResult(False, None, error_message=_clip(str(exc)))

    timeout = max(1, min(int(timeout_seconds), 120))
    opener = urllib.request.build_opener(_NoRedirect)

    for _ in range(MAX_REDIRECTS + 1):
        try:
            req = urllib.request.Request(
                current,
                method="GET",
                headers={"User-Agent": "THRUM-Checker/1.0", "Accept": "*/*"},
            )
            with opener.open(req, timeout=timeout) as resp:
                code = int(getattr(resp, "status", None) or resp.getcode())
                resp.read(1024)
                latency = int((time.monotonic() - started) * 1000)
                ok = code == int(expected_status)
                return ProbeResult(
                    success=ok,
                    latency_ms=latency,
                    status_code=code,
                    error_message="" if ok else _clip(f"Expected {expected_status}, got {code}"),
                )
        except urllib.error.HTTPError as exc:
            latency = int((time.monotonic() - started) * 1000)
            code = int(exc.code)
            if code in (301, 302, 303, 307, 308):
                loc = exc.headers.get("Location")
                if not loc:
                    return ProbeResult(False, latency, code, _clip("Redirect without Location"))
                try:
                    nxt = urljoin(current, loc)
                    current = assert_safe_http_url(nxt)
                    continue
                except ValueError as verr:
                    return ProbeResult(False, latency, code, _clip(str(verr)))
            ok = code == int(expected_status)
            return ProbeResult(
                success=ok,
                latency_ms=latency,
                status_code=code,
                error_message="" if ok else _clip(f"Expected {expected_status}, got {code}"),
            )
        except Exception as exc:  # noqa: BLE001 — surface as check failure
            latency = int((time.monotonic() - started) * 1000)
            return ProbeResult(False, latency, error_message=_clip(str(exc) or type(exc).__name__))

    return ProbeResult(
        False,
        int((time.monotonic() - started) * 1000),
        error_message="Too many redirects",
    )


def check_tcp(target: str, timeout_seconds: int) -> ProbeResult:
    started = time.monotonic()
    try:
        host, port = parse_tcp_target(target)
    except ValueError as exc:
        return ProbeResult(False, None, error_message=_clip(str(exc)))

    timeout = max(1, min(int(timeout_seconds), 120))
    try:
        with socket.create_connection((host, port), timeout=timeout):
            latency = int((time.monotonic() - started) * 1000)
            return ProbeResult(True, latency)
    except Exception as exc:  # noqa: BLE001
        latency = int((time.monotonic() - started) * 1000)
        return ProbeResult(False, latency, error_message=_clip(str(exc) or type(exc).__name__))


def probe_monitor(monitor: Any) -> ProbeResult:
    if monitor.type == "http":
        return check_http(monitor.target, monitor.timeout_seconds, monitor.expected_status_code)
    if monitor.type == "tcp":
        return check_tcp(monitor.target, monitor.timeout_seconds)
    return ProbeResult(False, None, error_message="Not an HTTP/TCP monitor")
