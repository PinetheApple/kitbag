# Staged TS/React enforcement config (SPEC §13.6) — WIRED at Phase 2

> **Status (#27, Phase 2 skeleton):** these files have been wired into the
> workspace root. `eslint.config.mjs` and `prettier.config.mjs` were
> `git mv`-ed to the repo root; the staged `tsconfig.json` became the root
> `tsconfig.base.json` (with `extends: "expo/tsconfig.base"` uncommented and its
> `paths` dropped in favour of `@kitbag/*` workspace package names). This
> `config/` dir now holds only this note. The history below is why they were
> staged here first.

These files were **staged ahead of the RN app**. Before Phase 2 the React
Native app did not exist (SPEC §2, §15) — there was no `package.json` and no
`src/`, so none of them could run, and staging them at the repo root would have
read as if the app already existed.

## Why a `config/` dir rather than repo root

Staging at repo root would put non-runnable ESLint/TS/Prettier files next to
`native/`, `design/`, `legacy/` and read as if the app already exists — exactly
the "docs describe code that isn't there" failure SPEC §2 documents. Keeping
them in `config/` marks them as staged. Wiring at Phase 2 is a move:

```
# from the app/workspace root created by Phase 2 scaffolding
git mv config/eslint.config.mjs .
git mv config/tsconfig.json      .        # or merge into the generated one
git mv config/prettier.config.mjs .
```

## What maps to what

| File | SPEC clause | Encodes |
|---|---|---|
| `eslint.config.mjs` | §13.6, §13.3, §9.4, §13.1 | Boundary zones, the 60fps stopgap, style rules |
| `tsconfig.json` | §13.8 | Strict TS, extends `expo/tsconfig.base` |
| `prettier.config.mjs` | — | 80-col to match the C++ core |

The intended lint layer (SPEC §13.6) is `eslint-plugin-kitbag` — a real plugin
with an eval harness. It **does not exist yet**. This ESLint config is the
generic-rule layer that holds until that plugin lands; the boundary and 60fps
rules here are best-effort stopgaps (see the honest limitations in
`eslint.config.mjs`), not the final enforcement.

## Commands (once `package.json` exists)

```bash
# lint — SPEC §13.6: the custom_lint `--fatal-infos` analogue is --max-warnings 0
pnpm eslint . --max-warnings 0

# typecheck
pnpm tsc --noEmit

# format check / write
pnpm prettier --check .
pnpm prettier --write .
```

## Devitle dependencies these configs assume (install at Phase 2, not now)

Do **not** install these yet. Listed so Phase 2 knows the set:

- `eslint`, `typescript-eslint`, `@eslint/js`
- `eslint-plugin-react`, `eslint-plugin-react-hooks`
- `eslint-plugin-react-native`
- `prettier`, `eslint-config-prettier`
- (future) `eslint-plugin-kitbag` — the real §13.6 enforcement

Versions track the reference working setup (`~/Development/verse_learning_app`:
Expo 55, RN 0.83, TS 5.9). Pin at install time against the actual lockfile;
this repo has no lockfile to validate against yet.

## Honesty note (SPEC §2)

These configs are **not validated**. They cannot be — there is no `package.json`
to resolve plugins against and no source to lint. Do not report them as
"passing". They parse as hand-written JS/JSON; that is the only claim made here.
