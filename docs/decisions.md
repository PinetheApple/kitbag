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
