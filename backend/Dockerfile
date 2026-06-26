FROM python:3.12-slim-bookworm

WORKDIR /app

# Устанавливаем системные пакеты и движок машинного зрения (Tesseract)
RUN apt-get update && apt-get install -y --no-install-recommends --fix-missing \
    gcc \
    libpq-dev \
    curl \
    tesseract-ocr \
    tesseract-ocr-rus \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --default-timeout=100 --no-cache-dir -r requirements.txt

COPY . .


EXPOSE 8000
CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4"]