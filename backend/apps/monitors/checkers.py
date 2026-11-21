"""HTTP, TCP, and UDP probe implementations."""

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


def _http_headers(authorization: str = "") -> dict[str, str]:
    headers = {"User-Agent": "THRUM-Checker/1.0", "Accept": "*/*"}
    auth = (authorization or "").strip()
    if auth:
        headers["Authorization"] = auth[:512]
    return headers


def _assert_link_ok_body(raw: bytes) -> str | None:
    """Return error message if JSON link_ok is missing/false; None if OK."""
    import json

    try:
        data = json.loads(raw.decode("utf-8", errors="replace"))
    except (UnicodeDecodeError, json.JSONDecodeError, ValueError):
        return "Expected JSON with link_ok"
    if not isinstance(data, dict):
        return "Expected JSON object with link_ok"
    if data.get("link_ok") is True:
        # Optional handshake age when present
        wg = data.get("wireguard") if isinstance(data.get("wireguard"), dict) else {}
        age = wg.get("handshake_age_seconds")
        try:
            if age is not None and int(age) > 90:
                return f"WG link stale — handshake_age_seconds={int(age)}"
        except (TypeError, ValueError):
            pass
        return None
    return "WG link broken — link_ok is not true"


def check_http(
    url: str,
    timeout_seconds: int,
    expected_status: int,
    *,
    authorization: str = "",
    assert_link_ok: bool = False,
) -> ProbeResult:
    started = time.monotonic()
    try:
        current = assert_safe_http_url(url)
    except ValueError as exc:
        return ProbeResult(False, None, error_message=_clip(str(exc)))

    timeout = max(1, min(int(timeout_seconds), 120))
    opener = urllib.request.build_opener(_NoRedirect)
    headers = _http_headers(authorization)

    for _ in range(MAX_REDIRECTS + 1):
        try:
            req = urllib.request.Request(
                current,
                method="GET",
                headers=headers,
            )
            with opener.open(req, timeout=timeout) as resp:
                code = int(getattr(resp, "status", None) or resp.getcode())
                body = resp.read(65536)
                latency = int((time.monotonic() - started) * 1000)
                if code != int(expected_status):
                    return ProbeResult(
                        False,
                        latency,
                        code,
                        _clip(f"Expected {expected_status}, got {code}"),
                    )
                if assert_link_ok:
                    link_err = _assert_link_ok_body(body)
                    if link_err:
                        return ProbeResult(False, latency, code, _clip(link_err))
                return ProbeResult(True, latency, code, "")
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
            if code == int(expected_status) and assert_link_ok:
                try:
                    body = exc.read(65536)
                except Exception:  # noqa: BLE001
                    body = b""
                link_err = _assert_link_ok_body(body)
                if link_err:
                    return ProbeResult(False, latency, code, _clip(link_err))
                return ProbeResult(True, latency, code, "")
            return ProbeResult(
                False,
                latency,
                code,
                _clip(f"Expected {expected_status}, got {code}"),
            )
        except Exception as exc:  # noqa: BLE001 — surface as check failure
            latency = int((time.monotonic() - started) * 1000)
            return ProbeResult(False, latency, error_message=_clip(str(exc) or type(exc).__name__))

    return ProbeResult(
        False,
        int((time.monotonic() - started) * 1000),
        error_message="Too many redirects",
    )


def _port_unreachable_message(exc: BaseException, *, host: str, port: int) -> str:
    """Human label when TCP/UDP cannot reach the port."""
    raw = str(exc) or type(exc).__name__
    low = raw.lower()
    if isinstance(exc, ConnectionRefusedError) or "111" in raw or "refused" in low:
        return f"Port {port} unreachable — connection refused"
    if isinstance(exc, TimeoutError) or "timed out" in low or "timeout" in low:
        return f"Port {port} unreachable — timed out"
    if "name or service not known" in low or "getaddrinfo" in low or "nodename" in low:
        return f"Host unreachable — DNS failed for {host}"
    if "network is unreachable" in low or "no route" in low:
        return f"Port {port} unreachable — no route to host"
    return _clip(raw)


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
        return ProbeResult(
            False,
            latency,
            error_message=_port_unreachable_message(exc, host=host, port=port),
        )


# RakNet magic used by Minecraft Bedrock unconnected ping / pong.
_RAKNET_MAGIC = bytes.fromhex("00ffff00fefefefefdfdfdfd12345678")


def bedrock_unconnected_ping() -> bytes:
    """Minecraft Bedrock (RakNet) Unconnected Ping — elicits Unconnected Pong."""
    import os
    import struct

    ts = int(time.time() * 1000) & 0xFFFFFFFFFFFFFFFF
    guid = int.from_bytes(os.urandom(8), "big")
    return b"\x01" + struct.pack(">Q", ts) + _RAKNET_MAGIC + struct.pack(">Q", guid)


def udp_datagram(payload: str = "") -> bytes:
    """Build UDP bytes from form payload.

    - empty → short ASCII probe (generic services)
    - bedrock / raknet / minecraft-bedrock → Bedrock RakNet ping
    - hex:AABBCC… → raw hex bytes
    - otherwise → UTF-8 text (capped)
    """
    raw = (payload or "").strip()
    key = raw.lower()
    if key in ("bedrock", "raknet", "minecraft-bedrock", "mcbe"):
        return bedrock_unconnected_ping()
    if key.startswith("hex:"):
        hexpart = key[4:].replace(" ", "").replace("0x", "")
        try:
            return bytes.fromhex(hexpart)[:512]
        except ValueError:
            return b"thrum-udp-probe"
    if not raw:
        return b"thrum-udp-probe"
    return raw.encode("utf-8", errors="replace")[:512]


def check_udp(target: str, timeout_seconds: int, payload: str = "") -> ProbeResult:
    """Send one UDP datagram; up if any reply arrives before timeout."""
    started = time.monotonic()
    try:
        host, port = parse_tcp_target(target)
    except ValueError as exc:
        return ProbeResult(False, None, error_message=_clip(str(exc)))

    timeout = max(1, min(int(timeout_seconds), 120))
    data = udp_datagram(payload)
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        sock.settimeout(timeout)
        sock.sendto(data, (host, port))
        sock.recvfrom(2048)
        latency = int((time.monotonic() - started) * 1000)
        return ProbeResult(True, latency)
    except TimeoutError:
        latency = int((time.monotonic() - started) * 1000)
        return ProbeResult(
            False, latency, error_message=f"Port {port} unreachable — no UDP reply"
        )
    except socket.timeout:
        latency = int((time.monotonic() - started) * 1000)
        return ProbeResult(
            False, latency, error_message=f"Port {port} unreachable — no UDP reply"
        )
    except Exception as exc:  # noqa: BLE001
        latency = int((time.monotonic() - started) * 1000)
        return ProbeResult(
            False,
            latency,
            error_message=_port_unreachable_message(exc, host=host, port=port),
        )
    finally:
        sock.close()


def probe_monitor(monitor: Any) -> ProbeResult:
    if monitor.type == "http":
        return check_http(
            monitor.target,
            monitor.timeout_seconds,
            monitor.expected_status_code,
            authorization=getattr(monitor, "http_authorization", "") or "",
            assert_link_ok=bool(getattr(monitor, "http_assert_link_ok", False)),
        )
    if monitor.type == "tcp":
        return check_tcp(monitor.target, monitor.timeout_seconds)
    if monitor.type == "udp":
        return check_udp(
            monitor.target,
            monitor.timeout_seconds,
            getattr(monitor, "udp_payload", "") or "",
        )
    return ProbeResult(False, None, error_message="Not a probeable monitor type")
