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

The wiring is now drafted (staged, going live on device) rather than empty. It is
**compiles-shaped at most** — none of it has built, because the codegen'd
TurboModule superclass does not exist off-build and the runtime plumbing cannot be
exercised off-device. Files: `KitbagCommandsModule.kt`, `KitbagCorePackage.kt`,
`core-native/cpp/KitbagJni.cpp`, `app-shell/src/runtime/bootstrapRuntime.ts`
(the install is now app-wide — `RootLayout` calls `useKitbagRuntime()`, not
`GateScreen`), and the drive sequence in `GateScreen.tsx`.

- **HostObject install on the correct runtime — the chosen mechanism.**
  `kitbagInstall(rt)` creates the single `g_engine` and installs the HostObject
  under `__KitbagHostObject` on whatever runtime `rt` is. The worklet in
  `useBeatSweep.ts` reads on the **Reanimated UI runtime**, whose `global` is a
  *separate* object from the RN JS runtime. Installing only on the JS runtime →
  `global.__KitbagHostObject` undefined in the worklet → sweep silently frozen at
  0, no crash. This is the trap; it looks identical to "not wired yet".

  The mechanism chosen (over reaching into worklets' internal C++
  `WorkletsModuleProxy`/`RuntimeManager`, which is version-fragile): install
  natively on the RN JS runtime (`KitbagCommandsModule`'s constructor →
  `nativeInstall` → `kitbagInstall`), then **re-publish the SAME C++ HostObject
  onto the UI runtime from JS** via `runOnUISync` (`bootstrapRuntime.ts`). When a
  foreign `jsi::HostObject` is captured into a worklet, react-native-worklets
  wraps it as a `SerializableHostObject` and reconstructs it on the UI runtime
  sharing the same underlying C++ object (verified by reading worklets v0.7.4
  `Serializable.cpp`) — so both runtimes reference the one `KitbagHostObject`
  holding the one `kb_engine*` (§4.5). Uses only worklets' public JS API.
  **UNVERIFIED on device:** (a) that v0.7.4 actually takes that serialization
  branch for our HostObject; (b) that `reactContext.javaScriptContextHolder.get()`
  yields a live JSI runtime pointer under bridgeless New Arch (may need a
  `RuntimeExecutor` hop); (c) that the reanimated/worklets babel plugin transforms
  the bootstrap worklet (a prebuild concern, same dependency `useBeatSweep`
  already has).
- **`KitbagCommands` TurboModule registration** (codegen runs during the Gradle
  build) so the screen's `start()/stop()`/`setTempo`/`setGrid` resolve instead of
  throwing. `KitbagCommandsModule.kt` extends the codegen'd
  `NativeKitbagCommandsSpec`; its exact package + method signatures are emitted by
  the Gradle codegen task and confirmed only at build.
- **Driving the engine so `bar_phase` advances — see §3a.** `GateScreen`'s Start
  button issues `start()` → `setTempo` → `setBeats` → `setGrid` →
  `metronomeStart`. Both a grid and the transport start are required to move the
  sweep; read §3a for the ordering + shared-anchor reasoning.

## 2. Build + install

```
pnpm --filter @kitbag/app-shell prebuild        # if regenerating android/
cd packages/app-shell && npx expo run:android --device
```

Dev-client build, installs to the plugged-in phone.

## 3. Run the gate

Open the app → navigate to `/gate` (Home has the link). Press **Start**.

### 3a. What Start does, and why `metronomeStart` is required

`bar_phase` (the sweep) is "position within the bar", derived from a beat timeline
against the running master frame clock. This is statically answerable from the
engine source: `kb_engine_start` only opens the audio device — it does NOT move the
transport. The metronome's `running_` (and therefore `bar_phase`, published only
while `running_` — `metronome.cpp` `PublishBlockMirrors`) is flipped true ONLY by
`kb_metronome_start` / `kb_metronome_start_at`. So a grid + started device is NOT
sufficient; the transport must also be started.

`metronomeStart` (mapping to `kb_metronome_start_at`) is therefore now part of
§13.2's command spec — a recorded spec change, not a fudge. Start issues, in
order: `start()` (opens the device / advances frames) → `setTempo(bpm)` →
`setBeats(n, denominator)` → `setGrid(beatTimes, anchorFrame)` →
`metronomeStart(anchorFrame)`.
The grid and the transport start share ONE anchor (`frames_rendered` captured
once), so `running_` flips at beat 0 and the sweep starts at phase 0. `setGrid`
precedes `metronomeStart` because the engine seeds the grid cursor from the live
grid when the deferred start fires (`metronome_render.cpp` `BeginPendingStart`).

**The genuine on-device unknown** is not this — it is whether the foreign JSI
HostObject is actually re-published onto the Reanimated UI runtime (the
`SerializableHostObject` sharing in `bootstrapRuntime.ts`). A correct install with
a started transport moves the sweep; a wrong-runtime install leaves it frozen at 0
with nothing thrown. That is exactly why the gate asserts the values must CHANGE on
device — a "nothing threw" run proves nothing. A frozen-at-baseline run is the
wrong-runtime install trap (§1), NOT a §13.3 architecture failure.

## 4. Measure — recorded, NOT by ear/eye (§14.1, §5.8)

1. **Baseline first.** With the metronome running, confirm the sweep + LEDs move
   *at all*. Start now issues `metronomeStart` (§3a), so a frozen baseline is the
   wrong-runtime install trap (§1) — **not** a §13.3 failure. Fix the wiring; do
   not fail the architecture on this.
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
