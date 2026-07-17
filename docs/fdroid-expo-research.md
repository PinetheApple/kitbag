# F-Droid × Expo Prebuild Research

> **⚠ Read this first.**
>
> This document answers one question for SPEC.md §15 Phase 0 item 1 / §17.1:
> *can an Expo-prebuild React Native Android app be accepted into F-Droid's
> **main** repository, under F-Droid's current, actual inclusion policy?*
>
> **Verdict: CONDITIONAL YES — moderate-to-high confidence for the general
> case, low confidence for one specific dependency (lightningcss).** There is
> real precedent (one app, not many), the general RN/npm build pattern is
> documented and repeatedly used, and Hermes — the RN JS engine — is
> explicitly, by name, exempted from the "build from source" rule. But I
> found exactly **one** Expo-prebuild app in the main repo, not a population
> of them, and no fdroiddata precedent that names lightningcss specifically.
> Where I could not verify a claim against a primary source, it is marked
> **inferred**, not confirmed — do not read those lines as policy.
>
> This was researched by fetching F-Droid's docs, forum, and fdroiddata via
> automated tools (WebFetch summarizes pages through a small model before
> handing text back to me), not by a human reading the HTML. I cross-checked
> the load-bearing quotes by re-fetching and asking for literal-string search
> rather than paraphrase, and I flag below the one quote I could not confirm
> a second, independent way (a plain web search failed to surface it, even
> though two independent fetches of the doc reproduced it identically).

---

## 1. Verdict, up front

**CONDITIONAL YES.** Expo-with-prebuild is *not* categorically barred from
F-Droid's main repo — SPEC.md's assumption survives — but the spec's
reasoning ("Expo prebuild produces a standard Android project, which is the
reason it is acceptable") was incomplete. The actual reason it works, per the
one precedent found, is narrower and more mechanical:

- The generated `android/` project is bare-RN-shaped at build time, so
  F-Droid's existing RN build recipe (documented since 2020, still current)
  applies to it unchanged.
- F-Droid's build server does have network access during the `init`/`build`
  steps (`npm`/`yarn`/`pnpm install` is the documented, standard pattern) —
  it is not the fully network-isolated environment SPEC.md's phrasing about
  "phones home at build time" might suggest. Isolation is from the **signing**
  infrastructure, not from the internet during the build itself.
- Reproducibility is **not** a hard gate for inclusion — it's tracked and
  displayed per-app, and the one Expo app found was merged despite the
  submitter reporting it could **not** reproduce byte-for-byte (`.dex` file
  differences), which is direct evidence reproducibility is a
  verification/trust signal, not an admission requirement.
- Prebuilt native binaries are tolerated for specific, named, policy-exempted
  tools — critically, **Hermes is one of them, by name** — and for anything
  that is stripped from the distributed/scanned output via `scandelete`
  before the reproducibility scanner ever sees it (build-time-only tooling,
  as opposed to what ends up compiled into the shipped APK).

What's **not** established: whether F-Droid's inclusion team would treat
NativeWind's build-time `lightningcss` binary the same way. I found no
fdroiddata recipe, forum thread, or policy text that names it. My best
inference (§4) is that it falls in the same "build-time tool, stripped by
`scandelete`, never shipped" bucket as `hermesc` — but that is inference
from a structural analogy, not a confirmed ruling.

---

## 2. Evidence

### 2.1 Inclusion Policy — what it actually says

Primary source: [f-droid.org/en/docs/Inclusion_Policy](https://f-droid.org/en/docs/Inclusion_Policy/)

Quoted (verified by two independent fetches, the second asking explicitly
for literal-string search rather than summary, to guard against the
fetch tool's summarizer inventing text):

> "All binary dependencies including JAR files must originate either from
> source compilation or Debian repository downloads. Prebuilt binaries
> should only come from authorized trusted sources."

> "Though we try to build everything from source, sometimes prebuilt FLOSS
> binaries are the only feasible approach."

> **"The Android SDK, Flutter SDK and Hermes have permission to use official
> prebuilt binaries until Debian provides alternative solutions."**

The last sentence is load-bearing for this whole question and I want to be
honest about its confirmation level: two separate WebFetch calls against the
same URL reproduced it identically, the second time under an instruction to
only quote if the literal string "Hermes" was present verbatim (not to
paraphrase or invent). That's real corroboration. What I could **not** do is
find it via a plain web search (a targeted search for the exact sentence
returned nothing) or view the raw page HTML directly (this environment's
fetch tool renders through a summarizing model, not a raw HTTP client) — so
treat this as **fetched and reproduced consistently, not independently
verified byte-for-byte against raw HTML.** If SPEC.md work depends on this
exact clause later, re-fetch it and diff against a raw `curl`/browser view
before treating it as gospel.

On non-free deps, the same page states proprietary tracking/ads/analytics
SDKs (Google Play Services, Firebase, Crashlytics) are "strictly forbidden."
Nothing in that list targets JS-ecosystem build tooling specifically.

On network access during the build itself: **the Inclusion Policy page does
not address it.** This is a real gap in the primary sources — see §5.

### 2.2 Reproducible Builds — not an inclusion gate

Primary source: [f-droid.org/en/docs/Reproducible_Builds](https://f-droid.org/en/docs/Reproducible_Builds/)

The page frames reproducibility as something F-Droid "works to spread" and
verifies/displays per-app ("Reproducibility Status" on each app's page), not
as a stated precondition for an app entering the repo. I could not find an
explicit sentence saying "reproducibility is/is not required for inclusion"
on this page — its framing is entirely about the verification mechanism.

**Direct evidence this is not a hard gate:** the submitter of the one Expo
precedent found (§2.4) reported in their merge request checklist that they
"attempted reproducible builds but encountered `.dex` file differences" —
i.e., it does not currently reproduce byte-identically — and the app is
published on the main repo regardless (confirmed live on
[f-droid.org/packages/dev.djara.wafrn_rn](https://f-droid.org/packages/dev.djara.wafrn_rn/)
as of this research). This is the single strongest piece of evidence in this
report and it is a primary-source fact (the merge request checklist, and the
live package page), not an inference.

### 2.3 The 2020 canonical recipe for RN apps — still the baseline

Primary source: [f-droid.org/en/2020/10/14/adding-react-native-app-to-f-droid.html](https://f-droid.org/en/2020/10/14/adding-react-native-app-to-f-droid.html)

This blog post is F-Droid's own canonical walkthrough and it is still hosted
unchanged. Verbatim, on the crux points:

> `init: yarn install` — installing JS dependencies is a documented,
> supported build step (i.e. running an npm-ecosystem package manager
> during the F-Droid build is the *expected*, not exceptional, path for RN
> apps).

> "tell F-Droid to automatically get rid of all of the non-free dependencies
> pulled by our JavaScript deps, like so: `scandelete: - node_modules/`" —
> the standard pattern is to let `node_modules` exist during build (so
> `yarn`/`npm install` can pull whatever it needs, including prebuilt
> `.node`/`.so` files), then delete it from what's scanned/distributed
> before the reproducibility/licence scanner runs.

> **"Please note that some Expo modules depend on non-free components, so
> they may be incompatible with F-Droid."**

That last sentence is the one piece of evidence that could be read as
contradicting this report's conditional-yes verdict, so I want to be precise
about what it does and doesn't say. It is a 2020-era caveat about **specific
Expo modules** (e.g. push-notification modules that talk to Expo's own
proprietary push service, or modules bundling Google-only functionality) —
it is not a blanket statement that Expo tooling or the prebuild model is
incompatible. The **2026 precedent (§2.4)** is an Expo project, built via
`create-expo-app`, that ships and is on the main repo today — which means
either (a) this caveat is about specific modules Kitbag does not intend to
use (Expo push notifications, Expo's proprietary asset CDN, etc. — not
`expo-router`, config plugins, or NativeWind), or (b) the caveat is dated and
narrower than it reads. I lean toward (a) given the WAFRN recipe explicitly
`pnpm uninstall`s `expo-notifications` and `expo-dev-client` before build —
i.e. the actual practice is "strip the specific non-free-adjacent Expo
modules," which is exactly what this sentence is warning about, not "Expo
prebuild itself is disqualifying." But I'm stating this as my read of how
the pieces fit, not as something a maintainer said explicitly in those
words.

### 2.4 The precedent: WAFRN

This is the finding the whole verdict rests on, so the sourcing is laid out
in full.

- **App:** WAFRN's React Native client, `dev.djara.wafrn_rn`. An Expo project
  (bootstrapped with `create-expo-app`), using Expo's config-plugin /
  prebuild model, with custom native modules (`react-native-skia`) that
  **cannot run under Expo Go** — i.e. it is exactly Kitbag's shape: Expo
  prebuild + custom native code, not managed workflow.
- **Source repo:** [codeberg.org/wafrn/wafrn-rn](https://codeberg.org/wafrn/wafrn-rn)
  — the generated `android/` directory is **committed to the repo**, not
  regenerated from config plugins at F-Droid build time. This matters for
  §3 below.
- **fdroiddata metadata:**
  [gitlab.com/fdroid/fdroiddata/.../dev.djara.wafrn_rn.yml](https://gitlab.com/fdroid/fdroiddata/-/raw/master/metadata/dev.djara.wafrn_rn.yml)
- **Merge request:** [gitlab.com/fdroid/fdroiddata/-/merge_requests/22974](https://gitlab.com/fdroid/fdroiddata/-/merge_requests/22974)
  (opened 2025-05-23). I could only retrieve the submission checklist through
  the fetch tool, not the full comment thread — see the open question in
  §5. The checklist itself confirms: submitter is the original author; a
  reproducible build was attempted and did **not** match (`.dex` differences).
- **Live status:** published on F-Droid's main site, v1.13.6, added
  2026-06-09, two architecture builds (arm64-v8a, armeabi-v7a), confirmed via
  the live package page.
- **Build recipe** (verified by fetching the raw metadata YAML directly):
  - `init:` runs `corepack enable`, `pnpm install`, then explicitly
    `pnpm install lightningcss --save-dev` (worth flagging: **lightningcss is
    present in this exact recipe**, installed deliberately, not stripped),
    then `pnpm uninstall expo-notifications expo-dev-client` — the specific
    Expo modules removed are exactly the ones with non-free/proprietary-
    service entanglements (push notifications via Expo's service; the dev
    client).
  - `srclibs: react-native-skia@v2.0.0` — Skia's native graphics engine is
    fetched as source and **compiled from source** during the build
    (`yarn build-skia android-arm64`), not consumed as a prebuilt `.so`.
    This is the one native dependency the recipe treats as "must build from
    source," and it's the one that ships compiled code in the final APK.
  - `scanignore:` explicitly whitelists
    **`node_modules/react-native/sdks/hermesc/linux64-bin/hermesc`** — i.e.
    the maintainers reviewed and accepted a prebuilt Hermes *compiler*
    binary living in the JS toolchain, consistent with the Inclusion Policy's
    named Hermes exemption (§2.1).
  - `scandelete: - node_modules` — as in the 2020 recipe, the entire JS
    dependency tree (including whatever `lightningcss`'s native `.node`
    binary looks like) is stripped from what gets scanned/distributed once
    the JS bundle has been produced.

**What this confirms, as primary-source fact:** an Expo-prebuild RN app with
a real custom native module is in F-Droid's main repo today, was accepted
despite failing reproducibility, and its accepted recipe explicitly installs
`lightningcss` via a JS package manager during build and relies on
`scandelete`/`scanignore` rather than "rebuild everything from source" for
JS-ecosystem prebuilt binaries that aren't Skia.

**What this does NOT confirm:** that a maintainer ever explicitly discussed
or ruled on lightningcss by name, or that F-Droid's inclusion team would
accept it under different framing (e.g. if NativeWind's styling pipeline
somehow caused lightningcss's output to be compiled into the shipped APK
rather than being pure build-time CSS→native-style transformation). I found
no comment thread text confirming a maintainer looked at this dependency and
signed off on it — only that the recipe as merged does what it does and is
live.

### 2.5 Other precedent searched for and not found

- **EteSync Notes** (`com.etesync.notes`) — GPLv3, published, uses
  `scanignore` for RN `node_modules`, confirms the general RN pattern is
  used more than once. I did not re-verify in this session whether it's bare
  RN or Expo; my earlier note (this repo's researcher memory) recorded it as
  a bare-RN comparable, not an Expo one. **Not independently re-verified this
  session — flag before citing it as an Expo precedent.**
- **`host.exp.exponent`** (the Expo Go client app itself) is **not** in
  F-Droid — there's a merge request open since 2017
  ([MR 2370](https://gitlab.com/fdroid/fdroiddata/-/merge_requests/2370),
  [RFP #240](https://gitlab.com/fdroid/rfp/-/issues/240)) blocked on binary
  blobs, fetching assets from AWS/CloudFront, and phoning home to `exp.host`
  at startup. **This is a different, unresolved case and should not be read
  as evidence against prebuild apps** — Expo Go is a managed-workflow runtime
  that bundles Expo's own proprietary-ish client and talks to Expo's servers
  at runtime; Kitbag (Expo *prebuild*, not Expo Go) doesn't ship or depend on
  any of that.
- I searched fdroiddata and the web generally for other Expo-prebuild
  submissions and found none. **This is a real gap**: one precedent is not a
  population. I did not exhaustively grep the ~4,000+ file fdroiddata repo
  (that would need a git clone and local search, which I did not do this
  session) — a web search and a few targeted queries came back empty. Do not
  read "I found only one" as "there is only one"; it may mean the search
  surface (web search + a few targeted fetches) is incomplete, not that the
  population is actually one.

### 2.6 A contradicting forum data point — and how I resolved it

Forum thread: "Upgrading react native app and using Hermes engine"
([forum.f-droid.org/t/upgrading-react-native-app-and-using-hermes-engine/7712](https://forum.f-droid.org/t/upgrading-react-native-app-and-using-hermes-engine/7712)).
An F-Droid maintainer (username Rudloff) is quoted there as saying "Using a
prebuilt binary is against our policy" regarding Hermes, and telling the
original poster to either build Hermes from source or not use it.

This appears to predate the Inclusion Policy's current, explicit
Hermes/Android-SDK/Flutter-SDK exemption clause (§2.1) — i.e. read together,
the most coherent explanation is that the policy was **later amended** to
carve out Hermes by name, likely because Hermes became the RN default and a
blanket ban would have made essentially every modern RN app unbuildable for
F-Droid. I could not find a changelog or dated diff of the Inclusion Policy
page to confirm exactly when that clause was added, so **this is my
inference reconciling an older forum post with current policy text, not a
confirmed timeline.** If this matters later, it's worth asking on the F-Droid
forum directly rather than relying on this reconstruction.

---

## 3. Expo prebuild specifically — what helps, what could hurt

**Helps:**

- The precedent app (WAFRN) commits its generated `android/` directory to
  its own source repo rather than regenerating it via config plugins at
  F-Droid build time. **This sidesteps the one theoretical objection I could
  imagine** — that F-Droid's build server needs a `gradlew`-buildable Android
  project up front, and asking it to run `expo prebuild` (which itself needs
  network access to resolve config-plugin-driven native dependencies) adds a
  layer the 2020 canonical recipe never anticipated. Kitbag would need to
  decide whether to commit the generated `android/` tree (matching this
  precedent, and the safer path given it's the only proof point) or run
  `expo prebuild` as part of the F-Droid `init`/`build` steps (untested by
  anything I found).
- Beyond that generation question, once `android/` exists, it genuinely is
  gradle-buildable via the normal Android toolchain — Expo's marketing claim
  that "prebuild produces a standard Android project" checks out
  structurally, and it's the reason the existing RN recipe (2020, still
  current) transfers without modification once the tree exists.

**Could hurt / unresolved:**

- I found **no confirmation either way** on whether F-Droid's build server
  will tolerate running `npx expo prebuild` itself (as opposed to consuming
  an already-generated, committed `android/` tree) as part of `init`/`build`.
  This is a materially different question from "does npm install work during
  build" (answered: yes, §2.3) — prebuild additionally resolves and merges
  config plugins, which could pull additional network resources beyond plain
  `yarn install`. **Open question — see §5.**
- Config plugins can, in principle, inject arbitrary Gradle/manifest changes
  at prebuild time — which is a bigger "trust the toolchain" surface than a
  static, reviewable `android/` directory. I found no F-Droid policy text
  addressing config plugins by name (unsurprising given how few
  Expo-prebuild submissions exist to have raised the question).

---

## 4. What this means for SPEC.md §13.8 / §13.8.1

- **§13.8's Expo-with-prebuild choice is not contradicted by anything found.**
  The one real precedent is structurally identical to Kitbag's situation
  (custom native modules, cannot run under Expo Go, GPLv3, targets F-Droid
  main) and is live today. I'd upgrade the spec's parenthetical "this needs
  confirming" to "confirmed for one precedent app, with the recipe
  known" — not to "definitively general policy," because one data point is
  one data point.
- **Recommendation for §13.8:** commit the generated `android/` directory
  (matching WAFRN's approach) rather than running `expo prebuild` inside the
  F-Droid build steps, until/unless someone confirms the build-server-side
  prebuild path works. This is the lower-risk of the two options given the
  evidence.
- **§13.8.1 / lightningcss:** the dependency **survives, on the strength of
  precedent, not confirmed policy.** The WAFRN recipe installs lightningcss
  via `pnpm install --save-dev` during `init` and relies on `scandelete:
  node_modules` to strip it (and everything else in the JS tree) before the
  scanner runs. Kitbag's NativeWind pipeline uses lightningcss the same
  way — build-time only, never shipped in the compiled output. The
  structural argument ("it's build tooling, not a runtime binary, and it's
  gone before the scanner looks") is sound and matches how F-Droid already
  treats `hermesc`. But **no source confirms a maintainer has ever looked at
  lightningcss specifically**, and NativeWind + lightningcss + Expo prebuild
  together is a combination nobody in the sources I found has actually
  shipped. Treat this as "very likely fine, unconfirmed" rather than
  "cleared."
- **Reproducible-builds language in §13.8.1** ("F-Droid ... are unhappy with
  anything that phones home at build time") should be softened. The evidence
  says F-Droid's build server **does** allow network access during
  `init`/`build` for JS package managers (that's the entire basis of the
  2020 canonical RN recipe) — what it doesn't allow is the *shipped app*
  phoning home at **runtime** without disclosure, and it doesn't require
  perfect reproducibility as a condition of inclusion (§2.2). The real
  constraint is narrower than the spec's phrasing suggests, which is good
  news, not bad — but the spec should say the narrower true thing.
- **§9.3's Play Asset Delivery rejection is unaffected and still correct** —
  nothing here relates to asset delivery; that's a distinct mechanism (CDN-
  hosted, app-controlled asset packs at runtime) from build-time npm
  dependency resolution.

---

## 5. Open questions I could not resolve from sources

1. **Does F-Droid's build server tolerate running `expo prebuild` itself**
   (regenerating `android/` from config plugins during the F-Droid build),
   or must the generated tree be committed to the source repo as WAFRN does?
   Nothing in the sources I found answers this directly — WAFRN sidesteps
   the question entirely by committing the generated directory. **This
   would be resolved by:** asking on the F-Droid forum, or finding a second
   fdroiddata Expo recipe that runs prebuild live (I did not find one), or
   just trying it and reading the build log.
2. **Has any F-Droid maintainer discussed `lightningcss` or NativeWind by
   name?** I found nothing. **Resolved by:** a targeted forum search/post,
   or by submitting Kitbag's actual metadata and seeing what the reviewer
   flags.
3. **When was the Hermes/Android-SDK/Flutter-SDK exemption added to the
   Inclusion Policy**, relative to the 2022-ish(?) forum post where a
   maintainer called a prebuilt Hermes binary "against our policy"? I
   inferred a later amendment (§2.6) but have no dated diff confirming it.
   **Resolved by:** the Inclusion Policy page's git history, if the
   fdroid-website repo is public (it should be — it's the site's source) —
   I did not check this session.
4. **How many Expo-prebuild apps, beyond WAFRN, exist in fdroiddata?** I
   found one via web search and targeted fetches; I did not clone
   fdroiddata and grep it locally. **Resolved by:** cloning
   `gitlab.com/fdroid/fdroiddata` and grepping metadata for `expo`,
   `create-expo-app`, `app.json`/`expo-modules-core` references across all
   `.yml` files.
5. **Was the WAFRN merge request's actual review discussion (not just the
   submission checklist) free of objections?** I could only retrieve the
   checklist through the fetch tool, not the full comment thread. If a
   maintainer raised and resolved a concern about lightningcss, Skia, or
   prebuild generation during that review, it would directly answer several
   of the above. **Resolved by:** reading the MR's full discussion thread
   directly (a browser or `gh`-equivalent for GitLab, not the WebFetch
   summarizer, would be more reliable for a long comment thread).

---

## 6. Sources (all cited above, collected here for convenience)

- [F-Droid Inclusion Policy](https://f-droid.org/en/docs/Inclusion_Policy/)
- [F-Droid Reproducible Builds](https://f-droid.org/en/docs/Reproducible_Builds/)
- [F-Droid Build Metadata Reference](https://f-droid.org/en/docs/Build_Metadata_Reference/)
- [F-Droid Building Applications](https://f-droid.org/en/docs/Building_Applications/) (checked, no RN/Expo-specific content)
- [F-Droid 2020 blog: Adding React Native Apps to F-Droid](https://f-droid.org/en/2020/10/14/adding-react-native-app-to-f-droid.html)
- [F-Droid forum: Upgrading react native app and using Hermes engine](https://forum.f-droid.org/t/upgrading-react-native-app-and-using-hermes-engine/7712)
- [WAFRN on F-Droid (live package page)](https://f-droid.org/packages/dev.djara.wafrn_rn/)
- [WAFRN fdroiddata metadata (raw YAML)](https://gitlab.com/fdroid/fdroiddata/-/raw/master/metadata/dev.djara.wafrn_rn.yml)
- [WAFRN inclusion merge request #22974](https://gitlab.com/fdroid/fdroiddata/-/merge_requests/22974)
- [WAFRN source repo (Codeberg)](https://codeberg.org/wafrn/wafrn-rn)
- [Expo Go / host.exp.exponent merge request #2370](https://gitlab.com/fdroid/fdroiddata/-/merge_requests/2370) and [RFP #240](https://gitlab.com/fdroid/rfp/-/issues/240) (the *unrelated*, still-unresolved Expo Go case)

---

## 7. What would change this verdict

- A second and third Expo-prebuild precedent, ideally with an active MR
  discussion thread, would move this from "one data point" to "pattern."
- A maintainer statement (forum or MR comment) naming lightningcss or
  NativeWind specifically.
- Actually submitting Kitbag's metadata (even in draft/RFP form) and reading
  what the review flags — this is the only way to get a ruling rather than
  an inference, and it's cheap relative to building the whole toolchain
  first.
