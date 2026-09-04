from __future__ import annotations

"""Bounded, thread-safe failed-login throttling for the single API process."""

from collections import defaultdict, deque
from hashlib import sha256
from threading import Lock
from time import monotonic
from typing import Callable


class LoginThrottle:
    def __init__(self, *, account_limit: int = 5, address_limit: int = 30,
                 window_seconds: int = 15 * 60,
                 clock: Callable[[], float] = monotonic) -> None:
        self.account_limit = account_limit
        self.address_limit = address_limit
        self.window_seconds = window_seconds
        self._clock = clock
        self._attempts: dict[str, deque[float]] = defaultdict(deque)
        self._lock = Lock()

    @staticmethod
    def _account_key(email: str) -> str:
        digest = sha256(email.strip().casefold().encode("utf-8")).hexdigest()
        return f"account:{digest}"

    @staticmethod
    def _address_key(address: str) -> str:
        return f"address:{address or 'unknown'}"

    def _prune(self, key: str, now: float) -> deque[float]:
        attempts = self._attempts[key]
        cutoff = now - self.window_seconds
        while attempts and attempts[0] <= cutoff:
            attempts.popleft()
        return attempts

    def retry_after(self, address: str, email: str) -> int:
        now = self._clock()
        keys_and_limits = (
            (self._account_key(email), self.account_limit),
            (self._address_key(address), self.address_limit),
        )
        with self._lock:
            waits = []
            for key, limit in keys_and_limits:
                attempts = self._prune(key, now)
                if len(attempts) >= limit:
                    waits.append(max(1, int(attempts[0] + self.window_seconds - now) + 1))
            return max(waits, default=0)

    def record_failure(self, address: str, email: str) -> None:
        now = self._clock()
        with self._lock:
            self._prune(self._account_key(email), now).append(now)
            self._prune(self._address_key(address), now).append(now)

    def record_success(self, email: str) -> None:
        with self._lock:
            self._attempts.pop(self._account_key(email), None)


login_throttle = LoginThrottle()
