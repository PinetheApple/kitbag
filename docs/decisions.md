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
  was never built. Store held `denominator` as validated intent and `setBeats` sent
  the numerator, flagged honestly (no silent no-op). **Command chain closed 2026-08-04**:
  #41 landed the C ABI half and the denominator is now wired through the TS/Kotlin
  chain (vitest + typecheck; no device run, so no runtime proof). D1 itself is not
  done — §17.1 still owes the M3 time-signature stepper that edits both halves.
  Note the engine's grid/song-follow mode ignores the denominator by design
  (`metronome_grid.cpp:39`): 7/8 applies to the free-running click only.
  `perAccentSounds` (§5.3) and
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

- **2026-08-04 · M3 performance-surface gaps decided (§5.2, #46)** — Ten unambiguous
  gaps SPEC/design didn't state, decided during the M3 build (deviations recorded in
  `docs/phase3-tracker.md`): (1) `MAX_LEDS_PER_ROW = 7` — the only simple ceiling
  satisfying both §5.2 data points (7 on one row; 16 as four rows of four).
  (2) Irregular-meter LED groupings: 5→3+2, 7→2+2+3, 9→3+3+3; 10, 11 and up chunk
  by 4. (3) Swipe fling = 140 ms of release velocity, capped ±40 BPM (§5.2 says
  only "coarse jumps"). (4) Denominator cycles on the badge face; −/+ step the
  numerator. (5) Tempo markings are the conventional Italian bands — the design
  mock prints ANDANTE at 124, which no conventional table agrees with; the screen
  shows ALLEGRO (**user ruling requested at sign-off**). (6) LED touch targets are
  gap-bounded (`hitSlopFor` caps at half the tightest gap) because §12.6's 48dp is
  unreachable for 26dp LEDs 8dp apart without overlapping hit regions
  (**user ruling requested: widen the design's gaps or exempt the criterion**).
  (7) Practice pill counts play time only and dies with the screen — persistence is
  §5.7/M8. (8) Poly row is display-only (no accent editing, never flashes): one
  accent table in the C ABI and no `current_poly_beat` on the HostObject; closing
  it is a later core-native change, not a screen fix. (9) No §12.6 first-use hint
  this task — swipe-anywhere and tap-to-type are currently undiscoverable; the
  preset row is the visible fallback; hint deferred. (10) `useMetronomeFrame`
  copies the #33 gate's worklet rather than importing it (§9.4 package boundary);
  deduplicating needs core-native to own the read-path accessor — filed as an M3
  follow-up, not done now. **[recorded]**

- **2026-08-18 · M3 sign-off rulings: conventional tempo bands, LED row exempt from
  48dp (§5.2, §12.6, #46)** — The two rulings the M3 build left open (entries 5 and 6
  above) are decided: (1) tempo markings follow the **conventional Italian bands**,
  so 124 BPM reads ALLEGRO and `design/kitbag-metronome.html`'s ANDANTE at 124 is a
  mock error, not intent — the design file is binding on layout and tokens, not on
  that string. (2) The **LED row is exempt from §12.6's 48dp minimum**; the design's
  26dp LEDs at 8dp gaps stay as drawn and `hitSlopFor` keeps bounding the hit region
  at half the tightest gap. Widening the gaps was the alternative and was rejected:
  the LED row is a beat *indicator* first, its geometry carries the meter grouping,
  and overlapping hit regions would mis-assign accent taps — a worse failure than a
  small target on a control that has the preset row as a fallback. Both rulings match
  what M3 already shipped, so neither changes code. **[recorded]**

- **2026-09-26 · Completion-push rulings (§5.2, §5.4, §8.9, §12, D11, #56)** — Approved by
  the owner at the start of the Claude + GPT completion push: (1) the poly row **hides**
  when poly is off; (2) 4/4 shows **four evenly spaced, ungrouped LEDs**; (3) the Player and
  Play along get their own **metronome slots inside the one native engine** (one device,
  one clock), not a second engine and not app-side save/restore; (4) the metronome's
  All Songs screen **reuses Setlist Detail's list grammar**; (5) storage starts in an
  **app-owned base directory**, and a user-chosen SAF location is adopted by copy → verify
  → atomic switch → delete; (6) the GetSongBPM personal key is an **optional Settings
  field**, and no request is made without it; (7) stem/library failures render as
  **inline status cards** on the affected row; (8) Home ships as a **fixed hub** before
  edit mode; (9) landscape stays deferred (D13). **[recorded]**

- **2026-09-26 · Wave 0 implementation calls (§12.2, §13.1, #68, #69, #78)** — (1)
  `onDanger` resolves to `surface1`, not the specimen's `#fff`, which is 3.03:1 on dark
  danger; surface1 is 5.8:1 dark / 4.69:1 light. (2) Sheets dismiss on a downward drag
  past 25% of their height; the design only says "dismissible by drag". (3) Schema v8
  adds `setlists.active` (partial unique index) and nullable `song_presets.poly_accents`.
  (4) drizzle-orm's op-sqlite `transaction()` does not await its callback, so core-db
  owns a serialised BEGIN/COMMIT/ROLLBACK transactor and `openDatabase()` exposes
  repositories only. **[recorded; (1) and (2) await design sign-off]**

- **2026-10-13 · Tuner smoothing deviates from SPEC §10.2 (§10.1, §10.2, #117)** —
  SPEC §10.2 asks for a 3–5 frame median plus an EMA on cents, settling under
  150 ms. The tuning mode instead uses the parameters chosen for the tuner spec
  (`docs/tuner-functional-spec.md` P8/P9): each 85 ms frame's pitch is blended into
  the reading at weight 0.25 when within 70 c of it and replaces it otherwise, and a
  7-frame median is used only to hold the last reading after the note stops.
  Rationale: the smoothing favours a stable reading over raw settle time. Measured
  consequence: the first reading lands 85 ms after onset (one frame), but a +50 c
  step takes 7 hops (~300 ms) to read 45 c, so §10.2's <150 ms settle holds for
  onset, not for a pitch change within a note. SPEC §10.2's text is unchanged;
  reconcile it or overrule this. **[recorded]**

- **2026-10-14 · Tuner screen calls (§10.2, §12.8, §13.2, §13.3, #118)** — Decided by the
  integrator on the owner's delegation: (1) the in-tune lock fires `expo-haptics`'
  Android confirm haptic, which respects the system haptics toggle; no sound. (2) Schema
  v10 adds `tunings.instrument` (default guitar), because the instrument selects the
  native in-tune window. (3) Built-in tunings (Standard, Drop D, DADGAD, half-step
  down, bass 4/5, ukulele) stay read-only code constants; only custom tunings are rows.
  (4) The tuning picker, tuning editor and A4 sheets have no drawing, so they are built
  from existing primitives and await design sign-off. (5) The readout follows the
  design's true-cents caption ("−4 CENTS · TUNE UP") rather than the functional spec's
  step numbers; the needle's full scale is ±50 c. (6) The tuner does not wait for #109:
  app-shell opens the database through core-db's `openDatabase()` behind one runtime
  module, to be folded into #109's composition root when that lands. **[recorded;
  (4) awaits design sign-off]**

- **2026-10-16 · Tuner needle and hold follow-up (§10.2, #118)** — Decided by the owner
  after testing the tuner on device: small errors read as large, and the needle never
  returned to centre. The tuner spec's P27 and §5 D1–D5 now set the values: ±220 c at
  80 % of the travel (supersedes the ±50 c in the 2026-10-14 entry), cents averaged per
  hop, a release hold that drains with string confidence (≈ 0.77 s, was 1.2 s), a return
  to centre on silence, and a 200 ms status dwell. SPEC §10.2's hold line is reworded to
  match. Implementation calls the spec leaves open: (1) the cents average
  also resets when the target note changes, so one note's error never bleeds into the
  next; (2) after silence the needle stays visible, dimmed, while it decays to centre;
  it is hidden before the first note; (3) the screen reader says "No note" once the
  reading clears. **[recorded]**

- **2026-10-27 · Metronome notification shows the practice clock (§5.6, #87)** — Decided by
  the owner after testing on device. The notification's elapsed time is the same clock
  as the app's practice pill, which now lives in the metronome store rather than the
  screen. Samsung's media card ignores text-only updates, so the time is carried by the
  card's seek bar, which it animates itself. Position is practice time; the bar's length
  is the next 10-minute block (10:00, then 20:00, …), so at each boundary it drops from
  full to 50 %, then 67 %, and keeps filling. `design/kitbag-metronome.html` draws no
  seek bar; this entry supersedes it for the system card. When both previous and next
  songs show, the tempo keys drop from the system controls. **[recorded]**

- **2026-10-28 · Metronome notification drops the seek bar (§5.6, #163)** — Decided by
  the owner, superseding the 2026-10-27 entry's 10-minute seek bar. Android 13+ draws a
  bar on every media-style card, even with no duration, so the notification is a plain
  one with its own button row; the media session stays for headset keys, and the
  lock screen shows the notification itself. The practice clock still runs in the app. **[recorded]**

- **2026-10-28 · Floating-point contraction off for the native core (#165)** — CI's
  ubuntu-26.04 GCC targets an FMA-capable CPU by default, so it fused `a*b+c` in our
  downbeat code and in QM's at different places, and the bit-identical equivalence
  checks failed in the last digit. `-ffp-contract=off` for every native target makes
  the rounding the source's, on any compiler default, including the phone's clang. The
  runner image is not pinned: the check is toolchain-independent instead. **[recorded]**

- **2026-10-27 · What "dropped or jittered" means for the soak (§5.8, §6.5, #88)** — SPEC
  sets no numbers, so the harness's limits were set by the integrator and live once in
  `native/audio_core/tools/soak/click_soak_types.h`. A click is jittered, and an interval
  is off, beyond 1 ms (the engine is sample-accurate; 1 ms is what onset detection on a
  recording can honestly claim). A click is dropped when its beat slot (±½ beat) is empty
  and doubled when a slot holds two. The mean tempo may differ from the grid by at most
  300 ppm (recorder and phone clocks are each within ~±100 ppm; 0.1 BPM at 120 is
  833 ppm). Against a song grid, every 8-click window's mean |offset| must be under 5 ms
  (one 256-frame block at 48 kHz is 5.3 ms). Open: an unlocked recorder's clock drift
  counts against the offset window over a long song, so §6.5 captures should record the
  phone's own output or stay short. **[recorded; owner may override any limit]**

- **2026-10-27 · Library and ambient analysis (§6.2, §12, §13.5, #160)** — Decided by the
  owner: (1) the Library is built before StemDeck import, and single-file import plus
  analysis come with it. (2) Analysis runs as a `WorkManager` task per §13.5 and survives
  the app being closed. Results are stored natively until the app acknowledges them, and
  a song whose analysis is interrupted twice is marked failed rather than retried forever.
  (3) Analysis must be memory-efficient: `kb_analyze_song` streams the file in two passes,
  and memory is bounded as `kitbag_api.h` states. Integrator calls: a song that analyzes
  to no beats is finished, not failed (`NO GRID` badge), and counts as analyzed. A song
  restored without a grid shows `NOT ANALYZED` until it is queued. A failed re-analysis
  keeps the previous grid and still counts as analyzed. The Home Songs count excludes stem
  songs, which have their own tile. Failure copy distinguishes missing file, unsupported
  format, interrupted and failed; native text never reaches the screen. **[recorded]**

- **2026-10-28 · How a StemDeck song is stored (§7.8, §11.2, #136)** — Integrator calls,
  schema v15. Bar marks are a BLOB of little-endian int32 pairs (beat index into the
  grid, beats per bar), packed like `downbeat_indices`, because they index the Float32
  grid and go to native with it. Sections are a JSON array in a TEXT column: they carry
  names and colours, nothing queries inside them, and a reader skips an entry it does not
  recognise. `lyrics_instrumental` is NULL only when the bundle had no `lyrics.json`, so
  "no lyrics" and "instrumental" stay apart. The beat grid is stored whole, even past
  `KB_MAX_GRID_BEATS`; capping it is the load path's call, open in #161. A refused bundle
  copies nothing. A re-import asks first and replaces in one transaction, then deletes
  the old folder; a failed add deletes the new one. Stems are stored at the bundle's own
  sample rate; `kb_mixer_load_track` resamples them to the engine rate as it streams the
  decode (§4.1). That is how §7.1/§7.8's "resample on ingest" is met: there is no second
  resampler at import. **[recorded]**

- **2026-10-29 · The follow-mixer click ignores the latency offset (§4.7, §12.5.1, D16,
  #137)** — Decided by the owner: with `kb_metronome_follow_mixer` on, the metronome
  reads the mixer's song frame as is. Stems and click leave through the same output
  buffer, so the offset could only push the click off the stems; it exists to align
  with sources outside the phone. Follow mode now reads whole song frames only, so a
  grid beat a fraction of a frame before a loop end can no longer fire ahead of the
  wrap and stack on the loop start's click. **[user]**

- **2026-10-29 · Mixer frames are engine-rate song frames (§4.2.2, #137)** — The
  mixer resamples on load, so `kb_mixer_seek`, `kb_mixer_position` and the
  `kb_mixer_set_loop` points count frames at the engine rate (song time × engine rate),
  not at a stem's own rate. §4.2.2 said source frames; the code never did, and a
  44.1 kHz stem on a 48 kHz engine showed the difference. SPEC and the header now say
  engine-rate frames. **[recorded]**

- **2026-10-29 · The stem player takes the shared metronome (§7.3, D16, #137)** — There
  is one engine metronome. Opening a stem song, and turning its Click on, stop the
  metronome tool, running or paused behind its notification, through the metronome
  store and dismiss that notification, so its Play cannot restart the click on the
  stem grid. The follow-mode click itself stays the stem player's: the
  metronome store is not told it is running, and leaving the stem player stops it and
  clears the grid. **[recorded]**

- **2026-10-29 · Stem player facts, badges and level chip (§7.2, §7.5, #137)** — The key
  reads as uncertain below a key confidence of 50; the tempo reads steady at a
  stability of 80 or more, else variable **[recorded]**. Library stem rows carry BPM,
  key, GRID ✓ and STEMS ×N on a wrapping line under the title. Each stem row shows its
  level as a dB chip; tapping it or the row opens that row's fader, one row at a time,
  and the fader moves only on a drag **[user]**.

- **2026-10-29 · The engine renders in slices of at most `kMaxBlockFrames` and sizes
  read-ahead from the device callback (§4.4, #137)** — Each read-ahead ring holds twice
  the callback width read at device init, capped at `kMaxReadAheadFrames`. The refill
  thread cannot run between slices of one callback, so the ring must hold all of it.
  Rings are sized once, so a reroute to a backend period wider than the ring (for
  example a move to Bluetooth) can still underrun until the song is reloaded.
  **[recorded]**

- **2026-10-30 · Stem player layout (§7.2, §7.3, §12, #137)** — The owner chose variant C
  ("Bottom dock") in `docs/research/mockups/stems-layouts.html`; for the stem player it
  supersedes `design/kitbag-ui.html` §04. Deliberately out: the BPM and key chips' speed
  and pitch actions (#138), count-in, and LUFS. Reset mix sets every stem and the master
  to 0 dB with nothing muted or soloed, and saves the stems. On one stem, mute and solo
  exclude each other: soloing a muted stem unmutes it, muting a soloed stem un-solos it.
  **[user]**

- **2026-10-30 · Renaming songs, stem songs and stems (§7.1, §7.8, #176)** — Schema v17
  adds `stem_sets.renamed` and a nullable `stems.name`; a re-import replacing the same job
  keeps the user's song name only when `renamed` is set, so a never-renamed song takes the
  new bundle's title. Stem names carry over by role, not position. Renaming a stem song
  writes both `title` and `song_title` and keeps `artist`. `RowText` titles and subtitles
  are single-line app-wide. **[recorded]**

- **2026-10-30 · Song notification (§5.6, §13.9, #177)** — One service (`PlaybackService`),
  one media session and one notification id serve the metronome and songs; a song card
  replaces the metronome's. Actions are −10 s, play/pause, +10 s and stop, with a seekable
  bar; stop rewinds, and dismissing a paused card is stop. `kb_player_*` gets no card until
  a single-song screen exists. The skip icons are fixed at 10 to match the in-app transport,
  so changing `SKIP_SECONDS` means redrawing them. **[recorded]**

- **2026-10-30 · Metronome layout B supersedes the design file (§5.2, §5.3, §12, #175)** —
  The owner chose layout B from `docs/research/ui-survey-metronome-stems.md` and approved
  its reworked mockup, `docs/research/mockups/metronome-layouts.html` ("Chosen"), as the
  design for #175, #56, #81, #82, #171, #172 and #173. Where it differs from
  `design/kitbag-metronome.html` §02 the mockup wins: an app bar with Back; meter and
  notation subdivision chips instead of the steppers card; beat dots on their own row with
  a "1" marker; one status line for count-in, the mute cycle and the ramp; ramp, mute bars,
  count-in, sound and poly in one Practice sheet instead of the four-chip row; a transport
  of setlist, Play and Practice with no stopwatch key; a first-use swipe hint; no glow
  behind the BPM numeral. This also settles #56's poly-off ruling: poly has no row on the
  screen at all, it is armed in the Practice sheet and listed in the status line. The
  value-by-value table is `docs/research/metronome-b-parity.md`. The mockup also
  changes D9's row rule on this screen: a line holds up to eight dots and longer bars
  wrap at a group boundary (12/8 → two lines of 3+3), because D9's seven-per-row cap
  pushes the transport off a 360 × 800 screen at the mockup's 56 dp dots. **[user]**
