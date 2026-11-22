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

> verified at 82e2378

```
frontend/
├── .env.development              # VITE_API_URL=http://localhost:5000/api
├── index.html
├── package.json
├── tsconfig.json                 # strict, "@/*" → "src/*"
├── vite.config.ts                # @ alias only (no server proxy)
└── src/
    ├── app/
    │   ├── App.tsx               # mounts RouterProvider + applies theme attribute
    │   └── styles/
    │       └── global.css        # all styling, 1006 lines (see refactor-01)
    ├── components/
    │   ├── layout/
    │   │   └── AppLayout.tsx     # NavBar + <Outlet/>
    │   ├── navigation/
    │   │   └── NavBar.tsx
    │   └── shared/
    │       ├── ConfirmDialog.tsx
    │       ├── Loader.tsx
    │       ├── Modal.tsx
    │       └── Pagination.tsx
    ├── config/
    │   └── constants.ts          # APP_ROUTES (used); API_ROUTES (unused, see task-05)
    ├── features/
    │   ├── auth/
    │   │   ├── api/index.ts
    │   │   ├── models/index.ts
    │   │   ├── pages/{LoginPage,RegisterPage}.tsx
    │   │   └── validation/index.ts
    │   └── tasks/
    │       ├── api/index.ts
    │       ├── components/{TaskCard,TaskEditDeleteModals,TaskForm}.tsx
    │       ├── hooks/useTaskMutations.ts
    │       ├── models/index.ts
    │       ├── pages/{TodayPage,UpcomingPage,AllTasksPage,ArchivePage}.tsx
    │       ├── utils/index.ts
    │       └── validation/index.ts
    ├── hooks/
    │   ├── useAsync.ts           # fetcher + AbortController + reload
    │   └── usePagination.ts
    ├── main.tsx
    ├── pages/
    │   └── SettingsPage.tsx      # (not under features/)
    ├── providers/
    │   ├── AuthGuard.tsx
    │   └── router.tsx
    ├── shared/
    │   ├── api/apiClient.ts      # the shared axios instance
    │   └── utils.ts              # getApiError
    ├── store/
    │   ├── authStore.ts
    │   └── themeStore.ts
    └── vite-env.d.ts
```

Note: `SettingsPage` lives under `src/pages/`, not under a feature slice. Settings is a
single-screen mix of auth + theme that does not warrant its own feature. If it grows, promote
it then.

## 2. Patterns in use, and not in use

**In use:**

- **Feature-Sliced Design** for `auth` and `tasks` — each feature owns `api/`, `models/`,
  `components/`, `pages/`, `validation/`, and optionally `hooks/` and `utils/`.
- **Barrel files.** Every feature folder exposes a `index.ts` barrel.
- **Custom hooks for async state** — `useAsync` wraps every fetch in an `AbortController` and
  gives back `{ data, isLoading, error, reload }`. `useTaskMutations` centralises the
  edit/delete/complete flow a page needs.
- **Form state via `useState`.** No form library.
- **Zod on the client**, mirroring the backend schemas.

**Not in use — do not introduce:**

- No **form library** (`react-hook-form`, `formik`, etc.).
- No **query cache** (`react-query`, `swr`). `useAsync` is the agreed shape.
- No **CSS framework or CSS-in-JS**. Vanilla CSS + BEM with CSS custom properties, one file
  (`src/app/styles/global.css`). Splitting that file is tracked as `refactor-01`.
- No **i18n layer.** English copy only.

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

**All feature `api/` modules call `apiClient` with paths relative to `baseURL`** — never with
hardcoded absolute URLs.

## 4. Data-fetching template

Every page follows the same shape:

```ts
const fetcher = useCallback((signal: AbortSignal) => apiGetX(args, signal), [args]);
const { data, isLoading, error, reload } = useAsync(fetcher, "Failed to load X");
```

Then:

- `if (isLoading) return <Loader />;`
- `if (error) return <div className="page-error">{error}</div>;`
- Render.

Mutations call the `api/` function directly and then `reload()` (or go through
`useTaskMutations`, which wraps the common cases). See [TodayPage.tsx:13-29](../frontend/src/features/tasks/pages/TodayPage.tsx)
for a canonical example.

## 5. Routing and auth gate

[`providers/router.tsx`](../frontend/src/providers/router.tsx) creates the browser router:

- Public routes: `/login`, `/register`.
- A single `AuthGuard` route group wraps every authenticated page, nested under `AppLayout`.
- Routes come from `APP_ROUTES` in [config/constants.ts](../frontend/src/config/constants.ts);
  never hardcoded strings.

[`AuthGuard`](../frontend/src/providers/AuthGuard.tsx):

- On mount, calls `GET /auth/me`.
- 200 → sets `user` in `authStore`, renders `<Outlet />`.
- 401 → sets `user = null`, which triggers `<Navigate to="/login" replace />`.
- While loading, renders `<Loader />`.

## 6. State

Two Zustand stores, no persist middleware except `themeStore` writing to `localStorage` by
hand.

- [`authStore`](../frontend/src/store/authStore.ts): `user`, `isLoading`, `setUser`,
  `setLoading`. Populated by `AuthGuard` on startup and by login/register pages after submit.
- [`themeStore`](../frontend/src/store/themeStore.ts): `theme`, `toggleTheme`. Initial value is
  `localStorage.getItem("theme")` falling back to `prefers-color-scheme`. `toggleTheme` writes
  both to `localStorage` and the `data-theme` attribute on `<html>`. The initial attribute is
  applied via a `useEffect` in [App.tsx:9-11](../frontend/src/app/App.tsx).

Component state is `useState` + `useMemo` for derived values. There is no global task cache.

## 7. Forms and validation

- Each form owns its fields as `useState` strings.
- On submit the form calls `schema.safeParse(raw)`; errors are collected into a
  `Record<field, message>` using the first error per path (see
  [LoginPage.tsx:27-33](../frontend/src/features/auth/pages/LoginPage.tsx) and
  [TaskForm.tsx:60-66](../frontend/src/features/tasks/components/TaskForm.tsx)).
- Server errors from axios come back through `getApiError` in [shared/utils.ts](../frontend/src/shared/utils.ts),
  which returns `err.response.data.message ?? fallback`.

## 8. Styling

- One stylesheet: [`src/app/styles/global.css`](../frontend/src/app/styles/global.css).
- BEM class naming (`task-card__body`, `btn btn--primary`, `form-group__input--error`).
- Light and dark themes via CSS custom properties, switched by `[data-theme="dark"]` on
  `<html>`; see UI §1 for the token list.
- One breakpoint: `@media (max-width: 768px)` (mobile).

## 9. Testing

**There are no automated tests on the frontend.** No Vitest, no Jest, no Testing Library, no
Playwright. This is tracked in `refactor-02`.

Until a framework lands:

- Verify UI changes manually. The PR description should say which screens were exercised.
- Prefer small, pure utility functions (`src/features/tasks/utils/index.ts`) — they will be the
  first testable surface.
- Do not stub `axios` globally; when tests arrive, the plan is to mock at the `api/` layer so
  features stay decoupled from the HTTP client.
