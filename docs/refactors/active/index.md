# Active refactor campaigns

> Campaigns are structural work that changes **no behaviour**. One file per campaign.
> Read this index first, then only the campaign file you are working on.

Progress counts subtasks; a subtask counts as done only when every one of its boxes is ticked.

`What's left` describes the *remaining* work in a dozen words or so.

| Campaign | Title | Progress | What's left | Depends on | Blocks | File |
|---|---|---|---|---|---|---|
| refactor-01 | Split global.css by concern | 0/1 | 1006-line monolith + no CSS module layout | — | — | [refactor-01-split-global-css.md](refactor-01-split-global-css.md) |
| refactor-02 | Introduce a test framework on both tiers | 0/2 | no test runner on backend or frontend | — | every future `Test:` subtask | [refactor-02-introduce-test-framework.md](refactor-02-introduce-test-framework.md) |
