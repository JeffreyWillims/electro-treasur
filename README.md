# Citrine Vault (Electro Treasur)

Citrine Vault (ранее Aura Wealth) — это премиальная, геймифицированная финансовая "Система Управления Будущим" и трекер капитала. Проект построен на архитектуре уровня Apple Fintech с глубокой реактивностью фронтенда, элементами геймификации и микросервисной базой с использованием FastAPI и PostgreSQL.

## 🌟 Ключевые возможности

*   **Премиальный "Glassmorphic" UI**: Погружающее React-приложение с поддержкой темной/светлой тем, использующее передовую эстетику "California Organic Luxury" (теплые градиенты Citrine, слои размытия, утонченная типографика Cormorant Garamond / Space Mono).
*   **"Precision Lock" Layout**: Безупречные Fintech-интерфейсы в стиле Apple, созданные с помощью Tailwind CSS, Framer Motion и абсолютного внимания к геометрической точности.
*   **Интеллектуальный Дашборд**: Детализированные метрики (Общий капитал, Доходы, Расходы), кинетические интерактивные графики и геймифицированные индикаторы роста капитализации.
*   **AI Консультант (Savings Navigator)**: Модуль "Кабины Пилота" с физикой пружин `framer-motion` (Spring Haptics), встроенным симулятором выживаемости капитала и оптимизированными советами ИИ по сбережению средств.
*   **Zero-G Security (Backend)**: Безопасное FastAPI-приложение на базе строгих типизированных моделей `pydantic`, изолированных контекстов пользователей, JWT-авторизации, Redis-троттлинга и детальной телеметрии.
*   **Мгновенная Реактивность (Kinetic UX)**: Полная интеграция с `react-query`, обеспечивающая моментальные отклики интерфейса (Kinetic Abacus) и ввод транзакций без задержек.
*   **Полная Докеризация**: Разработка и деплой оркестрируются через стандартный `docker-compose.yml`.

## 🛠 Технологический стек

### Frontend
*   **React 18** (Vite + TypeScript)
*   **Tailwind CSS V3**
*   **Framer Motion** (для кинетических анимаций и физики интерфейса)
*   **TanStack Query** (Извлечение данных и мутации)
*   **Lucide React** (Единая система иконок)
*   `react-phone-number-input` & `recharts`

### Backend
*   **FastAPI** (Python 3.11+)
*   **SQLAlchemy** (Асинхронные запросы)
*   **PostgreSQL 15** 
*   **Redis**
*   **Alembic** (Миграции БД)
*   **Pytest & Hypothesis** (Тестирование свойств и интеграции)

### DevOps
*   Docker & Docker Compose
*   Манифесты готовности к Kubernetes (`/k8s`)
*   Модули нагрузочного тестирования (`/load_testing`)

## 🚀 Начало работы

### Требования

Убедитесь, что на вашем локальном компьютере установлены Docker и Docker Compose.

### Установка и Запуск

1. **Клонировать репозиторий:**
   ```bash
   git clone https://github.com/JeffreyWillims/electro-treasur.git
   cd electro-treasur
   ```

2. **Запустить весь стек:**
   ```bash
   docker-compose up -d --build
   ```

3. **Миграции Базы Данных:**
   ```bash
   # Войти в контейнер бэкенда и применить миграции
   docker-compose exec backend bash
   alembic upgrade head
   ```

4. **Доступ к Приложению**:
   *   **Frontend**: Перейдите на `http://localhost:4000` (по умолчанию Vite работает на 4000 или 5173).
   *   **API Документация Backend**: Перейдите на `http://localhost:8000/docs` для просмотра полного интерфейса Swagger UI.

## 🤝 Структура Проекта

```text
├── backend/
│   ├── src/                 # Основная логика FastAPI (маршруты, схемы, модели)
│   ├── migrations/          # Миграции Alembic для PostgreSQL
│   ├── tests/               # Набор тестов Pytest
│   ├── requirements.txt     # Python зависимости
├── frontend/
│   ├── src/
│   │   ├── api/             # Запросы React Query 
│   │   ├── components/      # Функциональные компоненты и модули интерфейса
│   │   ├── context/         # AuthContext
│   │   └── App.tsx          # Маршрутизация и Конфигурация Приложения
│   ├── tailwind.config.js
│   ├── package.json
├── k8s/                     # Конфигурации для деплоя Kubernetes
├── load_testing/            # Скрипты Artillery или Locust
├── docker-compose.yml       # Полная конфигурация стека
```

## ⚖️ Лицензия

Все права защищены.
