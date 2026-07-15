# context

React Context-провайдеры глобального состояния.

- `AuthContext.tsx` — состояние авторизации: текущий пользователь, `login`/`logout`/`register`,
  подтягивает профиль через `fetchMe` из `@/api/client`.
- `ThemeContext.tsx` — переключение светлой/тёмной темы: хранит выбор в localStorage,
  учитывает системные настройки, синхронизирует класс `<html>` для Tailwind `darkMode: 'class'`.
