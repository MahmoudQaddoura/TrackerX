"""Run a bounded, read-only concurrency check against TrackerX readiness."""

from __future__ import annotations

import argparse
import json
import math
import ssl
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from statistics import median
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

import certifi

EXPECTED_READY = {
    "status": "ok",
    "database": "ok",
    "schema": "ok",
    "integrity": "ok",
    "storage": "ok",
}


def percentile(values: list[float], fraction: float) -> float:
    """Return the nearest-rank percentile for a non-empty sample."""
    rank = max(0, math.ceil(len(values) * fraction) - 1)
    return sorted(values)[rank]


def request_once(url: str, timeout: float) -> dict[str, object]:
    """Perform one cache-bypassed request and record only operational metadata."""
    started = time.perf_counter()
    request = Request(
        url,
        headers={
            "Accept": "application/json",
            "Cache-Control": "no-cache",
            "User-Agent": "TrackerX-Readiness-Load-Gate/1.0",
        },
    )
    try:
        tls_context = ssl.create_default_context(cafile=certifi.where())
        with urlopen(  # nosec B310
            request,
            timeout=timeout,
            context=tls_context,
        ) as response:
            payload = json.loads(response.read().decode("utf-8"))
            status = response.status
            request_id = response.headers.get("X-Request-ID")
    except HTTPError as exc:
        return {
            "ok": False,
            "status": exc.code,
            "elapsed_ms": (time.perf_counter() - started) * 1000,
            "error": f"HTTP {exc.code}",
        }
    except (URLError, TimeoutError, json.JSONDecodeError) as exc:
        reason = getattr(exc, "reason", exc)
        return {
            "ok": False,
            "status": None,
            "elapsed_ms": (time.perf_counter() - started) * 1000,
            "error": f"{type(exc).__name__}: {reason}",
        }

    ready = status == 200 and all(payload.get(key) == value for key, value in EXPECTED_READY.items())
    return {
        "ok": ready,
        "status": status,
        "elapsed_ms": (time.perf_counter() - started) * 1000,
        "request_id": request_id,
        "error": None if ready else "Unexpected readiness payload",
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("url", help="Full TrackerX /api/health URL")
    parser.add_argument("--requests", type=int, default=300)
    parser.add_argument("--concurrency", type=int, default=30)
    parser.add_argument("--timeout", type=float, default=15)
    args = parser.parse_args()
    if args.requests < 1 or args.concurrency < 1 or args.concurrency > args.requests:
        parser.error("requests and concurrency must be positive; concurrency cannot exceed requests")

    started = time.perf_counter()
    with ThreadPoolExecutor(max_workers=args.concurrency) as executor:
        futures = [executor.submit(request_once, args.url, args.timeout) for _ in range(args.requests)]
        results = [future.result() for future in as_completed(futures)]
    wall_seconds = time.perf_counter() - started

    durations = [float(result["elapsed_ms"]) for result in results]
    failures = [result for result in results if not result["ok"]]
    summary = {
        "url": args.url,
        "requests": args.requests,
        "concurrency": args.concurrency,
        "passed": len(results) - len(failures),
        "failed": len(failures),
        "requests_per_second": round(args.requests / wall_seconds, 2),
        "latency_ms": {
            "median": round(median(durations), 2),
            "p95": round(percentile(durations, 0.95), 2),
            "p99": round(percentile(durations, 0.99), 2),
            "max": round(max(durations), 2),
        },
        "failure_samples": failures[:5],
    }
    print(json.dumps(summary, indent=2))
    return 0 if not failures else 2


if __name__ == "__main__":
    raise SystemExit(main())
