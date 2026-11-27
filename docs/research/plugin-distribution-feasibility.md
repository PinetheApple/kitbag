# Tools as downloadable plugins: feasibility and cost

Status: research and plan, 2026-11-27, updated the same day with the owner's decision
on #657 (see "Progress and decisions"). Steps 1 to 3 are done and step 4 is approved,
starting with an experience mockup. SPEC.md §9.2 and §9.3 still say tools are a fixed
compile-time set and that there is no public plugin SDK; building step 4 means changing
those sections first.

The question: can the tuner, Songs, Stem songs, the metronome and Play along become
plugins that a user downloads only when wanted, with community plugins later, and what
does that cost and save?

## Verdict

Feasible for JavaScript and data, not for native code, and it buys little size. Every
tool's JavaScript plus its tool-only native code is an estimated 1.3 to 2.3 MB of a
35.7 MB APK. The other 33 MB is React Native, Hermes, Reanimated, Expo, SQLite and
the shared audio core, which every tool needs.

A packaging change that has nothing to do with plugins saves more: storing the
native libraries compressed would cut the download from 35.7 MB to about 20.6 MB,
though the app would take more space once installed (see "Size levers that are not
plugins").

Recommended path: take the packaging decision first, then make the shell
registry-driven, since that helps every later option. Build runtime-loaded first-party
JavaScript tool packs (S2 passed; approved by the owner, mockup first), and start
community extension as data packs, not code.

## Progress and decisions

Owner decision (2026-11-27): "lightweight" means a smaller download, extensibility, and
less app bloat (only installed tools show on screens). The size of each extension is not
a concern. The path in #657 and where it stands:

| Step | What | State |
|---|---|---|
| 1 | Compressed native libraries (`expo.useLegacyPackaging`) | Done, #697 (#692). Download went from about 37.7 MB to about 20.9 MB. |
| 2 | Registry-driven shell: Home, Settings and routes list only installed or enabled tools | Done, #698 (#696, Play along hidden when off) and #701 (#695, tool routes come from the registry). |
| 3 | Spike: a worklet in a downloaded Hermes bundle drives a 60fps view | Done, verdict "works" (#700, closed unmerged, branch `spike/runtime-bundle-worklet` kept). |
| 4 | First-party tools as signed downloadable bundles, then data packs | Approved. The experience mockup (every state of the Tools "Get", update and remove flows, the consent screen, and the F-Droid build) comes first, before any loader code. |

Community plugins stay later.

### Spike verdict (step 3, #700)

A separately built bundle, as plain JavaScript and as Hermes bytecode, loaded at runtime
through a small JSI function in `core-native`, drove a Reanimated worklet screen on the
emulator at 61 frames/s with no frame over 16.7 ms and no worklet errors. The same screen
compiled in was the control. Read it as works or does not work, not as absolute numbers
(SwiftShader). The run with the JS thread blocked is not proven: it logged no marker
that the block ran. Rerun it on a phone with a marker.

Blockers the spike hit, which a real loader has to solve:

1. `fetch` cannot read local files on React Native 0.88, so the bundle is read natively.
2. A second Metro bundle writes its module system onto the host's global object. The
   prototype snapshots and restores it; a real loader needs a serializer with a
   per-plugin global prefix.
3. Reanimated's Bundle Mode does not support a second bundle, so it stays off. Default
   worklet serialisation works across bundles.
4. Release builds skip the worklets version check, so a plugin built against another
   worklets or Hermes version fails without a clear error. Pin every plugin to the host
   build in its manifest and check before evaluating.
5. Handing a plugin the whole `react-native` module gives it `TurboModuleRegistry` and
   bypasses `core-native` (§13.1). A plugin needs a curated, versioned module surface.

Loader estimate from the spike: 10 to 17 agent-days (build and serializer 1–2, shared
module surface 2–4, version pinning 1–2 plus CI rebuilding every plugin per host release,
signature check 2–3, download path 2–3, lifecycle and errors 2–3). This replaces the
2–3 day estimate for spike S2 and narrows Phase 3 below. The owner approved step 4 knowing
the saving is about 1.3 to 2.3 MB, because the goal is extensibility and screens that
show only what is installed, not bytes alone.

### F-Droid findings for step 4 (researched 2026-11-27)

Verified means the policy page says it; inferred is reasoning; gap means no primary
source was found.

- **Allowed only with opt-in consent (verified).** The Inclusion Policy bars downloading
  additional executable binary files without explicit, opt-in consent that says users are
  bypassing F-Droid's checks [F1]. Hermes bytecode most likely counts (inferred). For
  plain JavaScript it is less clear (gap: no ruling found).
- **No anti-feature covers it (verified).** The list has no "downloads code" tag; the
  non-free add-on, network and dependency tags do not apply to FOSS bundles built from
  this repo and hosted on our releases (inferred). A silent update check could fall under
  Tracking, so any check is opt-in too (inferred). Undisclosed anti-features are
  rejected, so the download behaviour is stated in the metadata.
- **Reproducibility (verified and inferred).** F-Droid builds the APK from source and
  compares it with the published one [F3]. Downloaded bundles fall outside that check,
  which is why consent is required. The policy's remedy for non-free dependencies is a
  build flavour without them, and that is the sanctioned shape here (inferred). No
  precedent that requires F-Droid to build the bundles was found (gap).
- **Precedent.** Termux ships add-ons as separate F-Droid apps with one signing
  identity. F-Droid and GitHub builds cannot be mixed.

Options for the F-Droid build, best fit first (inferred):

1. A flavour with every tool compiled in and no code download. No consent screen, F-Droid
   builds everything, tool updates arrive with app releases. Downloads stay in the GitHub
   and Obtainium build. **This is the plan's default.**
2. Opt-in downloads in the F-Droid build too, with explicit consent text. Expect review
   friction; whether Hermes bytecode is accepted is open.
3. One F-Droid app per tool (S5's shape). Workable, but signing and upkeep add up and it
   fits a registry poorly.

Still open (S4): ask on the inclusion request (#61) whether signed Hermes bundles fall
under the consent clause, and check whether the F-Droid scanner flags bundled `.hbc`
files. A reviewer's answer settles it; option 1 does not wait for it.

## 1. Today's state

### How tools are wired

- `packages/core-plugin-api/src/index.ts` defines `ToolPlugin` (`id`, `name`,
  `icon`, `routes`, `homeTile`, `settingsSchema?`, `assets?: LazyAssetSpec`). It holds
  types only. **No tool package exports a `ToolPlugin` value.**
- `packages/app-shell/src/home/registry.ts` is the one registry (`HOME_TOOLS`), a
  hand-written list that picks fields from `ToolPlugin`. Play along has no `homeTile`,
  so Home shows it as not built.
- Routes are Expo Router files in `packages/app-shell/src/app/` (`tuner.tsx`,
  `metronome.tsx`, `library.tsx`, `stems/`, `stemdeck/`, `setlists/`, `presets/`,
  `songs.tsx`, `practice/`). Each one imports a screen from a tool package statically.
  About 30 non-test files in `app-shell/src` import from `@kitbag/tool-*`. Besides the
  routes, these include the mini-player, queue sheet, practice timeline, transport
  subtitle and media-session runtime. So the tools are not isolated from the shell.
- Tool state lives in `core-state` by rule (§13.4: Zustand `create()` only there).
  About 600 KB of its roughly 780 KB of non-test source is tool-specific:
  `stemPlayer/`, `playOrder/`, `songLibrary/`, `stemDeck/`, `songPlayer/`,
  `metronome/`, `songView/`, `playAlong/`, `tuner/`, `tempoLadder/`,
  `clickSounds/`. Splitting a tool out also means moving its store out of
  `core-state`, which is a §13.4 change.
- Tool data lives in one Drizzle schema in `core-db`. Tools share it: setlists and
  Play along reference songs, and stem songs are library rows.
- `core-native` is the only native binding package. It holds the JSI HostObject
  (`libkitbag_jsi.so`), the TurboModules (`libreact_codegen_RNKC.so`) and the
  Kotlin services: `PlaybackService`, the media-session listener, WorkManager
  analysis, backup and data-folder moves. It also holds the stem-import QR scanner,
  which uses CameraX and ZXing.
- `native/audio_core` builds one `libkitbag_core.so`: the metronome, mixer and
  player, decoding (miniaudio), analysis (vendored QM-DSP beat and downbeat tracking),
  time-stretch (Signalsmith Stretch) and the tuner. SPEC §4.5 and §13.2 require one
  `kb_engine` per process, held only by the HostObject. A tool's audio is a slot in
  that engine, not a separate engine.
- The manifest declares every permission up front: `RECORD_AUDIO` (tuner),
  `CAMERA` (stem import), notification listener (Play along), foreground service
  types, `POST_NOTIFICATIONS`.

### What the release APK contains

Measured on release `v0.99.5` (`kitbag.apk`, 37,417,681 bytes = 35.7 MiB, built from
`main` on 2026-11-25), unpacked with `unzip -lv`:

| Part | In the APK | Compressed in the APK? | gzip -9 size |
|---|---|---|---|
| `lib/arm64-v8a/*.so` (28 libraries, the only ABI) | 24.0 MiB | No (stored) | 8.0 MiB |
| `assets/index.android.bundle` (Hermes bytecode, magic `c6 1f bc 03`) | 5.95 MiB | No (stored) | 2.4 MiB |
| `classes.dex` (R8-minified) | 6.70 MiB raw | Yes, 3.04 MiB | — |
| `res/` + `resources.arsc` | 3.6 MiB raw | Partly, 2.16 MiB | — |
| Everything else (licences, Kotlin metadata, baseline profile) | 0.3 MiB | — | — |

The native libraries in that row, largest first (uncompressed):

| Library | Size | Owner | Could a tool carry it? |
|---|---|---|---|
| `libreactnative.so` | 6.9 MB | React Native | No |
| `libhermesvm.so` | 2.6 MB | Hermes | No |
| `libappmodules.so` | 1.9 MB | RN codegen for every module | No |
| `libreanimated.so` + `libworklets.so` | 2.9 MB | Reanimated (every 60fps surface, §13.3) | No |
| `libop-sqlite.so` | 1.6 MB | Database | No |
| `libexpo-modules-*.so` | 2.1 MB | Expo | No |
| `libc++_shared.so` | 1.3 MB | NDK runtime, shared by every C++ library | No |
| `libreact_codegen_rnscreens.so`, `_rnsvg`, `_rngesturehandler_codegen`, `_safeareacontext` | 2.5 MB | Navigation, SVG, gestures | No |
| `libzstd-kmp.so` | 0.7 MB | A transitive Android dependency (zstd) | No |
| `libkitbag_core.so` | 0.64 MB | Kitbag audio core | Parts, see below |
| `libreact_codegen_RNKC.so` + `libkitbag_jsi.so` | 0.24 MB | Kitbag bindings | No (§13.1: one binding package) |
| `libnative-filters.so`, `libimagepipeline.so` | 0.29 MB | Image pipeline (RN `Image`) | No |
| `libimage_processing_util_jni.so`, `libsurface_util_jni.so` | 0.04 MB | CameraX (stem import only) | Yes |

### What each tool adds

Native code. The exported symbols in `libkitbag_core.so` cover only 21 KB of its 514 KB
`.text`, so the numbers below come from the share of C++ source. They are
estimates. Own C++ source is about 525 KB (miniaudio excluded).

- Tuner: `src/tuner/` is about 48 KB of source. Estimate: at most 60 KB of the `.so`.
- Songs (analysis): `src/analysis/` plus vendored QM-DSP and KissFFT. Estimate:
  about 100 to 150 KB.
- Stem songs: Signalsmith Stretch is header-only and compiled into the mixer. The
  mixer, streaming and mixdown code is shared with single-song playback. CameraX JNI
  is 37 KB, and CameraX plus ZXing add some of the 3 MiB dex (not attributed).
- Metronome: `src/metronome/` (112 KB of source) is the engine that Play along and
  the stem player's count-in also use. It is core, not a tool.
- Play along: `packages/tool-sync` is a 0.7 KB skeleton. Its engine slot and store
  are in `core-native`/`audio_core` and `core-state`.

JavaScript. Release builds ship no source map, so this split is an estimate as well.
The four built tools' screen names appear in the bytecode string table, so they are
compiled in. Own non-test TypeScript source by package:

| Package | Source |
|---|---|
| `tool-metronome` | 335 KB |
| `tool-stems` | 292 KB |
| `tool-library` (Songs and Stem songs lists, song player, mini-player) | 134 KB |
| `tool-tuner` | 60 KB |
| `tool-sync` | 0.7 KB |
| Tool-specific stores in `core-state` | about 600 KB |
| Shared (`app-shell`, `core-state` rest, `core-db`, `core-design`, `core-native`) | about 1.4 MB |

About half of Kitbag's own code is tool-specific. The bundle also contains
`node_modules`: React, React Native's JS, Expo Router, Reanimated, Drizzle and
NativeWind. If own code is 35 to 60% of the 5.95 MiB bundle, the tool-specific
bytecode is 1.0 to 1.8 MiB stored, or roughly 0.45 to 0.8 MiB after gzip. Spike S1
replaces this estimate with a measurement.

### Which parts could be split out at all

- **Could be split:** each tool's screens, components and stores (JavaScript), the
  CameraX and ZXing dependency, and any future large data (sounds, models).
- **Cannot be split without breaking a SPEC rule:** `libkitbag_core.so` (one engine
  per process, realtime invariants in §4.5), `core-native` (§13.1), the Kotlin
  services, and the manifest's permissions and service declarations. Android reads
  these only at install time.
- **Not worth splitting:** the tuner's and analysis code's share of
  `libkitbag_core.so`, about 0.2 MB at most.

So the most any plugin scheme can remove from a base install is about 1.3 to 2.3 MB:
1.0 to 1.8 MiB of JavaScript, plus CameraX and ZXing, plus about 0.2 MB of C++ that
cannot move anyway. That is 4 to 6% of the APK. A user who wants every tool saves
nothing and pays for the extra plumbing.

### Size levers that are not plugins

- **Compressed native libraries.** `gradle.properties` sets
  `expo.useLegacyPackaging=false`, so the 24.0 MiB of `.so` files are stored
  uncompressed. Android documents the trade: with `extractNativeLibs="false"` the
  "native libraries are stored uncompressed in the APK. Although your APK might be
  larger, your application loads faster because the libraries load directly from the
  APK at runtime" [A9]. Storing them compressed would make the APK about 20.6 MB
  (37.4 MB minus 25.2 MB stored plus 8.4 MB gzip-equivalent). In exchange, the
  libraries are extracted on install (about 25 MB on disk next to the APK), and
  start-up is slower. Whether that is "lighter" depends on what the owner means: a
  smaller download, or less space used on the phone. This is a one-line decision and
  needs one measured start-up check on a device.
- **The JavaScript bundle is stored uncompressed** on purpose: Hermes maps the
  bytecode into memory directly. Expo's own docs say Hermes apps "will not benefit as
  much from bundle splitting as the bytecode is already memory mapped" [E1].
- **A dependency audit** (spike S1) should check what release builds still carry.
  Examples: `libhermestooling.so` (137 KB) and the image pipeline's GIF and WebP
  decoders.

## 2. Options for downloadable tools on Android

The same five questions apply to every option: limits, security and signing,
distribution (GitHub releases, Obtainium, F-Droid, Play), and the 60fps rule.

Two facts apply to all of them:

- **F-Droid inclusion policy, verified against the raw page on 2026-11-27:**
  "Applications must not download additional executable binary files (e.g. add-ons,
  auto-updates, etc.) without explicit user consent. Consent means it needs to be
  opt-in (it must not be harder to decline than to accept or presented in a way users
  are likely to press accept without reading) and structured in a way that clearly
  explains to users that they're choosing to bypass F-Droid's checks if they activate
  it" [F1]. The same page contains the Hermes clause that SPEC §13.8 could not verify
  (#38): "The Android SDK, Flutter SDK and Hermes have permission to use official
  prebuilt binaries until Debian provides alternative solutions" [F1].
- **Anti-features.** Checking for updates "without your knowledge or permission" is
  listed under Tracking, and there is an exception "if the functionality is opt-in ...
  and disabled by default" [F2]. "Non-Free Addons" applies to apps that "promote other
  Non-Free applications or plugins" [F2]. Any plugin feed must therefore be opt-in,
  and community plugins it lists must be FLOSS.

### 2.1 Separately signed companion APKs over IPC

Each tool would be its own APK, its own package and its own process, and the host
would talk to it over a bound service (AIDL or Messenger) [A6].

- **Limits.** A companion runs in another process, so it cannot reach the host's
  `kb_engine`. It would need a second engine (breaks §4.5's one engine per process,
  and two processes would compete for the audio output) or Binder calls into the
  host's engine. React Native cannot embed another process's UI in the host's screen,
  so the tool would be a separate activity with its own React Native runtime. That
  costs about 20 MB per companion, because each one carries its own copy of React
  Native, Hermes and Reanimated. That is the opposite of lightweight. Since Android 11
  the host must also declare the companions in `<queries>` to see them [A5].
- **Security and signing.** This is the strongest model of the five. The system
  installer verifies each APK, and a `signature` permission lets the host and its
  companions call each other with no prompt, because "the system grants [it] only if
  the requesting application is signed with the same certificate" [A4].
  `sharedUserId`, the old way to share a process, is deprecated [A10].
- **Distribution.** GitHub releases: one extra asset per tool. Obtainium: one extra
  app entry per tool. F-Droid: one extra app per tool, each built from source. No
  runtime download, so the policy is satisfied. Play: one listing per tool. Android
  developer verification starts on 30 September 2026 in select regions and goes
  global in 2027, and every companion package must be registered [A11].
- **60fps.** It fails. A per-frame Binder round trip from a UI-thread worklet is
  exactly the cross-boundary call that §13.2 rules out.

A variant is worth spiking (S5): an **asset-only companion APK**. It has no
launcher, no process of its own and no IPC. It carries one tool's Hermes bundle and
data as assets. The host checks that the companion is signed with its own
certificate, then reads the bundle with `createPackageContext` [A12] and runs it in
the host's own runtime. The code then runs in-process, so §13.3 holds. The system
installer has verified the code, and on F-Droid it is built from source, so nothing
is downloaded at runtime. The cost is the user experience: one more install per tool,
and on Obtainium one more entry per tool.

### 2.2 JavaScript-only bundles loaded at runtime

The host would load each tool's code as a separate Hermes bundle (or a Re.Pack or
Module Federation remote) into the same runtime, and the tool would use the host's
`core-native`, `core-state`, `core-design` and React.

- **Limits.**
  - Expo Router's bundle splitting ("async routes") does not cover native production
    builds: "On native platforms, async routes remain experimental, require explicit
    opt-in, and are supported only in development", and "Async routes do not support
    native production apps yet" [E1].
  - Metro has no documented way to load a second bundle at runtime.
  - Re.Pack replaces Metro with Rspack or webpack and provides `ScriptManager`, remote
    chunks and Module Federation 2 [R1, R2]. Under Module Federation "`react` and
    `react-native` must be singletons: one copy for the host and all remotes" [R2].
    Re.Pack's pages say nothing about Expo SDK 58, Expo Router or the New
    Architecture, and Expo documents no Re.Pack support. Kitbag uses all three, so
    that is the main technical risk (spike S3).
  - A tool loaded this way can add no native code, no Expo module and no permission.
    Everything it touches has to be in the host already.
  - Bytecode is tied to the Hermes build: React Native ships "a version of Hermes ...
    fully compatible with the version of React Native you're using" [RN1]. Expect
    every React Native upgrade (#551 was one) to need every pack rebuilt.
- **Security and signing.** Android does not verify a downloaded bundle. Kitbag
  would sign each pack in `release.yml`, pin the public key in the host and check
  the signature before loading. Android also recommends integrity checks before
  loading and internal storage for the files [A1]. Re.Pack's code-signing guide URL
  returned 404 when this was written, so plan to build the check in `core-native`.
  All code in one Hermes runtime shares one heap and every JSI object, so a loaded
  bundle can read the database and drive the engine. There is no sandbox.
- **Distribution.** GitHub releases: packs are release assets next to the APK.
  Obtainium updates only the APK, so the app would have to update packs itself, and
  that check must be opt-in to avoid the Tracking anti-feature [F2]. F-Droid: a
  bundle is code downloaded at runtime, so it needs the opt-in consent screen in
  [F1]. Whether Hermes bytecode counts as an "executable binary file" is not stated
  anywhere; ask F-Droid (spike S4). The safe fallback is an F-Droid build with every
  tool compiled in and downloading turned off. Play: "This restriction does not apply
  to code that runs in a virtual machine or an interpreter where either provides
  indirect access to Android APIs (such as JavaScript in a webview or browser)", but
  interpreted code "must not allow potential violations of Google Play policies"
  [P1].
- **60fps.** Holds, if one thing is true: a worklet defined in a second bundle has to
  be registered on the Reanimated UI runtime and call the HostObject the way built-in
  worklets do today. Worklets are compiled by a Babel plugin at bundle time, so a
  pack built without the host's exact Reanimated and Worklets versions breaks. This
  is the deciding question of spike S2.

### 2.3 Native .so loaded at runtime (dlopen from app storage)

- **Limits.** Android 10: "Execution of files from the writable app home directory is
  a W^X violation. Apps should load only the binary code that's embedded within an
  app's APK file" [A3]. Android 14 requires every dynamically loaded file to be
  read-only, or the system throws an exception [A2]. That page's examples are DEX,
  JAR and APK files, and Android's general advice is to avoid dynamic code loading
  [A1]. A tool `.so` would also have to link against the host's exact
  `libc++_shared.so` and `kitbag_api.h`, and run code inside the realtime
  callback that was not built and verified with the core. That breaks §4.5.
- **Security and signing.** Same as 2.2 but worse: native code bypasses even the
  JavaScript heap's checks.
- **Distribution.** Play: "an app may not download executable code (such as dex, JAR,
  .so files) from a source other than Google Play" [P1]. F-Droid: an "executable
  binary file", so it needs the opt-in bypass screen [F1].
- **60fps.** Not relevant; the option fails on rules first. Reject it.

### 2.4 Play dynamic feature modules

- **Limits.** Feature modules are part of an Android App Bundle, which "is a publishing
  format ... [that] defers APK generation and signing to Google Play" [A8]. The Play
  Core library downloads modules on demand from Play [A7]. GitHub releases, Obtainium
  and F-Droid ship APKs, so those builds would have to include every module, and
  only Play users would save anything.
- **Security and signing.** Play signs the modules. Sound, but Play-only.
- **Distribution.** Play only. The F-Droid build would need a flavour without Play
  Core (a proprietary dependency). SPEC §9.3 already rejects Play Asset Delivery for
  this reason.
- **60fps.** Unaffected, but the option does not meet the goal outside Play. Reject
  it.

### 2.5 Asset and data packs (models, sounds)

- **Limits.** No code: only data such as click-sound kits, tunings, drum patterns,
  setlist templates, or later a model file read by code already in the core.
  `LazyAssetSpec` (`sizeBytes`, `url`, `checksum`) already describes this.
  Kitbag ships no heavy assets today (`assets/` holds only the bundle, `app.config`
  and the baseline profile), so the saving today is zero.
- **Security and signing.** A checksum or signature check, plus schema validation of
  every file. A data file cannot run code, as long as the parser that reads it is
  safe.
- **Distribution.** Allowed on every store. Play's rule is about executable code
  [P1], and F-Droid's is about executable binaries [F1]. Downloads must be started by
  the user (a "Get" tap) so they do not count as tracking [F2]. Play Asset Delivery
  is the Play-only version of this and stays rejected [A13].
- **60fps.** Unaffected.

## 3. Recommended architecture

### 3.1 What stays in the core

- The whole C++ engine (`libkitbag_core.so`), including the tuner, analysis and
  stretch code. They cost about 0.2 MB, and splitting them breaks §4.5.
- `core-native`: the HostObject, TurboModules, `PlaybackService`, the media-session
  listener, WorkManager jobs, and CameraX and ZXing. Native code cannot be downloaded
  on any channel without breaking a store rule.
- `core-db` with every table, so data and backups survive installing and removing a
  tool.
- `core-design` and `core-state`'s shared stores (transport, play order, library),
  because more than one tool reads them.
- Every permission and manifest component.
- The metronome. Play along and the stem player's count-in use its engine, and Home
  treats it as core.

### 3.2 First-party downloadable tools

1. **Registry-driven shell (worth doing whatever is chosen later).** Each tool
   package exports a `ToolPlugin` value, and `HOME_TOOLS` comes from those values.
   The shell mounts tool screens through one catch-all route
   (`app/tool/[id]/[...path].tsx`) that renders the matching `RouteDescriptor`.
   The shell stops importing tool internals; things such as the mini-player and the
   queue sheet become contributions that a plugin registers. Each tool's store moves
   behind a factory the plugin owns, while `create()` stays in `core-state`.
   SPEC §9.2, §13.1 and §13.4 change.
2. **A tool pack format.** A Hermes bytecode bundle of the tool package, with React,
   `react-native`, Reanimated and `@kitbag/core-*` as externals the host provides.
   Each pack has a manifest: tool id, version, required host API version, Hermes
   bytecode version, size and sha256, and an ed25519 signature made in
   `release.yml`.
3. **Loading.** Packs are stored in internal storage and marked read-only before they
   are written [A2]. Each pack's signature is checked against the key pinned in the
   host on every load, and the pack runs in the host runtime. A pack whose host API
   or bytecode version does not match is refused and shown as "needs an update".
4. **Delivery.** On GitHub releases, packs are assets next to the APK, and the Tools
   manager's "Get" downloads them. That puts back the "Get" verb and sizes that §9.3
   removed on 2026-10-31. The F-Droid and default build flavour has every tool
   compiled in and downloads off. Downloading is an opt-in setting with the consent
   wording in [F1]. If spike S5 succeeds, asset-only companion APKs replace runtime
   downloads on F-Droid.

### 3.3 Community plugins (a separate, later path)

All code in one Hermes runtime is fully trusted (section 2.2), so community code
cannot share the first-party loader.

1. **Data packs first.** Click-sound kits, tunings, rhythm patterns and setlist
   templates. Each pack type gets a schema in `core-plugin-api` and a validating
   importer in `core-state`. Packs are installed from a file or from the registry.
   This covers most "add a feature" wishes with no code-execution risk, and it is
   allowed on every store.
2. **A registry.** A public GitHub repository holding an index file. Each entry names
   a pack, its licence (FLOSS only, to avoid Non-Free Addons [F2]), a source URL, a
   sha256 and a reviewer's signature. Submissions arrive as pull requests, a
   maintainer reviews them and CI checks the schema. The app fetches the index only
   after the user opts in.
3. **Code plugins only with a real sandbox.** Run them in a separate JS context that
   has no Kitbag JSI objects, such as a WebView with a narrow `postMessage`
   capability API, and allow only the capabilities a manifest lists (read the beat
   clock, draw in a panel, add a sound). A WebView is not a §13.3-safe surface, so
   community code would never drive a 60fps visual from the engine directly. This is
   research-grade work. Do not plan it before data packs exist and someone has asked
   for code plugins.

## 4. Effort

### The pace this is sized on

- 200 pull requests merged between 2026-11-07 and 2026-11-26, over 10 active days.
  That is about 20 a day across 3 to 5 parallel lanes, or roughly 4 to 6 per lane-day.
- The median PR changes 572 lines. Median time from opening to merge is 0.9 h; p75 is
  2.1 h and p90 is 4.3 h (`gh pr list --state merged`).
- In the coordination board, a feature that needs a review round and an emulator
  check spans one lane-day or more. #620 needed two stacked PRs and merged in about
  2 h of wall time after a day of preparation. Work that waits on the owner or a
  phone check stalls for hours to days.

An **agent-day** below is one lane working for one day: about 4 to 6 merged PRs of
median size, including its review rounds. Owner waits and phone checks come on top.

| Phase | Content | Size |
|---|---|---|
| 0. Measure and pack | Done for packaging (#697). Spike S1 and the dependency audit are optional now. | Done |
| 1. Registry-driven shell | `ToolPlugin` exports, catch-all route, shell stops importing tool internals (about 30 files), store factories, SPEC §9.2/§13.1/§13.4 edits, lint zones. Routes and Home visibility are done (#698, #701); the rest remains. | Started; remainder 4–8 agent-days |
| 2. Spikes S2–S5 | S2 done (#700, works). S3 is not needed unless the custom loader proves worse than Re.Pack. S4 and S5 are below. | S4 plus S5 only, 1.5–2.5 agent-days, plus the wait for F-Droid's answer |
| 3. First-party tool packs | Experience mockup first (approved before code). Then per-tool bundle build, signing in `release.yml`, loader and verifier in `core-native`, version gate, Tools manager "Get" and "Remove", F-Droid flavour with tools compiled in, release-gate checks | 10–17 agent-days (spike estimate) |
| 4a. Community data packs | Schemas, importer, registry repo and review CI, opt-in feed, Tools manager entry | 6–10 agent-days |
| 4b. Community code plugins | Sandbox runtime, capability API, permission prompts, review tooling | 15–25+ agent-days; research first |

Phases 0 and 1 take 7 to 12 agent-days, and Phase 1 is useful whatever comes after.
Downloadable first-party tools take 21 to 34 agent-days in total.

### Spikes

| Spike | Question | Proves it | Kills it |
|---|---|---|---|
| S1 Attribution (0.5 day) | How many bytes of the bundle and dex are each tool's? | Release bundle with `--sourcemap-output`, attributed per package; dex attributed with the R8 mapping. | Tools total under 1.5 MB, so the whole plugin plan is not worth it for size alone. |
| S2 Second Hermes bundle (done, #700: works) | Can a second bytecode bundle be loaded into the running app on RN 0.88 and the New Architecture, mount under Expo Router, and run a worklet that reads the HostObject at 60 fps? | Tuner needle from a pack, steady on the phone, with the JS thread starved (§5.8's test). | Worklets from the second bundle cannot reach the UI runtime, or module IDs clash with the host bundle. |
| S3 Re.Pack on Expo SDK 58 (2 days) | Does the app build and run with Rspack instead of Metro, including Expo Router, Expo modules and NativeWind? | A release APK from Re.Pack that passes the existing e2e flows. | Expo Router or NativeWind need Metro; Re.Pack is then out, and S2 decides alone. |
| S4 F-Droid ruling (0.5 day plus waiting) | Is an opt-in "Get tool" that downloads signed first-party Hermes bytecode acceptable, and which anti-feature does it carry? | A written answer on the inclusion request (#61). | No: the F-Droid build ships every tool, or uses S5. |
| S5 Asset-only companion APK (1–2 days) | Can the host load a tool bundle from a same-signer, launcher-less APK, and will F-Droid and Obtainium list one? | Host reads and verifies the companion's bundle after the companion is installed through Obtainium. | Signature check or asset access fails, or no store lists add-on packages. |

### Risks

- **The size saving is small** (section 1). This is the main risk to the goal itself.
- **No sandbox** for anything loaded into the Hermes runtime (2.2).
- **Version skew.** Packs are tied to the host's Hermes, React Native, Reanimated and
  `core-*` APIs. Every upgrade rebuilds every pack, so packs ship with the host
  anyway.
- **Permissions are fixed at install time.** The host keeps requesting camera,
  microphone and notification access for tools the user never downloads.
- **Coupled data model.** Songs are used by setlists, Play along and stems. Removing
  Songs has to leave the other tools working.
- **Store rules move.** The F-Droid wording [F1], the Play policy [P1] and developer
  verification [A11] all affect this plan and have all changed recently.
- **SPEC conflicts.** §9.2 (fixed compile-time set), §9.3 (no "Get" and no sizes,
  owner 2026-10-31) and §9.3 (no public plugin SDK yet) all have to be reopened.

## 5. Verdict

- **Feasible:** first-party tools as signed Hermes bundles loaded into the host
  runtime (pending S2, plus S3 or a custom loader), and data packs for anyone.
- **Not feasible:** downloadable native code (Play forbids it, F-Droid needs a bypass
  screen, Android discourages it, and it breaks §4.5), companion processes for real
  tools (they fail §13.3), and Play feature modules (Play only).
- **Size saving:** at most about 1.3 to 2.3 MB of 35.7 MB (4 to 6%) for a user who
  downloads no tools, and nothing for a user who wants them all. The packaging lever
  in section 1 saves about 15 MB of download on its own.
- **Cost:** 7 to 12 agent-days for the groundwork that pays off anyway, and 21 to 34
  agent-days to ship downloadable first-party tools. Add 6 to 10 more for community
  data packs. Community code plugins are open-ended.

## Sources

Accessed 2026-11-27.

- [A1] Android Developers, "Dynamic code loading": https://developer.android.com/privacy-and-security/risks/dynamic-code-loading
- [A2] Android Developers, "Behavior changes: Apps targeting Android 14", Safer dynamic code loading: https://developer.android.com/about/versions/14/behavior-changes-14#safer-dynamic-code-loading
- [A3] Android Developers, "Behavior changes: apps targeting API 29+", Removed execute permission for app home directory: https://developer.android.com/about/versions/10/behavior-changes-10#execute-permission
- [A4] Android Developers, `<permission>` element, `protectionLevel`: https://developer.android.com/guide/topics/manifest/permission-element
- [A5] Android Developers, "Package visibility filtering on Android": https://developer.android.com/training/package-visibility
- [A6] Android Developers, "Bound services overview": https://developer.android.com/develop/background-work/services/bound-services
- [A7] Android Developers, "Overview of Play Feature Delivery": https://developer.android.com/guide/playcore/feature-delivery
- [A8] Android Developers, "About Android App Bundles": https://developer.android.com/guide/app-bundle
- [A9] Android Developers, `<application>` element, `android:extractNativeLibs`: https://developer.android.com/guide/topics/manifest/application-element
- [A10] Android Developers, `<manifest>` element, `android:sharedUserId` (deprecated in API 29): https://developer.android.com/guide/topics/manifest/manifest-element
- [A11] Android Developers, "Android developer verification": https://developer.android.com/developer-verification
- [A12] Android Developers, `Context.createPackageContext`: https://developer.android.com/reference/android/content/Context
- [A13] Android Developers, "Play Asset Delivery": https://developer.android.com/guide/playcore/asset-delivery
- [P1] Google Play Console Help, "Device and Network Abuse" policy: https://support.google.com/googleplay/android-developer/answer/9888379
- [F1] F-Droid, "Inclusion Policy": https://f-droid.org/docs/Inclusion_Policy/
- [F2] F-Droid, "Anti-Features": https://f-droid.org/docs/Anti-Features/
- [F3] F-Droid, "Reproducible Builds": https://f-droid.org/en/docs/Reproducible_Builds/
- [E1] Expo, "Async routes": https://docs.expo.dev/router/web/async-routes/
- [RN1] React Native, "Using Hermes": https://reactnative.dev/docs/hermes
- [R1] Re.Pack, "Code splitting": https://re-pack.dev/docs/features/code-splitting
- [R2] Re.Pack, "Module Federation": https://re-pack.dev/docs/features/module-federation
