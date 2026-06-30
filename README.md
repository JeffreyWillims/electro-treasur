# 🏦 Citrine Vault (Electro-Treasur)

**Live Production:** [https://citrinevault.ru](https://citrinevault.ru)  
**Telegram Assistant:** [@citrine_vault_bot](https://t.me/citrine_vault_bot)

Привет! Меня зовут Евгений. Как инженер, который ценит абсолютную точность и внимание к деталям, я не мог ограничиться созданием обычного трекера расходов. 

**Citrine Vault** — это премиальная, геймифицированная финансовая «Система Управления Будущим». Я спроектировал этот проект с архитектурой уровня финтех-компаний: от глубокой реактивности фронтенда и физики интерфейса до микросервисного бэкенда с пулингом коннектов и защитой от состояний гонки (Race Conditions).

---

## 🌟 Ключевые возможности

* **Премиальный "Glassmorphic" UI:** Погружающее React-приложение с эстетикой "California Organic Luxury" (теплые градиенты Citrine, слои размытия, утонченная типографика Cormorant Garamond / Space Mono).
* **"Precision Lock" Layout:** Безупречные Fintech-интерфейсы, созданные с помощью Tailwind CSS и Framer Motion с абсолютным вниманием к геометрической точности.
* **AI Консультант & OCR (V.I.A.):** Умный Telegram-ассистент, способный читать фотографии чеков и банковских выписок, очищать Tesseract-шум и автоматически маршрутизировать расходы по категориям.
* **Zero-G Security (Backend):** Безопасное FastAPI-приложение на базе строгих моделей `pydantic`, JWT-авторизации, Redis-троттлинга (защита от Brute Force) и паттерна **Idempotency Keys** для защиты баланса пользователя от двойных списаний.
* **Мгновенная Реактивность (Kinetic UX):** Интеграция с `react-query` обеспечивает моментальные отклики интерфейса (Kinetic Abacus) без сетевых задержек.

---

## 🛠 Технологический стек и Архитектура

Я не тренируюсь на Production, поэтому каждое решение здесь обкатано и обосновано.

### Frontend
* **React 18** (Vite + TypeScript)
* **Tailwind CSS V3** + **Framer Motion** (для кинетических анимаций и физики интерфейса)
* **TanStack Query** (Кэширование, извлечение данных и мутации)

### Backend & AI
* **FastAPI** (Python 3.12, Strict Mypy Typing)
* **SQLAlchemy 2.0 + asyncpg** (Полностью асинхронное взаимодействие с БД)
* **Aiogram 3** (Telegram-бот с поддержкой HTTP Proxy для обхода блокировок)
* **Tesseract OCR + LLM** (Распознавание документов)
* **Pytest & Hypothesis** (Unit/Integration тестирование, вложенные транзакции `db_session`)

### DevOps & Инфраструктура
* **PostgreSQL 16 + PgBouncer** (Transaction Pool Mode для защиты базы от исчерпания коннектов)
* **Redis 7** (Кэширование, Rate Limiting, Celery/RQ)
* **Nginx** (Reverse proxy, раздача статики, SSL/TLS редиректы)
* **Docker & Docker Compose** (Полная изоляция сервисов)
* **GitHub Actions** (CI/CD: линтеры Ruff, Mypy, проверка CVE, автосборка)

---

## 🚀 Локальный запуск (Development)

Проект полностью докеризован. Для запуска вам потребуются только Git и Docker.

1. **Клонируйте репозиторий:**
   ```bash
   git clone https://github.com/JeffreyWillims/electro-treasur.git
   cd electro-treasur
   
2. **Настройте переменные окружения:**
   Создайте файл `.env` на основе шаблона и укажите свои ключи (JWT Secret, Telegram Token).
   ```bash
   cp .env.example .env
   
3. **Запустите инфраструктуру:**
   ```bash
   docker-compose up -d --build
   
4. **Примените миграции Базы Данных:**
   ```bash
   docker-compose exec backend alembic upgrade head
   
## Доступ к Приложению:
- Frontend: http://localhost:5173 (Vite)
- Backend API Docs: http://localhost:8000/docs (Swagger UI)

## ⚖️ Лицензия
Все права защищены. Разработано с вниманием к каждой детали.