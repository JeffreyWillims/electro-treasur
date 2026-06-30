###############################################################################
# Citrine Vault Backend — Multi-Stage Docker Build
#
# Stage 1 (builder): Install Python deps + compile C-extensions (gcc, libpq-dev)
# Stage 2 (runtime): Slim image with only runtime deps (no gcc, no dev headers)
#
# Result: ~40% smaller image, no build tools in production.
###############################################################################

# ── Stage 1: Builder ─────────────────────────────────────────────────────────
FROM python:3.12-slim-bookworm AS builder

WORKDIR /build

# Yandex mirror for faster apt in RU regions
RUN sed -i 's/deb.debian.org/mirror.yandex.ru/g' /etc/apt/sources.list.d/debian.sources 2>/dev/null || true
RUN sed -i 's/deb.debian.org/mirror.yandex.ru/g' /etc/apt/sources.list 2>/dev/null || true

# Build-time system deps (gcc for C-extensions, libpq-dev for asyncpg)
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Python deps into a virtual env for clean copy
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

COPY requirements.txt .
RUN pip install --default-timeout=100 --no-cache-dir -r requirements.txt


# ── Stage 2: Runtime ─────────────────────────────────────────────────────────
FROM python:3.12-slim-bookworm AS runtime

WORKDIR /app

# Yandex mirror
RUN sed -i 's/deb.debian.org/mirror.yandex.ru/g' /etc/apt/sources.list.d/debian.sources 2>/dev/null || true
RUN sed -i 's/deb.debian.org/mirror.yandex.ru/g' /etc/apt/sources.list 2>/dev/null || true

# Runtime-only system deps (no gcc!)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    curl \
    tesseract-ocr \
    tesseract-ocr-rus \
    && rm -rf /var/lib/apt/lists/*

# Copy pre-built virtualenv from builder stage
COPY --from=builder /opt/venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Copy application code (tests excluded via .dockerignore)
COPY . .

# Non-root user for security
RUN groupadd -r appuser && useradd -r -g appuser -d /app appuser
RUN chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4"]