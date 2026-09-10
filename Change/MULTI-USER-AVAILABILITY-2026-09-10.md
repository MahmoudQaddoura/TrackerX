# TrackerX Multi-User Availability Hardening

**Date:** 10 September 2026  
**Scope:** Production API concurrency, overload control, database connections, readiness cost, and process recovery

## Outcome

TrackerX is configured for the current small-team workload with explicit overload protection rather than unbounded resource consumption. A pre-change external test completed 300 full readiness requests at 30 concurrent callers with 300 successes, zero failures, 87.37 requests per second, 312.86 ms median latency, and 499.51 ms p95 latency.

After deployment, the stronger gate completed 600 full readiness requests at 75 concurrent callers with 600 successes, zero failures, 131.49 requests per second, 406.88 ms median latency, 914.14 ms p95 latency, 1,531.70 ms p99 latency, and 1,618.72 ms maximum latency. The service recorded no restart and no error-level log entry during or after the test.

This validates substantially more simultaneous activity than the current enabled-user population. It does not make a single server infallible. True host-failure availability still requires redundant application nodes, PostgreSQL, replicated object storage, and an external load balancer.

## Implemented controls

- Uvicorn admits at most 100 active connections and queues bursts with a 2,048-entry backlog. Excess load receives a controlled service response instead of consuming memory without a bound.
- SQLAlchemy uses 20 persistent connections plus 20 overflow connections, a 30-second acquisition timeout, pre-ping, connection recycling, and last-used-first reuse.
- SQLite retains WAL mode, foreign-key enforcement, a 30-second lock wait, and normal synchronous durability for the current single-host deployment.
- Production readiness is single-flight cached for five seconds. Concurrent monitors share one database/integrity/storage result instead of triggering identical expensive probes.
- Failed readiness is cached for only one second to suppress a failure stampede while allowing rapid recovery detection.
- The service may open 65,536 file descriptors and 1,024 tasks, but memory pressure begins at 3 GiB and is hard-bounded at 4 GiB. A killed or failed process restarts after two seconds.
- Startup and shutdown have explicit 90-second and 30-second bounds; graceful shutdown receives 30 seconds.
- The public reverse proxy already caps request bodies at 55 MB and keeps the backend private on loopback.
- `scripts/load_readiness.py` provides a repeatable, read-only release gate that fails when any request returns a non-200 response or an incomplete readiness payload.

## Design decision: one worker

TrackerX remains on one Uvicorn worker deliberately. FastAPI executes the synchronous database routes in its thread pool, so a single worker still serves concurrent users. Multiple workers would split the in-memory login throttle and make SQLite schema/write coordination less deterministic. Adding workers without first externalizing those shared states would trade availability for security and consistency.

## Acceptance gates

- Backend regression and concurrency-cache tests: 52/52 passed.
- Ruff correctness scan, Bandit security scan, Python compilation, and dependency audit: passed; no known dependency vulnerabilities.
- Production unit validation and controlled restart: passed; service active with zero unexpected restarts.
- Post-deployment external concurrency test: 600/600 passed at 75 concurrent callers.
- Production database integrity and foreign keys: passed; recent error-level service log contained no entries.
- Public readiness after the load gate: HTTP 200 with database, schema, integrity, and storage all `ok`.
- Final service-isolation score: `2.8 OK`.

## Next architecture threshold

Move to PostgreSQL, Redis-backed throttling, at least two API instances, replicated object storage, and an independent load balancer before the user count or write volume requires horizontal scaling, or before the business requires continued service after total host failure.
