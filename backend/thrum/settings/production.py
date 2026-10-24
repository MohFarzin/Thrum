import os

from .base import *  # noqa: F403

DEBUG = False

SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
# Default Secure cookies when public URL is https; override with SESSION_COOKIE_SECURE=.
_public = (os.environ.get("THRUM_PUBLIC_BASE_URL") or "").strip().lower()
_secure_default = "true" if _public.startswith("https://") else "false"
SESSION_COOKIE_SECURE = os.environ.get("SESSION_COOKIE_SECURE", _secure_default).lower() in (
    "1",
    "true",
    "yes",
)
CSRF_COOKIE_SECURE = SESSION_COOKIE_SECURE
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_REFERRER_POLICY = "same-origin"
X_FRAME_OPTIONS = "DENY"
SESSION_COOKIE_HTTPONLY = True
