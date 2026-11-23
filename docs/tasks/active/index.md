# Active implementation tasks

> Open tasks live as individual files in this folder. Read this index first, then only the
> task file you are working on. **Resume at the first unchecked subtask** and tick it in the
> same commit as its work. A task file still being here does not mean nothing has been done.

Progress counts subtasks; a subtask counts as done only when every one of its boxes is ticked.

`What's left` describes the *remaining* work in a dozen words or so; it never restates the
count, and it only changes when the shape of what remains changes.

| Task | Title | Progress | What's left | Depends on | Blocks | File |
|---|---|---|---|---|---|---|
| 1 | Fix stale API paths in README | 0/1 | README §6 endpoints vs live routes | — | — | [task-01-fix-readme-api-paths.md](task-01-fix-readme-api-paths.md) |
| 2 | Remove stale SameSite comment in apiClient | 0/1 | one comment in frontend/src/shared/api/apiClient.ts | — | — | [task-02-remove-stale-samesite-comment.md](task-02-remove-stale-samesite-comment.md) |
| 4 | Remove unused API_ROUTES constant | 0/1 | constants.ts §API_ROUTES is dead code | — | — | [task-04-remove-unused-api-routes-constant.md](task-04-remove-unused-api-routes-constant.md) |
| 5 | Forgot password + logout via Resend | 0/8 | reset flow + Resend email; logout pinned | refactor-05, refactor-03 | — | [task-05-forgot-password-and-logout.md](task-05-forgot-password-and-logout.md) |
| 6 | Preserve SQL Server data across the migration | 4/4 | — | — | — | [task-06-preserve-sqlserver-data.md](task-06-preserve-sqlserver-data.md) |
