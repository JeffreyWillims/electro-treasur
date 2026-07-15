# components/auth

Формы входа и регистрации.

- `LoginForm.tsx` — форма входа: email/пароль, показать/скрыть пароль, вызывает
  `useAuth().login`, обрабатывает ошибки тостами.
- `RegisterForm.tsx` — форма регистрации: аналогично `LoginForm`, вызывает `useAuth().register`.
