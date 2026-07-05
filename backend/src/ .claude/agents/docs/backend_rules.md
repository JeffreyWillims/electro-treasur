# Backend Rules

Conventions observed in `backend/src/` — follow these when writing or reviewing backend code.
(Note: `backend/src/agents/orchestrator.py` and related agent-runner files are currently empty
stubs — nothing yet actually enforces these rules automatically. This file is a reference for
whoever/whatever writes backend code, human or agent.)

## Async everywhere

- All DB access goes through `AsyncSession` (`sqlalchemy.ext.asyncio`) and `asyncpg`. Use
  `select()` / `update()` / `insert()` from `sqlalchemy` — never the legacy `Session.query()` API.
- No synchronous blocking calls inside async request handlers.

## Layering

- Routers (`src/api/v1/*.py`) stay thin: parse/validate input, call one service function, map
  errors to `HTTPException`. Business logic lives in `src/services/*_service.py` as plain async
  functions taking `session: AsyncSession` and typed params — there is **no Repository class
  abstraction** in this codebase; don't introduce one for a single call site.
- Pydantic v2 schemas live in `src/schemas/`, one module per feature area, mirroring the router it
  serves (e.g. `schemas/offer.py` ↔ `api/v1/offers.py`).

## Types and money

- `mypy --strict` is enforced on `src/` (see `backend/pyproject.toml`; `migrations/` and `tests/`
  excluded). The `pydantic.mypy` plugin is enabled with `init_forbid_extra = true`,
  `init_typed = true` — keep Pydantic models fully typed, no `**kwargs` passthrough.
- Every monetary value is `Decimal` in Python / `NUMERIC(12,2)` in Postgres. Never use `float` for
  money. Pydantic schemas constrain with `max_digits=12, decimal_places=2`.
- `ruff` config: line-length 99, rule sets `E,F,I,UP,B,SIM`, with `E501` (line length) and `B008`
  (function calls in defaults — needed for `Depends(...)`) explicitly ignored.

## Idempotency

- Mutating endpoints that can be retried (e.g. `POST /v1/transactions/`) accept an
  `Idempotency-Key` header. Check Redis first (`idempotency:{key}`, O(1) GET) before hitting the
  DB; the table's `UNIQUE` constraint on `idempotency_key` is the last-resort guard against a race.
  See `src/services/transaction_service.py` for the reference implementation.

## Background work

- Anything slow or external (LLM calls, nightly aggregation) goes through **arq** background jobs,
  not inline in the request/response cycle. Routers enqueue via `pool.enqueue_job(...)` and return
  `202` with a `task_id`; a separate `GET .../{task_id}` endpoint polls status. See
  `src/api/v1/insights.py` and `src/api/analytics/yearly.py`.

## Rate limiting

- Sensitive/abusable endpoints (register, login, OTP generation) are decorated with
  `@limiter.limit("N/minute")` (SlowAPI). Add this to any new endpoint that's a brute-force or
  spam target.
