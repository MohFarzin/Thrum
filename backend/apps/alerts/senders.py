"""AlertSender interface + email / Discord implementations."""

from __future__ import annotations

import json
import logging
import smtplib
import urllib.error
import urllib.request
from email.message import EmailMessage
from typing import Protocol

from django.conf import settings

logger = logging.getLogger(__name__)


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


class DiscordSender:
    def send(self, *, subject: str, body: str, config: dict, kind: str = "down") -> None:
        url = (config.get("webhook_url") or "").strip()
        if not url.startswith("https://"):
            raise ValueError("Discord channel needs https webhook_url")

        base = getattr(settings, "THRUM_PUBLIC_BASE_URL", "").rstrip("/")
        down = kind == "down"
        logo = f"{base}/{'logo-down.svg' if down else 'logo.svg'}" if base else ""
        color = 0xE85D5D if down else 0x2F9E68
        author: dict = {"name": "THRUM"}
        if base:
            author["url"] = base
        if logo:
            author["icon_url"] = logo
        embed: dict = {
            "author": author,
            "title": subject[:250],
            "description": body[:2000],
            "color": color,
            "footer": {"text": "If it has a pulse, THRUM hears it."},
        }
        if logo:
            embed["thumbnail"] = {"url": logo}

        payload = {"embeds": [embed]}
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
