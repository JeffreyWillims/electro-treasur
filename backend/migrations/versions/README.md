# versions

Файлы миграций Alembic в хронологическом порядке (по цепочке `down_revision`,
не по алфавиту — имена файлов это хеши/произвольные id ревизий).

1. `001_initial_schema.py` — начальная схема: Users, Categories, BudgetPlans, Transactions.
2. `2898dc65dcd1_zen_finance_models.py` — таблицы `budgets` и `budget_plans`, иерархия категорий (`parent_id`, `icon`).
3. `d05756d8f778_add_authentication_and_profile_fields_.py` — поля аутентификации и профиля в `users`.
4. `be3bb58149d3_add_monthly_income_to_users.py` — поле `monthly_income` в `users`.
5. `6825ab5d3032_add_performance_indexes.py` — индексы для ускорения частых запросов.
6. `efe8619e215d_add_comment_to_transactions.py` — поле-комментарий в `transactions`.
7. `a1b2c3d4e5f6_add_telegram_chat_id_to_users.py` — `telegram_chat_id` в `users` (привязка Telegram-бота).
8. `bb95b3b80349_add_insights_table.py` — таблица `insights` (AI Анализ).
9. `87839f63308a_add_bank_offers_table.py` — таблица `bank_offers` (банковские предложения).
10. `c1d2e3f4a5b6_add_feedback_table.py` — таблица `feedback` (обратная связь пользователей).
11. `e7a8b9c0d1f2_add_rbac_consultant_access_api_keys.py` — таблицы `role`, `consultant_access`, `api_keys` (RBAC и доступ консультанта).
12. `f3b4c5d6e7a8_add_merchant_rules_table.py` — таблица `merchant_rules` (правила авто-категоризации по продавцу).
13. `a9b8c7d6e5f4_add_game_scores_table.py` — таблица `game_scores` (результаты игр).
14. `f623ec9b0921_add_savings_goals_table.py` — таблица `savings_goals` (цели/Сейф).
15. `7848b98b914b_tax_rules_reference_table_fts.py` — справочная таблица `tax_rules` + полнотекстовый поиск (FTS).
16. `b9c0d1e2f3a4_add_notifications_table.py` — таблица `notifications` (колокольчик уведомлений), последняя ревизия (head).

`__init__.py` — маркер пакета, пустой.
