from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
import unittest

from app.services.readiness_cache import ReadinessCache, ReadinessProbeError


class ReadinessCacheTests(unittest.TestCase):
    def test_concurrent_callers_share_one_probe_and_receive_copies(self):
        now = [100.0]
        calls = [0]
        cache = ReadinessCache(success_ttl=5, failure_ttl=1, clock=lambda: now[0])

        def probe() -> dict[str, str]:
            calls[0] += 1
            return {"status": "ok", "database": "ok"}

        with ThreadPoolExecutor(max_workers=20) as executor:
            results = list(executor.map(lambda _index: cache.get(probe), range(100)))

        self.assertEqual(calls[0], 1)
        self.assertTrue(all(result["status"] == "ok" for result in results))
        results[0]["status"] = "changed"
        self.assertEqual(cache.get(probe)["status"], "ok")

        now[0] += 6
        cache.get(probe)
        self.assertEqual(calls[0], 2)

    def test_failure_is_briefly_cached_without_repeating_dependency_work(self):
        now = [100.0]
        calls = [0]
        cache = ReadinessCache(success_ttl=5, failure_ttl=1, clock=lambda: now[0])

        def probe() -> dict[str, str]:
            calls[0] += 1
            raise ReadinessProbeError("storage")

        with self.assertRaises(ReadinessProbeError) as first:
            cache.get(probe)
        with self.assertRaises(ReadinessProbeError) as second:
            cache.get(probe)

        self.assertFalse(first.exception.cached)
        self.assertTrue(second.exception.cached)
        self.assertEqual(second.exception.component, "storage")
        self.assertEqual(calls[0], 1)

        now[0] += 2
        with self.assertRaises(ReadinessProbeError):
            cache.get(probe)
        self.assertEqual(calls[0], 2)


if __name__ == "__main__":
    unittest.main()
