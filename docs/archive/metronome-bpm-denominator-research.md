# Metronome BPM vs. Time-Signature Denominator: Product Survey

**⚠ Read first — researched 2026-07-25.**

This is a source-grounded survey, not a recommendation already implemented in
Kitbag. Every row below is either **confirmed** (official manual/docs/forum
post naming the exact behavior) or **inferred** (no direct source found; a
plausible read from adjacent evidence, flagged explicitly). Do not cite this
doc as proof of what Kitbag itself does — SPEC.md is the only source of truth
for Kitbag's own decisions (§17). This survey exists to *inform* an open
decision, not record one.

**Decision since taken (2026-07-25), and it differs from the recommendation
below.** Kitbag ships quarter-note-referenced BPM with **no** separate
click-unit control: 6/8 clicks six times per bar. The recommendation at the
end of this doc argues for pairing it with a beat-unit override; that was
considered and declined. See `docs/decisions.md` and §17 D1.

## Short answer

**Convention A ("the dial is the click," BPM = clicks/minute of whatever note
the denominator names) does not exist as a first-class feature in any
standalone metronome product surveyed.** Every dedicated metronome app and
every hardware metronome either:

- has **no denominator concept at all** (mechanical and quartz
  metronomes, hardware metronomes A and B) — you set *beats per bar* + a *rhythm/subdivision
  pattern*, and the note-value naming is left to the player; or
- defaults BPM to the **quarter note** (Convention B) and offers a *separate*
  beat-unit / click-note-value control to decouple the click from the
  denominator when needed (metronome apps A, B, C and F, DAWs A, B and C,
  notation apps A and B).

So the two real options in practice aren't "A vs. B" — they're **"B, with an
optional beat-unit override"** vs. **"no denominator at all, just beat count +
subdivision sliders."** Nobody ships a metronome where changing 7/4→7/8 at the
same BPM number silently doubles the click rate *without the user asking for
it via an explicit beat-unit/subdivision control*. Where that doubling happens
automatically (DAW A, MIDI clock math, another DAW), users on forums call it
out as confusing, not as an expected feature.

## Per-product table

| Product | Convention | Denominator control? | Source |
|---|---|---|---|
| **Hardware metronome A** | No denominator. Sets beat count (0–9) + note-value volume sliders (quarter/eighth/16th/triplet). 6/8 done via the vendor's documented workaround (beat "1" + Accent/Whole/Triplet sliders). | None | Vendor support article; owner's manual |
| **Hardware metronome B** | No denominator. Beat count 0–9 + rhythm-pattern selector (duplet/triplet/clave etc.). 6/8 = beat "6" (eighth-note feel) or beat "2" + triplet rhythm (dotted-quarter feel) — both possible, user picks. | None | Vendor product page; manual |
| **Mechanical metronome (bell models)** | No denominator. Push/pull knob selects pendulum-swings-per-bell-strike (2/3/4/6). Labels like "6/8" printed on the dial are nominal groupings, not a note-value calculation. Bell-less models have no time-signature control at all. | None | Vendor instruction manual |
| **Quartz metronome** | No denominator. Beat selector 0/2/3/4/6, tempo dial 40–208 BPM. Denominator left to player interpretation. | None (inferred from product description; no dedicated manual PDF found) | Product listing, cross-referenced against the mechanical pattern above |
| **Metronome app A** | **B.** BPM = quarter note by default. Explicit subdivision selector lets you click eighths, triplets, etc., at the same BPM number — manual explicitly instructs users to *double* the BPM for x/8 signatures if they want the same quarter-note pulse. | Yes — separate subdivision menu | Vendor app manual |
| **Metronome app B (and its advanced edition)** | **B, with per-beat override.** Ships 6 simple-meter and 3 compound-meter rhythm patterns; in 6/8 you get click-per-beat patterns *and* can silence/accent individual LEDs to force a 2-pulse dotted-quarter feel. The advanced edition's subdivide mode exposes up to 20 beats × 20 subdivisions, each independently accent/silence-configurable. | Yes — rhythm-pattern selector + per-LED override | App store listing; vendor page |
| **Metronome app C (Android)** | **B by construction, but exposed directly as math.** No time-signature field at all — you enter "beats per bar" + "clicks per beat" and translate the meter yourself. The vendor's own blog spells out the 6/8 case: beats-per-bar=6 (eighth-note pulse) vs. beats-per-bar=2, subdivision=3 (dotted-quarter pulse) are both reachable, user's choice. | Yes, but manual (no meter parser) | Vendor blog post; user guide |
| **Metronome app D** | **Inferred B, with strong compound-meter tooling.** Six independent note-division sliders + per-division mute/volume, described repeatedly in reviews as the strongest app in this class for compound/odd meters ("no equal in the app store" for subdivisions). Could not confirm the exact default beat-unit assumption from public sources — inferred from its slider model, which mirrors hardware metronome A's approach. | Yes — per-division sliders | Third-party review; app listing |
| **Metronome app E** | **Could not confirm.** Store listing documents tempo + time-signature support and tempo-track import/export but does not document how the denominator maps to click rate. Not verified either way. | Unknown | App store listing |
| **Metronome app F** | **Inferred B.** Advertises "dynamic time signature settings" and subdivision/polyrhythm controls in the Pro tier, consistent with quarter-referenced BPM + subdivision override, but no source explicitly states the 6/8-at-120 click rate. Flagging as unconfirmed. | Likely yes (subdivision controls) | App store listing |
| **A search engine's built-in metronome widget** | N/A — **no time signature or denominator control exists.** BPM slider only (40–218). | None (feature absent) | Confirmed via direct product inspection during search |
| **A tuner app's metronome** | **B (default quarter/beat = 1 click), with a fixed 6/8 preset.** Browser version's time-signature selector documents 6/8 explicitly as "grouped into two sets of three" — i.e. the UI groups 6 clicks visually into 2×3 rather than de-clicking to 2 dotted-quarter hits. Beat dots are individually toggleable (accent/normal/mute), so a user *can* mute 4 of 6 dots to get a 2-pulse feel, but the shipped default is 6 audible clicks. | Yes — per-beat accent/mute toggles; no dedicated beat-unit field | the vendor's browser metronome page |
| **DAW A** | **B by default ("Auto" tick interval follows denominator), with an explicit Rhythm override added in version 10.** Tempo is *always* quarter-note BPM regardless of meter — changing 3/4→6/8 (multiplying both numerator and denominator by 2) doubles the click rate at the same BPM number, which the vendor's own forum calls a recurring point of user confusion. The Rhythm setting (Metronome Settings menu) lets you decouple click subdivision from the denominator without changing tempo. | Yes — Rhythm menu (added in version 10) | Vendor forum threads |
| **DAW B** | **B strictly — click always follows the denominator, no direct override.** In 6/8/9/12/8 the click is eighth notes by default; to get a dotted-quarter feel you must use the Group checkbox (clicks only on beat-groups, e.g. 1 and 4 in 6/8) instead of Beat. BPM readout still means the denominator note; users must hand-compute (e.g. dotted-quarter=64 → BPM 96) since DAW B has no beat-unit field like DAW C's. | Partial — Group/Beat/Division checkboxes, no explicit beat-unit field | User help forum; vendor support guide |
| **DAW C** | **B by default, with an explicit Click note-value field — the most direct DAW analog to a "beat unit" control.** The Meter Change / Time Operations dialog has a dedicated "Click" note-value parameter, letting you set the click to a dotted quarter in 6/8, 9/8, 12/8 without changing the tempo number. Tempo ruler's own Resolution setting can likewise be set to a dotted quarter so "BPM" itself means dotted-quarter-per-minute. | Yes — explicit Click note-value + Tempo Resolution fields | Training site article; forum thread |
| **Notation app A** | **B, strictly quarter-note-per-minute internally**, independent of the displayed metronome-mark text. Playback tempo is stored as quarter-notes/minute; a printed "dotted quarter = 60" mark in 6/8 is converted internally to 90 (i.e. ×1.5). Older versions required manual compensation; current versions parse the note-value glyph in the tempo-mark text when using proper (non-ASCII) note/dot glyphs. | Indirect — via tempo-mark text parsing, not a dedicated field | Vendor forum; vendor handbook |
| **Notation app B** | **First-class beat-unit property — the cleanest implementation found.** A tempo mark's Beat Unit (note value + dot) is an explicit, independently editable property, and tempo equations formally model the beat-unit change across a meter change (e.g. quarter=120 in 3/4 → dotted-quarter=120 in 6/8, tempo held constant). | Yes — explicit Beat Unit property + tempo equations | Vendor manual |
| **Notation app C** | **Could not confirm in this pass.** No source retrieved describing its internal tempo-storage model (quarter-referenced vs. beat-unit-aware) with the same specificity as notation apps A and B. Given its mature notation heritage, a beat-unit-aware model (similar to notation app B) is plausible but unverified — do not treat as confirmed. | Unknown | — |
| **MIDI spec (contrast class, not a product)** | Explicitly **decouples click rate from the denominator** via the Time Signature meta event's `cc` byte (clocks-per-click, in units of 1/24 quarter note) — this is *why* DAW tempo is quarter-bound: the format defines tempo in µs/quarter-note (`FF 51 03`) and meter separately, so a sequencer's "click" is a distinct configurable parameter, not derived from the denominator automatically. 4/4 quarter-click = `cc`=24 (0x18); 6/8 dotted-quarter-click = `cc`=36 (0x24). | N/A — spec provides both, product choice is up to the sequencer | [MIDI.org: Time Signature Understanding](https://midi.org/community/midi-specifications/time-signature-understanding), [RecordingBlogs: MIDI Time Signature meta message](https://www.recordingblogs.com/wiki/midi-time-signature-meta-message) |

## The 6/8 wrinkle

Every product that supports 6/8 at all resolves the "6 clicks vs. 2 clicks"
question the same way: **give the user an explicit, separate control**
(rhythm pattern, subdivision field, beat-unit property, Group-vs-Beat
checkbox, or per-click accent/mute toggles) rather than picking one behavior
and hard-coding it as "what 6/8 means."

- **Hardware** (hardware metronomes A and B, mechanical, quartz) resolve it via *beat-count +
  rhythm-pattern selection* — set beats to 6 for eighth-note clicks, or set
  beats to 2 (or 1) plus a triplet/whole-note rhythmic layer for the
  dotted-quarter feel. No hardware surveyed defaults to one interpretation
  without a user choice.
- **Metronome app B** ships 3 named compound-meter rhythm patterns for
  6/8 specifically, plus per-LED accent/mute as an escape hatch.
- **DAWs A, B and C** all default to eighth-note clicks in 6/8
  (Convention B literally applied against the printed denominator) and
  require an explicit secondary setting (Rhythm, Group checkbox, Click
  note-value) to get the dotted-quarter pulse.
- **Notation apps A and B** treat the beat unit as notation metadata separate
  from the raw tempo number, so "dotted quarter = 60" is stored/computed
  correctly without the user manually doubling anything — this is the
  cleanest UX for the *notation* side, but it depends on parsing a printed
  tempo mark, which a standalone practice metronome doesn't have.

**Conclusion: a dedicated "click unit" control, decoupled from the raw
time-signature denominator, is the dominant resolution** — not a hidden
implementation detail, but a control musicians are expected to see and use.

## What musicians actually expect

Genuinely split by population, and the split tracks tooling background more
than genre:

- **DAW/notation users** (forum evidence: forums for four DAWs and a
  general audio-engineering forum) treat
  quarter-note-per-minute as the default mental model and file compound-meter
  click behavior as a recurring *complaint* — multiple independent forum
  threads across four different DAWs ask for the same feature (decouple
  click from denominator without retyping tempo), which is evidence the
  default (B, strictly denominator-following) surprises people in compound
  meters specifically, not in plain x/4 or x/8 meters.
- **Band/practice-tool users** (hardware manuals, hardware vendor Q&A pages,
  banjo/mandolin forum threads) don't seem to carry a "BPM = quarter note"
  assumption at all, because the hardware they grew up on never offered a
  denominator field — the mental model is "beats per bar + a feel," and the
  note-value naming is understood as notation-only, disconnected from the
  click.
- No source found states a single "dominant" expectation across the whole
  musician population; the two populations disagree because they're
  answering different questions ("what does the printed meter mean" vs.
  "what does this specific box do when I turn this specific knob").

## Does anyone let the denominator alone change click rate (Convention B, unconditionally) in a standalone metronome?

**Yes — DAW B's metronome does this by default and it is the single
strongest real-world instance of "the dial is the click, and it's the
denominator" found in this survey**, but note the frame: DAW B is a DAW, not
a standalone practice-metronome product, and its own users treat the
resulting compound-meter behavior as a bug to route around (Group checkbox),
not as an intended practice-tool feature. No standalone, dedicated metronome
app or hardware unit in this survey ships this as an *unconditional* default;
every one of them either has no denominator field, or offers an explicit
secondary control precisely to prevent 7/4→7/8 from silently doubling the
click rate.

## What we could not confirm

- **Metronome app E**'s exact denominator-to-click mapping — store listing
  doesn't document it.
- **Metronome app F**'s exact 6/8-at-120 click rate — inferred from
  its subdivision/polyrhythm feature set, not directly sourced.
- **Metronome app D**'s default beat-unit assumption — inferred from its slider
  model (mirrors hardware metronome A), not confirmed from a manual.
- **Quartz metronome** — no dedicated manual PDF found; behavior inferred by
  analogy to the mechanical beat-selector pattern.
- **Notation app C**'s internal tempo-storage model — no source retrieved with the
  specificity available for notation apps A and B. Do not assume it matches
  either.
- Whether **any** platform of that tuner app (native iOS/Android apps, as opposed to
  the browser tool checked here) exposes a distinct beat-unit control beyond
  per-beat mute/accent toggles — only the browser tool was directly
  inspected.

## Recommendation for a standalone practice-metronome app (denominators 2/4/8/16)

**Adopt Convention B (BPM = quarter notes/minute) as the stored value, but
expose an explicit, separate "click unit" control** (default = denominator's
implied note, per standard notation) that the user can override — this is
what every well-regarded product in this survey converges on (metronome
apps A, B and C, DAW C's Click field, notation app B's Beat Unit).
Do **not** implement raw Convention B alone (denominator silently rescales
click rate with no override) — nothing in this survey ships that as an
unconditional default in a standalone tool, and the DAW precedent (DAW A,
another DAW) that comes closest is uniformly reported by its own users as
confusing.

**Cost of picking wrong:**

- **Ship raw Convention B** (denominator changes click rate, no override):
  every user coming from a DAW/notation background — the population that
  already has BPM-means-quarter-note wired in — will experience 7/8 at 120
  clicking twice as fast as 7/4 at 120 as a *bug*, not a feature, per the
  cross-DAW forum evidence above. This is the worse failure mode because it's
  silent: the number on screen doesn't change, but the felt tempo does.
- **Ship raw Convention A** (denominator never affects click rate, ever): compound meters (6/8, 12/16) become unusable for the
  dotted-note pulse practice-metronome users actually want without manual
  BPM arithmetic (×1.5 or ×3, per notation app A's own pre-parsing behavior) —
  this is the failure every hardware/software product in this survey
  specifically built a workaround for (Group checkbox, Click field, rhythm
  patterns, beat-unit property).
- **Ship both without a visible unit label**: the metronome app A / DAW A
  failure mode — the control exists but users don't know which mode they're
  in, and re-derive the wrong BPM by hand. The MIDI spec's own bifurcation
  (tempo in µs/quarter vs. click in clocks-per-click) argues for keeping the
  two numbers visually distinct at all times, not merged into one dial.
