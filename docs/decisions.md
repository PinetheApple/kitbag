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
