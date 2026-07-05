# Frontend Rules

Conventions observed in `frontend/src/` — follow these when writing or reviewing frontend code.

## Components

- Functional components + hooks only, TypeScript throughout (React 19). Components are organized
  by domain under `src/components/{analytics,auth,budgets,dashboard,insights,layout,profile,ui}/`
  — put new components in the matching domain folder, not a generic `components/` root.

## Data fetching

- Plain, one-shot API calls (fetch-and-done, e.g. `fetchTransactions`, `createTransaction`) are
  typed wrapper functions in the single `src/api/client.ts` — not one hook per endpoint. They
  return `Promise<T>` with contract types imported from `@/types`, and throw a typed `ApiError` on
  non-2xx responses.
- Anything that needs caching, polling, or invalidation (e.g. `useLLMInsight.ts`) is a **TanStack
  Query** hook built on top of the `client.ts` functions — use `useQuery`'s `refetchInterval` for
  polling, not a raw `useEffect` + `setInterval`/`setTimeout`. Query does its own cleanup; don't
  hand-roll interval teardown.
- Auth: JWT is read from `localStorage.getItem('aura_token')` and attached as
  `Authorization: Bearer <token>` in the request headers. Reuse this convention rather than adding
  a second token storage/naming scheme.

## Talking to the FastAPI backend

- The API base is `/api` (proxied by Nginx to the backend, prefix stripped — see
  `docs/API_REFERENCE.md`). Endpoint paths in `client.ts` are the backend's own paths
  (`/v1/...`), not re-prefixed with `/api` again.
- Pydantic v2 on the backend does **strict** Decimal validation — always send money fields as
  strings (`payload.amount.toString()`), never raw JS numbers, or the request will be rejected.
- Datetimes: convert to ISO and swap the `Z` suffix for `+00:00` when the backend expects an
  offset it can parse (see `createTransaction` in `client.ts`) — a workaround for Python's
  `datetime.fromisoformat` parsing, not a general pattern to copy blindly elsewhere without need.

## Styling

- Tailwind CSS v3 utility classes; the UI is deliberately glassmorphic (backdrop-blur, gradients).
  Match the existing visual language in `components/ui/` rather than introducing a new styling
  approach (CSS modules, styled-components, etc.).

## Linting

- ESLint flat config: `@eslint/js` recommended + `typescript-eslint` recommended +
  `eslint-plugin-react-hooks` + `eslint-plugin-react-refresh` (Vite variant). Run `npm run lint`
  before considering frontend work done.
