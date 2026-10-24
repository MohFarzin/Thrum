"""AlertSender interface + email / Discord implementations."""

from __future__ import annotations

import json
import logging
import smtplib
import urllib.error
import urllib.request
from email.message import EmailMessage
from pathlib import Path
from typing import Protocol

from django.conf import settings

logger = logging.getLogger(__name__)

_ASSETS = Path(__file__).resolve().parent / "assets"


class AlertSender(Protocol):
    def send(self, *, subject: str, body: str, config: dict, kind: str = "down") -> None: ...


def _smtp_settings(config: dict) -> tuple[str, int, bool, str, str, str, str]:
    """Prefer per-channel SMTP; fall back to server EMAIL_* env."""
    host = (config.get("smtp_host") or settings.EMAIL_HOST or "").strip()
    port = int(config.get("smtp_port") or settings.EMAIL_PORT or 587)
    use_tls = config.get("use_tls")
    if use_tls is None:
        use_tls = bool(settings.EMAIL_USE_TLS)
    else:
        use_tls = bool(use_tls)
    user = (config.get("smtp_user") or settings.EMAIL_HOST_USER or "").strip()
    password = config.get("smtp_password") or settings.EMAIL_HOST_PASSWORD or ""
    from_email = (config.get("from_email") or settings.DEFAULT_FROM_EMAIL or "thrum@localhost").strip()
    to_addr = (config.get("to") or "").strip()
    return host, port, use_tls, user, password, from_email, to_addr


class EmailSender:
    def send(self, *, subject: str, body: str, config: dict, kind: str = "down") -> None:
        host, port, use_tls, user, password, from_email, to_addr = _smtp_settings(config)
        if not to_addr:
            raise ValueError("Email channel missing recipient (config.to)")
        if not host:
            raise ValueError("SMTP host missing — set it on the channel or EMAIL_HOST")

        msg = EmailMessage()
        msg["Subject"] = subject
        msg["From"] = from_email
        msg["To"] = to_addr
        msg.set_content(body)

        with smtplib.SMTP(host, port, timeout=20) as smtp:
            if use_tls:
                smtp.starttls()
            if user:
                smtp.login(user, password)
            smtp.send_message(msg)


def _multipart_form(fields: dict[str, str], files: list[tuple[str, str, bytes, str]]) -> tuple[bytes, str]:
    boundary = "----ThrumBoundary7MA4YWxkTrZu0gW"
    lines: list[bytes] = []
    for name, value in fields.items():
        lines.append(f"--{boundary}".encode())
        lines.append(f'Content-Disposition: form-data; name="{name}"'.encode())
        lines.append(b"")
        lines.append(value.encode("utf-8"))
    for field, filename, content, content_type in files:
        lines.append(f"--{boundary}".encode())
        lines.append(
            f'Content-Disposition: form-data; name="{field}"; filename="{filename}"'.encode()
        )
        lines.append(f"Content-Type: {content_type}".encode())
        lines.append(b"")
        lines.append(content)
    lines.append(f"--{boundary}--".encode())
    lines.append(b"")
    return b"\r\n".join(lines), f"multipart/form-data; boundary={boundary}"


class DiscordSender:
    def send(self, *, subject: str, body: str, config: dict, kind: str = "down") -> None:
        url = (config.get("webhook_url") or "").strip()
        if not url.startswith("https://"):
            raise ValueError("Discord channel needs https webhook_url")

        base = getattr(settings, "THRUM_PUBLIC_BASE_URL", "").rstrip("/")
        down = kind == "down"
        color = 0xE85D5D if down else 0x2F9E68
        asset_name = "logo-down.png" if down else "logo.png"
        asset_path = _ASSETS / asset_name
        # Prefer attached PNG (Discord rejects SVG URLs). Fallback to public PNG URL.
        use_attach = asset_path.is_file()
        thumb = f"attachment://{asset_name}" if use_attach else (f"{base}/{asset_name}" if base else "")

        author: dict = {"name": "THRUM"}
        if base:
            author["url"] = base
        if thumb:
            author["icon_url"] = thumb

        embed: dict = {
            "author": author,
            "title": subject[:250],
            "description": body[:2000],
            "color": color,
            "footer": {"text": "If it has a pulse, THRUM hears it."},
        }
        if thumb:
            embed["thumbnail"] = {"url": thumb}

        payload = {"embeds": [embed]}

        if use_attach:
            raw = asset_path.read_bytes()
            body_bytes, content_type = _multipart_form(
                {"payload_json": json.dumps(payload)},
                [("files[0]", asset_name, raw, "image/png")],
            )
            req = urllib.request.Request(
                url,
                data=body_bytes,
                method="POST",
                headers={"Content-Type": content_type, "User-Agent": "THRUM-Alerts/1.0"},
            )
        else:
            data = json.dumps(payload).encode("utf-8")
            req = urllib.request.Request(
                url,
                data=data,
                method="POST",
                headers={"Content-Type": "application/json", "User-Agent": "THRUM-Alerts/1.0"},
            )
        try:
            with urllib.request.urlopen(req, timeout=15) as resp:  # noqa: S310
                resp.read(256)
        except urllib.error.HTTPError as exc:
            raise ValueError(f"Discord webhook HTTP {exc.code}") from exc


SENDERS: dict[str, AlertSender] = {
    "email": EmailSender(),
    "discord": DiscordSender(),
}


def get_sender(channel_type: str) -> AlertSender:
    sender = SENDERS.get(channel_type)
    if sender is None:
        raise ValueError(f"No sender for type {channel_type}")
    return sender
