# Active refactor campaigns

> Campaigns are structural work that changes **no behaviour**. One file per campaign.
> Read this index first, then only the campaign file you are working on.

Progress counts subtasks; a subtask counts as done only when every one of its boxes is ticked.

`What's left` describes the *remaining* work in a dozen words or so.

| Campaign | Title | Progress | What's left | Depends on | Blocks | File |
|---|---|---|---|---|---|---|
| refactor-01 | Split global.css by concern | 0/1 | 1006-line monolith + no CSS module layout | — | — | [refactor-01-split-global-css.md](refactor-01-split-global-css.md) |
| refactor-05 | Replace raw SQL with Prisma ORM | 6/6 | done — ready to archive | refactor-04 | task-05 | [refactor-05-prisma-orm.md](refactor-05-prisma-orm.md) |
| refactor-06 | Transform frontend to the React 19 feature-sliced stack | 0/8 | stack upgrade, restructure, rebuild on shadcn | refactor-02, refactor-03 | — | [refactor-06-frontend-transformation.md](refactor-06-frontend-transformation.md) |
