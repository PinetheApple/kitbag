---
name: native-audio
description: >-
  Kitbag's C++ realtime audio core (`native/audio_core`) — the metronome sequencer,
  mixer, decoder, tuner, and the flat C ABI in `include/kitbag_api.h`. Use this
  whenever a task touches native/audio_core, any .cpp/.h under it, kitbag_api.h,
  CMakeLists.txt, or the verify tools — and whenever the work involves the audio
  callback, the SPSC command ring, latency offset, phase anchoring, beat grids,
  downbeats, stem mixing, resampling, or SPEC.md §4 / Phase 1. Also use it when
  asked to "fix the tuner", "add a native call", "make playback work", or to change
  anything a realtime thread touches, even if the request sounds like a one-line
  change. The invariants here are unforgiving and violating them produces bugs that
  only a 4-hour soak reveals.
---

# Kitbag native audio core

The C++ core is the portable foundation and currently the only buildable thing in
the repo. It survived the Flutter→React Native change untouched, because the
boundary is a flat C ABI of scalars. Keeping it that way is the whole point —
SPEC.md §4.

## Verify first, and verify cheaply

The build is headless, needs no device, and takes about a second. It is the
cheapest signal in the project — run it before you reason and after you change
anything.

```sh
cmake -S native/audio_core -B native/audio_core/build -G Ninja -DKITBAG_BUILD_TOOLS=ON
cmake --build native/audio_core/build
./native/audio_core/build/metronome_verify   # must stay green
./native/audio_core/build/tuner_verify       # fails 37/37 today — expected
```

`tuner_verify` failing 37/37 is a real defect in `PitchAnalyzer`, not a stale
harness (SPEC.md §10.1). It reports `0.000 Hz` / `confidence 0.00` for clean
synthetic tones with no mic in the path. Do not make it pass by loosening the
assertions — that converts the project's only tuner evidence into a lie.

`metronome_verify` and `tuner_verify` render offline and assert onsets against a
beat grid. When you add a native capability, the verify tool is how it gets
proven. A capability with no offline proof is not done.

## Read the code before you trust the prose

SPEC.md is the source of truth for *decisions*. It is not always accurate about
*current behaviour*, and this repo's documented history is one of docs that
confidently misdescribed the code (SPEC.md §2). Both the spec and the header
comments have been wrong about the engine in ways that would have shaped a fix
incorrectly.

So: grep for the symbol, read the function, then decide. If what you find
contradicts SPEC.md's description of the present, that is a finding worth
surfacing to the human — not something to quietly code around, and not something
to "fix" by editing SPEC.md's decisions.

## The realtime contract

The audio callback is `Engine::DataCallback` → `Engine::Render` (`src/engine.h`).
Everything reachable from it is realtime: **no allocation, no locks, no syscalls,
no I/O, no unbounded work** (SPEC.md §4.5). A `malloc` there does not crash — it
produces an audible dropout under memory pressure, hours later, on someone's
phone. That is why the rule is absolute rather than a preference.

The codebase already has the right shape; follow it rather than inventing a
second pattern.

**Commands in, through a lock-free ring.** App-thread setters push a POD
`Command` onto `SpscRing` (`src/rt/spsc_ring.h`) and return immediately; the
callback drains the ring at the top of `Render` via `ApplyPendingCommands()`.
Validation and clamping happen in the *drain*, not the setter. `Metronome`
(`src/metronome/metronome.h`, `.cpp`) is the reference implementation.

**Realtime state is RT-owned and private.** `beat_position_`, `bpm_`,
`current_bar_` and friends are plain members touched only inside `Render`. They
need no atomics precisely because one thread owns them.

**Values out, through atomic mirrors.** The UI never reads RT state directly. The
callback publishes to `std::atomic` mirrors (`bar_phase_`, `current_beat_`,
`current_bpm_`) with relaxed ordering, and the app polls them. This is what
SPEC.md §4.5 means by "realtime data out via polled lock-free reads", and it is
why the JSI HostObject in §13.2 can be a synchronous read.

**Ordering has a reason.** `SpscRing` uses acquire/release across the head/tail
handoff and the mirrors use relaxed, because a mirror is a single independent
scalar with no companion data to order against. If you add a publish where a
reader must see *two* things consistently, relaxed is wrong — either pack them
into one word (as `kb_tuner_snapshot` does) or use release/acquire.

**One engine per process.** Tools attach to the engine; none constructs its own.

## Where the known traps are

Verified against the source. Each of these is a live SPEC.md §4 work item, and
each is somewhere a plausible-looking change goes wrong.

- **`Mixer::SetTrackData` allocates and races** (`src/mixer/mixer.cpp:9`). It does
  `t.pcm.assign(...)` on the app thread while the callback may be reading `pcm`.
  §4.1 removes this entirely: the core loads and streams from disk itself, built
  off-thread and published by atomic pointer swap with release semantics. Do not
  patch the race by adding a lock — a lock in the callback is the same bug wearing
  a hat.
- **`mixer.cpp:109` silently skips any track whose rate ≠ engine rate.** 44.1kHz is
  the common case, so the mixer is silent for most real content. The fix is
  resampling on load (miniaudio supplies a Speex-derived resampler), not a louder
  skip.
- **`mixer.cpp:~140` advances the read head by `max_read`** while the comment above
  it says minimum. Unequal-length stems desync. The comment is the correct intent.
- **`Mixer::Stop()` resets position to 0 and there is no `Pause()`** (`mixer.cpp:68`).
  §4.4 splits them.
- **Auto-stop fires when no track produced data**, which includes "everything is
  muted or gain 0". Muting all stems must not end playback; the trigger is end of
  the *longest* track.
- **Nothing streams.** Tracks are `std::vector<float>` held whole. Memory must
  become O(tracks), not O(duration) — a ring-buffered read-ahead on a non-RT
  thread, with the callback only draining.

## Boundary rules

`include/kitbag_api.h` is a flat C ABI. Every value crossing it is a scalar —
after §4.1 lands, with no exceptions but `kb_metronome_set_grid`'s `const double*`
(copied during the call) and `kb_analyze_song`'s out-pointers. This is what makes
the UI framework a swappable detail, and it is why a JSI HostObject is sufficient
and no ArrayBuffer bridge is needed (§13.2).

- **No buffers cross.** Exporting PCM to the app layer is a rejected fix, at any
  size — six 5-minute stems as float32 is ~690MB.
- **`uint64_t` frame counts cross as JS doubles.** 53 mantissa bits is exact to
  ~5,900 years at 48kHz. Do not introduce BigInt.
- **Every exported symbol has a consumer.** No speculative FFI surface.
- **Cross-boundary constants have exactly one definition**, owned here and
  generated or exposed outward — never retyped on the other side (SPEC.md §13.7).
  `sync_screen.dart` invented its own sound names, mislabelled every sound from
  index 2 up, and the error reached a design file. That is the failure mode.

## Comments

Write the constraint the code cannot show — the memory-ordering reason, the
epsilon's purpose, why a bar counter is monotonic. Never write a comment that
describes intent as behaviour: `mixer.cpp`'s "advance by the minimum" over a
`max_read` is exactly how this repo taught itself that lesson, and
`kitbag_api.h:63` documents a `[-100, 100]` bound as though it were an engine
constraint when it is a decision.

## Before you hand off

Build, run `metronome_verify`, and confirm `tuner_verify`'s failure count is
unchanged. Then run the `ralph` agent — it reviews realtime C++ against these
invariants and against SPEC.md, and it is cheaper than a soak test.
