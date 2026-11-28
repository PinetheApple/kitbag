# Delivering first-party tools as signed downloadable bundles: technical design

Status: design, 2026-11-27. Docs only. Builds on #657 (owner decisions, spike verdict,
F-Droid research) and `docs/research/plugin-distribution-feasibility.md` (PR #658).
SPEC.md §9.1–§9.5, §12.4, §12.5, §13 and D18 state the rules this design implies
(issue 0, #722).

Every claim cites a repo path or a URL. **Inferred** marks reasoning not yet checked
against code or a device. Spike-branch paths are read with
`git show origin/spike/runtime-bundle-worklet:<path>`.

Prose says "tool" throughout. `ToolPlugin`, `ToolHost` and "plugin" in identifiers are
code names for the same thing.

## 1. Scope and non-goals

In scope:

- First-party tools, built from this repo by CI, signed with a key only CI holds, and
  downloaded by the user from this repo's GitHub releases.
- JavaScript (Hermes bytecode) and static assets only. A tool's screens, components,
  stores and logic move; nothing native does.
- Decided 2026-11-27 (owner, and the coordinator on the owner's behalf): build
  downloadable first-party tools; every new feature from #656 ships as one, metronome
  extras included; the JavaScript and UI of Tuner, Songs, Stem songs, Play along and
  Practice history become downloadable tools too, with their native parts left in the
  APK as inert stubs (section 8); the Metronome stays core; the app always opens on
  Home.
- Owner answers 2026-11-27: the experience is approved and lives in
  `design/kitbag-tools.html`, its smaller choices following this doc's
  recommendations; the F-Droid build compiles every tool in and carries no download
  code (section 10); tool update checks are manual only (section 6).
- Sequence: the delivery system, then the first new #656 tool, then the existing tools
  (section 12).

Non-goals:

- **Community tools.** Later, and as data packs before code (feasibility plan §5).
- **Native code in a bundle.** C++ engine features, Kotlin services, manifest entries and
  permissions stay in the APK. SPEC §4.5 and §13.2 allow one `kb_engine` per process,
  held only by the HostObject (`packages/core-native/cpp/KitbagHostObject.cpp`), and
  Android reads permissions only at install time.
- **The Metronome as a tool.** It stays core: setlists, presets, the practice recorder
  and the playback card are built on it.
- **Changing owner data.** Converting a tool moves code, never rows (section 9).
- iOS, Play Store delivery, and over-the-air updates of the host bundle
  (`expo.modules.updates.ENABLED` is `false` in
  `packages/app-shell/android/app/src/main/AndroidManifest.xml`).

**Metronome extras** (decided by the coordinator on the owner's behalf, 2026-11-27). A
#656 item with a native half (drone, click trainers, swing, spoken count, recorder)
ships that half in an APK release and its UI as a downloadable tool, reached from a
declared entry on the metronome (a "More" item), not UI injected into the metronome
screen. Each extra adds one facade function.

## 2. Bundle format

### 2.1 What a bundle contains

One file per tool, `tool-<id>-<version>.kbt`: a zip, unpacked by Kotlin's
`java.util.zip`, holding:

| Entry | What |
|---|---|
| `manifest.json` | Section 3. The signed bytes. |
| `manifest.sig` | ECDSA P-256 signature over the exact bytes of `manifest.json` (section 4). |
| `bundle.hbc` | The tool's code: Hermes bytecode from the host's own `hermesc`. |
| `assets/…` | Images, sounds, JSON data. Optional. |

A detached signature over raw bytes avoids canonical-JSON rules.

### 2.2 The build

`scripts/build-tool.sh <tool-package>` productises the spike's
`packages/app-shell/spike/plugin-build.config.mjs`:

- **Metro with no prelude.** `serializer.getPolyfills = () => []` and
  `getModulesRunBeforeMainModule = () => []`, as in the spike config. The host
  already ran the polyfills.
- **Module-system globals.** `transformer.globalPrefix` alone does not keep a second
  bundle off the host's module system. Metro's require polyfill
  (`node_modules/metro-runtime/src/polyfills/require.js`, lines 3–6) prefixes only
  `__d` and writes `global.__r`, `global.__c` and `global.__registerSegment`
  unprefixed, and the default `getRunModuleStatement`
  (`node_modules/metro-config/src/defaults/index.js`, lines 77–78) emits a bare
  `__r(id)`; the spike's output ends in one. The build therefore:
  - sets `globalPrefix = '__kbt_<id>_'`;
  - wraps the output in a function whose `globalThis` and `global` parameters are a
    per-tool scope object whose prototype is the host global, so the require
    polyfill's `__r`, `__c`, `__registerSegment` and the prefixed `__d` land on the
    scope, not on the host's global (issue 4 tests this against the spike's output);
  - sets a custom `getRunModuleStatement` that runs the entry through that object.

  The scope also shadows `ErrorUtils` and `nativeRequire` (read by the require
  polyfill) and the native entry points: `__turboModuleProxy`, `nativeModuleProxy`,
  `__fbBatchedBridge`, core-native's HostObject key and the others listed in
  `packages/app-shell/src/toolBuild/metroBundle.ts`. This is containment against
  accidental collisions and casual access, not a sandbox: a tool can still reach the
  host global through the scope's prototype or `Function('return this')()`. The
  signature is the trust boundary.

  The loader keeps the spike's global snapshot
  (`packages/app-shell/src/spike/pluginLoader.ts`, `globalDescriptors`), but as a
  check: any change to the host global other than the registration call fails the
  load and restores the snapshot. Issue 4's build evaluates the bundle, calls its
  `register()` with a stub host, and fails on any new global or changed property
  descriptor. That probe runs in a Node `vm` context on the JavaScript handed to
  `hermesc`, not in Hermes: `hermes-compiler` ships only the compiler, no Hermes VM.
  The JavaScript is the same, but Hermes's own globals are not, so the loader's
  snapshot check stays.
- **Shared-module map.** `resolver.resolveRequest` maps every allowlisted specifier
  (2.3) to a shim that reads the host's copy from the registration object, as the
  spike's `writeShims` does. Any other bare import fails the build.
- **Host `hermesc`.** Resolved from `hermes-compiler` next to `react-native`, as
  the spike's `hermesc()` does, so the lockfile pins it to the host's Hermes. Flags
  `-emit-binary -O`.
- The script then hashes every file, writes `manifest.json` and zips. Signing is a
  separate CI step (section 4). There is no unsigned load path: debug builds compile
  tools in (section 10), and testing the loader on a debug build uses a test key that
  only the debug source set pins (issue 5).

### 2.3 The curated, versioned module surface

The spike handed a tool the real `react-native` module, which exposes
`TurboModuleRegistry`, a §13.1 bypass (spike blocker 5, #657). The surface is an
allowlist, versioned as `hostApi`:

| Specifier | Given to the tool |
|---|---|
| `react`, `react/jsx-runtime` | Host copies (spike `HOST_MODULES`). |
| `react-native` | A curated object: layout and text primitives, `Pressable`, lists, `StyleSheet`, `useWindowDimensions`, `Platform`. No `NativeModules`, `TurboModuleRegistry`, `DeviceEventEmitter` or `Linking`. |
| `react-native-reanimated`, `react-native-worklets` | Host copies; the spike proved worklets cross bundles with default serialisation. |
| `react-native-gesture-handler`, `react-native-svg` | Host copies (§13.8: gestures, waveform rendering). |
| `@kitbag/core-design` | Its public exports: tokens, theme, shared components, `Icon`. |
| `@kitbag/core-plugin-api` | Types only; erased at build. |

**The facade is an argument, not a module.** A tool's entry exports
`register(host: ToolHost): ToolPlugin`. The downloaded path calls it after
evaluation; the compiled-in path (section 10) imports the package and calls the same
function with the same object. So the F-Droid build typechecks with plain static
imports, and no phantom specifier exists. `ToolHost` is the only door to the rest of
the app:

- `engine`: a named subset of core-native commands, and worklet-callable realtime
  reads (below), each added deliberately.
- `store`: `createToolStore(initial)`, implemented in core-state, so Zustand
  `create()` still runs only there (§13.4, §13.6).
- `data`: the tool's own key-value rows (section 7), scoped to its id by the host.
- `navigation`: `open(path)`, `back()` and `openTool(id)`, scoped under the tool's
  route prefix. Tools never import expo-router.
- `assets`: `uri(name)` for a verified file in the tool's directory.
- `haptics`, the preference reads the tool needs (theme, A4), `log`.

**Realtime values (§13.3).** A built-in tool reads the engine on the UI thread from a
`useFrameCallback` worklet through the HostObject global named by core-native's
`KITBAG_HOST_OBJECT_KEY` (`packages/tool-tuner/src/screen/useTunerFrame.ts`).
`host.engine.reads` gives a tool the same thing: `'worklet'`-marked functions over the
HostObject, called inside the tool's frame callback and written to a `SharedValue`.
Realtime values never enter `createToolStore` or React state. Issue 3's eval harness
gets a fail scenario: a tool that writes an engine read into its store or `useState`
from a frame callback.

§13.1 compliance:

- `ToolHost` **types** live in `core-plugin-api` (types only, imports nothing), next to
  `ToolPlugin` (`packages/core-plugin-api/src/index.ts`).
- The `ToolHost` **object** is assembled in `app-shell`, the one package that may
  import everything (§13.1 table). core-native stays the only package touching JSI and
  TurboModules; the facade calls core-native's exports.
- Downloadable tool packages live in `packages/tool-<name>` like today's tools. A new
  lint zone (root `eslint.config.mjs`) restricts packages marked downloadable to the
  allowlist above. The build enforces it again (unknown import fails) and the runtime a
  third time (the shim throws on an unlisted name).

## 3. Manifest format

### 3.1 Tool manifest (`manifest.json`)

Kotlin parses the exact bytes it verified, never a second read. Schema (JSON Schema
2020-12, abbreviated to what the loader checks):

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "required": ["schema", "id", "name", "version", "icon", "hostApi", "host", "runtime",
               "entry", "files", "size", "routes", "capabilities", "signature"],
  "additionalProperties": false,
  "properties": {
    "schema": { "const": 1 },
    "id": { "type": "string", "pattern": "^[a-z][a-z0-9-]{1,31}$" },
    "name": { "type": "string", "maxLength": 40 },
    "version": { "type": "string", "pattern": "^(0|[1-9]\\d*)\\.(0|[1-9]\\d*)\\.(0|[1-9]\\d*)$" },
    "icon": { "type": "string" },
    "summary": { "type": "string", "maxLength": 80 },
    "hostApi": {
      "type": "object", "required": ["major", "minMinor"],
      "properties": { "major": { "type": "integer" }, "minMinor": { "type": "integer" } }
    },
    "host": {
      "type": "object", "required": ["minVersionCode", "maxVersionCode", "builtWith"],
      "properties": {
        "minVersionCode": { "type": "integer" },
        "maxVersionCode": { "type": ["integer", "null"] },
        "builtWith": { "type": "string", "pattern": "^\\d+\\.\\d+\\.\\d+$" }
      }
    },
    "runtime": {
      "type": "object",
      "required": ["hermesBytecodeVersion", "reactNative", "react", "reanimated", "worklets"],
      "properties": {
        "hermesBytecodeVersion": { "type": "integer" },
        "reactNative": { "type": "string" }, "react": { "type": "string" },
        "reanimated": { "type": "string" }, "worklets": { "type": "string" }
      }
    },
    "entry": { "const": "bundle.hbc" },
    "files": {
      "type": "array",
      "minItems": 1,
      "items": {
        "type": "object", "required": ["path", "sha256", "size"],
        "properties": {
          "path": { "type": "string", "pattern": "^(bundle\\.hbc|assets(/[A-Za-z0-9_-][A-Za-z0-9._-]*)+)$" },
          "sha256": { "type": "string", "pattern": "^[0-9a-f]{64}$" },
          "size": { "type": "integer", "minimum": 0 }
        }
      }
    },
    "size": { "type": "integer", "minimum": 0 },
    "routes": {
      "type": "array", "minItems": 1,
      "items": { "type": "string", "pattern": "^/t/[a-z][a-z0-9-]{1,31}(/[A-Za-z0-9\\[\\]._-]+)*$" }
    },
    "homeTile": {
      "type": "object", "required": ["label", "route"],
      "properties": { "label": { "type": "string", "maxLength": 40 }, "route": { "type": "string" } }
    },
    "capabilities": { "type": "array", "items": { "type": "string" } },
    "requires": {
      "type": "array", "uniqueItems": true,
      "items": { "type": "string", "pattern": "^[a-z][a-z0-9-]{1,31}$" }
    },
    "changelog": { "type": "string", "maxLength": 500 },
    "signature": {
      "type": "object", "required": ["alg", "keyId"],
      "properties": { "alg": { "const": "ES256" }, "keyId": { "type": "string" } }
    }
  }
}
```

Rules JSON Schema cannot express, checked by the loader: every route starts with
`/t/<id>` for this manifest's `id`; `homeTile`, when present, has a `route` that is one
of `routes` (a metronome extra has none, SPEC §9.1; #725 and #726 build this); every id in `requires` is installed or
compiled in, and is not this manifest's `id`; `files` paths
are unique and `bundle.hbc` appears exactly once; `size` is the sum of `files[].size`.
The length caps (id 32, name 40, summary 80, changelog 500) are placeholders sized for
the Home tile and the Get row; final values follow `design/kitbag-tools.html`.

Example (sizes and the bytecode version are illustrative; version codes follow
`scripts/version.sh code`: major*100000 + minor*100 + patch):

```json
{
  "schema": 1,
  "id": "chords",
  "name": "Chords and scales",
  "version": "1.0.0",
  "icon": "chords",
  "summary": "Chord and scale reference, transposer, capo",
  "hostApi": { "major": 1, "minMinor": 0 },
  "host": { "minVersionCode": 10100, "maxVersionCode": null, "builtWith": "0.101.0" },
  "runtime": {
    "hermesBytecodeVersion": 96,
    "reactNative": "0.88.1",
    "react": "19.3.0",
    "reanimated": "4.7.2",
    "worklets": "0.13.0"
  },
  "entry": "bundle.hbc",
  "files": [
    { "path": "bundle.hbc", "sha256": "<64 hex>", "size": 184320 },
    { "path": "assets/scales.json", "sha256": "<64 hex>", "size": 12288 }
  ],
  "size": 196608,
  "routes": ["/t/chords", "/t/chords/scale/[id]"],
  "homeTile": { "label": "Chords", "route": "/t/chords" },
  "capabilities": [],
  "changelog": "First release.",
  "signature": { "alg": "ES256", "keyId": "tools-1" }
}
```

Notes:

- The runtime pins are the versions in `packages/app-shell/package.json` (React
  Native 0.88.1, React 19.3.0, Reanimated 4.7.2, worklets 0.13.0). Spike blocker 4:
  release builds skip the worklets version check, so a mismatch would fail silently;
  the loader checks these fields instead.
- `routes` and `homeTile` are in the manifest, so Home, Settings and the router can
  list a tool **without evaluating it**. Code is evaluated on first open.
- `capabilities` names facade features (`engine.drone`, `mic`), not Android
  permissions. The Get screen states them; the host refuses a capability it does not
  have.
- `keyId` and `alg` are inside the signed bytes; the signature is `manifest.sig`,
  since a signature cannot sign itself.

### 3.2 Signed index (`tools-index.json` + `tools-index.json.sig`)

One per host release, listing what that release built. `hostApi` here is the host's
own `{major, minor}`; a manifest's `{major, minMinor}` is checked against it (section 6).
`host.versionName` uses the same format as a manifest's `builtWith`.

```json
{
  "schema": 1,
  "host": { "versionName": "0.101.0", "versionCode": 10100 },
  "hostApi": { "major": 1, "minor": 0 },
  "signature": { "alg": "ES256", "keyId": "tools-1" },
  "tools": [
    {
      "id": "chords", "version": "1.0.0", "name": "Chords and scales",
      "icon": "chords", "summary": "Chord and scale reference, transposer, capo",
      "asset": "tool-chords-1.0.0.kbt", "size": 198431,
      "kbtSha256": "<64 hex>", "manifestSha256": "<64 hex>",
      "capabilities": [], "changelog": "First release."
    }
  ]
}
```

### 3.3 Signed status (`tools-status.json` + `.sig`)

The index is frozen with its release, so it cannot withdraw anything after the fact.
The status file carries what must reach old installs. Its source is
`tools/status.json` in this repo, signed offline (4.2) and committed with its
signature; CI attaches the pair to every release, so GitHub's `latest` link
(`/releases/latest/download/<asset>`,
[Linking to releases](https://docs.github.com/en/repositories/releasing-projects-on-github/linking-to-releases))
always serves the newest. The same file is compiled into each APK as its baked-in list.

```json
{
  "schema": 1,
  "issuedAt": "2026-11-27T00:00:00Z",
  "signature": { "alg": "ES256", "keyId": "revocation-1" },
  "revokedKeys": [],
  "revokedTools": [{ "id": "chords", "version": "1.0.0", "manifestSha256": "<64 hex>" }],
  "disabledTools": []
}
```

## 4. Signing and verification

### 4.1 Key type: ECDSA P-256 (`SHA256withECDSA`)

- `java.security.Signature` supports `SHA256withECDSA` from API 11 and `Ed25519` only
  from API 33 ([Signature](https://developer.android.com/reference/java/security/Signature),
  algorithm table). minSdk is 24: `packages/app-shell/android/app/build.gradle` reads
  `rootProject.ext.minSdkVersion`, which comes from React Native 0.88.1's
  `gradle/libs.versions.toml` (`minSdk = "24"`). Ed25519 would need a library on API
  24–32; ECDSA P-256 needs nothing new.
- The NDK's stable APIs include no crypto library
  ([NDK native APIs](https://developer.android.com/ndk/guides/stable_apis)), so
  verifying in C++ would mean vendoring one. Verification runs in core-native's Kotlin,
  which already uses `java.security.MessageDigest` for SHA-256
  (`packages/core-native/android/src/main/java/com/kitbag/corenative/library/DurableFiles.kt`,
  `stemdeck/CertFingerprint.kt`).
- CI signs with `openssl dgst -sha256 -sign`, which writes the DER signature
  `Signature.verify` reads (**inferred**; issue 4 tests it both ways).

### 4.2 Keys, ranks and custody

| Key | Signs | Private half | Pinned in |
|---|---|---|---|
| Revocation key (`revocation-N`) | `tools/status.json` only | Offline with the owner; long-lived | Every `github` APK |
| Tool key (`tools-N`), current | Manifests and indexes | GitHub Actions secret `TOOLS_SIGNING_KEY` | Every `github` APK |
| Tool key, next | Nothing until rotation | Offline with the owner | Every `github` APK |
| Tool key, retired | Nothing; verifies builds already installed | Offline with the owner until revoked | Every `github` APK until revoked |

Custody decided 2026-11-27 (coordinator, on the owner's behalf).

- Public keys live in `packages/app-shell/android/app/src/github/assets/tool-keys.json`
  (format in 4.5), in the `github` source set only (section 10). Same idea as the APK's
  pinned certificate (`packages/app-shell/android/app/release-cert.sha256`, checked by
  `scripts/release-gate.sh`).
- CI decodes `TOOLS_SIGNING_KEY` to `$RUNNER_TEMP` with `umask 077` and deletes it in
  an `if: always()` step, as `.github/workflows/release.yml` handles
  `ANDROID_KEYSTORE_BASE64`.
- The revocation key ranks above every tool key. Tool keys never sign status files, so
  no tool key can revoke itself or the revocation key. A compromised revocation key is
  replaced only by an APK update.

### 4.3 Verification, before `evaluateJavaScript`

All checks run natively; JavaScript never sees unverified bytes.

1. **Install.**
   - Verify the index embedded in the APK (section 5) with a pinned, unrevoked
     current or next tool key; reject an index whose `host.versionCode` is not the
     host's own.
   - Download (section 5); check the `.kbt`'s sha256 against `kbtSha256`.
   - Unpack into a staging directory. Reject absolute paths, `..` (zip-slip), duplicate
     entries, entries not listed in the manifest, and any entry or total that exceeds
     the signed sizes; stop writing at the manifest's `size` so a zip bomb cannot fill
     the disk.
   - Verify `manifest.sig`; check every file's sha256 and size against `files`; check
     compatibility (section 6) and rollback (4.4). Only then move it into place.
2. **Every load.** Kotlin re-verifies `manifest.sig` with any pinned, unrevoked tool
   key, retired ones included, reads `bundle.hbc` **once** into
   memory, checks its sha256 against the manifest, and hands those exact bytes to C++,
   which checks the Hermes bytecode version and calls `evaluateJavaScript`. One read,
   so nothing can swap the file between check and evaluation. SHA-256 of a bundle under
   2 MB costs milliseconds (**inferred**; measured in issue 5).

The spike's loader (`packages/core-native/cpp/KitbagBundleEval.cpp`) read a path or an
APK asset and evaluated it unchecked. The production loader takes a tool id, not a path.

### 4.4 Rollback, rotation, revocation

Terms, each with the label the user sees:

| Term | Meaning | Label |
|---|---|---|
| Revoked | A key or tool build listed in the status file; never loaded again | "Withdrawn" |
| Disabled | Switched off by the user, the crash-loop breaker (section 11), the status file's `disabledTools`, or an incompatible host (section 6) | "Off", "Stopped working", "Paused by Kitbag", "Needs an update" |
| Withdrawn | The user-visible state of a revoked build; data kept, Remove and Get offered | "Withdrawn" |

- **Rollback.** The host keeps a per-tool high-water mark (version and
  `manifestSha256`) of the newest build it installed. It refuses a lower version unless
  the user picks "Install older version" and confirms.
- **Status file rules.** Accepted only if signed by a pinned revocation key that is not
  itself listed in `revokedKeys`. The host keeps the newest `issuedAt` it accepted and
  ignores older files, so a replay cannot un-revoke. It rejects an `issuedAt` more than
  one day ahead of the device clock (enough for clock skew, too little to freeze the
  mark far ahead). An APK update that pins a new revocation key resets the mark.
- **Rotation.** CI starts signing with the next tool key; the following APK release pins
  a new next key and marks the old one retired. A retired key stays pinned so builds it
  signed keep loading for users who never open Settings > Tools; only revocation
  removes trust in it. Old hosts keep reading their own frozen release, signed with a
  key they pin. A compromised tool key is revoked by a status
  file, which every APK can verify because the revocation key does not rotate with it.
- **Reach.** The check runs only when Settings > Tools is opened (section 6), so
  revocation reaches most
  installs only through an APK update and its baked-in list. The user's own switch and
  the crash-loop breaker need no network.

### 4.5 Owner setup steps

Generating keys and adding secrets is an owner action. No agent, issue or CI job
generates or reads a real private key. Run once, before the first real tool release,
on a machine you trust, in a new directory on encrypted or removable storage (called
`<offline>` below), never inside the repo; `*.key` and `*.key.enc` are gitignored by
issue 0:

```sh
umask 077
for id in revocation-1 tools-1 tools-2; do
  openssl genpkey -algorithm EC -pkeyopt ec_paramgen_curve:P-256 -out "$id.key"
  openssl pkey -in "$id.key" -pubout -outform DER | base64 -w0 > "$id.spki.b64"
done
```

Each `.spki.b64` holds a 91-byte P-256 SubjectPublicKeyInfo, so it starts with
`[REDACTED-SECRET-00f7c19c]`.

Where each private key goes:

- **`tools-1` (current tool key)** → two GitHub Actions secrets that `release.yml`'s
  `tools` job reads (issue 10):

  ```sh
  base64 -w0 tools-1.key | gh secret set TOOLS_SIGNING_KEY --repo <owner>/<repo>
  printf tools-1 | gh secret set TOOLS_SIGNING_KEY_ID --repo <owner>/<repo>
  ```
- **`revocation-1`** and **`tools-2` (next tool key)** → offline only. Encrypt each
  with a passphrase and keep two copies on separate offline media; never add them to
  Actions:

  ```sh
  openssl pkey -in revocation-1.key -aes256 -out revocation-1.key.enc
  openssl pkey -in tools-2.key -aes256 -out tools-2.key.enc
  ```
- Keep an encrypted copy of `tools-1` the same way, then delete every plaintext
  `.key` file.

Pinning the public keys: a PR adds
`packages/app-shell/android/app/src/github/assets/tool-keys.json`:

```json
{
  "schema": 1,
  "keys": [
    { "keyId": "revocation-1", "role": "revocation", "spkiBase64": "<revocation-1.spki.b64>" },
    { "keyId": "tools-1", "role": "tools", "status": "current", "spkiBase64": "<tools-1.spki.b64>" },
    { "keyId": "tools-2", "role": "tools", "status": "next", "spkiBase64": "<tools-2.spki.b64>" }
  ]
}
```

`status` is `current`, `next` or `retired` (4.4). Signing the status file whenever
`tools/status.json` changes, from the repo root; the decrypted key exists only in a
pipe, never on disk:

```sh
openssl dgst -sha256 -sign <(openssl pkey -in <offline>/revocation-1.key.enc) \
  -out tools/status.json.sig tools/status.json
```

**Test keys only in tests.** Unit tests, the debug build and the build scripts' own
tests use keys with a `test-` id: generated by the test or committed under a `test`
or `debug` source set, with the debug pin file in
`packages/app-shell/android/app/src/debug/assets/`. `tools-gate.sh` fails a release
whose pin file holds any `test-` key, and a unit test fails if a `test-` key appears
in the `github` or `main` source sets.

**Rotation drill.** Once before the first real tool release, then yearly:

1. Generate `tools-3` as above and store it offline, encrypted.
2. Open a PR that changes the pin file: `tools-1` `retired`, `tools-2` `current`,
   `tools-3` `next`, all three pinned.
3. Before merging it, switch CI to `tools-2`:

   ```sh
   openssl pkey -in <offline>/tools-2.key.enc | base64 -w0 | gh secret set TOOLS_SIGNING_KEY --repo <owner>/<repo>
   printf tools-2 | gh secret set TOOLS_SIGNING_KEY_ID --repo <owner>/<repo>
   ```

   Merge; that release signs with `tools-2`.
4. On the phone: a tool installed under `tools-1` still loads after updating to that
   release, without opening Settings > Tools; Get installs a new tool; the previous
   release's APK still installs tools from its own release. Keep `tools-1` pinned and
   its offline copy until it is revoked.
5. Revocation check: sign a status file with a newer `issuedAt` and no new entries,
   attach it to the next release, open Settings > Tools on the phone, and confirm it
   was accepted (the debug log names the key). On a debug build, confirm a status file
   signed by a tool key is rejected.

## 5. Hosting on GitHub releases

- **One release per host version.** Every merge to main already publishes `vX.Y.Z` with
  `kitbag.apk` and its sha256 (`release.yml`, "Publish the GitHub release"). The same
  release gains `tool-<id>-<version>.kbt` per tool, `tools-index.json`,
  `tools-status.json` and their `.sig` files. The signed index is also embedded in the
  APK, so the catalogue is local (`design/kitbag-tools.html` 7c): browsing tools needs
  no network, and an install downloads only the `.kbt`. A release holds up to 1000
  assets of under 2 GiB each
  ([About releases](https://docs.github.com/en/repositories/releasing-projects-on-github/about-releases)).
  Tool updates therefore ship with host releases; tool-only releases would need
  cross-version indexes and a compatibility matrix in CI.
- **URLs**, built from a compile-time repo slug and the host's own versionName:
  `https://github.com/<repo>/releases/download/v<versionName>/<asset>` for a `.kbt`,
  and `https://github.com/<repo>/releases/latest/download/tools-status.json`. A host only
  fetches tools built for its own release, so compatibility holds by construction.
- **CI.** A `tools` job in `release.yml` runs after `plan` and before the APK build:
  `pnpm install --frozen-lockfile` (same lockfile, same hermesc), build every
  downloadable tool, sign, then `scripts/tools-gate.sh` verifies each signature with the
  public keys in the repo and checks the bytecode version against the host's hermesc.
  The APK build needs `tools` because it embeds the signed index and, during the bridge
  window (section 9), the bundles. The `release` job passes every artefact to the single
  `gh release create`, so a failed tool build fails the release and a release appears
  with all its assets or none. Every tool is rebuilt for every host release, the largest
  ongoing cost (spike estimate).
- **Download client.** `android.permission.INTERNET` is already declared
  (`AndroidManifest.xml`). `stemdeck/StemDeckHttp.kt` does not fit: it is built for a
  LAN server (no proxy, pinned or probed TLS, no redirects), and GitHub release
  downloads redirect to a storage host. A separate client uses system TLS and proxy
  settings, follows up to five redirects and only to `https` (a release download is one
  hop; the cap stops loops), and stops reading at a byte cap: the signed `size` for a
  `.kbt`, a fixed cap for the status file (value decided in issue 7).
- **Storage.** Downloads go to `noBackupFilesDir/tools/.staging/<random>.part` and
  move into place with the `DurableFiles` pattern (`copyAndHash`: part file,
  `fd.sync()`, rename, directory sync). Installed tools live in
  `noBackupFilesDir/tools/<id>/<manifestSha256>/` with an atomically replaced
  `current` pointer; leftover staging and unreferenced directories are deleted at
  start. `noBackupFilesDir` keeps re-downloadable code out of Auto Backup
  ([Context.getNoBackupFilesDir](https://developer.android.com/reference/android/content/Context#getNoBackupFilesDir())),
  which matters because the manifest sets `android:allowBackup="true"`.
- **Retry, not resume.** Tool JavaScript is about 0.5 to 1.8 MiB in total (feasibility
  plan §1), so a failed download restarts with backoff; the try count is decided in
  issue 7. Range resume adds code for little gain (**inferred**).
- **Offline.** Installed tools load from disk and never touch the network. The Get
  screen shows an offline state with a retry.

## 6. Versioning and compatibility

- **Host plugin API.** `hostApi = {major, minor}` describes the surface in 2.3. Adding
  a facade function or allowlisted export bumps minor; removing or changing one bumps
  major. The number lives next to the facade in app-shell; `build-tool.sh` reads it.
- **Tool version.** Semver from the tool package's `package.json`: minor for features,
  patch for fixes. It says what changed for the user; compatibility is decided by the
  fields below.
- **Compatible** means all of: same `hostApi.major` and host minor ≥ `minMinor`; host
  versionCode within `[minVersionCode, maxVersionCode]`; equal Hermes bytecode version;
  equal React Native, React, Reanimated and worklets versions. The host computes its
  own fingerprint at build time.
- **On app update** the host re-checks every installed manifest at start. A compatible
  tool keeps working. An incompatible one is disabled as "Needs an update", its tile
  muted, its data kept, and one tap downloads the build listed in the new release's
  embedded index, which always has one because CI rebuilds every tool.
- **Tool downloads switch** (`design/kitbag-tools.html` 2a, 2b, 7). Off on a new
  install. The full-screen opt-in screen (2a, "Turn on downloads") is the only way to
  turn it on, reached from Install on a tool page; Settings > Tools > Downloads > "Tool
  downloads" turns it off after a confirm. While off, Kitbag makes no tool network
  request at all: no install, no update, no check. Installed tools keep working, the
  local catalogue stays listed, and a tool needing an update after an app update waits
  until downloads are back on. The bridge install (section 9) is not a download and
  runs either way.
- **Update checks are manual only** (owner, 2026-11-27). With downloads on, the check
  runs only when the user opens Settings > Tools: it fetches the status file and
  compares installed builds with the embedded index then. There is no background or
  scheduled check, and nothing is fetched at app start. A silent check may count as the
  Tracking anti-feature ([Anti-Features](https://f-droid.org/docs/Anti-Features/); #657
  F-Droid comment).

## 7. Tool data storage

- **Table.** A migration to the next schema version (`SCHEMA_VERSION` is 31 today,
  `packages/core-db/src/migrate.ts`) adds:

  ```sql
  CREATE TABLE tool_data (
    tool_id TEXT NOT NULL,
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (tool_id, key)
  );
  ```

  `value` holds JSON. The migration only adds a table, so every existing row stays. The
  test follows the `migrate-vNN.test.ts` pattern with `migrate-fixtures.test-helper.ts`:
  seed a v31 database with rows in every table, migrate, and assert equal row counts and
  contents plus the new table. The repository validates JSON on write and caps a
  value's size (value decided in issue 6).
- **Access** only through `host.data`, scoped to the calling tool's id. A tool needing
  relational data later gets a reviewed migration of its own.
- **Backups.** `BACKUP_VERSION` stays 5 and `CATEGORIES` do not change, so every file
  restores on older apps. Tool data goes in a root key `toolData` (`{ "version": 1,
  "records": [...] }`) that is not a category. `parseBackup` (`core-db/src/backup-parse.ts`)
  reads only the root keys named in `CATEGORIES` (`readCategory`) and checks only the
  listed category names (`readCategories`), so a v5 parser never looks at `toolData`.
  The rule relies on that. New readers parse `toolData` after the categories; the
  import screen offers it as its own row. Record key is `<tool_id>:<key>`, so merge
  conflicts resolve per row. Issue 6 adds a test that today's parser, run on a file
  with `toolData`, restores every category and ignores it.
- **Restore never needs the tool.** Restore lives in core-db and writes every category
  (songs, stem songs, practice sessions, `toolData`) whether or not the tool that
  shows it is installed. The tool shows "Install to open" (section 9) and finds its
  data when added.
- **Remove keeps data.** Removing a tool deletes its code directory only. "Delete data
  too" is a separate, confirmed action. Matches §9.3: "Off removes a tool everywhere;
  nothing is deleted."
- **Converted tools keep their tables** (`songs`, `stem_sets`, `practice_sessions`,
  `tunings` and the rest in `schema.ts`), reached through `ToolHost` domain services
  (8.3). The generic table is for new tools.
- **Installed state** comes from disk (the `current` pointer and its verified
  manifest), not a table, so the database and the files cannot disagree. The on/off
  switch stays the `tool_enabled_<id>` preference (§9.3).

## 8. Existing tools as downloads

Tuner, Songs, Stem songs, Play along and Practice history move their JavaScript and UI
into bundles. This section is built from the import graph at `bd048af9` (`origin/main`
when written): `git grep` over relative imports in `packages/core-state/src` and over
`@kitbag/tool-*` imports in `packages/app-shell/src`, tests excluded. Sizes are
`du -sk` of each directory, tests included.

### 8.1 Inert stubs

An inert stub is native code that stays in the APK but that nothing in the core calls:
only a tool reaches it, through a `ToolHost` slice its manifest names in
`capabilities`. Permissions stay declared (Android reads them only at install time)
and are requested only from the tool, through `host.permissions.request(...)`.

| Tool | Native parts left as stubs | Permission, requested only from the tool |
|---|---|---|
| Tuner | Tuner in `libkitbag_core`, `cpp/KitbagJniTuner.cpp`, the HostObject's `tuner_snapshot` read | `RECORD_AUDIO` (`packages/app-shell/app.json`); requested today by `app-shell/src/runtime/tunerRuntime.ts` |
| Songs | None: import and analysis (`KitbagLibraryModule.kt`, `AnalysisWorker.kt`) are wrapped by the `songLibrary` store, which stays core (8.2); only Songs' screens start an import | none |
| Stem songs | `KitbagStemDeckModule.kt`, `stemdeck/StemDeckImportService`, `stemdeck/qr/QrScanActivity` and CameraX | `CAMERA` (`packages/core-native/android/src/main/AndroidManifest.xml`); requested today by `app-shell/src/runtime/cameraPermission.ts` |
| Play along | `PlayAlongService`, `media/MediaListenerService`, `KitbagMediaSessionsModule.kt` | Notification access, opened from the tool only |
| Practice history | none | none |

`MediaListenerService` is not inert by itself: Android binds an enabled notification
listener whenever the user has granted access. While Play along is absent the host
disables the component with `PackageManager.setComponentEnabledSetting(...,
COMPONENT_ENABLED_STATE_DISABLED, DONT_KILL_APP)`
([PackageManager](https://developer.android.com/reference/android/content/pm/PackageManager#setComponentEnabledSetting(android.content.ComponentName,%20int,%20int)))
and enables it when Play along is installed. That disabling also unbinds a running
listener is **inferred**; issue 19 checks it on the phone.

Shared native parts stay core: the mixer and player, `PlaybackService` (metronome,
stem songs and single songs, §13.9), `POST_NOTIFICATIONS` (the playback card) and the
data-folder move service. Analysis already queued in WorkManager still finishes after
Songs is removed.

### 8.2 What moves and what stays

core-state directories:

| Directory | Fate | Core importers and their resolution |
|---|---|---|
| `tuner` (76 KB) | Tuner bundle | None in core-state. |
| `stemDeck` (148 KB) | Stem songs bundle, except `lanes.ts` | `stemPlayer/speedKey.ts` imports `DRUMS_STEM` from `stemDeck/lanes.ts`: `lanes.ts` moves into `stemPlayer/`. |
| `playAlong` (244 KB), `tempoLadder` (124 KB), `mediaSessions` (20 KB) | Play along bundle | Only each other. |
| `songLibrary`, `songPlayer`, `stemPlayer`, `songView` | **Stay core** (the listening core) | `playOrder` (`nowPlaying`, `autoAdvance`, `listeningSession`, `shown`, `shownPlayer`, `metronomeTakeover`, `libraryRemovals`, `useLibrarySongs`, `useStemSongs`), `dataFolder` (`store`, `release`), `clickSounds/store.ts` (`checkAudioFormat`), `metronome/store.ts` (`mixerClick`) and `playAlong` import them; `songPlayer` alone imports some 30 `stemPlayer` modules. |
| `playOrder`, `library`, `practice`, `metronome`, `dataFolder`, `clickSounds` and the rest | Stay core | Queue, setlists, the practice recorder and the metronome. |

app-shell files that import a tool package today:

| File | Imports | Resolution |
|---|---|---|
| `app/stems/index.tsx` | `LibraryScreen` (`tool-library`) | `LibraryScreen` (both lists) moves to core, `app-shell/src/listening/`. |
| `app/library/[id].tsx` | `UpNextRow`, `useMixerFrame` (`tool-stems`) | Both move to core (`listening/`; the frame hook beside `stemPlayer`). |
| `miniPlayer/DockedMiniPlayer.tsx`, `useMiniPlayerDocked.ts` | `MiniPlayer`, `useMiniPlayerShown` (`tool-library`); `useMixerFrame` (`tool-stems`); `PlayAlongMiniPlayer`, `usePlayAlongMiniShown` (`tool-sync`) | Song and stem mini-player move to core; Play along's becomes a `miniPlayer` contribution (8.3). |
| `queue/useQueueSheet.tsx` | `QueueSheet` (`tool-stems`) | Moves to core. |
| `home/HomeScreen.tsx` | `useLockedSubtext` (`tool-sync`), `DEFAULT_TUNING`, `tuningLabel` (`tool-tuner`) | `homeSubtext` contributions. |
| `home/registry.ts` | `PLAY_ALONG_NAME` (`tool-sync`) | Converted tools' entries come from their manifests; the name moves to core. |
| `settings/AttributionsScreen.tsx`, `settings/getSongBpmKeyText.ts` | `creditLinkText` (`tool-sync`) | Moves to core-state. |
| `runtime/mediaSessionsRuntime.ts` | `chooseSession` (`tool-sync`) | Moves with the runtime into the Play along bundle. |
| `practice/TimelineRows.tsx`, `practice/timelineText.ts` | `useCustomSoundViews`, `countInLabel`, `polyRatioLabel` (`tool-metronome`) | The screens move to the Practice history bundle and read these through `host.metronome` (8.3). |
| `app/stemdeck/*`, `app/stems/[id].tsx`, `app/library.tsx`, `app/tuner.tsx`, `app/sync.tsx` | Tool screens | Replaced by the `/t/<id>` route (section 11). |
| `app/metronome.tsx`, `songs.tsx`, `setlists/*`, `presets/[id].tsx`, `runtime/transportRuntime.ts` | `tool-metronome` | Unchanged: the Metronome is core. |

So the Songs and Stem songs bundles carry screens and import flows, not their stores,
and save less than the feasibility plan's tool-JavaScript estimate; issue 13 measures
the split with a source map. Tables and repositories never move: they stay in
`core-db`, reached through `ToolHost`.

**§13.4 changes.** Stores that move (`tuner`, `stemDeck`, `playAlong`, `tempoLadder`,
`mediaSessions`) become tool-owned. `create()` is still called only in core-state,
through `host.store.createToolStore`; the §13.6 rule becomes "`create()` only in
core-state; tool packages use the factory". Issue 0 edits §13.4 and §13.6.

### 8.3 What `ToolHost` and `ToolPlugin` grow

Each conversion adds its slice and bumps `hostApi` minor (section 6).

- **Domain services** over the core repositories: songs, stem songs, setlists (read),
  practice sessions, tunings, BPM cache and the GetSongBPM key.
- **Listening:** the song and stem player stores, the queue and now playing, the mixer
  frame worklet read.
- **Metronome:** `countInLabel`, `polyRatioLabel`, the custom sound views, and the
  pattern commands Play along uses.
- **Import:** file picking, StemDeck import commands, QR scan, mixdown export.
- **Engine slices:** tuner commands and worklet reads; Play along's engine commands.
- **Media sessions:** the listener's sessions (Play along).
- **Permissions:** `mic`, `camera`, `notificationListener`.

`ToolPlugin` (§9.1) gains optional contributions the core renders: `miniPlayer`,
`homeSubtext` and a Settings section. Until a tool has been loaded, Home shows its
manifest `summary`. Issue 0 edits §9.1.

### 8.4 Coupling between tools, and what the core keeps

No converted tool imports another: what two tools share is core (8.2), and issue 13
adds a test that fails if a bundle's imports reach another tool's package or moved
directory. So converted tools declare no `requires`; the field (3.1) is for new tools
built on another, such as an intonation trainer on the drone (`design/kitbag-tools.html`
3c), where Install offers to install both.

| Link today | Without the other tool |
|---|---|
| Queue holds songs and stem songs (`play_queue`: `song_id` or `stem_set_id`, `core-db/src/schema.ts`) | The queue is core. A row whose tool is absent shows its title and "Install <tool> to play"; auto-advance skips it. |
| Setlists hold presets and stem songs (`setlist_items`: `song_preset_id` or `stem_set_id`) | Setlists stay with the metronome. A stem-song entry without Stem songs shows "Install Stem songs to play" and is skipped. |
| Song presets link to library songs (`song_presets.library_song_id`) | Presets keep working; the song link is shown, not opened. |
| Play along offers library songs and grids (`playAlong/libraryOffer.ts`, `libraryGrid.ts` → `songPlayer/songGrid.ts`) | `songGrid` is core, so offers work without Songs. |
| Stem songs list (`app/stems/index.tsx` → `LibraryScreen`) | `LibraryScreen` is core, so Stem songs works without Songs. |
| Mini-player shows Songs, Stem songs or Play along | Only an installed tool starts playback. |
| Practice history reads sessions the metronome records | Recording continues; history appears when installed. |

Old routes (`TOOL_ROUTES` in `app-shell/src/home/toolRoutes.ts`) and `kitbag://` deep
links (`runtime/stemDeckLinks.test.ts`) redirect to `/t/<id>/...`, or to "Install to
open" when the tool is absent.

## 9. Upgrade path for existing users

Rules:

- Owner data never changes. Converting a tool runs no migration that deletes or
  rewrites rows; its data stays in its existing tables.
- **Ids stay.** Converted tools keep their ids from `TOOL_ID`
  (`app-shell/src/home/toolRoutes.ts`: `tuner`, `library`, `stems`, `sync`,
  `practiceHistory`), so `tool_enabled_<id>` (§9.3), the last-tool preference and the
  backup's `PREFERENCE_KEYS` (`core-db/src/backup-format.ts`) need no rewrite.
- **Preference keys stay.** A moved store keeps the preference keys it persists under
  today; nothing moves into `tool_data`.
- No one loses access silently.

"Install to open" is the state of a tool whose data or tile exists but whose code is
not installed: the tile stays, muted, and opening it offers Install.

**Bridge release (decided 2026-11-27, coordinator on the owner's behalf), card as
fallback.** The release that converts a tool also carries that tool's signed bundle in
its APK assets. On first launch the host installs it from there, verified as in 4.3,
for every upgrading user who has not switched it off (§9.3: a missing
`tool_enabled_<id>` is on). An upgrading user is one whose database existed before this
launch. No network and no tap, so the "Tool downloads" switch (section 6) does not
apply. A one-time notice says the tools are now separate (`design/kitbag-tools.html`
9a). If that install fails, the fallback card lists the tools with data counts and one
"Install all" that downloads on tap (9b); with downloads off, it opens the opt-in
screen first.

**Window.** Every merge publishes a release, so users skip releases. Each converted
tool's bundled copy stays in every release from its conversion until all five
conversions have shipped and 180 days have passed since the last one (issue 20). The
cost is APK size for that period. A user who updates after the window from a
pre-conversion release gets the fallback card directly; their data is untouched and
each tool shows "Install to open" until installed.

The F-Droid build is unaffected: every tool is compiled in (section 10).

Each conversion issue carries an upgrade test: a database and preferences seeded from
the previous release, with rows in every table, upgraded, keep identical rows,
`tool_enabled_<id>`, last-tool and the tool's own preference keys, and the tool is
installed from the bundled copy.

## 10. F-Droid build

Decided (owner, 2026-11-27): the F-Droid build compiles every tool in, the five
converted ones included, and carries no download code. #657's F-Droid comment gives
the reason: it is the Inclusion Policy's own remedy for this shape (a build flavour
without the problem), and opt-in downloads would need a consent screen
([Inclusion Policy](https://f-droid.org/docs/Inclusion_Policy/)) and a ruling on
`.hbc`. Tools show as "Not added" and Add is instant, so the screens match the GitHub
build. The GitHub/Obtainium APK is the download build; its opt-in screen is the
"Tool downloads" switch's (section 6). The `fdroid` build has neither the switch nor
the opt-in screen.

Build mechanism:

- **Gradle.** There are no product flavours today
  (`packages/app-shell/android/app/build.gradle`); this adds a `distribution`
  dimension with `github` and `fdroid`. The Kotlin installer, verifier and the
  `loadTool` JSI installer live in a `github` source set (or a module added only by
  `githubImplementation`), so the `fdroid` APK has no class that downloads or
  evaluates a bundle. The status file's baked-in list and the pinned keys go with them.
- **JavaScript.** The flavour passes a build-time constant to the JS bundle step; the
  shell imports the generated `compiledTools.ts` (static imports of every tool package,
  each called through `register(host)`) on `fdroid` and the downloader on `github`,
  and Metro drops the unused branch (**inferred**: how the React Native Gradle plugin
  passes a per-variant value is checked in issue 11). Debug builds use the compiled-in
  path too.
- **Proof.** Issue 11 checks the `fdroid` APK's dex for the installer classes and its
  bundle for the downloader's strings, and fails if either is present.
- **Recipe and metadata.** The F-Droid recipe builds the `fdroid` variant;
  `metadata/en-US/full_description.txt` says tools are built in. The GitHub release
  notes disclose downloads. The inclusion request (#61) only needs to confirm the
  flavour.
- **Not on GitHub.** The `fdroid` APK is not published on GitHub releases (decided
  2026-11-27); GitHub releases carry only the `github` APK.

## 11. Lifecycle and errors

- **Start.** Kotlin lists installed tools and verifies each manifest (no code read).
  The registry merges them into `HOME_TOOLS`, so Home, Settings and `useToolOn`
  (`packages/app-shell/src/home/toolsOn.ts`) treat them like built-in tools. The app
  still opens on Home.
- **Routes.** Expo Router is file-based, so a downloaded tool cannot add route files.
  One host route, `src/app/t/[tool]/[...path].tsx`, wrapped in `gated()`
  (`packages/app-shell/src/home/ToolGate.tsx`), mounts the screen matching the
  manifest's `routes`. The spike mounted its screen from one host route
  (`packages/app-shell/src/app/plugin-spike.tsx` on the spike branch).
  `registryRoutes.test.ts` gains the rule that downloadable tools own only `/t/<id>`
  routes.
- **Load** on first open: a JSI function in core-native (`loadTool(id)`) runs 4.3's
  checks and evaluates; the host calls the bundle's `register(host)` and checks the
  returned `ToolPlugin`'s `id` and routes against the manifest. Measured eval cost in
  the spike: 0.4 ms for bytecode.
- **Unload and reload.** Hermes cannot unload evaluated code. Disabling drops the
  registry's references; the code stays in memory until the app restarts. Updating a
  tool that has not run this session takes effect at once; updating one that has run
  says "Restart Kitbag to finish" (**inferred**: re-evaluating the same prefix might
  work but leaves two copies of module state).
- **Failure screen.** A React error boundary around every tool route catches render
  errors and shows "<Tool> stopped working" with Disable and Back, never a dead end
  (§12.6). Load failures (bad signature, missing file, incompatible) show the same
  screen with the reason in plain words.
- **Crash isolation limits.** Tools share the JS runtime, heap and UI thread with the
  host. An error thrown in an event handler or timer reaches the global handler and can
  take the app down; a worklet error on the UI thread is fatal; an infinite loop
  freezes the app. The facade wraps the callbacks it owns, which helps only partly.
- **Crash-loop breaker.** Before evaluating, Kotlin writes a `loading:<id>` marker
  synchronously and clears it once the tool's first screen has rendered. A marker found
  at start counts a strike; two strikes disable the tool and Home says why (one strike
  can be an unrelated kill; the threshold is revisited in issue 9).

## 12. Build plan

Ordered, one PR each against main. Estimates in agent-days.

| # | Issue | Acceptance criteria | Est. | Needs |
|---|---|---|---|---|
| 0 | SPEC: tools can be downloaded | §9.1 (contributions), §9.2 (lifts "no new generator" for `compiledTools.ts`), §9.3, §13.1, §13.4 and §13.6 (tool-owned stores) rewritten to this design; new §9.5 "Delivery"; decisions log entry; `*.key` and `*.key.enc` in `.gitignore` | 0.5 | — |
| 1 | Experience first | **Done**: approved by the owner 2026-11-27; `design/kitbag-tools.html` binds (§12). Any state this doc adds that the file lacks ("Install to open", the bridge notice, the fallback card) is added there before issue 8 | 0 | — |
| 2 | Spike: open runtime questions | Hermes bytecode version readable from the host runtime and from `hermesc`; a mismatched `.hbc` fails with an error, not a crash; the JS-starved run repeated on the phone with a marker that proves the block ran | 1 | — |
| 3 | Host surface v1 | `ToolHost` types in core-plugin-api; object in app-shell; `createToolStore` in core-state; worklet engine reads; lint zone for downloadable packages with pass/fail eval scenarios, including the realtime-into-store fail scenario; `hostApi` constant | 2–3 | 0 |
| 4 | Tool build and signing scripts | `build-tool.sh`, `sign-tools.sh`, `tools-gate.sh` with `-h` and named exit codes; module-system globals rebound and a no-new-globals test that fails on the spike's output; OpenSSL-signed sample verified by a Node verifier, and a tampered byte rejected. Tests use `test-` keys only; real keys are the owner's (4.5). | 2–2.5 | 3 |
| 5 | Native verifier and loader | Kotlin ECDSA and sha256 checks on the exact bytes; an OpenSSL-signed sample verified by the Kotlin verifier in a unit test, and a tampered byte rejected; manifest rules read from `packages/app-shell/tool-bundle-rules.json`, not retyped; bytes handed to C++ once; bytecode version check; no path-based or unsigned eval; debug-only test key in the debug source set; unit tests for each rejection: bad signature, revoked key, wrong hash, extra file, duplicate entry, zip-slip, zip bomb, wrong bytecode, verify after rotation, a build signed by a retired key still loads; unit test that no `test-` key is in the `github` or `main` source sets. Tests use `test-` keys only; real keys are the owner's (4.5). | 2–3 | 2, 4 |
| 6 | `tool_data` table and backups | Migration to the next schema version with a seeded test keeping every row; repository; `toolData` root key in v5 files; a test that today's parser restores a file with `toolData` and ignores it; v4 and v5 restore tests still pass | 1.5–2 | — |
| 7 | Installer | Embedded index verified, own-versionCode check, rollback refusal with tests, HTTPS-only redirect client with byte caps, retry, staging, atomic install, remove (data kept), delete data; no request while "Tool downloads" is off, tested; a test that kills the install midway and finds the old build intact and staging cleaned at start; offline state | 2–2.5 | 5 |
| 8 | Registry and Tools screen | Installed tools in `HOME_TOOLS`; `/t/[tool]/[...path]` route; local catalogue, tool pages, Get/Add/Remove and states from `design/kitbag-tools.html`; "Tool downloads" switch off on a new install, turned on only from the opt-in screen (2a), off from Settings > Tools > Downloads with a confirm (2b) | 2–3 | 1, 3, 7 |
| 9 | Lifecycle | Error boundary and failure screen; crash-loop breaker; compatibility check at start; status file with tests for future `issuedAt`, a file signed by a revoked key, and replay; baked-in list; update check only on opening Settings > Tools with downloads on, with a test that nothing is fetched at start. Tests use `test-` keys only; real keys are the owner's (4.5). | 2–2.5 | 8 |
| 10 | CI | `tools` job in `release.yml` before the APK build; the APK embeds the signed index (and the bridge copies during the window, section 9); key handled like the keystore; `tools/status.json` and its signature attached; one `gh release create` with every asset; a failed tool build fails the release; `tools-gate.sh` gates it and refuses `test-` keys. Reads `TOOLS_SIGNING_KEY` and `TOOLS_SIGNING_KEY_ID`; the workflow's own tests use `test-` keys. Live run needs the owner setup (4.5) done | 1–1.5 | 4, 5 |
| 11 | F-Droid flavour | `github` and `fdroid` flavours; `fdroid` dex has no installer or loader classes and its bundle no downloader code, checked by a script; metadata updated | 1.5–2 | 3, 8 |
| 12 | First downloadable tool | One pure-JS #656 tool (recommend chord and scale reference) shipped through a real release, installed on the phone, removed and re-added with its data intact; owner setup (4.5) and the first rotation drill done before the release | 1–2 | 9, 10 |
| 13 | Listening core and UI split | Everything 8.2 moves to core: `LibraryScreen`, the song and stem mini-player, `QueueSheet`, `UpNextRow`, `useMixerFrame`, `stemDeck/lanes.ts`, `creditLinkText`, `PLAY_ALONG_NAME`; `host.metronome` replaces the practice screens' `tool-metronome` imports; `ToolPlugin` contributions (`miniPlayer`, `homeSubtext`, Settings section) used by today's compiled-in tools; no `app-shell` file outside `src/app` imports `@kitbag/tool-*` except the Metronome's (`runtime/transportRuntime.ts`); a test that no tool package or moved core-state directory imports another tool's; the tool-JavaScript split measured with a source map; existing tests pass unchanged | 5–7 | 3 |
| 14 | Bridge and absent-tool states | Bundled copies signed by the release's tool key (test keys in tests) installed on first launch for upgrading users with the tool not switched off; one-time notice; fallback card; window rule (section 9); "Install to open" tiles, queue rows and setlist entries; old routes and deep links redirect; restore with the tool absent shows "Install to open" | 2.5–3.5 | 9, 10, 13 |
| 15 | Convert Practice history | Screens in a bundle; recorder stays core; upgrade test (section 9) including ids and preference keys; runs downloaded on the phone and compiled in on the `fdroid` build | 1.5–2 | 11, 12, 14 |
| 16 | Convert Tuner | Tuner store and screens in a bundle; mic requested through `host.permissions`; worklet reads drive the needle at 60 fps on the phone; Home subtext contribution; upgrade test | 2–3 | 15 |
| 17 | Convert Stem songs | Stem player screen and StemDeck store and screens in a bundle; camera and QR through `host`; queue and setlist rows without it tested; upgrade test; phone run with a real stem song | 3.5–5 | 15 |
| 18 | Convert Songs | Song player screen and import flow in a bundle (stores stay core, 8.2); import through `host`; queued analysis survives removal; upgrade test; phone run | 2–3 | 15 |
| 19 | Convert Play along | `playAlong`, `tempoLadder`, `mediaSessions` and the media-session runtime in a bundle; notification access through `host`; `MediaListenerService` disabled while absent, checked on the phone; library offers work without Songs; upgrade test; phone run | 3–4 | 15 |
| 20 | Drop the bridge copies | No earlier than 180 days after issue 19's release; that release carries no bundled copies; an upgrade from a pre-conversion release shows the fallback card, tested; APK size measured against the release before conversion | 0.5 | 16–19 |

Issues 0 to 12 (delivery system and the first new tool) total about 19.5 to 27.5
agent-days, issue 1 being done; the spike's 10 to 17 left out the SPEC and design work,
the migration and backup format, CI and the F-Droid flavour. Issues 13 to 20 (existing
tools) add about 20 to 28, so about 39.5 to 55.5 in all. Issues 16 to 19 can run in
parallel after 15: none imports another, since what Play along shares with Songs is
core (8.2).

Spikes still open: issue 2; the module-system rebinding in issue 4; whether the
`react-native` subset can be cut without breaking Reanimated's or core-design's
internal imports, which resolve to the host's full copy (**inferred**, checked in
issue 3).
