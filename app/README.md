# BreakTimer-new app

Tauri v2 + React + TypeScript implementation of `BreakTimer-new`.

Project documentation lives in [`../docs`](../docs); start with
[`../docs/architecture.md`](../docs/architecture.md),
[`../docs/log/progress.md`](../docs/log/progress.md), and
[`../docs/log/decisions.md`](../docs/log/decisions.md).

## Commands

Run from this directory:

```shell
pnpm install --frozen-lockfile
pnpm tauri:dev
pnpm test
pnpm lint
pnpm typecheck
pnpm build
pnpm verify
```

Run from `src-tauri/`:

```shell
cargo test --all-targets
cargo check --locked --all-targets
```
