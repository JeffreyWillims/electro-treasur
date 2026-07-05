# API Reference

Backend mounts two router trees in `backend/src/main.py`:

- `v1_router` (`backend/src/api/v1/router.py`) — mounted at **no extra prefix**, but the router
  itself carries `prefix="/v1"` → backend paths are `/v1/...`.
- `analytics_router` (`backend/src/api/analytics/yearly.py`, prefix `/analytics`) — mounted with
  an *additional* `prefix="/api"` in `main.py` → backend path is `/api/analytics/...`.

Nginx (`frontend/nginx.conf`) proxies `location /api/` → `http://backend:8000/` (prefix stripped).
So from the browser/client:

| Client-facing path | Backend path | Router |
|---|---|---|
| `/api/v1/...` | `/v1/...` | `v1_router` (auth, users, transactions, budgets, dashboard, analytics, insights, offers) |
| `/api/api/analytics/yearly` and `/api/api/analytics/tasks/{task_id}` | `/api/analytics/...` | `analytics_router` (yearly LLM report) — double `/api` is a real, if awkward, consequence of the current mount + proxy setup |

All endpoints below use **backend-path** notation (`/v1/...`); prepend `/api` when calling through
Nginx from the frontend.

Auth: unless noted, endpoints require `Authorization: Bearer <JWT>` via `get_current_user`
(OAuth2 password flow, `python-jose`, see `/v1/auth/login`).

---

## Auth — `/v1/auth` (`api/v1/auth.py`)

### `POST /v1/auth/register`
Rate limit: 3/minute. Creates a user; 400 if email already exists.

Request (`UserCreate`):
```json
{
  "email": "user@example.com",
  "full_name": "Ivan Petrov",
  "phone": "+79990000000",
  "monthly_income": "50000.00",
  "password": "min-8-chars"
}
```
Response `201` (`UserRead`):
```json
{
  "id": 1,
  "email": "user@example.com",
  "full_name": "Ivan Petrov",
  "phone": "+79990000000",
  "monthly_income": "50000.00"
}
```

### `POST /v1/auth/login`
Rate limit: 5/minute. OAuth2 password form (`username`=email, `password`). Constant-time check
against a dummy bcrypt hash when the user doesn't exist (timing-attack mitigation).

```bash
curl -X POST http://localhost:8000/v1/auth/login \
  -d "username=user@example.com&password=secret123"
```
Response (`Token`):
```json
{ "access_token": "eyJhbGciOi...", "token_type": "bearer" }
```

---

## Users — `/v1/users` (`api/v1/users.py`)

| Method | Path | Description |
|---|---|---|
| GET | `/me` | Current user profile |
| PATCH | `/me` | Partial update (`full_name`, `phone`, `monthly_income`) |
| GET | `/categories` | List current user's categories |
| POST | `/categories` | Create category (`201`) |
| GET | `/categories/{category_id}/transaction-count` | Pre-flight check before delete; `404` if not found |
| PATCH | `/categories/{category_id}` | Partial update (`name`, `icon`); `404` if not found |
| DELETE | `/categories/{category_id}` | `204`; `404` if not found |
| POST | `/telegram-link` | Rate limit 3/minute. Generates a 6-digit OTP, stored in Redis (`telegram_otp:{code}` → `user_id`, TTL 300s) for linking a Telegram account |

Example — create category (`CategoryCreate`):
```json
{ "name": "Продукты", "type": "expense", "icon": "🛒", "parent_id": null }
```

---

## Transactions — `/v1/transactions` (`api/v1/transactions.py`)

| Method | Path | Description |
|---|---|---|
| POST | `/` | Create transaction, **idempotent** via `Idempotency-Key` header |
| GET | `/` | Paginated list with filters |
| GET | `/export` | Stream all transactions as CSV |
| POST | `/import` | Upload CSV/XLSX/XLS (max 10 MB) |
| PATCH | `/{transaction_id}` | Partial update; `404` if not found/not owned |
| DELETE | `/{transaction_id}` | `204`; `404` if not found/not owned |

**Idempotency mechanism** (`services/transaction_service.py`):
1. Client sends `Idempotency-Key: <uuid>` header.
2. Server checks Redis key `idempotency:{key}` — O(1) GET. On HIT, returns the cached response, no DB write.
3. On MISS, inserts the row with `idempotency_key` set; the `transactions.idempotency_key` UNIQUE
   constraint is the last-resort guard if two requests race past the Redis check.
4. After a successful insert, the Redis key is `SET` with a TTL (`ET_REDIS_INSIGHT_TTL`-style
   setting, 24h by default).

Example — create transaction:
```bash
curl -X POST http://localhost:8000/v1/transactions/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "Idempotency-Key: 8f14e45f-ceea-4c7c-8b0f-1b1e1f1e1234" \
  -H "Content-Type: application/json" \
  -d '{"category_id": 3, "amount": "500.00", "currency": "RUB", "entry_type": "manual"}'
```

GET `/` query params: `limit` (≤100, default 10), `offset`, `category_id`, `type`, `min_amount`,
`max_amount`, `start_date`, `end_date`, `search`.

Response (`TransactionPaginatedResponse`):
```json
{
  "items": [
    {
      "id": 10, "user_id": 1, "category_id": 3, "category_name": "Продукты",
      "amount": "500.00", "currency": "RUB", "is_recurring": false,
      "entry_type": "manual", "executed_at": "2026-07-01T12:00:00Z",
      "comment": null, "idempotency_key": "8f14e45f-..."
    }
  ],
  "total": 1
}
```

---

## Budgets — `/v1/budgets` (`api/v1/budgets.py`)

| Method | Path | Description |
|---|---|---|
| PUT | `/` | Upsert a monthly limit for a category |
| DELETE | `/{category_id}?month=&year=` | Remove a budget; `404` if not found |

Request (`BudgetUpsert`):
```json
{ "category_id": 3, "amount_limit": "15000.00", "month": 7, "year": 2026 }
```

---

## Dashboard — `/v1/dashboard` (`api/v1/dashboard.py`)

### `GET /v1/dashboard/?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD`

Validations: `start_date <= end_date` (else `400`), range ≤ 90 days (else `400`).

Response (`DashboardResponse`) — per-category matrix with planned/fact/delta and a dynamic
day-by-day vector sized to the selected range:
```json
{
  "start_date": "2026-07-01", "end_date": "2026-07-31",
  "total_balance_all_time": "120000.00",
  "period_income": "50000.00", "period_expense": "32000.00",
  "rows": [
    {
      "category_id": 3, "category_name": "Продукты", "type": "expense",
      "planned": "15000.00", "fact": "8200.00", "delta": "6800.00",
      "days": [{ "day": 1, "amount": "500.00" }]
    }
  ]
}
```

---

## Analytics (Savings Navigator) — `/v1/analytics` (`api/v1/analytics.py`)

| Method | Path | Description |
|---|---|---|
| GET | `/profile` | 3-month average expenses per category + average income |
| POST | `/simulate` | Simulate a savings trajectory given adjustments and a bank deposit rate |

Request (`SimulateRequest`):
```json
{
  "target_amount": "300000",
  "initial_savings": "10000",
  "adjustments": [{ "category_id": 3, "new_amount": "10000" }],
  "bank_rate": "16.0",
  "avg_income": "80000",
  "base_expenses": [{ "category_id": 3, "name": "Продукты", "avg_amount": "12000" }],
  "habit_savings": "0"
}
```

---

## Yearly Analytics — `/api/analytics` (`api/analytics/yearly.py`, mounted with extra `/api` prefix)

Async LLM report, same enqueue/poll pattern as Insights below, backed by the arq job
`generate_annual_llm_insight`.

| Method | Path | Description |
|---|---|---|
| POST | `/yearly` | Body `{ "year": 2026 }`; `202` with `task_id` |
| GET | `/tasks/{task_id}` | Poll status: `"pending"` or `"complete"` + `result` |

---

## LLM Insights — `/v1/insights` (`api/v1/insights.py`)

Background LLM analysis via arq (Redis-backed job queue), decoupled from the request/response
cycle so OpenAI latency never blocks the API.

| Method | Path | Description |
|---|---|---|
| POST | `/` | Body `{ "start_date": "...", "end_date": "..." }`; enqueues `generate_annual_llm_insight`, `202` with `task_id` |
| GET | `/latest` | Newest persisted row from `insights` table (nightly cron-generated) or `null` |
| GET | `/{task_id}` | Poll: `"pending"` while running, or `"complete"` + `result` JSON |

```bash
curl -X POST http://localhost:8000/v1/insights/ \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"start_date": "2026-07-01", "end_date": "2026-07-31"}'
# → {"task_id": "...", "status": "pending"}

curl http://localhost:8000/v1/insights/<task_id> -H "Authorization: Bearer $TOKEN"
```

---

## Bank Offers — `/v1/offers` (`api/v1/offers.py`, new/in-progress)

CPA monetization for Savings Navigator; offers are managed via SQLAdmin, not via this API.

| Method | Path | Description |
|---|---|---|
| GET | `/` | Active offers, sorted by `sort_order` then `rate` desc (`BankOfferRead`, no click counters exposed) |
| POST | `/{offer_id}/click` | `204`; atomically increments `clicks` before redirecting to `partner_url`; `404` if offer missing/inactive |

```json
[{ "id": 1, "name": "Т-Банк Вклад", "rate": "18.50", "color": "#FFDD2D", "partner_url": "https://..." }]
```

---

## System

| Method | Path | Description |
|---|---|---|
| GET | `/v1/health` | O(1) liveness ping for Nginx/Kubernetes probes |
| GET | `/health` | Deeper healthcheck — pings Postgres (`SELECT 1`) and Redis; `503` on failure |
