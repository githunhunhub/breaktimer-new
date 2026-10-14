# BreakTimer app

Tauri v2 + React + TypeScript implementation of BreakTimer.

Project documentation lives in [`../docs`](../docs); start with
[`../docs/roadmap.md`](../docs/roadmap.md) and
[`../docs/architecture.md`](../docs/architecture.md).

## Commands

Run from this directory:

```shell
pnpm install --frozen-lockfile
pnpm tauri:dev
pnpm test
pnpm lint
pnpm typecheck
pnpm build
```

Run from `src-tauri/`:

```shell
cargo test --all-targets
cargo check --locked --all-targets
```
