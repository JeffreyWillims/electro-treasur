# components/budgets

- `BudgetList.tsx` — главный компонент раздела «Бюджеты»: единственный `useQuery`
  дашборда за период, вкладки фильтра конвертов (Все/В норме/Перерасход),
  раскрывающееся стеклянное окно конвертов; собирает вместе `BudgetDiscipline`,
  `Safe` и `BudgetEnvelopes` (см. `../dashboard/README.md`).
