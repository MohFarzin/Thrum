"""Gunicorn logger that skips high-frequency heartbeat access lines."""

from __future__ import annotations

from gunicorn.glogging import Logger


class ThrumLogger(Logger):
    def access(self, resp, req, environ, request_time):  # noqa: ANN001
        path = environ.get("PATH_INFO") or ""
        if path.startswith("/api/v1/heartbeat/"):
            return
        super().access(resp, req, environ, request_time)
