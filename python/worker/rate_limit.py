"""Sliding-window limiter for Tushare HTTP calls (shared in-process)."""

from __future__ import annotations

import time
from collections import deque

MAX_CALLS_PER_MINUTE = 400
WINDOW_SECONDS = 60.0
MIN_INTERVAL_SECONDS = WINDOW_SECONDS / MAX_CALLS_PER_MINUTE


class TushareRateLimiter:
    def __init__(
        self,
        max_calls_per_minute: int = MAX_CALLS_PER_MINUTE,
        window_seconds: float = WINDOW_SECONDS,
    ) -> None:
        if max_calls_per_minute < 1:
            raise ValueError("max_calls_per_minute must be >= 1")
        if window_seconds <= 0:
            raise ValueError("window_seconds must be > 0")
        self._max_calls = max_calls_per_minute
        self._window = window_seconds
        self._min_interval = window_seconds / max_calls_per_minute
        self._stamps: deque[float] = deque()

    def wait(self) -> float:
        """Block until a call is allowed. Returns seconds actually waited."""
        started = time.monotonic()
        while True:
            now = time.monotonic()
            self._prune(now)
            sleep_for = 0.0
            if self._stamps:
                since_last = now - self._stamps[-1]
                if since_last < self._min_interval:
                    sleep_for = max(sleep_for, self._min_interval - since_last)
            if len(self._stamps) >= self._max_calls:
                sleep_for = max(sleep_for, self._stamps[0] + self._window - now)
            if sleep_for <= 0:
                self._stamps.append(now)
                return now - started
            time.sleep(sleep_for)

    def _prune(self, now: float) -> None:
        cutoff = now - self._window
        while self._stamps and self._stamps[0] <= cutoff:
            self._stamps.popleft()


_limiter = TushareRateLimiter()


def wait_for_tushare_slot() -> float:
    return _limiter.wait()
