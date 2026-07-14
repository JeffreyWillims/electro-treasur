# QA Rules

Conventions observed in `backend/tests/` — follow these when writing or reviewing tests.

## Test runner and layout

- `pytest` + `pytest-asyncio` (`asyncio_mode = "auto"` in `pyproject.toml` — no need to mark every
  test `@pytest.mark.asyncio`).
- Tests are split into `tests/unit/`, `tests/integration/`, `tests/e2e/`, and `tests/factories/`.
  Unit tests must not touch the database; integration tests exercise a real PostgreSQL `_test`
  database; e2e tests use Playwright and are marked `@pytest.mark.e2e` (deselect with
  `-m "not e2e"`).

## DB isolation — no Testcontainers

- This project does **not** use Testcontainers. `tests/conftest.py` opens one connection/
  transaction for the whole test session against a real Postgres `_test` database, and wraps each
  individual test in its own `SAVEPOINT` that gets rolled back afterward. Don't reach for
  Testcontainers or an in-memory SQLite substitute — match the existing SAVEPOINT pattern.
- `conftest.py` asserts `settings.database_url.endswith("_test")` at collection time and aborts
  otherwise — a hard guard against accidentally running tests against a non-test database. Don't
  remove or weaken this check.
- `pytest-env` (see `[tool.pytest_env]` in `pyproject.toml`) sets `ET_DATABASE_URL`,
  `ET_SECRET_KEY`, `ET_REDIS_URL`, `ET_TELEGRAM_BOT_TOKEN` for the test process automatically.

## Test data

- Use **Factory Boy** factories in `tests/factories/` (`users.py`, `transactions.py`) for building
  model instances rather than constructing ORM objects by hand in every test.
- **Hypothesis** is used for property-based tests where the domain has a lot of edge cases (regex
  parsing in OCR, budget math) — reach for it when testing numeric/parsing logic with a wide input
  space, not for straightforward CRUD tests.

## Coverage

- CI/local runs enforce `--cov=src --cov-fail-under=70` (see `pyproject.toml` `addopts`). Don't
  drop coverage below 70%; this is the real, current gate — not 80%.

## What to test where

- Unit: pure logic (OCR parsing, budget math, dashboard aggregation) with fakes/factories, no DB.
- Integration: API endpoints, DB constraints (UNIQUE, FK, CASCADE), idempotency behavior — against
  the real `_test` Postgres via the SAVEPOINT fixture.
- E2E: full user journeys through Playwright (e.g. login flow, dashboard).
