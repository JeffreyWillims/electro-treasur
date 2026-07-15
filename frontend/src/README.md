# src

Корень фронтенда Citrine Vault (React 19 + Vite + TypeScript + Tailwind).
Общий обзор архитектуры фронтенда — в `frontend/README.md`; этот файл — точечный
индекс файлов и подпапок именно `src/`.

- `main.tsx` — точка входа: монтирует `<App />` в `#root` (StrictMode).
- `App.tsx` — корневой компонент: провайдеры (`QueryClientProvider`, `BrowserRouter`,
  `Toaster`), маршруты и общий layout (Sidebar + Outlet).
- `App.css` — утилитарные стили уровня приложения (базовый layout-контейнер и т.п.).
- `index.css` — глобальные стили: подключение шрифтов (Inter, Playfair Display, Space Mono),
  Tailwind-директивы, стили `react-phone-number-input`.
- `api/` — типизированный клиент бэкенда и хуки поверх него, см. `api/README.md`.
- `assets/` — статические изображения/иконки, см. `assets/README.md`.
- `components/` — все React-компоненты, см. `components/README.md`.
- `context/` — React Context-провайдеры (авторизация, тема), см. `context/README.md`.
- `data/` — тестовые/мок-данные для разработки, см. `data/README.md`.
- `lib/` — утилиты общего назначения, см. `lib/README.md`.
- `types/` — TypeScript-типы контракта с бэкендом, см. `types/README.md`.
