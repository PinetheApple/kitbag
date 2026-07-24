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

## Current state — 2026-07-23, `feat/phase2-skeleton` (off main; Phase 1 merged via PR #26)

**Done:** `P2-S` (#27) — monorepo skeleton (pnpm + Turborepo + Expo prebuild), merged `6a810f5`. Twelve packages per §13.1 with boundary edges; staged `config/` wired to root (`git mv` to `eslint.config.mjs`/`prettier.config.mjs`/`tsconfig.base.json`); Android tree committed (37 files, prebuild not F-Droid, §13.8.1); `pnpm install`/`typecheck` (12/12)/`lint --max-warnings 0` green. Device boot NOT verified — that is #33.

**Wave 1 (2026-07-23) — all landed on `feat/phase2-skeleton`, not yet pushed:** `P2-A1` (#28, `e8c5dd5`) plugin-api contract types · `P2-B1` (#34, `089da69`) core-db Drizzle schema + v6→v7 migration (setlist-preserving, sabotage-gated test) · `P2-B2` (#35, `ef9d5d1`) eslint-plugin boundary/naming rules (31 tests) · `P2-B4` (#37, `310fe41`) core-design §12.2 tokens + generated tailwind theme · `P2-B5` (#38, `0728b16`) F-Droid clause corroborated. Review round `a3ee2ff` closed two ralph findings (generated theme.css escaped the drift check under a tree-wide prettier run → `.prettierignore` + `generate:check`; plugin-api rule permitted the `react` import §9.1 forbids → rule + test fixed). Wave gate green on the integrated tree: typecheck 12/12, `lint --max-warnings 0`, core-db 4/4, eslint-plugin 31/31, `generate:check` 0.
**Wave 2 (2026-07-23) — all landed on `feat/phase2-skeleton`, not yet pushed:** `P2-A2` (#29, TurboModule spec merged `781ecbc`) command TurboModule mapping 1:1 to the flat C ABI, codegen-typed, holds no engine pointer (the HostObject does, §4.5) · `P2-A3` (#30, merged `fe9a26a`, fixes `9cb114a`) JSI HostObject typed contract + C++ scaffolding for the six polled realtime reads, and `nativeConstants.gen.ts` **generated** from engine source (sound names parsed from the `kSounds` preset comments, cross-checked against `kSoundCount`; tuner-snapshot layout, enums and bounds parsed from the header — `generate:check` re-derives them; §13.7) · `P2-B3` (#36, merged `23bbd11`, wired `21f2656`) lint eval harness ported to TS — 31/31 scenarios (13 `_pass`/18 `_fail`), each `_fail` proven to fire its expected rule (ralph sabotage probe). Review round: ralph caught the HostObject reads typed as callables (a `jsi::Function` per frame on the 60fps path, §13.3) → switched to value-properties (`9cb114a`, decision logged); the eval harness was a gate only manually → added a `test` turbo task + JS/TS CI job so typecheck/lint/drift-guards/all vitest suites run in CI (`8c06623`). Wave gate green on integrated tree: typecheck 12/12, `lint --max-warnings 0`, `generate:check` fresh (native + design), tests core-native 22 / eslint-plugin 31 / core-db 4 / app-shell eval 36.
**Wave 3 (2026-07-24) — landed on `feat/phase2-skeleton`, not yet pushed:** `P2-A4` (#31) native build integration. Android: `packages/core-native/android/CMakeLists.txt` `add_subdirectory`s the existing `native/audio_core` in place (§13.8, no copy/move), builds the JSI glue (`cpp/KitbagHostObject.cpp` + new `KitbagEngine.cpp` engine-ownership/install + `KitbagCommands.cpp` command routing) and links `kitbag_core` + RN prefab `jsi`/`reactnative` + `fbjni`; wired into `app/build.gradle` via `externalNativeBuild` + `abiFilters` + `buildFeatures { prefab true }`. iOS: `KitbagCoreNative.podspec` compiles the same glue, header-searches `native/audio_core/include`, builds the core from its own CMake (file list stays owned there, §13.7). Single-engine ownership (§4.5): `KitbagEngine.cpp` holds the one `kb_engine*` file-locally; the HostObject reads and the `command*` routing both borrow `kitbagEngine()`, never a second engine. Kotlin SKELETON stubs: `KitbagForegroundService` (§5.6), `MediaNotificationListenerService` (§13.9, port target = legacy `MediaSessionPlugin.kt`), `KitbagCorePackage` registration seam — manifest + MainApplication wired, behaviour deferred to Phase 3. **Verified here:** the three glue TUs `-fsyntax-only` against the real `jsi.h` + `kitbag_api.h` (NDK 28, aarch64); `kitbag_core` fully builds under the NDK android toolchain (arm64-v8a → `libkitbag_core.so`); typecheck 12/12, `lint --max-warnings 0`. **NOT verified (device-gated, #33):** no `gradlew`/`pod install`/on-device link ran — `find_package(ReactAndroid/fbjni)` needs a Gradle build's prefab, and this box is not macOS. The RN-runtime JSI install and the codegen'd TurboModule binding are the #33/#32 link, not done here.
**Wave 4 (2026-07-24) — landed on `feat/phase2-skeleton`, not yet pushed:** `P2-A5` (#32, `ac7f21c`) 60fps gate screen + JS-starvation harness in `app-shell/src/gate/`. The §13.3 proving surface: beat sweep, LED row and engine-BPM readout are driven entirely by a `useFrameCallback` Reanimated worklet on the UI thread reading `global[KITBAG_HOST_OBJECT_KEY]` props (`bar_phase`/`current_beat`/`current_bpm`) as allocation-free JSI doubles → SharedValues → `useAnimatedStyle`/`useAnimatedProps`; no `useState`/`runOnJS`/JS-thread on the per-frame path. React state holds only human-speed values (target BPM, beats/bar, running). Worklet reads the host defensively (holds last value until #33 installs it). `starveJsThread(STARVATION_MS)` synchronously blocks JS so #33 can confirm the sweep survives a starved JS thread (§5.8 / §13.3 corollary). Constants sourced from owners (host key ← core-native, tokens ← core-design; §13.7), no retyped literals. `tsconfig` gained `allowImportingTsExtensions` (consequence of the #30 import-safe barrel). ralph + code-reviewer both PASS-with-nits; nits fixed (wired the previously-dead `currentBpm` to `EngineBpmReadout`, trimmed comment over-density, #33 runtime caveat added). **Verified here:** typecheck 12/12, `lint --max-warnings 0`, eval 36/36. **NOT verified (device-gated, #33):** live HostObject install and the actual jitter-free 60fps measurement (recorded output, §14.1). **#33 CAVEAT (in `useBeatSweep.ts` header):** the worklet runs on the Reanimated UI runtime, whose global is separate from the JS runtime; #33's installer must publish on the UI-runtime global, and #33 must assert the values CHANGE on device — the defensive hold otherwise hides a wrong-runtime install as "not wired yet".
**In progress:** none.
**Next:** Wave 5 — the device gate (#33, `P2-A6`, §13.3), user-run on a physical device; the autonomous loop cannot self-clear it. Track A is now build-complete up to the gate.

## Two walls this phase cannot self-clear

1. **The device gate (#33, §13.3).** `P2-A6` is user-run on a physical device.
   The user has a device. The autonomous loop stops here and hands off a runbook.
   Gate blocks all of Phase 3.
2. **F-Droid toolchain (#38, §13.8.1) — verification done 2026-07-23, one residual.**
   The Hermes/prebuilt-binary clause is corroborated against raw source (see
   `docs/decisions.md`); the Hermes exemption is explicit. **lightningcss** survives
   only on the WAFRN `scandelete` precedent, not a policy carve-out — do not upgrade
   its confidence. Settling lightningcss definitively needs an actual RFP/draft
   submission to F-Droid: an outward-facing, authorization-gated action left for the
   user, not the loop. Blocks ship, not scaffold.

## Wave map

| Wave | Tasks | Runs |
|---|---|---|
| 0 ✅ | `P2-S` #27 | skeleton — serial, blocks all |
| 1 ✅ | `P2-A1` #28 · `P2-B1` #34 · `P2-B2` #35 · `P2-B4` #37 · `P2-B5` #38 | done 2026-07-23 |
| 2 ✅ | `P2-A2` #29 · `P2-A3` #30 (after #28) · `P2-B3` #36 (after #35) | done 2026-07-23 |
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
