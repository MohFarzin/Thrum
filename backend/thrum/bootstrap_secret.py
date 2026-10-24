"""Ensure a Django SECRET_KEY exists. Messages on stderr; key on stdout."""
from __future__ import annotations

import os
import secrets
import sys
from pathlib import Path

PLACEHOLDERS = {
    "",
    "auto",
    "change-me",
    "change-me-to-a-long-random-string",
    "dev-insecure-change-me",
}


def ensure_secret_key(path: Path) -> str:
    env = (os.environ.get("SECRET_KEY") or "").strip()
    if env and env not in PLACEHOLDERS:
        path.parent.mkdir(parents=True, exist_ok=True)
        if not path.exists():
            path.write_text(env + "\n", encoding="utf-8")
        return env

    if path.exists():
        key = path.read_text(encoding="utf-8").strip()
        if key:
            return key

    key = secrets.token_urlsafe(50)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(key + "\n", encoding="utf-8")
    print("==> THRUM generated a SECRET_KEY for you", file=sys.stderr)
    print(f"    File:  {path}", file=sys.stderr)
    print(f"    Value: {key}", file=sys.stderr)
    print("    Re-read anytime from that file (or scroll the console on first start).", file=sys.stderr)
    return key


def main() -> None:
    default = os.environ.get("THRUM_SECRET_FILE", "data/secret_key.txt")
    path = Path(sys.argv[1] if len(sys.argv) > 1 else default)
    print(ensure_secret_key(path))


if __name__ == "__main__":
    main()
