# Metronome layout B — mockup parity table

Source: the "Chosen" variant in `docs/research/mockups/metronome-layouts.html`
(owner-approved on #175, 2026-10-30). Values are the mockup's CSS at its 360 × 800
phone frame, where 1 CSS px = 1 dp. Colours name the §12.2 palette tokens; `mix(a N%, b)`
is CSS `color-mix(in srgb, a N%, b)`. The last column is where the value lives in
`@kitbag/core-design`; "new" means a role added for this layout.

## Unchanged by owner ruling

The owner ruled the top section unchanged apart from the BPM glow (#175, 2026-10-29). The
mockup draws it with slightly different numbers (numeral 100 vs 88, presets 48 tall at 15,
practice pill 34 tall); those are illustration, not a change request, and the built values
stay. The glow (`mix.tempoZoneGlow`) is removed.

## App bar

| Element | Mockup value | core-design |
|---|---|---|
| Bar | height 56, padding 0 4, gap 2 | existing `AppBar` |
| Back key | 48 circle, icon 24, `text` | `AppBar` back, `iconSizes` |
| Title | Space Grotesk 500 17 / 1.25, `text`, ellipsis | `textRoles.appBarTitle` |
| Setlist chip | height 36, radius 99, padding 0 8 0 14, gap 2, margin-right 8 | new `size.setChip`, `inset.setChip*` |
| Setlist chip fill / border | `mix(accent 14%, surface2)` / `accentDim` | new `mix.setChip` |
| Setlist chip text | Space Grotesk 500 13; `accentDeep` (Daylight), `accent` (Stage) | new `textRoles.setChip` |
| Setlist chip caret | chevron-down 18 | `iconGlyphs.caretDown` |

## Meter and subdivision chips

| Element | Mockup value | core-design |
|---|---|---|
| Row | centred, gap 10 | `space.rowGap` |
| Chip | height 48, radius 12, `surface2`, 1 `line`, gap 6 | `minTouchTargetDp`, `radius.button` |
| Meter chip | min-width 104, padding 0 10 0 16 | new `size.meterChipMin` |
| Subdivision chip | min-width 160, padding 0 10 0 12 | new `size.subdivisionChipMin` |
| Chip label | Space Grotesk 500 15, `text`, left-aligned, flex 1 | new `textRoles.pickerChip` |
| Chip caret | chevron-down 18, `text3` | `iconGlyphs.caretDown` |
| Notation glyph | `text`; note head 6.6 × 4.8 rotated −22°, stem 1.2 × 16.5, beam 2.2 thick, 3.4 apart, tuplet numeral Space Grotesk 700 7.5 | new `NotationGlyph` |

## Status line

| Element | Mockup value | core-design |
|---|---|---|
| At rest | height 40, centred, gap 8, Inter 14 `text2`, `tune` icon 18 | new `textRoles.status` |
| Live | `surface1`, 1 `line`, radius 12, padding 0 12, `text`, icon 20 `text2` | `radius.button` |
| Live lead | Space Grotesk 600 14.5, tabular | new `textRoles.statusLead` |
| Live meta | Space Grotesk 500 13 `text2`, tabular, right-aligned | new `textRoles.statusMeta` |
| Ramp progress | 3 tall at the bottom edge, `accent`, width = step progress | new `size.statusProgress` |
| Target reached | border `accentDim`, icon `accentDeep` | — |
| Count-in | fill `text`, border `text`, text `bg`; icon and meta `mix(bg 75%, text)` | new `mix.countInMeta` |
| Mute cycle cell | 18 × 14, radius 3, gap 3; base `surface3`; playing `text2`; muted 1.5 dashed `text2`; current gets a 2 `text` outline at 1.5 | new `size.cycleCell*` |

## Beat dots

| Element | Mockup value | core-design |
|---|---|---|
| Dot size | `min(56, floor((328 − gaps) / dots per line))`; 56 for ≤ 4 beats, 33 for 7/8, 43 for 12/8 | new `size.beatDotMax` |
| Gaps | 12 inside a group, 22 between groups, 10 between lines | new `space.beatDot*` |
| Wrapping | more than eight beats wraps at a group boundary | `logic/ledLayout.ts` |
| Normal | `surface3` fill, 2 border `mix(text3 55%, surface3)` | new `mix.dotBorder` |
| Accent | no fill, 5 border `accent` | new `size.dotAccentBorder` |
| Muted | no fill, 2 dashed `text3` | — |
| Sounding | `accent` fill and border; accented beat adds a 3 `accent` ring 3 outside it | — |
| Muted bar | every dot hollow, 2 `text3`; sounding dot 4 `text`; muted dots stay dashed | — |
| "1" marker | Space Grotesk 600 12 / 14, `text2`, 3 below the first dot | new `textRoles.beatMarker` |
| Legend | gap 16, Inter 12.5 `text2`, swatch 14 with gap 6 | new `textRoles.legend` |
| Count-in squares | 56 × 56, radius 14, 2 `text3`, Space Grotesk 700 26 `text2`, gap 12; done `surface3` / `text3`; current `text` fill, `bg` text | new `size.countSquare` |

## Transport

| Element | Mockup value | core-design |
|---|---|---|
| Row | gap 28, then 8 above the gesture bar | new `space.transportGapWide` |
| Setlist / Practice key | 56 circle, `surface2`, 1 `line`, icon 24 `text` | new `size.transportKeyLarge` |
| Practice key, armed | `mix(accent 18%, surface2)`, border `accentDim`, icon `accent` | `mix.activeControl` |
| Badge | 18 tall, min-width 18, radius 9, `accent` / `onAccent`, Space Grotesk 700 10.5 / 18, offset −2, padding 0 4 | new `size.keyBadge` |
| Play | 76 circle, `accent`, icon 36 `onAccent`, sheet shadow | new `size.playButtonLarge` |

## Sheets

| Element | Mockup value | core-design |
|---|---|---|
| Sheet | `surface1`, top border `line`, radius 24 top, padding 10 16 26, gap 6, shadow | `Sheet` (see deviations) |
| Grab | 36 × 4, radius 2, `surface3`, 8 below | `size.grab*` |
| Title | Space Grotesk 500 16 | see deviations |
| Scrim | `rgba(10,8,14,.45)` | `Sheet` scrim |
| Hint | Inter 12 `text3` | new `textRoles.sheetHint` |
| Subdivision tiles | 4 columns, gap 8; tile height 64, radius 12, `surface2`, 1 `line`, gap 4, Space Grotesk 500 11.5 `text2`; selected `mix(accent 16%, surface2)`, border `accent`, `text` | new `mix.selectedTile` |
| Meter wheels | gap 14, padding 6 0; wheel width 84, radius 14, `surface2`, 1 `line`, padding 4 0; item 36 tall Space Grotesk 500 18 `text3`; selected 44 tall 700 30 `text` with `line` rules; slash 300 44 `text3` | new `size.wheel*` |
| Common meters | wrap, gap 8; height 40, min-width 60, padding 0 10, radius 10, Space Grotesk 500 14; selected border `accent`, `mix(accent 16%, surface2)` | `radius.pick` |
| Sheet buttons | gap 8, 6 above; height 44, radius 12, Space Grotesk 500 14; primary `accent` / `onAccent` | `Button` |
| Practice sections | gap 8, padding 10 0, `line` between; heading Space Grotesk 500 15 with icon 24 `text2`, gap 10 | new `textRoles.practiceHeading` |
| Practice rows | gap 8, Inter 13 `text2` | new `textRoles.practiceRow` |
| Stepper | height 36, radius 10, `surface2`, 1 `line`, gap 2, padding 0 2; value Space Grotesk 500 14 min-width 40; keys 28 wide, 18 `text2` | `StepControl` inline |
| Segments | radius 12, padding 3, gap 3; option 34 tall, Space Grotesk 13, radius 9, `text2`; selected `surface1`, `text`, shadow 0 1 3 `rgba(0,0,0,.12)` | `SegmentedControl` |
| Switch | 40 × 24, radius 12, `surface3`, knob 18 `text2` inset 3; on `accent`, knob `onAccent` | new `Switch` |
| Loop toggle | chip 34 tall, Space Grotesk 13, icon 16 | `Chip` |
| Mute preview | 8 cells, gap 3, height 14, radius 3; playing `text2`, muted 1.5 dashed `text3` | `size.barPreview` |
| Sound picker | height 36, padding 0 6 0 12, radius 10, Space Grotesk 500 13.5, caret; preview key 40 circle | `radius.pick` |
| Numpad | display Space Grotesk 700 52; 3 columns gap 8; key 52 tall, radius 12, Space Grotesk 500 20; OK `accent` | `NumpadKeypad` |

## First-use hint

| Element | Mockup value | core-design |
|---|---|---|
| Scrim | `rgba(10,8,14,.55)`, content from 150 down | new |
| Target ring | 300 × 200, radius 24, 2 dashed `onAccent`, up-down arrow icon 48 | new |
| Bubble | width 300, 16 below, `surface1`, radius 16, padding 14 16, gap 10, shadow | `radius.card` |
| Bubble title / body | Space Grotesk 600 15 / Inter 13.5 `text2` | new roles |
| "Got it" | primary button, height 40, padding 0 18, right-aligned | `Button` |

## Not matched

Filled in as the implementation lands; each entry says why.
