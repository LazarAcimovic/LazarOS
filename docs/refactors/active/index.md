# Active refactor campaigns

> Campaigns are structural work that changes **no behaviour**. One file per campaign.
> Read this index first, then only the campaign file you are working on.

Progress counts subtasks; a subtask counts as done only when every one of its boxes is ticked.

`What's left` describes the *remaining* work in a dozen words or so.

| Campaign | Title | Progress | What's left | Depends on | Blocks | File |
|---|---|---|---|---|---|---|
| refactor-01 | Split global.css by concern | 0/1 | **Superseded by refactor-06 (D-020)** — global.css deleted, split moot | — | — | [refactor-01-split-global-css.md](refactor-01-split-global-css.md) |
| refactor-06 | Transform frontend to the React 19 feature-sliced stack | 7/8 | final e2e closes R06.6 | refactor-02, refactor-03 | — | [refactor-06-frontend-transformation.md](refactor-06-frontend-transformation.md) |
