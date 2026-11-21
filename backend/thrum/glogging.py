"""Gunicorn logger: skip heartbeat spam and TLS-on-HTTP probe noise."""

from __future__ import annotations

from gunicorn.glogging import Logger


def _is_tls_probe_noise(msg: str) -> bool:
    # Browsers opening https:// against the plain HTTP allocation port.
    if "Invalid HTTP method" not in msg and "Invalid request" not in msg:
        return False
    return ("\\x16\\x03" in msg) or ("\x16\x03" in msg)


class ThrumLogger(Logger):
    def access(self, resp, req, environ, request_time):  # noqa: ANN001
        path = environ.get("PATH_INFO") or ""
        if path.startswith("/api/v1/heartbeat/"):
            return
        super().access(resp, req, environ, request_time)

    def warning(self, msg, *args, **kwargs):  # noqa: ANN001
        try:
            text = msg % args if args else str(msg)
        except Exception:  # noqa: BLE001
            text = str(msg)
        if _is_tls_probe_noise(text):
            return
        super().warning(msg, *args, **kwargs)

    def error(self, msg, *args, **kwargs):  # noqa: ANN001
        try:
            text = msg % args if args else str(msg)
        except Exception:  # noqa: BLE001
            text = str(msg)
        if _is_tls_probe_noise(text):
            return
        super().error(msg, *args, **kwargs)
