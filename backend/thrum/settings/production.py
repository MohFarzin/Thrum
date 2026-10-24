import os

from .base import *  # noqa: F403

DEBUG = False

SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SESSION_COOKIE_SECURE = os.environ.get("SESSION_COOKIE_SECURE", "False").lower() in (
    "1",
    "true",
    "yes",
)
CSRF_COOKIE_SECURE = SESSION_COOKIE_SECURE
