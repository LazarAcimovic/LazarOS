# Tech — Frontend

## Section index

> Agents: do not Read this file whole. `grep -n "^## " docs/Tech-Frontend.md` for live line
> numbers, then Read with `offset`/`limit`.

| Section | Title |
|---|---|
| 1 | Project layout |
| 2 | Patterns in use, and not in use |
| 3 | HTTP client |
| 4 | Data-fetching template |
| 5 | Routing and auth gate |
| 6 | State |
| 7 | Forms and validation |
| 8 | Styling |
| 9 | Testing |

## 1. Project layout

> verified at: pending — stamped with the R06.8 commit sha (regenerated from the refactor-06 working tree).

```
frontend/
├── .env.development              # VITE_API_URL=http://localhost:5000/api
├── components.json               # shadcn config (aliases, Tailwind v4, no tailwind.config)
├── index.html
├── package.json
├── tsconfig.json                 # strict, "@/*" → "src/*"
├── vite.config.ts                # react plugin + React Compiler, @tailwindcss/vite, "@" alias, test block
└── src/
    ├── app/
    │   ├── App.tsx               # mounts providers + <RouterProvider/>
    │   └── index.css             # Tailwind entry: theme + preflight + utilities imports, @theme tokens, .dark, base body
    ├── components/
    │   ├── ui/                   # shadcn primitives (button, input, dialog, badge, card, ...), generated, owned
    │   ├── layout/               # AppLayout
    │   ├── navigation/           # NavBar
    │   └── shared/               # app composites: ConfirmDialog, ErrorState, Loader, Modal, Pagination
    ├── config/
    │   └── constants.ts          # APP_ROUTES, API_ROUTES
    ├── features/
    │   ├── auth/                 # api/, models/ (types + Zod), pages/ (LoginPage, RegisterPage), index.ts
    │   ├── settings/             # pages/ (SettingsPage), index.ts
    │   └── tasks/                # api/, components/, hooks/, models/, pages/, utils/, test-utils.ts, index.ts
    ├── hooks/                    # cross-feature hooks: useAsync, usePagination
    ├── lib/
    │   └── utils.ts              # cn() (clsx + tailwind-merge), required by shadcn
    ├── main.tsx
    ├── providers/                # AuthGuard, router.tsx
    ├── shared/
    │   ├── api/apiClient.ts      # the shared axios instance
    │   └── utils.ts              # getApiError
    ├── store/                    # authStore.ts, themeStore.ts
    ├── test/
    │   └── setup.ts              # jest-dom matchers + MSW server
    └── vite-env.d.ts
```

Rules for the layout:

- A feature never imports from another feature's internals — only from its `index.ts` barrel.
  Cross-feature code that is not a barrel export belongs in `components/shared`, `hooks/` or `shared/`.
- `components/ui/` holds only shadcn primitives; app-specific composites go in `components/shared/`.
- `Settings` is a single screen mixing auth and theme; it gets a `features/settings/` slice
  so no page lives outside a feature.

## 2. Patterns in use, and not in use

**In use:**

- **React 19.2 with the React Compiler** (`babel-plugin-react-compiler` via the Vite React
  plugin). Do not hand-write `useMemo` / `useCallback` / `React.memo` for performance; write
  plain components and let the compiler memoise. A hook that needs a stable identity for
  correctness (an effect dependency) may still use `useCallback`.
- **Feature-Sliced Design** for `auth`, `tasks` and `settings` — each feature owns `api/`,
  `models/`, `components/`, `pages/`, and optionally `hooks/` and `utils/`.
- **Barrel files.** Every feature folder exposes an `index.ts`; imports from outside the
  feature go through it.
- **Custom hooks for async state** — `useAsync` wraps every fetch in an `AbortController` and
  returns `{ data, isLoading, error, reload }`. Feature hooks (`useTaskMutations`) centralise
  multi-step flows.
- **Data router** (react-router-dom v7) — see §5.
- **Zustand 5** for global client state — see §6.
- **`react-hook-form` + `@hookform/resolvers/zod`** for forms; **Zod** schemas live in
  `models/` and mirror the backend — see §7.
- **Tailwind v4 + shadcn/radix primitives + lucide-react icons** — see §8.

**Not in use — do not introduce:**

- No **query cache** (`react-query`, `swr`). `useAsync` is the agreed shape.
- No **refresh-token / silent-retry machinery** — see §3 (D-007, D-020).
- No **CSS-in-JS** and no hand-written stylesheet beyond the Tailwind entry file.
- No **i18n layer.** English copy only.
- No **SSR / framework router** (Next, Remix). The SPA stays a Vite build.

## 3. HTTP client

[`src/shared/api/apiClient.ts`](../frontend/src/shared/api/apiClient.ts) is a single axios
instance:

- `baseURL = import.meta.env.VITE_API_URL ?? "/api"`.
- `withCredentials: true` — required for the `jwt` cookie.
- `Content-Type: application/json`.
- One response interceptor:
  - If the response is `401` **and** the request was not `GET /auth/me` **and** the current
    route is not `/login` or `/register`, hard-redirect to `/login`.
  - Otherwise the rejection propagates.

**There is no refresh token.** LazarOS issues a single 30-day JWT cookie (D-007). The client
therefore has **no** token-refresh endpoint, **no** request queue, **no** silent retry of the
failed request and **no** `_retry` flag: a 401 means the session is over and the user goes to
`/login`. Reference patterns that describe refresh-and-retry do not apply here (D-020); adding
one is a new product rule and needs its own Decisions entry first.

**All feature `api/` modules call `apiClient` with paths relative to `baseURL`** — never with
hardcoded absolute URLs. Each `api/` function takes an optional `AbortSignal` and returns the
parsed `data`, not the axios response.

## 4. Data-fetching template

Reads go through `useAsync`; the fetcher is a plain function of its arguments:

```ts
const fetcher = (signal: AbortSignal) => apiGetX(args, signal);
const { data, isLoading, error, reload } = useAsync(fetcher, "Failed to load X");
```

Under the React Compiler the fetcher does not need `useCallback`; `useAsync` re-runs when the
fetcher's captured inputs change. Then:

- `if (isLoading) return <Loader />;`
- `if (error) return <ErrorState message={error} />;` (a `components/shared` composite built on
  the shadcn `Alert`).
- Render.

Mutations call the `api/` function and then `reload()`, or go through the feature's mutation
hook (`useTaskMutations`), which exposes `{ run, isPending, error }`-style handlers; the error
is surfaced as the current screen already does (behaviour is frozen — no new toast layer). See
[TodayPage.tsx](../frontend/src/features/tasks/pages/TodayPage.tsx) for a canonical example.

## 5. Routing and auth gate

[`providers/router.tsx`](../frontend/src/providers/router.tsx) builds a **data router** with
`createBrowserRouter` (react-router-dom v7) and `App` renders `<RouterProvider router={router} />`:

- Public routes: `/login`, `/register`.
- A single `AuthGuard` layout route wraps every authenticated page, nested under `AppLayout`.
- Routes come from `APP_ROUTES` in [config/constants.ts](../frontend/src/config/constants.ts);
  never hardcoded strings.
- Pages are lazy-loaded with the route `lazy` property. Route `loader`s are **not** used for
  data (fetching stays in `useAsync`, §4); the data router is adopted for its API, not to move
  fetching.

[`AuthGuard`](../frontend/src/providers/AuthGuard.tsx):

- On mount, calls `GET /auth/me`.
- 200 → sets `user` in `authStore`, renders `<Outlet />`.
- 401 → sets `user = null`, which triggers `<Navigate to="/login" replace />`.
- While loading, renders `<Loader />`.

## 6. State

Zustand 5, two stores under `store/`, no persist middleware except `themeStore` writing to
`localStorage` by hand (through `services/`).

- **Selector convention.** Components subscribe with a selector per field —
  `useAuthStore((s) => s.user)` — never `useAuthStore()` whole. Selectors returning a new
  object or array must use `useShallow` (Zustand 5 otherwise loops on an unstable snapshot).
  Stores are created with `create<State>()(...)`.
- [`authStore`](../frontend/src/store/authStore.ts): `user`, `isLoading`, `setUser`,
  `setLoading`. Populated by `AuthGuard` on startup and by login/register pages after submit.
- [`themeStore`](../frontend/src/store/themeStore.ts): `theme`, `toggleTheme`. Initial value is
  `localStorage.getItem("theme")` falling back to `prefers-color-scheme`. `toggleTheme` writes
  both to `localStorage` and the `dark` class / `data-theme` attribute on `<html>`; the initial
  value is applied by `ThemeProvider`.

Component state is `useState`; derived values are plain expressions (the compiler memoises).
There is no global task cache.

## 7. Forms and validation

- Each form uses `useForm` from `react-hook-form` with `zodResolver(schema)`; the schema lives
  in the owning feature's `models/` and is the same one the backend mirrors.
- Fields render through the shadcn `Form` / `Input` / `Label` primitives; the first error per
  field is shown inline under it.
- Server errors from axios come back through `getApiError` in [shared/utils.ts](../frontend/src/shared/utils.ts),
  which returns `err.response.data.message ?? fallback`; the form shows them in an `Alert` strip
  (or `setError` for field-level cases).
- Validation rules and messages are unchanged by the migration (behaviour is frozen).

## 8. Styling

- **Tailwind CSS v4** via `@tailwindcss/vite`. The only stylesheet is
  `src/app/index.css`; there is no `tailwind.config.js` — tokens live in an `@theme` block (UI §1).
- Style with utility classes. Variants of a component are declared with `cva`; class lists are
  merged with `cn()` from `src/lib/utils.ts` (`clsx` + `tailwind-merge`).
- **shadcn/ui** primitives are generated into `components/ui/` by the CLI and then owned by
  the repo (edit freely, no upstream sync). Icons are `lucide-react`.
- Dark mode is a `dark` class on `<html>` (custom variant `@custom-variant dark`), set by
  `ThemeProvider`; with no stored choice it follows `prefers-color-scheme`.
- Breakpoints are Tailwind's defaults; the mobile layout switches at `md` (768px), matching UI §10.
- BEM and `global.css` are retired in R06.7 (D-020).

## 9. Testing

**Framework: Vitest + @testing-library/react + jsdom + MSW** (Vitest stack added in `refactor-02` R02.2; MSW by `refactor-06`).

Run with `cd frontend && npm test` (executes `vitest run`, non-interactive).

### Setup

- `vite.config.ts` carries the `test` block: `environment: "jsdom"`, `globals: true`,
  `setupFiles: ["./src/test/setup.ts"]`.
- `src/test/setup.ts` imports `@testing-library/jest-dom` (DOM matchers), starts the **MSW**
  node server (`server.listen({ onUnhandledRequest: "error" })`), resets handlers after each test
  and closes it at the end.
- `src/test/` also holds the MSW `server.ts` + default `handlers.ts`, a `renderWithProviders`
  helper (data router via `createMemoryRouter`) and shared fixtures (`makeTask`,
  `makeDashboardTask`, `localDate`).
- `tsconfig.json` includes `"types": ["vitest/globals"]`.

### Where tests live

Component tests sit beside their component: `TaskCard.test.tsx` next to `TaskCard.tsx`.
Page / integration tests follow the same co-location rule under their feature slice.

### Mocking convention

Mock the network, not the modules. Tests use **MSW** handlers (`server.use(http.get(...))`) so
the real `apiClient`, the real `api/` functions and the real hooks run; assertions check what
the page renders and which request was sent. Do not `vi.mock` a feature's `api/` module or
`axios`. Router-dependent components render through `renderWithProviders` with a memory data
router; the zustand `authStore` is reset with `useAuthStore.setState(...)` in `beforeEach`.

> **Migration note.** The suites below were written before MSW: they still mock at the `api/`
> layer (`vi.mock("../api")`) inside `MemoryRouter`, and import fixtures from
> `features/tasks/test-utils.ts`. R06.4–R06.6 convert them as they rebuild each layer; the
> behaviour they assert does not change.

### Suites in place

- Component: `TaskCard.test.tsx`.
- Auth pages: `LoginPage.test.tsx`, `RegisterPage.test.tsx` (inline Zod errors, `data-auth-error`
  strip, submitting state).
- Task pages: `TodayPage.test.tsx`, `AllTasksPage.test.tsx` (filters, `PAGE_SIZE` 10),
  `UpcomingPage.test.tsx` (grouping, "Tomorrow", `PAGE_SIZE` 5), `ArchivePage.test.tsx`
  (restore), `TaskWriteFlows.test.tsx` (create / toggle both ways / delete at the `api/` boundary).
- Provider: `providers/AuthGuard.test.tsx` (401 redirects to `/login`).
- Utils: `features/tasks/utils/index.test.ts` (unit, no render, no `api/`: `getLocalToday` returns the
  local date as `YYYY-MM-DD`, `formatDueDate` / `formatGroupDate` in `en-US` with "Tomorrow" and
  year-omitted-when-current, `priorityLabel`; the clock is faked with `vi.useFakeTimers()` +
  `vi.setSystemTime`, restored in `afterEach`).

### End-to-end (Playwright)

Run with `cd frontend && npm run test:e2e` (first run needs `npx playwright install chromium`).
No Docker. `e2e/run-e2e.mjs` prepares a dedicated **PostgreSQL** database `LazarOS_E2E` on the
local server (created if missing via the maintenance `postgres` database), resets it by dropping the
`public` schema and applying the Prisma migrations (`backend/prisma/migrations`), then runs
`playwright test`. Playwright's `webServer` array (`playwright.config.ts`)
starts the backend on port 5001 (`DATABASE_URL` pointing at `LazarOS_E2E`, plus `JWT_SECRET`) and
Vite on port 5174 with `VITE_API_URL` set to `http://localhost:5001/api` (process env beats
`.env.development`). Specs live in `frontend/e2e/` and are excluded from Vitest. Ports,
credentials and the connection are defined once in `e2e/e2eConfig.mjs`. The e2e database is
separate from the dev and backend test databases. Journeys: `smoke.spec.ts` (register, land on
Today); `journeys.spec.ts` (create today + yesterday task with overdue badge; complete then
browser clock +1 day via `page.clock.install` drops it from the dashboard; delete, Archive,
restore; logout and Back stay on `/login`).
