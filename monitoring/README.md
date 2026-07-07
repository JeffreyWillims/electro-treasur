# Monitoring & operational switches

Prometheus + Grafana + cAdvisor + exporters + Alertmanager, plus the two
"turn it on" switches for the back-office and Telegram alerts. **No secret is
committed** — each feature stays off until you provide its secret at runtime.

Start the stack with the monitoring overlay:

```bash
docker compose -f docker-compose.yml -f docker-compose.monitoring.yml up -d
# macOS/Docker Desktop: node-exporter is incompatible — list services explicitly
# and omit it (see the root run notes).
```

- Grafana → http://localhost:3000  (admin / admin on first start; override with
  `GRAFANA_ADMIN_USER` / `GRAFANA_ADMIN_PASSWORD`)
- Prometheus → http://localhost:9090
- Alertmanager → http://localhost:9093

---

## 1. SQLAdmin back-office (`/admin`)

Login is **disabled** until a password is set — an empty `ET_ADMIN_PASSWORD`
rejects every attempt (`src/admin.py::AdminAuth.login`). Enable with one env var:

```bash
# backend/.env  (never committed — .env is gitignored)
ET_ADMIN_PASSWORD=<a-strong-password>
ET_ADMIN_USERNAME=admin        # optional, defaults to "admin"
```

Then open http://localhost/admin/ (through nginx) and log in. Credentials are
compared with `secrets.compare_digest`; the session is signed with the app
`ET_SECRET_KEY`.

## 2. Telegram alerts (Alertmanager)

The bot token is read from a **file** (`bot_token_file`), never inlined. By
default the overlay mounts the committed dummy `bot_token.example`, so
Alertmanager starts healthy but delivery is effectively **off**. Enable real
alerts with one env var pointing at your own token file:

```bash
# 1. Put your BotFather token (single line) into a gitignored file:
printf '%s' '123456789:AA...your-real-token...' > monitoring/alertmanager/bot_token

# 2. Point the overlay at it and set the numeric chat_id in alertmanager.yml
#    (chat_id is not a secret). One env var flips the mount:
export ALERTMANAGER_BOT_TOKEN_FILE=./monitoring/alertmanager/bot_token

# 3. (Re)start alertmanager
docker compose -f docker-compose.yml -f docker-compose.monitoring.yml up -d alertmanager
```

`monitoring/alertmanager/bot_token` is gitignored — only `bot_token.example`
is tracked. Alert rules live in `prometheus/alerts.yml`; routing in
`alertmanager/alertmanager.yml`.
