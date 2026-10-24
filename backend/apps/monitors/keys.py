"""Per-monitor API keys — shown once, hashed at rest."""

from __future__ import annotations

import secrets

from django.contrib.auth.hashers import check_password, make_password

PREFIX_LEN = 8


def generate_api_key() -> str:
    return f"thrum_{secrets.token_urlsafe(32)}"


def key_prefix(raw_key: str) -> str:
    return raw_key[:PREFIX_LEN]


def hash_api_key(raw_key: str) -> str:
    return make_password(raw_key)


def verify_api_key(raw_key: str, hashed: str) -> bool:
    if not raw_key or not hashed:
        return False
    return check_password(raw_key, hashed)


def assign_new_key(monitor) -> str:
    raw = generate_api_key()
    monitor.api_key_prefix = key_prefix(raw)
    monitor.api_key_hash = hash_api_key(raw)
    return raw
