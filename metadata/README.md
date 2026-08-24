# F-Droid metadata (#61)

Fastlane-shaped metadata plus a draft build recipe for submitting Kitbag to
F-Droid's main repository (SPEC.md §13.8). Layout mirrors what an fdroiddata
submission needs:

```
metadata/
├── com.kitbag.app.yml      # build recipe (DRAFT — unverified until submitted)
└── en-US/
    ├── title.txt
    ├── short_description.txt
    ├── full_description.txt
    ├── changelogs/<versionCode>.txt
    └── images/             # pending a real device build — see its README
```

To submit, this tree maps into the fdroiddata repository as
`metadata/com.kitbag.app.yml` plus `metadata/en-US/…` — the paths are
identical, so the tree can be copied across verbatim once the recipe's
QUESTION comments are resolved.

## Submission plan (SPEC.md §13.8)

The recorded strategy: **submit metadata in draft/RFP form early and read
what the reviewer flags**, before the toolchain depends on any answer. The
research base is `docs/fdroid-expo-research.md` — read its warning banner
first: it separates confirmed policy from structural-analogy inference, and
this tree inherits that split. Nothing in the recipe is confirmed policy
until a reviewer has seen it.

## Proprietary-entangled modules (audited against the actual dependency set)

Grounded in `packages/app-shell/package.json` and `pnpm-lock.yaml`:

- **`expo-dev-client`** — the one removal candidate. It pulls
  `expo-dev-launcher` / `expo-dev-menu` (dev tooling; the launcher's whole
  purpose is talking to Metro/expo start during development). The WAFRN
  precedent uninstalls it in the F-Droid build's `init` step, and the recipe
  here copies that. Removal path: the recipe's
  `pnpm --filter @kitbag/app-shell remove expo-dev-client`. Expected
  side effect, unverified: `expo-updates-interface` (a peer stub arriving via
  the dev-launcher chain, not the proprietary update service) drops out too.
- **No `expo-notifications`** (Expo's push service), **no `expo-updates`**
  (the proprietary update channel), **no Google Play Services / Firebase /
  Crashlytics / Sentry** anywhere in the lockfile.
- **`lightningcss` 1.30.1** (pinned in `pnpm-workspace.yaml`) — build-time
  CSS compiler for NativeWind; never ships. `scandelete: node_modules`
  covers it. This rests on the WAFRN precedent, **not** on a confirmed
  maintainer ruling — see the research doc's §4 and open question 2.
- **Skia is not currently a dependency** (SPEC §13.8 names it for waveform
  rendering, but no package is installed yet). If/when it lands, the recipe
  will need a `srclibs` build-from-source step like WAFRN's — recorded here
  so the future change does not silently inherit a prebuilt-`.so` assumption.

## Open policy questions (questions, not answers)

1. Does the build server tolerate the committed-`android/` + no-prebuild
   flow unchanged (expected yes — it is the documented RN pattern and the
   WAFRN shape — but unverified for this repo's layout)?
2. Will a maintainer accept `lightningcss` under the build-time-tool
   framing, or flag it? (Research doc §5.2.)
3. What Node/pnpm versions does the build server provide, and do they
   satisfy `.nvmrc` (22) and `packageManager` (pnpm@11.3.0)?
4. Is `AuthorEmail`/`WebSite` required, and what should they be?
5. Do the anti-feature flags need declaring for anything in the current
   dependency set? Nothing known applies, but that is an assertion to test
   at review, not a fact.
