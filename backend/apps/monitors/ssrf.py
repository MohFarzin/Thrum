"""Light SSRF guards for HTTP/TCP targets (self-hosted residual risk remains)."""

from __future__ import annotations

import ipaddress
import socket
from urllib.parse import urlparse


_BLOCKED_HOSTNAMES = frozenset(
    {
        "metadata.google.internal",
        "metadata.google.com",
        "kubernetes.default",
        "kubernetes.default.svc",
    }
)


def _ip_blocked(ip: ipaddress.IPv4Address | ipaddress.IPv6Address) -> bool:
    # Cloud metadata / link-local; allow private LAN (common for self-host checks).
    if ip.is_link_local or ip.is_multicast or ip.is_unspecified:
        return True
    if isinstance(ip, ipaddress.IPv4Address) and ip == ipaddress.IPv4Address("169.254.169.254"):
        return True
    return False


def assert_safe_hostname(host: str) -> None:
    host = (host or "").strip().lower().rstrip(".")
    if not host:
        raise ValueError("Empty host")
    if host in _BLOCKED_HOSTNAMES or host.endswith(".metadata.google.internal"):
        raise ValueError("Blocked host")

    try:
        ip = ipaddress.ip_address(host)
    except ValueError:
        ip = None

    if ip is not None:
        if _ip_blocked(ip):
            raise ValueError("Blocked address")
        return

    # Resolve and check all answers (best-effort; DNS rebinding residual risk).
    try:
        infos = socket.getaddrinfo(host, None, type=socket.SOCK_STREAM)
    except socket.gaierror as exc:
        raise ValueError(f"DNS failed: {exc}") from exc

    for info in infos:
        addr = info[4][0]
        try:
            resolved = ipaddress.ip_address(addr)
        except ValueError:
            continue
        if _ip_blocked(resolved):
            raise ValueError("Blocked resolved address")


def assert_safe_http_url(url: str) -> str:
    parsed = urlparse(url.strip())
    if parsed.scheme not in ("http", "https"):
        raise ValueError("Only http/https URLs allowed")
    if not parsed.hostname:
        raise ValueError("URL missing host")
    assert_safe_hostname(parsed.hostname)
    return url.strip()


def parse_tcp_target(target: str) -> tuple[str, int]:
    raw = target.strip()
    if "://" in raw:
        raise ValueError("TCP target must be host:port")
    if raw.startswith("["):
        # [ipv6]:port
        end = raw.find("]")
        if end < 0 or end + 1 >= len(raw) or raw[end + 1] != ":":
            raise ValueError("Invalid IPv6 TCP target")
        host = raw[1:end]
        port_s = raw[end + 2 :]
    else:
        if raw.count(":") != 1:
            raise ValueError("TCP target must be host:port")
        host, port_s = raw.rsplit(":", 1)
    try:
        port = int(port_s)
    except ValueError as exc:
        raise ValueError("Invalid port") from exc
    if not (1 <= port <= 65535):
        raise ValueError("Port out of range")
    assert_safe_hostname(host)
    return host, port
