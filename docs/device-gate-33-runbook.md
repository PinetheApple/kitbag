# Device gate (#33 · P2-A6) runbook

**Status:** user-run, physical device. The autonomous loop cannot self-clear this.
**Blocks:** all of Phase 3 (SPEC.md §14.1, §5.8, §13.3).

This is the load-bearing bet of the whole RN stack: that a Reanimated worklet
reading the JSI HostObject each frame can hold the beat sweep steady while the JS
thread is starved (SPEC §13.3). If it can't, everything above the gate is rework.

## 0. Platform

Android arm64 physical device. The iOS side (podspec) needs a Mac and is out of
scope on a Linux dev box. Prereqs: USB debugging on, Android SDK + NDK, JDK 17,
device plugged in, `pnpm install` done.

## 1. Native wiring (lands before you plug in)

Three things are compile-shaped from #31 but not live — `KitbagCorePackage.kt`
returns empty lists on purpose. Drafted for #33; only the device build verifies
them:

- **HostObject install on the correct runtime.** `kitbagInstall(rt)` creates the
  single `g_engine` and installs the HostObject under `__KitbagHostObject`. It
  must install on the **Reanimated UI/worklet runtime's `global`** — the worklet
  in `useBeatSweep.ts` reads there, which is a *separate* runtime from the RN JS
  runtime. Wrong runtime → `global.__KitbagHostObject` is undefined in the
  worklet → sweep silently frozen at 0, no crash. This is the trap; it looks
  identical to "not wired yet".
- **`KitbagCommands` TurboModule registration** (codegen runs during the Gradle
  build) so the screen's `start()/stop()`/`setTempo`/`setGrid` resolve instead of
  throwing.
- **Driving the engine** so `bar_phase` advances: `start()` → `setTempo` →
  `setGrid`/`setBeats`. No running metronome → nothing to sweep even with a
  correct install.

## 2. Build + install

```
pnpm --filter @kitbag/app-shell prebuild        # if regenerating android/
cd packages/app-shell && npx expo run:android --device
```

Dev-client build, installs to the plugged-in phone.

## 3. Run the gate

Open the app → navigate to `/gate` (Home has the link). Start the metronome.

## 4. Measure — recorded, NOT by ear/eye (§14.1, §5.8)

1. **Baseline first.** With the metronome running, confirm the sweep + LEDs move
   *at all*. Frozen at baseline = wrong-runtime install (§1 trap), **not** a §13.3
   failure. Fix the install target; do not fail the architecture on this.
2. **Starve the JS thread.** Hit the JS-starvation button (a 3 s synchronous JS
   block, `STARVATION_MS` in `starvation.ts`). Requirement: sweep + LEDs keep
   moving **smoothly through the spin** — no freeze, no jump-and-catchup.
3. **Record** device audio out + screen. Compute beat-vs-grid offset and frame
   timing off the recording. §5.8 wants a 4 h soak for the metronome proper; for
   the gate, a shorter recorded run showing the SharedValue sweep stays
   frame-locked while JS is starved is the signal.

## 5. Pass / fail

- **PASS** — under a starved JS thread the sweep holds steady and the values
  change; offset within tolerance. → Phase 3 unblocked. Rebalance away from core
  rigor toward Phase 3 §5 (metronome).
- **FAIL** — sweep freezes or jitters when JS is starved. → §13.3 foundation is
  wrong; everything above the gate is rework. Do **not** fan out Phase 3.

## Honesty note

The #32 gate screen was verified headless only (typecheck / lint / eval). The
worklet actually reading a live HostObject, the runtime-install target, and the
jitter-free 60 fps measurement are all first tested here, on device. Assert the
values *change* — a passing "nothing threw" run can still be a broken
(wrong-runtime) install.
