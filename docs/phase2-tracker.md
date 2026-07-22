# Phase 2 — Skeleton: Execution Tracker

**Not a planning document, not a ticket.** `SPEC.md` §15 is the sequencing
authority and §13 is the contract. **GitHub issues in `PinetheApple/kitbag` are
the tickets** — they carry per-task state, the blocked-by dependency spine, and
the review trail. This file holds only what a flat issue list can't: **the wave
map, the conflict map, and the graveyard.** When a task's status here disagrees
with the issue, **believe the issue.**

Scope: **SPEC §15 Phase 2** — `core-native` (JSI HostObject + TurboModule),
the eval-harnessed lint rules, the Drizzle migration off v6, and the one screen
that proves §13.2/§13.3 on a device. No product.

**The whole phase gates on one device test (§13.3, #33).** If a Reanimated
worklet writing a `SharedValue` cannot hold a beat sweep steady under a starved
JS thread, that is a foundation problem and everything above it is rework. Build
to the gate first; do not fan out Phase 3 on an unproven foundation.

Status legend: `[ ]` todo · `[~]` in progress · `[x]` done (verify green + both reviews pass) · `[!]` blocked

## Current state — 2026-07-22, `feat/phase2-skeleton` (off main; Phase 1 merged via PR #26)

**Done:** none — phase just seeded.
**In progress:** none.
**Next:** Wave 0 — `P2-S` (#27) monorepo skeleton. Blocks everything.

## Two walls this phase cannot self-clear

1. **The device gate (#33, §13.3).** `P2-A6` is user-run on a physical device.
   The user has a device. The autonomous loop stops here and hands off a runbook.
   Gate blocks all of Phase 3.
2. **F-Droid toolchain (#38, §13.8.1).** NativeWind 5 preview + Hermes/lightningcss
   inclusion rests on one clause `docs/fdroid-expo-research.md` could not verify
   from raw HTML. Blocks ship, not scaffold. Re-fetch+diff raw, or submit a draft
   RFP and read the reviewer.

## Wave map

| Wave | Tasks | Runs |
|---|---|---|
| 0 | `P2-S` #27 | skeleton — serial, blocks all |
| 1 | `P2-A1` #28 · `P2-B1` #34 · `P2-B2` #35 · `P2-B4` #37 · `P2-B5` #38 | parallel after #27 |
| 2 | `P2-A2` #29 · `P2-A3` #30 (after #28) · `P2-B3` #36 (after #35) | parallel |
| 3 | `P2-A4` #31 (after #29, #30) | native build integration |
| 4 | `P2-A5` #32 (after #31) | 60fps gate app + JS-starvation test |
| 5 | `P2-A6` #33 (after #32) | **DEVICE GATE — user-run** |

**Track A** (#28→#29/#30→#31→#32→#33) is the load-bearing spike to the device
gate — build this first. **Track B** (#34, #35→#36, #37, #38) is headless and
parallel; it does not need a device and does not gate Phase 3, but #35/#36 must
land before any tool package is trusted to respect the boundary rules.

## Conflict map

- `core-native` (#29, #30) is one package edited by two tasks — TurboModule and
  HostObject. Same package, disjoint files; land #28 first so the package exists,
  then #29/#30 can run parallel if file ownership is split cleanly.
- Everything writes into a fresh workspace created by #27 — no task before it.

## Issue index

| Task | Issue | Task | Issue |
|---|---|---|---|
| P2-S skeleton | [#27](https://github.com/PinetheApple/kitbag/issues/27) | P2-A6 device gate | [#33](https://github.com/PinetheApple/kitbag/issues/33) |
| P2-A1 plugin-api | [#28](https://github.com/PinetheApple/kitbag/issues/28) | P2-B1 core-db migration | [#34](https://github.com/PinetheApple/kitbag/issues/34) |
| P2-A2 TurboModule | [#29](https://github.com/PinetheApple/kitbag/issues/29) | P2-B2 eslint-plugin | [#35](https://github.com/PinetheApple/kitbag/issues/35) |
| P2-A3 HostObject | [#30](https://github.com/PinetheApple/kitbag/issues/30) | P2-B3 eval harness | [#36](https://github.com/PinetheApple/kitbag/issues/36) |
| P2-A4 native build | [#31](https://github.com/PinetheApple/kitbag/issues/31) | P2-B4 NativeWind tokens | [#37](https://github.com/PinetheApple/kitbag/issues/37) |
| P2-A5 gate app | [#32](https://github.com/PinetheApple/kitbag/issues/32) | P2-B5 F-Droid clause | [#38](https://github.com/PinetheApple/kitbag/issues/38) |

## Graveyard

_(empty — record disproved / deliberately-unfixed work here as it happens, so a
future reader doesn't re-attempt it. See Phase 1's tracker for the pattern.)_
