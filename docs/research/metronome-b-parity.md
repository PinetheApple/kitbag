# Metronome layout B — mockup parity table

Source: the "Chosen" variant in `docs/research/mockups/metronome-layouts.html`
(owner-approved on #175, 2026-10-30). Values are the mockup's CSS at its 360 × 800
phone frame, where 1 CSS px = 1 dp. Colours name the §12.2 palette tokens; `mix(a N%, b)`
is CSS `color-mix(in srgb, a N%, b)`. The last column is where the value lives in
`@kitbag/core-design` (roles in `roles.ts`; `metronome`, `metronomeSheet`, `wheelPicker` and `metronomeMix` in
`metronomeRoles.ts`; otherwise named). The status rows, pulse marks and poly row follow
variant A, the Q6 draft and "Poly · second dot row" of `docs/research/mockups/metronome-status.html` (owner-approved on
#175, 2026-10-30).

## Unchanged by owner ruling

The owner ruled the top section unchanged apart from the BPM glow (#175, 2026-10-29). The
mockup draws it with slightly different numbers (numeral 100 vs 88, presets 48 tall at 15,
practice pill 34 tall); those are illustration, not a change request, and the built values
stay. The glow (`mix.tempoZoneGlow`) is removed.

## App bar

| Element | Mockup value | core-design |
|---|---|---|
| Bar | height 56, padding 0 4, gap 2 | `AppBar` in a `metronome.appBar` row |
| Back key | 48 circle, icon 24, `text` | `AppBar` back (see Not matched) |
| Title | Space Grotesk 500 17 / 1.25, `text`, ellipsis | `textRoles.appBarTitle` |
| Setlist chip | height 36, radius 99, padding 0 8 0 14, gap 2, margin-right 8 | `metronome.setChip`, `radius.chip`, `metronome.setChipLeft`, `metronome.setChipRight`, `space.inlineKeyGap` |
| Setlist chip fill / border | `mix(accent 14%, surface2)` / `accentDim` | `metronomeMix.setChip` through `mixHex` |
| Setlist chip text | Space Grotesk 500 13; `accentDeep` (Daylight), `accent` (Stage) | `textRoles.setChip` |
| Setlist chip caret | chevron-down 18 | `iconGlyphs.caretDown`, `iconSizes.caret` |

## Meter and subdivision chips

| Element | Mockup value | core-design |
|---|---|---|
| Row | centred, gap 10 | `space.rowGap` (wraps at large text) |
| Chip | height 48, radius 12, `surface2`, 1 `line`, gap 6 | `minTouchTargetDp`, `radius.button`, `space.chipGap` |
| Meter chip | min-width 104, padding 0 10 0 16 | `metronome.meterChipMin`, `metronome.meterChipLeft`, `metronome.pickerChipRight` |
| Subdivision chip | min-width 160, padding 0 10 0 12 | `metronome.subdivisionChipMin`, `metronome.subdivisionChipLeft` |
| Chip label | Space Grotesk 500 15, `text`, left-aligned, flex 1 | `textRoles.pickerChip` |
| Chip caret | chevron-down 18, `text3` | `iconGlyphs.caretDown`, `iconSizes.caret` |
| Notation glyph | `text`; note head 6.6 × 4.8 rotated −22°, stem 1.2 × 16.5, beam 2.2 thick, 3.4 apart, tuplet numeral Space Grotesk 700 7.5; 24 tall in the chip | `NotationGlyph`, `notationGeometry` (`notation.ts`), `metronome.notationChip`, `textRoles.notationNumeral` |

## Status rows

| Element | Mockup value | core-design |
|---|---|---|
| Stack | below the dots; two rows of 40, gap 6, height kept with one or no row live | `metronome.statusRow`, `metronome.statusRowGap` |
| Row order | mute cycle, then ramp; a lone ramp takes the first row; count-in, then what follows it | `statusRows` in `logic/statusRows.ts` |
| At rest | height 40, centred, gap 8, Inter 14 `text2`, `tune` icon 18 | `metronome.statusRow`, `space.controlGap`, `textRoles.status`, `iconGlyphs.practiceTools`, `iconSizes.statusRest` |
| Live | `surface1`, 1 `line`, radius 12, padding 0 12, `text`, icon 20 `text2` | `radius.button`, `metronome.statusH`, `iconSizes.statusLive` |
| Live lead | Space Grotesk 600 14.5, tabular | `textRoles.statusLead` (Space Grotesk 600 is now bundled) |
| Live meta | Space Grotesk 500 13 `text2`, tabular, right-aligned; mute meta 6 after the lead | `textRoles.statusMeta`, `metronome.statusMetaGap` |
| Ramp progress | 3 tall at the bottom edge, `accent`, width = step progress | `metronome.statusProgress` |
| Target reached | border `accentDim`, icon `accentDeep` | `iconGlyphs.check` |
| Count-in | fill `text`, border `text`, text `bg`; icon and meta `mix(bg 75%, text)` | `metronomeMix.countInMeta`, `iconGlyphs.countingIn` |
| After the count-in | live row, no fill, dashed 1 `line`; "Then" and meta `text2`, `tune` icon 20 | `TRANSPARENT`, `iconGlyphs.practiceTools`, `iconSizes.statusLive` |
| Mute cycle cell | 18 × 14, radius 3, gap 3; base `surface3`; playing `text2`; muted 1.5 dashed `text2`; current gets a 2 `text` outline at 1.5 | `metronome.cycleCellWidth`, `metronome.cycleCellHeight`, `metronome.cycleCellBorder`, `metronome.cycleCellRadius`, `metronome.cycleCellGap`, `metronome.cycleNowOutline`, `metronome.cycleNowOffset` |

## Beat dots

| Element | Mockup value | core-design |
|---|---|---|
| Dot size | `min(56, floor((328 − gaps) / dots per line))`; 56 for ≤ 4 beats, 33 for 7/8, 43 for 12/8 | `metronome.beatDotMax`, `beatDotSize` in `logic/ledLayout.ts` |
| Gaps | 12 inside a group, 22 between groups, 10 between lines | `metronome.beatDotGap`, `metronome.beatDotGroupGap`, `metronome.beatDotLineGap` |
| Wrapping | more than eight beats wraps at a group boundary | `layoutBeatLeds(n, MAX_DOTS_PER_LINE)` |
| Normal | `surface3` fill, 2 border `mix(text3 55%, surface3)` | `metronomeMix.dotBorder`, `metronome.dotBorder` |
| Accent | no fill, 5 border `accent` | `metronome.dotAccentBorder` |
| Muted | no fill, 2 dashed `text3` | — |
| Sounding | `accent` fill and border; accented beat adds a 3 `accent` ring 3 outside it | `metronome.dotRing`, `metronome.dotRingGap` |
| Muted bar | every dot hollow, 2 `text3`; sounding dot 4 `text`; muted dots stay dashed | `metronome.dotSilentNowBorder` |
| Pulse marks | one per subdivision pulse, 3 below the dot: 6 × 6, radius 2, gap 3, `surface3`; the sounding pulse `accent` | `metronome.pulseMark`, `metronome.pulseMarkRadius`, `metronome.pulseMarkGap`, `pulseMarkFit` in `logic/pulseMarks.ts` |
| "1" marker | Space Grotesk 600 12 / 14, `text2`, 3 below the pulse marks | `textRoles.beatMarker`, `metronome.beatMarkerLineHeight`, `metronome.beatMarkerGap` |
| Poly row | poly on only; 10 below the dot lines; dots 22, 2 border, `surface3` / `mix(text3 55%, surface3)`, centred at first-dot centre + k/n × (line width + dot gap); sounding dot `text2` fill and border, from the engine's poly beat; no accent or mute states | `metronome.polyDot`, `metronome.dotBorder`, `polyDotCentres` in `logic/polyRow.ts`, `current_poly_beat` |
| Poly ratio | Space Grotesk 600 11, tracking .08, `text2`, 28 wide right-aligned, 8 left of the row | `textRoles.polyRatio`, `metronome.polyLabelWidth`, `metronome.polyLabelGap` |
| Legend | stopped only, in the second reserved status row; gap 16, Inter 12.5 `text2`, swatch 14 with gap 6 | `metronome.legendGap`, `textRoles.legend`, `metronome.legendSwatch`, `metronome.legendSwatchBorder`, `metronome.legendAccentBorder`, `space.chipGap` |
| Count-in squares | 56 × 56, radius 14, 2 `text3`, Space Grotesk 700 26 `text2`, gap 12; done `surface3` / `text3`; current `text` fill, `bg` text | `metronome.countSquare`, `metronome.countSquareRadius`, `metronome.countSquareBorder`, `textRoles.countSquare` |

## Transport

| Element | Mockup value | core-design |
|---|---|---|
| Row | gap 28, then 8 above the gesture bar | `space.transportGapWide`, `metronome.belowTransport` |
| Setlist / Practice key | 56 circle, `surface2`, 1 `line`, icon 24 `text` | `TransportKey size="large"`: `size.transportKeyLarge`, `iconSizes.transportLarge` |
| Practice key, armed | `mix(accent 18%, surface2)`, border `accentDim`, icon `accent` | `TransportKey selected` (`mix.activeControl`) |
| Badge | 18 tall, min-width 18, radius 9, `accent` / `onAccent`, Space Grotesk 700 10.5 / 18, offset −2, padding 0 4 | `TransportKey badge`: `size.keyBadge`, `radius.keyBadge`, `size.keyBadgeOffset`, `inset.keyBadgeH`, `textRoles.keyBadge` |
| Play | 76 circle, `accent`, icon 36 `onAccent`, sheet shadow | `PrimaryPlayButton size="large"`: `size.playButtonLarge`, `size.playGlyphBoxLarge`, `playGlyphPathLarge` |

## Sheets

| Element | Mockup value | core-design |
|---|---|---|
| Sheet | `surface1`, top border `line`, radius 24 top, padding 10 16 26, gap 6, shadow | `Sheet` (see Not matched) |
| Grab | 36 × 4, radius 2, `surface3`, 8 below | `size.grabWidth`, `size.grabHeight` |
| Title | Space Grotesk 500 16 | `textRoles.sheetTitle` (see Not matched) |
| Scrim | `rgba(10,8,14,.45)` | `Sheet dim`: `opacity.sheetScrim` over `palette.bg.dark` (see Not matched) |
| Hint | Inter 12 `text3` | `SheetHint size="large"`: `textRoles.sheetHint` |
| Subdivision tiles | 4 columns, gap 8; tile height 64, radius 12, `surface2`, 1 `line`, gap 4, Space Grotesk 500 11.5 `text2`; glyph 26 tall; selected `mix(accent 16%, surface2)`, border `accent`, `text` | `metronomeSheet.notationTile`, `metronomeSheet.notationTileGlyph`, `radius.button`, `metronomeSheet.notationTileGap`, `textRoles.notationTile`, `metronomeMix.selectedTile` |
| Meter wheels | gap 14, padding 6 0; wheel width 84, radius 14, `surface2`, 1 `line`, padding 4 0; item 36 tall Space Grotesk 500 18 `text3`; selected 44 tall 700 30 `text` with `line` rules; slash 300 44 `text3` | `WheelPicker`: `metronomeSheet.wheelGap`, `metronomeSheet.wheelRowV`, `wheelPicker.width`, `wheelPicker.radius`, `wheelPicker.insetV`, `wheelPicker.item`, `wheelPicker.selected`, `textRoles.wheelItem`, `textRoles.wheelSelected`, `textRoles.meterSlash` |
| Common meters | wrap, gap 8; height 40, min-width 60, padding 0 10, radius 10, Space Grotesk 500 14; selected border `accent`, `mix(accent 16%, surface2)` | `metronomeSheet.meterPick`, `metronomeSheet.meterPickMin`, `metronomeSheet.meterPickH`, `radius.pick`, `textRoles.meterPick`, `metronomeMix.selectedTile` |
| Sheet buttons | gap 8, 6 above; height 44, radius 12, Space Grotesk 500 14; primary `accent` / `onAccent`; Cancel transparent, 1 `line`, `text2` | `Button size="sheet"`: `size.buttonSheet`, `radius.button`, `textRoles.button`; Cancel is `variant="ghost"` |
| Practice sections | gap 8, padding 10 0, `line` between; heading Space Grotesk 500 15 with icon 24 `text2`, gap 10 | `metronomeSheet.practiceSectionV`, `textRoles.practiceHeading`, `iconSizes.practiceHeading`, `space.rowGap` |
| Practice rows | gap 8, Inter 13 `text2` | `textRoles.practiceRow` |
| Stepper | height 36, radius 10, `surface2`, 1 `line`, gap 2, padding 0 2; value Space Grotesk 500 14 min-width 40; keys 28 wide, 18 `text2` | `StepControl variant="inlineLarge"`: `size.stepInlineLarge`, `radius.stepInlineLarge`, `space.inlineKeyGap`, `inset.stepInlineLargeH`, `textRoles.stepInlineLargeValue`, `size.stepValueMinWidth`, `size.stepInlineLargeKey`, `iconSizes.stepInlineLargeKey` |
| Segments | radius 12, padding 3, gap 3; option 34 tall, Space Grotesk 13, radius 9, `text2`; selected `surface1`, `text`, shadow 0 1 3 `rgba(0,0,0,.12)` | `SegmentedControl size="large"`: `radius.segmentLarge`, `space.segmentInset`, `size.segmentLargeOption`, `textRoles.segmentLarge`, `radius.segmentLargeOption` (shadow: see Not matched) |
| Switch | 40 × 24, radius 12, `surface3`, knob 18 `text2` inset 3; on `accent`, knob `onAccent` | `Switch`: `size.switchWidth`, `size.switchHeight`, `size.switchKnob`, `size.switchKnobInset`, `radius.switch` |
| Loop toggle | chip 34 tall, padding 0 12, gap 6, Space Grotesk 13, icon 16 | `Chip size="large"`: `size.chipLarge`, `inset.chipH`, `space.chipGap`, `textRoles.chipLarge`, `iconSizes.chipLarge` |
| Mute preview | 8 cells, gap 3, height 14, radius 3; playing `text2`, muted 1.5 dashed `text3` | `metronomeSheet.mutePreview`, `metronomeSheet.mutePreviewDashed`, `radius.barPreview`, `space.barPreviewGap` |
| Sound picker | height 36, padding 0 6 0 12, radius 10, Space Grotesk 500 13.5, caret; preview key 40 circle, icon 20 | `metronomeSheet.soundPick`, `metronomeSheet.soundPickLeft`, `metronomeSheet.soundPickRight`, `radius.pick`, `textRoles.soundPick`, `iconSizes.caret`; preview `TransportKey size="small"`: `size.transportKeySmall`, `iconSizes.transportSmall` |
| Numpad | display Space Grotesk 700 52; 3 columns gap 8; key 52 tall, radius 12, Space Grotesk 500 20, glyphs 24; OK `accent` | `textRoles.sheetNumeral`, `NumpadKeypad size="large"` (main tempo and ramp From/To): `size.numpadKeyLarge`, `radius.numpadKeyLarge`, `textRoles.numpadKeyLarge`, `iconSizes.numpadKeyLarge` |

## First-use hint

| Element | Mockup value | core-design |
|---|---|---|
| Scrim | `rgba(10,8,14,.55)`, content from 150 down | `metronome.coachScrim` over `palette.bg.dark` (see Not matched) |
| Target ring | 300 × 200, radius 24, 2 dashed `onAccent`, up-down arrow icon 48 | `metronome.coachRingWidth`, `metronome.coachRingHeight`, `metronome.coachRingBorder`, `metronome.coachRingRadius`, `iconGlyphs.swipeTempo`, `iconSizes.coachRing` |
| Bubble | width 300, 16 below, `surface1`, radius 16, padding 14 16, gap 10, shadow | `metronome.coachBubbleWidth`, `metronome.coachBubbleGap`, `metronome.coachBubbleV`, `metronome.coachBubbleH`, `space.rowGap`, `radius.card` |
| Bubble title / body | Space Grotesk 600 15 / Inter 13.5 `text2` | `textRoles.coachTitle`, `textRoles.coachBody` |
| "Got it" | primary button, height 40, padding 0 18, right-aligned | `Button size="prompt"`: `size.buttonPrompt`, `inset.buttonH` |

## Not matched

Each entry says why.

- **Back key.** The shared `AppBar` keeps its chevron at `iconSizes.title` (17) inside
  its own hit box, not a 48 circle with a 24 arrow (#175 question 2, default kept).
- **App bar inset.** `AppBar` sits inside the 16 screen inset like every other screen,
  so the back glyph and the setlist chip sit about 6 further in than the mockup's
  4 bar padding plus 8 chip margin.
- **Setlist chip states the mockup does not draw.** No active set: "Setlists" on the
  neutral `surface2` / `line` chip with a `text3` caret. Active set without its song
  loaded: "Wedding set · 12 songs".
- **Armed summary text the mockup does not draw.** Nothing armed reads "Practice tools
  are off". Mute bars read "Play 2, mute 2" (the mockup's "Mute 2+2") and poly
  "Poly 3:4"; the order is ramp, mute, count-in, poly. Sound is not armed state, so it
  is not listed. The row under a running count-in uses the same ramp and mute text.
- **Ramp countdown at zero.** While a seconds or minutes step waits for its beat the
  engine reports 0 remaining; the line reads "→ 124 now".
- **Mute cycle strip.** At most 8 cells; a longer cycle pages by eight so the current
  bar stays on the strip. Cells shrink below 18 wide when the line runs out of room
  (long cycles, 200% text) rather than clipping the outline.
- **Count-in "bar N of M"** takes M from the engine's running count-in, not the store.
- **Status rows for screen readers.** They are labelled with the armed summary. The live
  values are not announced, so nothing re-renders per bar.
- **Dot wrapping against the old SPEC D9.** D9 asked for at least 4 dots per row ("16
  beats are four rows of four"); the build capped a row at 7 (`MAX_LEDS_PER_ROW`). The
  dots follow the mockup instead and hold up to 8 per line, wrapping at a group
  boundary, so 16 beats are two lines of eight 29 dp dots. The minimum of 4 is dropped:
  9/8 wraps 6+3. At 7 per row with 56 dp dots, 13 to 16 beats pushed the transport off
  a 360 × 800 screen. SPEC D9 now states the new rule.
- **Current muted beat.** The mockup's CSS fills it like a sounding beat. It stays
  hollow and dashed and its outline turns `text`, since a fill reads as a click that did
  not sound (SPEC §5.2; #175 question 7).
- **Pulse marks on silent pulses.** A muted beat or a muted bar lights no mark, since
  those pulses make no click (SPEC §5.2: dim = muted). ×1 draws one mark per beat.
- **Pulse mark size.** Marks and gaps shrink together only when the row would be wider
  than the dot: from 7 per beat at 56 dp dots, sooner at smaller dots.
- **12 beats group 3 + 3 + 3 + 3** whatever the denominator. The mockup only draws 12/8,
  and 6 and 9 already grouped in threes for any denominator.
- **Count-in squares** take the dot size, so they are 56 only when the dots are, and
  the numeral scales with the square, not with system text size. They overlay the dots,
  which are hidden during the count-in and stop taking taps through an animated
  `pointerEvents`; that has not been checked on a device.
- **Short screens.** Below 860 dp tall the BPM numeral drops from 88 to the 64 display
  role, the tempo zone's padding to 6 and the body gaps to 6, so 12/8 with pulse marks,
  the poly row and two status rows fits 360 × 800. On taller screens the tempo zone
  takes the spare height. When content still does not fit (large text), the body
  scrolls and the transport stays pinned.
- **Poly row on a wrapped bar.** The mockup draws only one line of beats. On a bar that
  wraps, the poly dots spread by time across the widest line, so they no longer sit
  under the beats they coincide with. The ratio label stops at the screen edge when the
  dots fill the width, and can then overlap the first poly dot.
- **First-use hint position and scrim.** The ring is centred on the measured swipe zone
  instead of 150 from the top. The scrim is Stage `bg` (#0E0D10) at 55%:
  rgba(10, 8, 14) is not a §12.2 token.
- **Sheet scrim.** Stage `bg` at 45% for the same reason. The ramp numpad and the sound
  list open over the Practice sheet, so their scrims stack; the mockup does not draw that.
- **Notation numeral baseline.** React Native cannot set a text baseline, so the
  numeral is placed by an approximate ascent ratio.
- **Play glyph.** The large button draws the Material play triangle (11 × 14 in 24)
  at 36. The stop square is not drawn in the mockup; it is the Material 12-in-24
  square.
- **Sheet frame and title.** `Sheet` keeps its tokens (#175, owner default): radius 20
  top and 14 bottom with a full 1 `line` border, padding 14 on three sides plus the
  bottom inset, content gap 12, title Space Grotesk 500 14.
- **Selected segment shadow.** Not drawn. §12.2 limits shadow to sheets and the play
  button ("elevation = lighter surface, not shadow"); adding it needs a §12.2 ruling.
- **Meter slash.** Space Grotesk 400: weight 300 is not bundled.
- **Wheel geometry.** Every row is 40 apart, the mean of 36 and 44, so a native scroll
  view can snap to it. The rows next to the selection sit where the mockup draws them;
  the outer rows sit 4 further out. The large selected style lands when the scroll
  settles, not while it moves. Wheel numerals do not scale with system text, and a row
  is 40 tall: the wheel is a scroll target, and screen readers adjust it as one control.
- **Subdivision tiles at large text** drop to two columns from a 1.5 font scale, so the
  names fit. The mockup draws only four.
- **Sound list.** Tapping a sound picker opens a "Normal sound" or "Accent sound" sheet
  over the Practice sheet; one tap sets the sound, plays it and closes. The mockup does
  not draw this step.
- **Practice heading icons** are the nearest Material Community glyphs: `trending-up`,
  `volume-off`, `timer-sand`, `metronome`, `waveform`.
- **Live ramp edits.** Any ramp edit is sent at once. While the ramp is on, the store's
  `setRamp` re-arms it, so the tempo jumps back to From after each change.
