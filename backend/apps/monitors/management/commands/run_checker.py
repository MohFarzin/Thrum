"""Sleep-until-due check loop — accurate short intervals, low idle CPU."""

from __future__ import annotations

import logging
import os
import time

from django.core.management.base import BaseCommand
from django.db import close_old_connections
from django.utils import timezone

from apps.monitors.scheduler import run_due_checks, seconds_until_next_due
from apps.monitors.tasks import cleanup_check_results, heartbeat_watchdog

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = "Run HTTP/TCP checks + heartbeat watchdog; sleeps until next due check."

    def handle(self, *args, **options):  # noqa: ARG002
        max_sleep = max(1.0, float(os.environ.get("THRUM_CHECKER_MAX_SLEEP", "5")))
        watchdog_every = max(5.0, float(os.environ.get("THRUM_WATCHDOG_EVERY", "10")))
        last_cleanup = timezone.now()
        last_watchdog = 0.0
        self.stdout.write(
            self.style.SUCCESS(
                f"checker sleep-until-due max_sleep={max_sleep}s watchdog={watchdog_every}s"
            )
        )
        while True:
            close_old_connections()
            try:
                n = run_due_checks()
                now_mono = time.monotonic()
                if now_mono - last_watchdog >= watchdog_every:
                    heartbeat_watchdog()
                    last_watchdog = now_mono
                if (timezone.now() - last_cleanup).total_seconds() >= 86400:
                    cleanup_check_results()
                    last_cleanup = timezone.now()
            except Exception:  # noqa: BLE001
                logger.exception("checker tick failed")
                n = 0
            finally:
                close_old_connections()

            # If we just ran checks, recompute soon; else sleep until next due.
            sleep_for = 0.05 if n else seconds_until_next_due(max_sleep=max_sleep)
            time.sleep(sleep_for)
