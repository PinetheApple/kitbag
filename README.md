# Kitbag 🎒

**The open-source everything-app for musicians.** Metronome, tuner, song
library, stem player, play-along sync — one app, plugin-shaped, GPLv3,
no caps, no paywalls, ever.

> **Status: rebuilding.** An audit on 2026-07-17 found the previous Flutter build
> was a broad UI shell over an audio core missing two primitives the product
> depends on — it could neither play a file nor start the click at a known
> instant. That app has been removed; the C++ core stays.
>
> **[SPEC.md](SPEC.md) is the source of truth** — scope, contracts, decisions and
> sequencing. It is the only planning document; `PLAN.md` was folded into it and
> deleted. `CHANGELOG.md` previously claimed five shipped releases and has been
> corrected — nothing has shipped.

## Architecture

- **C++ realtime audio core** (`native/audio_core`) on miniaudio — sample-accurate
  scheduling, lock-free realtime thread. **The durable part.** A flat C ABI
  (`include/kitbag_api.h`) written so the UI framework is a swappable detail,
  which it turned out to be.
- **React Native + TypeScript** UI, reached via JSI — decided 2026-07-17
  ([SPEC.md](SPEC.md) §13). Commands go through a TurboModule; polled realtime
  reads go through a JSI HostObject. **Not yet written.**
- **Internal plugin system** — every tool declares itself to a shell that is just
  a registry. First-party only; no public SDK yet.

Android is the primary target. iOS is secondary (play-along is Spotify-only there
— a platform limit, not a bug). Web is **out of scope**: no cross-app media
session, no foreground service.

```
native/audio_core   # C++ engine (miniaudio), CMake — the only buildable thing today
SPEC.md             # source of truth
design/             # four binding design specs
legacy/             # Flutter-era files the spec can't reconstruct (reference only)
docs/               # tuner research (read its warning banner)
```

## Building

Requirements: CMake ≥ 3.22, Ninja, clang.

```sh
cmake -S native/audio_core -B native/audio_core/build -G Ninja -DKITBAG_BUILD_TOOLS=ON
cmake --build native/audio_core/build

./native/audio_core/build/tone_test          # should beep for 2 s
./native/audio_core/build/metronome_verify   # renders offline, asserts onsets — passes
./native/audio_core/build/tuner_verify       # currently fails 37/37 — see SPEC.md §10.1
```

The verify tools render audio offline and assert against it — no UI, no device.
This is why the core is testable before the app exists, and it is the cheapest
signal in the project.

## License

GPLv3 — see [LICENSE](LICENSE). Dependencies: miniaudio (public domain),
Space Grotesk & Inter (OFL). BPM data: Deezer (attribution in-app).
