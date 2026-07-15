# components/consultant

- `MyClients.tsx` — страница роли CONSULTANT: список клиентов, давших доступ
  (`getConsultantClients`), и просмотр их транзакций (`getClientTransactions`)
  только для чтения; редирект (`Navigate`), если у пользователя нет роли консультанта.
