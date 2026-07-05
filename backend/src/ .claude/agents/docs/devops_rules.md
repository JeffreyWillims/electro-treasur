# DevOps Rules

Conventions observed in the repo's Docker/CI/infra setup — follow these when changing deployment,
CI, or container configuration.

## Containers

- Every service runs in Docker; there's no "install locally" path documented or supported. Compose
  files: `docker-compose.yml` (dev/base stack: postgres, pgbouncer, redis, backend, frontend,
  telegram-bot, arq-worker), `docker-compose.prod.yml` (prod overrides), and
  `docker-compose.monitoring.yml` (Prometheus/Grafana/Alertmanager/cAdvisor + exporters).
- `backend/Dockerfile` is multi-stage (builder → runtime); the prod container runs as a non-root
  user (`appuser`), not root. Keep new backend Dockerfile changes consistent with that.
- Services with no HTTP server (`telegram-bot`, `arq-worker`) explicitly set
  `healthcheck: { disable: true }` in `docker-compose.yml` — the inherited image healthcheck
  (which probes `:8000`) would otherwise false-fail. Don't remove that override without adding an
  actual healthcheck suited to a non-HTTP process.

## Configuration

- All env vars come from `.env` files, never hardcoded — see `backend/.env.example`. Every
  variable is read through `pydantic-settings` with the `ET_` prefix. Adding a new setting means
  adding it to `.env.example` with a placeholder value and to the `Settings` model, not sprinkling
  `os.environ.get(...)` calls around.

## CI/CD

- GitHub Actions pipeline (per `README.md`): `ruff check` + `ruff format` → `mypy --strict` →
  `pip-audit` → `pytest` (coverage ≥ 70%) → Docker multi-stage build → push to GHCR — GHCR push
  only happens on a push to `main`, not on PRs. Concurrency control auto-cancels superseded runs
  for the same branch. New CI steps should slot into this same lint → test → build order rather
  than running in parallel with no ordering guarantee.

## Nginx and routing

- `frontend/nginx.conf` (local) and `frontend/nginx.prod.conf` (prod, SSL/Let's Encrypt) are
  separate files — don't conflate the two. Nginx proxies `location /api/` to
  `http://backend:8000/` with the `/api/` prefix stripped, and `location /admin` to the backend's
  SQLAdmin panel. See `docs/API_REFERENCE.md` for how this affects client-facing vs. backend-facing
  paths (there's an existing double-`/api` quirk on the yearly-analytics router — don't "fix" it
  as a side effect of an unrelated change without calling it out).

## Monitoring

- Prometheus + Grafana + Alertmanager + cAdvisor/exporters run via
  `docker-compose.monitoring.yml`, configured under `monitoring/{prometheus,grafana,alertmanager}/`.
  Add new alert rules to `monitoring/prometheus/alerts.yml`, not as a new standalone file, unless
  there's a good reason to split.

## Scaling beyond Compose

- `k8s/` holds Kubernetes manifests for the FastAPI deployment (+ HPA), the ARQ worker, and
  PgBouncer — these mirror the Compose services and should be kept in sync if you change resource
  requirements, image tags, or env var wiring in Compose.
