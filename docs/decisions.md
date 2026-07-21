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
