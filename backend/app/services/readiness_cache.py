from __future__ import annotations

"""Thread-safe single-flight cache for the production readiness probe."""

from collections.abc import Callable
from threading import Lock
from time import monotonic


class ReadinessProbeError(RuntimeError):
    """A dependency-specific readiness failure safe to expose as a field name."""

    def __init__(self, component: str, message: str = "unavailable", *, cached: bool = False):
        super().__init__(message)
        self.component = component
        self.cached = cached


class ReadinessCache:
    """Run one probe per TTL while concurrent callers reuse the same outcome."""

    def __init__(
        self,
        *,
        success_ttl: float,
        failure_ttl: float,
        clock: Callable[[], float] = monotonic,
    ) -> None:
        self.success_ttl = max(0.0, success_ttl)
        self.failure_ttl = max(0.0, failure_ttl)
        self._clock = clock
        self._lock = Lock()
        self._expires_at = 0.0
        self._value: dict[str, str] | None = None
        self._failure: tuple[str, str] | None = None

    def get(self, probe: Callable[[], dict[str, str]]) -> dict[str, str]:
        """Return a recent snapshot or execute exactly one fresh probe."""
        if self.success_ttl <= 0:
            return probe()
        with self._lock:
            now = self._clock()
            if now < self._expires_at:
                if self._failure is not None:
                    component, message = self._failure
                    raise ReadinessProbeError(component, message, cached=True)
                if self._value is not None:
                    return dict(self._value)

            try:
                value = probe()
            except ReadinessProbeError as exc:
                self._value = None
                self._failure = (exc.component, str(exc))
                self._expires_at = now + self.failure_ttl
                raise

            self._value = dict(value)
            self._failure = None
            self._expires_at = now + self.success_ttl
            return dict(value)

    def clear(self) -> None:
        """Expire the snapshot immediately, primarily for deterministic tests."""
        with self._lock:
            self._expires_at = 0.0
            self._value = None
            self._failure = None
