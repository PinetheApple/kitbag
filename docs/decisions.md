# Decisions log

Autonomous and user rulings on points SPEC.md leaves open or general. **SPEC.md
stays the source of truth and is user-owned** — this file never overrides it; it
records choices that fill gaps SPEC does not state, so autonomy leaves an audit
trail instead of silent drift. `project-loop` reads this on every fresh invocation.

Format: `YYYY-MM-DD · <topic> (SPEC §ref) — decision. Rationale. [user | recorded]`

---

- **2026-07-21 · D1 downbeat tracker (§4.3/§4.6)** — Vendor **QM-DSP `BarBeatTrack`**,
  SPEC's preferred researched choice; accept the GPL dependency. Record the vendored
  version + license from its `LICENSE` when it lands (#12). Rationale: SPEC already
  names it preferred and license-compatible; user ruled to adopt rather than extend
  the hand-rolled `beat_tracker.cpp`. Unblocks Track D (D2–D4). **[user]**

- **2026-07-21 · Resampler quality (§4.6, #22)** — **Keep miniaudio linear.** Do not
  add a Speex-grade resampler / new dependency now; revisit only if audible artifacts
  show on real stems. Closes #22. **[user]**

- **2026-07-21 · Per-beat mute cascade (§4.2/§4.7, #21)** — A muted beat **mutes its
  subdivisions too** (cascade = yes), on the **`position` / speaker-time** base — mute
  what is heard at the speaker, not grid-time. Implementation caution: do not blindly
  switch `OnSubdivisionTick` to `floor(position)`; ralph must confirm the fix does not
  regress other latency-offset runs (the reason #21 was parked). Unblocks the #21
  defect fix. **[user ruled cascade; time base = position per rec]**

- **2026-07-21 · Test-tone (§16, #17)** — Folded into **A5** (#10). **RESOLVED
  2026-07-22 (A5 landed): deleted** `kb_engine_set_test_tone` / `RenderTestTone` /
  the tone fields and `tone_test.c`. The only consumer was the dev tool itself — no
  product surface — so §16 (no orphan exports) forces delete over the accumulate-fix
  path. Closes #17. **[recorded — user delegated]**

- **2026-07-22 · Live-seek source reposition (§4.1/§4.4)** — Re-tracked as **#25**,
  not folded into A5. A live seek clears a `SpscBulkRing` the callback is still
  draining → bounded transient glitch (no crash). Pre-existing in the mixer; the
  A5 player mirrors it. A5 is a thin transport and correctly did not widen scope;
  the residual pointer (`mixer.cpp` + tracker) now points at #25 instead of dangling
  at a closed task. Fix = rebuild+republish-on-seek by atomic swap. **[recorded]**

- **2026-07-22 · Live-seek in-place quiescence gate (§4.1/§4.4/§4.5, #25)** — In-place
  `AudioSource::Seek`→ring `Clear` runs **only when the device is stopped AND the
  read-ahead thread is idle**; any seek while `engine_running` (paused included) and
  `Stop()` while the device is live route through the rebuild+republish path
  (`ReseekLive`). ralph's review found gating on `is_running()` alone left a one-block
  pause→seek window that reintroduced the `filled = 0 - old_tail` underflow. The
  conjunction is a strict superset of ralph's `!engine_running` recommendation — the
  literal form broke 17 hand-driven `Process` tests that seek with `engine_running=false`
  while the source thread runs. A failed rebuild suppresses the `kSeek` enqueue so
  transport can't advertise a position the audio isn't at. Closes #25. **[recorded — review-driven]**

- **2026-07-22 · D3 beat-grid BLOB scope (§4.3 vs §11) — RESOLVED, user ruling in #14.**
  The block was a phantom: it conflated §4.3 downbeat *detection* (native, already shipped
  in D2/#13 — `downbeat.cpp` QM-DSP detector + `kb_analyze_song` int32 emit + the
  `analyze_test_downbeat` verify that already mirrors the 4/4 degraded fallback) with §11
  *persistence* (the `+ downbeat indices` BLOB column lives in the Drizzle/op-sqlite store,
  §11.2 lines 1272/1280–1282 — TS, Phase 2). Ruling: (1) native §4.3 = complete, **#14
  closed**; (2) **no native BLOB serializer** — §16 orphan, the raw-int32 ABI is the whole
  native surface; (3) the BLOB column → §11.3/Phase 2, folded with the *real* SPEC §11 D3
  (drop `volume`/`latencyOffset`) and D4 (identity tuple); (4) #15 stays Phase-1 but narrows
  to one native test case (absent-list → every `beats_per_bar`-th beat). **D-number collision
  recorded:** tracker Track-D "D3/D4" (downbeat BLOB/verify) ≠ SPEC §11.3 "D3/D4"
  (drop-columns/identity-tuple) — different numbering, do not conflate. **[user]**

- **2026-07-23 · F-Droid Inclusion Policy Hermes/prebuilt-binary clause (§13.8.1, #38)
  — CORROBORATED against raw source (wording reproduced across fetches, not byte-exact —
  see caveat below), scope narrower than the note implied.**
  Re-fetched the *raw* source markdown (not the rendered page) directly from F-Droid's
  own docs repo: `https://gitlab.com/fdroid/fdroid-website/-/raw/master/_docs/Inclusion_Policy.md`
  (project id 2151437, file last touched by commit `30d61e8b` "Inclusion_Policy - re-add
  binary section", 2026-03-06; most recent commit to the file overall is `5f9e2980`,
  2026-04-17, an unrelated quality-control-section addition — so the binary clause is
  stable, not stale). Fetched 2026-07-23. The environment's WebFetch tool caps literal
  quotes at ~125 chars regardless of source (confirmed across 4 independent fetch calls,
  including the GitLab raw-file API endpoint, all hit the same cap) — so no tool in this
  environment can return byte-exact text; treat what follows as **corroborated wording**,
  reproduced consistently across independent fetches of both the rendered page and the
  raw source file, not a byte-diffed patch.
  - **Clause exists, current, and names Hermes explicitly**, same as
    `docs/fdroid-expo-research.md` §2.1 already recorded: *"The Android SDK, Flutter SDK
    and Hermes have permission to use official prebuilt binaries until Debian provides
    alternative solutions."* Confirmed independently via the raw `_docs/Inclusion_Policy.md`
    source (not just the rendered `f-droid.org` page the prior note relied on) — this is a
    stronger verification than the 2026-07-17 note, which flagged it as reproduced-but-not-
    independently-confirmed.
  - **New detail the prior note did not have**: the raw source additionally states
    *"Prebuilt SDKs (Android/Flutter) permitted [to] use scanignore until Debian packaging
    finishes."* — i.e. the Hermes/Android-SDK/Flutter-SDK exemption is implemented via the
    **`scanignore`** build-metadata field specifically, matching WAFRN's recipe (§2.4 of the
    research doc), which whitelists `node_modules/react-native/sdks/hermesc/linux64-bin/hermesc`
    under `scanignore`.
  - **Material scope finding — this changes the §13.8.1 confidence framing:** the named
    exemption (`scanignore`) is **specific to Hermes, Android SDK, and Flutter SDK by name**.
    It does **not** extend to `lightningcss` or any other JS-ecosystem build tool. The general
    rule stated immediately around it is stricter: *"All binary dependencies including JAR
    files must originate either [from] source, compilation, [or] Debian repository downloads."*
    lightningcss's survival in the WAFRN precedent rests on a **different, unnamed mechanism**
    — `scandelete: node_modules` bulk-stripping the entire JS dependency tree from what the
    scanner ever sees, not an explicit policy carve-out the way Hermes has. `docs/fdroid-expo-
    research.md` already draws this distinction correctly in §4 ("survives, on strength of
    precedent, not confirmed policy") — this ruling **confirms that framing was right and should
    not be upgraded**. Do not read the Hermes clause as also covering lightningcss; it doesn't
    name it, and the raw source's general-rule sentence argues the opposite absent the
    `scandelete` structural workaround.
  - **Ship-risk verdict for §13.8.1**: no downgrade, no upgrade. Hermes exemption: CONFIRMED
    from raw source, current as of 2026-07-23. lightningcss exemption: still **inferred from
    one precedent (WAFRN), not a named policy carve-out** — an actual RFP/draft submission to
    F-Droid remains the only way to get a binding ruling on lightningcss specifically, per the
    research doc's own §5.2 and the task's scope boundary (no RFP submitted this pass).
  **[recorded — independent re-verification, no material change to prior conclusion]**

- **2026-07-23 · JSI HostObject read shape (§13.2/§13.3, #30)** — Polled realtime
  reads are number-valued **properties** on the HostObject (`readonly bar_phase:
  number`), not `() => number` callables. `HostObject::get()` returns a jsi double
  directly; a callable shape would build a `jsi::Function` via
  `createFromHostFunction` on every property access, allocating a function per
  frame on the 60fps Reanimated worklet path — the one thing §13.3 forbids there.
  Rationale: ralph review of wave 2 — the method-call idiom reads more naturally
  but loses to the no-per-frame-allocation rule; fixed in the contract now so #31
  builds the native side against the right shape. **[recorded]**

- **2026-07-23 · TS workspace gate runs in CI (§13.6)** — Added a `test` turbo task
  + root script and a JS/TS CI job that runs typecheck, the architecture-rule lint,
  both one-owner generation drift guards (§13.7/§13.8.1), and every vitest suite,
  including the lint eval harness that proves the custom rules fire. Rationale:
  ralph flagged that the eval harness was a gate mechanically but not operationally
  — nothing (CI/turbo/scripts) invoked it, so it ran only when a human typed the
  command; the repo's §2 history bars claiming an unshipped gate, so the claim was
  made true rather than softened. Also retroactively wires Wave 1's vitest suites,
  which had never run in CI. **[recorded]**

- **2026-07-24 · Phase 3 opened; F1-M1 metronome store built (§5, §13.3, #40)** —
  Phase gate 2→3 cleared (device reading #33 PASSED). Stood up `docs/phase3-tracker.md`
  and dispatched the one §5 task that clears headlessly: the core-state metronome
  config store. Everything else in §5 is design-gated (screens) or device-gated
  (background §5.6, soak §5.8). Store maps mutations 1:1 to TurboModule commands and
  holds no realtime value (§13.3). **[recorded]**
- **2026-07-24 · TurboModule Spec extended with 3 real ABI commands (§13.7, #40)** —
  Added `metronomeStop`/`setRamp`/`setBarMute` to `NativeKitbagCommands.ts`; the #29
  Spec had omitted them. They map to existing `kb_metronome_stop`/`set_ramp`/`set_bar_mute`
  in `kitbag_api.h` (ralph-verified against the header), so this is completing the Spec,
  not inventing bindings. Unambiguous gap → decided and recorded rather than stopped. **[recorded]**
- **2026-07-24 · D1 denominator C ABI gap deferred to #41 (§17 D1)** — The store and
  schema halves of D1 shipped; the C-API half (`kb_metronome_set_beats` numerator-only)
  was never built. Store holds `denominator` as validated intent and `setBeats` sends
  the numerator, flagged honestly (no silent no-op). Follow-up #41 owns the native change;
  the denominator is not real end-to-end until it lands. `perAccentSounds` (§5.3) and
  `countInBars` are likewise store-only intent (no engine command yet). **[recorded]**
- **2026-07-25 · Denominator scales the click rate; no separate click-unit control
  (§17 D1, #41)** — BPM stays **quarter-note referenced**: beat interval =
  `(60/bpm) × (4/denominator)`, so 7/8 at 120 clicks twice as fast as 7/4 at 120,
  and 6/8 clicks **six** times per bar, not two. Rationale: SPEC §17 D1 requires
  the beat interval to be a function of both numerator and denominator, which only
  the quarter-referenced reading satisfies. A product survey
  (`docs/metronome-bpm-denominator-research.md`) found no standalone metronome
  ships this bare — the well-regarded ones pair it with an explicit beat-unit /
  click-unit control so compound meters can click the dotted-note pulse (Dorico's
  Beat Unit, Pro Tools' Click field, Tempo, Soundbrenner). **User decided against
  that control: six eighth-note clicks in 6/8 is the wanted behaviour.** So bar
  length stays `numerator × beat unit`, the ABI gains no click-unit parameter, and
  §17.1 gains no entry. Cost accepted: a user wanting the 6/8 dotted-quarter pulse
  halves the BPM by hand. **[recorded]**
