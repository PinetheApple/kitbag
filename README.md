# Kitbag

**The open-source everything-app for musicians.** Metronome, tuner, song
library and player, stem player — one app, plugin-shaped, GPLv3, no caps, no
paywalls, ever.

> **Status: in development, released on GitHub.** Every merge to `main`
> publishes a signed APK as a GitHub release
> ([latest](https://github.com/PinetheApple/kitbag/releases/latest)). It is not
> on F-Droid: the submission is drafted in `metadata/`
> and has not been sent (SPEC.md §17.1). The earlier Flutter app was removed
> after the 2026-07-17 audit (SPEC.md §2); only the C++ core carried over.
>
> **[SPEC.md](SPEC.md) is the source of truth** — scope, contracts, decisions and
> sequencing. §15 holds the current status.

## What it does

- **Metronome** — tempo by swipe, tap or numpad; beat lights with accents and
  groupings; subdivisions, polyrhythms (N against M), tempo ramps, bar muting
  and count-in; custom click sounds; songs, presets and setlists; practice
  sessions with a summary and a history you can browse.
- **Tuner** — built-in and custom tunings, string-aware detection and an
  adjustable A4.
- **Songs** — import audio files, analysed in the background for tempo, beat
  grid and meter; a song player with a click on the song's bars, an A-B loop
  and count-in, a mini-player that keeps the song playing on Home and Songs, and
  a media notification shared with the metronome.
  <!-- WAIT #555: single-song speed -->
  <!-- WAIT #237: single-song playback in the background and from the lock screen -->
- **Stem songs** — import StemDeck bundles from a zip, a folder or a StemDeck
  server; per-stem volume, mute and solo; speed and key; sections and synced
  lyrics; save the mix as a WAV; setlists, a play-next queue and playing the next
  song when one ends; background playback with a media notification.
  A stem song played from a setlist or Up next has Next and Previous on its
  notification and lock screen (#563); this still needs a phone check.
- **Settings** — theme, keep the screen awake, the rig click and per-route
  latency calibration, turning tools on or off, backup and restore, and moving
  the data folder to an SD card and back (#500, #519). The card move is checked
  on the emulator (re-checks for #532 and #548); its phone check is pending.
- **Not built:** play along (SPEC.md §8).

Some merged features still need a phone check, tracked in #516 and the open
feature issues.

## What it looks like

Screenshots from the emulator at SM-M156B size, dark theme then light.

<!-- WAIT #555: retake song-player-dark.png and song-player-light.png with the speed control -->

<table>
  <tr>
    <th>Home</th>
    <th>Metronome</th>
    <th>Setlist playing</th>
    <th>Practice sheet</th>
    <th>Tuner</th>
  </tr>
  <tr>
    <td><img src="docs/images/home-dark.png" width="140" alt="Home, dark theme"></td>
    <td><img src="docs/images/metronome-dark.png" width="140" alt="Metronome playing, dark theme"></td>
    <td><img src="docs/images/metronome-setlist-dark.png" width="140" alt="Metronome playing a setlist song, dark theme"></td>
    <td><img src="docs/images/metronome-practice-dark.png" width="140" alt="Practice sheet over the metronome, dark theme"></td>
    <td><img src="docs/images/tuner-dark.png" width="140" alt="Tuner, dark theme"></td>
  </tr>
  <tr>
    <td><img src="docs/images/home-light.png" width="140" alt="Home, light theme"></td>
    <td><img src="docs/images/metronome-light.png" width="140" alt="Metronome playing, light theme"></td>
    <td><img src="docs/images/metronome-setlist-light.png" width="140" alt="Metronome playing a setlist song, light theme"></td>
    <td><img src="docs/images/metronome-practice-light.png" width="140" alt="Practice sheet over the metronome, light theme"></td>
    <td><img src="docs/images/tuner-light.png" width="140" alt="Tuner, light theme"></td>
  </tr>
</table>

<table>
  <tr>
    <th>Songs</th>
    <th>Song player</th>
    <th>Mini-player</th>
    <th>Stem songs</th>
    <th>Stem player</th>
  </tr>
  <tr>
    <td><img src="docs/images/songs-dark.png" width="140" alt="Songs, dark theme"></td>
    <td><img src="docs/images/song-player-dark.png" width="140" alt="Song player, dark theme"></td>
    <td><img src="docs/images/mini-player-dark.png" width="140" alt="Mini-player over Songs, dark theme"></td>
    <td><img src="docs/images/stem-songs-dark.png" width="140" alt="Stem songs, dark theme"></td>
    <td><img src="docs/images/stem-player-dark.png" width="140" alt="Stem player, dark theme"></td>
  </tr>
  <tr>
    <td><img src="docs/images/songs-light.png" width="140" alt="Songs, light theme"></td>
    <td><img src="docs/images/song-player-light.png" width="140" alt="Song player, light theme"></td>
    <td><img src="docs/images/mini-player-light.png" width="140" alt="Mini-player over Songs, light theme"></td>
    <td><img src="docs/images/stem-songs-light.png" width="140" alt="Stem songs, light theme"></td>
    <td><img src="docs/images/stem-player-light.png" width="140" alt="Stem player, light theme"></td>
  </tr>
</table>

<table>
  <tr>
    <th>Up next</th>
    <th>Speed and key</th>
    <th>Setlists</th>
    <th>Setlist detail</th>
    <th>StemDeck</th>
  </tr>
  <tr>
    <td><img src="docs/images/stem-up-next-dark.png" width="140" alt="Stem player Up next sheet, dark theme"></td>
    <td><img src="docs/images/stem-speed-key-dark.png" width="140" alt="Stem player Speed and key sheet, dark theme"></td>
    <td><img src="docs/images/setlists-dark.png" width="140" alt="Setlists, dark theme"></td>
    <td><img src="docs/images/setlist-detail-dark.png" width="140" alt="Setlist with stem songs and metronome songs, dark theme"></td>
    <td><img src="docs/images/stemdeck-connect-dark.png" width="140" alt="StemDeck connect, dark theme"></td>
  </tr>
  <tr>
    <td><img src="docs/images/stem-up-next-light.png" width="140" alt="Stem player Up next sheet, light theme"></td>
    <td><img src="docs/images/stem-speed-key-light.png" width="140" alt="Stem player Speed and key sheet, light theme"></td>
    <td><img src="docs/images/setlists-light.png" width="140" alt="Setlists, light theme"></td>
    <td><img src="docs/images/setlist-detail-light.png" width="140" alt="Setlist with stem songs and metronome songs, light theme"></td>
    <td><img src="docs/images/stemdeck-connect-light.png" width="140" alt="StemDeck connect, light theme"></td>
  </tr>
</table>

<table>
  <tr>
    <th>Settings</th>
    <th>Data folder</th>
    <th>Practice history</th>
    <th>Practice session</th>
    <th>Database error</th>
  </tr>
  <tr>
    <td><img src="docs/images/settings-dark.png" width="140" alt="Settings, dark theme"></td>
    <td><img src="docs/images/settings-data-folder-dark.png" width="140" alt="Data folder sheet, dark theme"></td>
    <td><img src="docs/images/practice-history-dark.png" width="140" alt="Practice history, dark theme"></td>
    <td><img src="docs/images/practice-session-dark.png" width="140" alt="One practice session, dark theme"></td>
    <td><img src="docs/images/database-error-dark.png" width="140" alt="Database error screen, dark theme"></td>
  </tr>
  <tr>
    <td><img src="docs/images/settings-light.png" width="140" alt="Settings, light theme"></td>
    <td><img src="docs/images/settings-data-folder-light.png" width="140" alt="Data folder sheet, light theme"></td>
    <td><img src="docs/images/practice-history-light.png" width="140" alt="Practice history, light theme"></td>
    <td><img src="docs/images/practice-session-light.png" width="140" alt="One practice session, light theme"></td>
    <td><img src="docs/images/database-error-light.png" width="140" alt="Database error screen, light theme"></td>
  </tr>
</table>

## Install (Android)

The newest signed build is always at
<https://github.com/PinetheApple/kitbag/releases/latest/download/kitbag.apk>,
with its checksum alongside. It is built for arm64-v8a only (64-bit ARM phones).

```sh
curl -fLO https://github.com/PinetheApple/kitbag/releases/latest/download/kitbag.apk
curl -fLO https://github.com/PinetheApple/kitbag/releases/latest/download/kitbag.apk.sha256
sha256sum -c kitbag.apk.sha256
```

Then open `kitbag.apk` on the phone (allow installs from that source), or
`adb install kitbag.apk`. Later releases install over it.

## Architecture

- **C++ realtime audio core** (`native/audio_core`) on miniaudio — sample-accurate
  scheduling, lock-free realtime thread. **The durable part.** A flat C ABI
  (`include/kitbag_api.h`) written so the UI framework is a swappable detail,
  which it turned out to be.
- **React Native + TypeScript** UI, reached via JSI — decided 2026-07-17
  ([SPEC.md](SPEC.md) §13). Commands go through a TurboModule; polled realtime
  reads go through a JSI HostObject. Builds and runs on Android; the 60fps read
  path is proven on a device (§13.3). Built: everything under "What it does";
  play along is not.
- **One package per tool** — each tool is a `tool-*` package, listed in the
  shell's registry (`app-shell/src/home/registry.ts`) and shaped after the
  `ToolPlugin` contract (SPEC.md §9). First-party only; no public SDK yet.

Android is the only platform built; iOS is planned, not started (SPEC.md §3.4).
Web is **out of scope**: no cross-app media session, no foreground service.

```
native/audio_core   # C++ engine (miniaudio), CMake
packages/           # React Native app — pnpm workspaces + Turborepo
SPEC.md             # source of truth
design/             # binding design specs (precedence: SPEC.md §12)
legacy/             # Flutter-era media-session code play-along still has to port
docs/               # decisions, tuner spec, research; archive/ is historical
e2e/                # Maestro device flows and their fixture generators
scripts/            # repeatable actions — gates, release, device flows, lint, changelog
```

## Building

### Native core

Requirements: CMake ≥ 3.22, Ninja, clang.

```sh
cmake -S native/audio_core -B native/audio_core/build -G Ninja -DKITBAG_BUILD_TOOLS=ON
cmake --build native/audio_core/build

./native/audio_core/build/metronome_verify   # renders offline, asserts onsets
./native/audio_core/build/tuner_verify       # tuner on synthetic tones
```

The verify tools render audio offline and assert against it — no UI, no device.
CI and `scripts/preflight.sh` run every `*_verify` tool;
`.github/workflows/ci.yml` lists them.
This is why the core was testable before the app existed, and it is still the
cheapest signal in the project.

### App

Requirements: Node (version in `.nvmrc`), pnpm, Android SDK + NDK.

```sh
pnpm install
pnpm -w typecheck && pnpm -w lint && pnpm -w test
bash scripts/preflight.sh   # every CI gate, with auto-fixes
```

Android builds run from `packages/app-shell/android` via Gradle;
`bash scripts/install-on-device.sh` builds, installs and launches on a connected
device. Anything that touches a screen or the native boundary needs verifying on a real device — the
headless gates cannot see a broken JNI chain.

## License

GPLv3 — see [LICENSE](LICENSE). Native dependencies: miniaudio (public domain),
QM-DSP (GPL-2.0-or-later, with kissfft under BSD-3-Clause), Signalsmith
Stretch and signalsmith-linear (MIT). Fonts: Space Grotesk
and Inter (OFL).
