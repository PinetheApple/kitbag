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

- **2026-07-22 · D3 beat-grid BLOB scope (§4.3 vs §11) — OPEN, asked in #14.** §4.3
  says the native beat-grid BLOB gains a downbeat list; §11 places that BLOB in the
  TS/op-sqlite/Drizzle store and passes grids across the C ABI as raw float buffers
  (no native serializer exists). Building a native grid-BLOB serializer now would be a
  §16 orphan (no consumer until the TS layer exists); the conflict map also pins Track D
  as analyze-only. Proposed native scope = the degraded-fallback helper (absent list →
  every `beats_per_bar`-th beat, one-owner per §13.7) + D4's verify, leaving the sqlite
  BLOB to §11/Phase 2. **Awaiting user ruling in #14 before D3/D4 dispatch — this is a
  stop-point-1 gap (two SPEC sections disagree on ownership).** **[asked]**
