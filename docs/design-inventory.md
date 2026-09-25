# Kitbag design inventory

Read-only inventory of the four binding HTML design files. This is a consistency checklist and `core-design` backlog, not a new design source.

## Precedence

1. `design/kitbag-ui.html` is the foundation: tokens, shared modules, baseline screens, flows, and experience rules.
2. `design/kitbag-metronome.html` supersedes only the foundation Metronome surface and adds Setlists, Setlist Detail, Preset Editor, sheets, practice summary, and notification/lock-screen surfaces.
3. `design/kitbag-playalong.html` supersedes only the foundation Play-along surface and adds locked/unlocked/no-tempo/permission states plus five sheets.
4. `design/kitbag-settings.html` owns Settings, Latency Calibration, Restore, and the final Tools Manager. It supersedes the foundation rule “Settings stay contextual,” not the rest of the foundation.

When two specimens disagree, use the narrower/later file only inside its declared scope. Product behavior in `SPEC.md` and recorded decisions still override mock copy; layouts and tokens remain binding.

## Canonical foundation tokens

All four files repeat the same color/theme variables byte-for-byte (`kitbag-ui.html:6-40`, `kitbag-metronome.html:6-40`, `kitbag-playalong.html:6-40`, `kitbag-settings.html:6-40`). They are one semantic system, not four palettes.

| Semantic role | Stage/dark | Daylight/light |
|---|---:|---:|
| `background` (`--bg`) | `#0E0D10` | `#F5F3EE` |
| `surface.1` (`--s1`) | `#1A1820` | `#FFFFFF` |
| `surface.2` (`--s2`) | `#242230` | `#ECE9E1` |
| `surface.3` (`--s3`) | `#2E2C3A` | `#E3DFD4` |
| `border.default` (`--line`) | `#33303F` | `#DCD7CA` |
| `text.primary` (`--tx`) | `#ECEAF0` | `#221F26` |
| `text.secondary` (`--tx2`) | `#9B97A8` | `#6E687A` |
| `text.tertiary` (`--tx3`) | `#6C6878` | `#98929F` |
| `accent` (`--ac`) | `#FFB347` | `#B26F0E` |
| `accent.deep` (`--ac-deep`) | `#E89B2E` | `#8F5A0C` |
| `accent.dim` (`--ac-dim`) | `#8A6A35` | `#D8B27C` |
| `accent.on` (`--on-ac`) | `#221600` | `#FFF7EA` |
| `feedback.danger` (`--red`) | `#FF5C5C` | `#CC4444` |
| `feedback.warning` (`--amb`) | `#FFC24B` | `#9A6E06` |
| `feedback.success` (`--grn`) | `#4ADE80` | `#1E8A4F` |
| `wave.default` (`--wave`) | `#4E4A5E` | `#C9C3B4` |
| `wave.played` (`--wave-hot`) | `#FFB347` | `#B26F0E` |
| `shadow.overlay` | `0 8px 32px rgba(0,0,0,.45)` | `0 8px 28px rgba(60,50,20,.14)` |

Rules:

- Amber accent means active/on-beat. Red/amber/green are semantic feedback and never substitute for accent.
- Elevation is surface lightness; shadow is reserved for sheets, floating action/play controls, and phone specimens.
- Do not introduce component-local color literals. The one foundation `#fff` in `.ms.on-m` (`kitbag-ui.html:112`) should map to a semantic inverse/on-danger token in code.

## Typography, geometry, and motion

Sources: common CSS in all four files (`:42-60`), foundation prose (`kitbag-ui.html:263-278`), and SPEC §12.2–12.3.

### Type roles

| Role | Family | Size/weight | Notes |
|---|---|---|---|
| Display/numeric | Space Grotesk | 64/700 canonical; tool heroes vary intentionally (BPM 88, tuner note 64, calibration 60, sheet number 52, summary 38) | Always tabular figures for changing numbers. |
| Headline/app title | Space Grotesk | 22/500 canonical; phone app bar specimen 17/500 | Do not copy mock-only inline 15px titles into a separate component. AppBar handles long-title compression. |
| Body | Inter | 15/400 product canonical; design-doc body is 16/1.6 | Design-document chrome is not app typography. |
| Label | Space Grotesk | 12/500, uppercase, `0.18em` tracking | Section labels use 10.5 and `0.16em` inside phone frames. |
| Secondary row title | Space Grotesk | 14–14.5/500 | One named row-title style. |
| Secondary/support | Inter | 11–13.5 | Named `caption`, `bodySmall`, and `hint`; avoid arbitrary inline sizes. |

### Radius/size roles

- Card/tile/empty state: 16.
- Tool/list rows: 12–13 contextual; prefer named `row` 12 and reserve 13 only if visual comparison proves it intentional.
- Button: 12.
- Chip/pill/toggle track: full/99.
- Sheet: 20 top, 14 bottom.
- Step control: 9 outer, 6 inner.
- Segmented control: 11 outer, 8 selected segment.
- LED: circle; main 26 with 2 border, small 16 with 1.5 border.
- Play primary: 58 circle; secondary transport key: 42 circle.
- Tool icon tile: 38 square, radius 11.
- FAB: 52 square, radius 16.
- App phone content cadence: 12 gap; standard horizontal card padding 14.

### Spacing roles already repeated

The HTML does not define spacing variables, but repeatedly uses `2, 3, 4, 6, 8, 9, 10, 11, 12, 14, 18, 22, 26`. Code should normalize these to the existing `core-design` spacing authority rather than preserve every inline mock number. Required visual anchors: screen gap 12, compact row gap 8–10, card padding 14, sheet gap/padding 12/14, screen horizontal inset 14–16.

### Motion

- Beat signal combines continuous anticipation (bar sweep) and click confirmation (LED flash).
- Reduced motion removes decorative motion but retains static on-beat state changes.
- Foundation mock's pulse is `1.2s ease-out infinite` only under `prefers-reduced-motion: no-preference` (`kitbag-ui.html:194-196`). This is illustrative, not the real audio-clock timing source.
- Presses and sheets use platform/M3-style springs; no ambient timer animation competes with the beat.
- Realtime sweep/needle/drift values remain Reanimated `SharedValue`s read from JSI, never React state.

## Shared module catalog

### Tier 1 — build/extract in Wave 0

| Module | Required variants/states | Evidence |
|---|---|---|
| `AppBar` | title, back, trailing icon/chip/action; long-title compression | Shared phone CSS `:147-151`; all screens below. |
| `Button` | primary, tonal, ghost, destructive; full-width/composed layout | Foundation `kitbag-ui.html:98-101`. |
| `Chip` | default, active, value, source/live-dot, full-width-in-row; wrap, never horizontal scroll | Foundation `:102-103`; metronome chips `kitbag-metronome.html:324-327`. |
| `BeatLed` / `BeatLedRow` visual | accented/normal/muted/active; main/small; `SharedValue` active beat; reduced motion | Foundation `:104-107,139`; repeated in Metronome, Settings, Play along, Tuner progress. Meter grouping remains tool logic. |
| `StepControl` | compact inline minus/value/plus; semantic labels; long-press repeat optional | Metronome `:230-234`; Play along `:209-213`; Settings `:250-252`. |
| `Sheet` | grabber/title/content/actions/hint; scrim and drag dismiss; 20/20/14/14 radius | Metronome `:205-209`; Play along `:243-247`; Settings `:234-238`. |
| `Numpad` | digits/backspace/confirm; feature supplies bounds, value and extra actions | Metronome `:215-217`; Play along `:230-232`. |
| `PresetButton` | equal-width tonal numeric/action key | Foundation `:137-138`; metronome BPM row. |
| `TransportKey` | 42 secondary circle; icon/text and selected/disabled states | Foundation `:166-167`; every audio tool. |
| `PrimaryPlayButton` | 58 amber circle, play/pause glyph, shadow | Foundation `:114-115`. |
| `SegmentedControl` | 2–4 segments, selected state, compact variant | Foundation `:181-183`; all specific files. |
| `Card` | default, active/hot, feedback-border; padding variants only through composition | Foundation `:152-153`. |
| `Badge` | default, accent, success, warning, danger; text/icon status | Foundation `:116-118`; warning currently inline in Library/Play-along and needs a named variant. |

### Tier 2 — required by later screens

| Module | Required variants/states | Evidence |
|---|---|---|
| `ListRow` | icon/title/subtitle/trailing/action, selected/active, ellipsis | Foundation `:154-158`; used everywhere. |
| `ToolTile` | 1×1/2×1, live subtext, muted/upcoming, edit affordance | Home `kitbag-ui.html:328-350`. |
| `SearchField` | search icon, placeholder/value, accessible clear | Foundation `:164`; Library/Setlists. |
| `FloatingActionButton` | primary add/import | Foundation `:165`. |
| `DragListRow` | drag handle only, index, title/subtitle, active badge | Metronome `:225-228,415-449`. |
| `EditRow` | key/value/chevron/toggle/path/checkbox; grouped card | Metronome `:219-223`; Play along `:202-207`; Settings `:244-248`. |
| `Toggle` | off/on/disabled | Settings `:210-213`. |
| `Checkbox` | off/on/disabled | Settings `:215-216`; Restore. |
| `SectionLabel` | uppercase label + optional audible-state chip | Settings `:199-201`. |
| `EmptyState` | icon/title/reason/one primary next action | Metronome `:240-243`; Play along `:253-256`; shared experience rule. |
| `StatusCard` | reason, next action/retry/remove, neutral/warning/danger/success without color-only meaning | Play-along state cards `:258-263`; future Library/Stem failure states. |
| `RouteRow` | output/media source, active, subtitle, trailing badge/live dot | Play along `:237-241`; Settings `:228-232`. |
| `PickerGrid` | 3-column default, configurable count, selected state | Metronome `:211-213`; Settings/Play along. |
| `Waveform` | played/unplayed, beat/downbeat ticks, seek/loop overlays, compact stem variant | Foundation `:119-121`; Player/Stem screens. |
| `Slider` | normal, unity detent, warning range, dB/percent readout | Foundation `:108-110`; Settings `:207-208`; Stem master. |
| `MuteSoloButtons` | normal, mute danger, solo accent, additive-solo gesture | Foundation `:111-113`; Stem. |
| `ProgressBar` | generic position/bar progress; deterministic animated source | Foundation beatring `:135-136`; Play along posbar `:215-216`. |
| `TunerStrip` | fixed center, graduated semantic gradient, realtime needle | Foundation `:123-127`. |
| `PegSelector` | default/detected/in-tune/locked | Foundation `:173-177`. |
| `TapPad` | default, accent fallback, progress/count, disabled | Foundation `:169`; Play along and latency calibration. |
| `ScatterPlot` | samples, zero, mean, range labels | Settings `:222-226`. |
| `DriftMeter` | quiet band, warning, numeric redundant status | Play along `:218-223`. |
| `PhaseMeter` | zero, needle, ±half-beat labels | Play along `:225-228`. |
| `NotificationTransport` | state/title/subtitle, conditional prev/next, pause/stop | Metronome `:245-249,594-640`. Platform implementation is Android-owned, but visual/state model is shared. |
| `MiniPlayer` | docked title/play-pause above Home | Required by `kitbag-ui.html:459-466`; not drawn as a standalone specimen. |

## Screen and state matrix

### Foundation: `kitbag-ui.html`

| Screen | Modules | Required states/notes | Source |
|---|---|---|---|
| Home | AppBar, Continue Card, ListRow, Button, ToolTile grid, muted Card | exact-state resume; live subtext; edit mode reorder/resize/pin/hide; upcoming visible | `:328-350` |
| Metronome | Superseded—see metronome file | Foundation specimen is historical only | `:355-390` |
| Tuner | AppBar, Chip, PegSelector, numeric display, TunerStrip | detected/in-tune/locked; Auto/A4/Chromatic; redundant direction text | `:392-417` |
| Songs/Library | AppBar, SearchField, filter Chips, ListRows, Badges, FAB | analyzing/success/stems; empty CTA; failed/unsupported/missing required by SPEC | `:419-442` |
| Player | AppBar, Badge, Waveform, A-B loop, active Card, Chips, 5-key Transport | click lock, count-in/sound/accent, mini-player; speed visible but explicitly inert until plugin | `:444-469` |
| Stem player | AppBar, Chip, StemRows, Waveform compact, M/S, Slider, Badge, 5-key Transport | expanded volume, exclusive/additive solo, >16/loading/resampling/error states required | `:471-496` |
| Play along | Superseded—see play-along file | Foundation happy path is historical | `:498-523` |
| Permission explainer | promise Cards, primary/ghost Button | two does/two never; decline degrades to tap tempo | `:525-549`; final copy in play-along file |
| Tools manager | AppBar, ListRows, Toggle/Get Button/SOON Badge | final version is settings-file specimen with switches and back navigation | `:551-571`; superseded details below |

### Metronome: `kitbag-metronome.html`

| Screen/surface | Modules | Required states/notes | Source |
|---|---|---|---|
| Performance surface | AppBar + active setlist Chip, Practice Pill, swipe BPM display, bar progress, Preset Buttons/TAP, StepControls, grouped BeatLedRows, Segmented poly toggle, four Chips, 3-key Transport | chips wrap; poly row collapses off; 4/4 ungrouped; first-use swipe/type hints; active LED; reduced motion | `:301-370` |
| Setlists | AppBar/overflow, SearchField, active Card, ListRows, Badges, All Songs row, FAB, EmptyState | active pinned; search spans sets/songs; long-press actions | `:374-413` |
| Setlist detail | AppBar/overflow, action Chips, DragListRows, active Badge, helper Card | handle-only reorder; row subtext; NOW stable; remove vs delete | `:415-451` |
| Preset editor | AppBar Save Chip, grouped EditRows, StepControls, small BeatLeds, Buttons | identity/music/rig groups; explicit save; same accents and four chip concepts | `:453-501` |
| Ramp sheet | Sheet, StepControls, Segmented unit, Chip, Buttons, Hint | live apply; loop-back; manual tempo cancels | `:516-530` |
| Mute-bars sheet | Sheet, StepControls, 8-bar preview, Chip, Buttons, Hint | silent bars retain LEDs | `:532-540` |
| Sound sheet | Sheet, Segmented normal/accent, PickerGrid | native-owned names; preview current volume; per-accent selection | `:542-554` |
| Count-in sheet | Sheet, 4-way PickerGrid, EditRow/Segmented, Chip | off/1/2/4; distinct default; every-song choice; start only | `:556-566` |
| Tempo numpad | Sheet, numeric display, Numpad | 20–400; clamp on confirm | `:568-578` |
| Practice summary | Sheet, summary display, EditRows, Buttons | stop not pause; save/discard | `:580-589` |
| Notification/lock screen | NotificationTransport, ListRow, EmptyState | ongoing; conditional prev/next; BPM/signature/set/song; lock-screen parity | `:594-640` |

### Play along: `kitbag-playalong.html`

| Screen/state | Modules | Required states/notes | Source |
|---|---|---|---|
| Unlocked | AppBar/source Chip/live dot, Now Playing Card/position, tempo Card/Badge, optional grid-lock Card, TapPad, shared pattern Card, media Transport | Lock offered not automatic; meter source named; same LEDs/steps/sound as metronome | `:436-495` |
| Locked | same source/player, lock Card, DriftMeter, pattern Card, phase StepControl/Segmented, save/re-tap Chips, media Transport | tap pad replaced by drift; total trust time; song follows transport | `:497-564` |
| Permission | promise Cards, primary/ghost Buttons, helper copy | open notification-listener settings; verify on resume; denial continues in tap-only mode | `:566-610` |
| No tempo | source/player, neutral tempo Card, accent TapPad, four small LED progress, helper Card, media Transport | count first four taps; name attempted sources; not an error/dead end | `:612-655` |
| State matrix | StatusCards + Badges | drifting, track changed, paused/seeked, several apps, source lost, iOS, denied | `:658-717` |
| Source sheet | Sheet, RouteRows/live dots | playing first; podcasts visible but not default | `:730-740` |
| Sound sheet | exact shared Metronome Sound Sheet | one vocabulary/source of names | `:742-754` |
| Phase sheet | numeric display, PhaseMeter, StepControl, Segmented size, EditRows/Button | ±half beat, 1/10/50ms, downbeat shift, route+song total | `:756-789` |
| Tempo sheet | shared Numpad + feature-specific ÷2/×2 Chips | preserve source hint | `:791-805` |
| Save sheet | Sheet, EditRows, Buttons | writes shared SongPreset; tempo excluded | `:807-818` |

### Settings: `kitbag-settings.html`

| Screen/surface | Modules | Required states/notes | Source |
|---|---|---|---|
| Settings | AppBar, SectionLabels, audible Chip, grouped EditRows, Slider/unity, StepControl, Route row, small LEDs, Segmented theme, Toggles | Rig/Tools/Data/Appearance/About; preview independent of metronome; version from manifest | `:403-493` |
| Latency calibration | AppBar, active RouteRow, TapPad/progress, ScatterPlot, Badge, Buttons | 16 taps; refuse <8; route named top/bottom; start over/apply | `:495-547` |
| Tools manager | AppBar back, intro, ListRows, Toggles, Get Buttons, SOON Badge | this specimen wins over foundation gear/static ON badges | `:549-585` |
| Restore | AppBar, file Card, Segmented merge/replace, Checkboxes/EditRows, warning Card, primary/destructive CTA | v4 precondition; live counts; conflicts reviewed; typed replace | `:587-639` |
| Subdivision accents | Sheet, StepControl, BeatLed row, Buttons | one pattern per subdivision; same cycle semantics | `:653-669` |
| Backup | Sheet, EditRows, Toggle, Buttons | system share/document picker only | `:671-683` |
| Output/latency | Sheet, RouteRows, Badges | per-route values, active route | `:685-694` |
| Storage | Sheet, EditRows/path, Chip action | reports only; base picker relocates | `:696-707` |

## Cross-file decisions and drift

### Resolved by explicit precedence/recorded decisions

| Conflict | Pick |
|---|---|
| Foundation Metronome has three chips, inert badges and condensed subdivision segment; metronome file has four chips, StepControls and 1–16 subdivision | Use `kitbag-metronome.html`. |
| Mock says `ANDANTE` at 124 BPM | Use recorded conventional band: `ALLEGRO`; layout remains binding. |
| Foundation sound icon/name includes bell/rimshot language | Use metronome Sound Sheet, `♩`, and generated engine sound names only. |
| Foundation Play along implies zero-tap auto-lock and fixed ±10ms | Use play-along file: deliberate Lock tap, 1/10/50ms, ±half-beat, route+song total. |
| Foundation Tools Manager uses gear and static ON badges | Use settings file: back navigation and real Toggle controls. |
| Foundation Permission CTA says “Open Android settings” | Use narrower play-along copy “Open notification access” plus helper `Kitbag → allow · then come back`. |
| Settings-contextual foundation rule | Superseded: Settings owns volume, per-route latency, and subdivision accents. |
| Base directory appears cut in an older Settings decision | Current binding decision D11: keep it authoritative; Storage reports, picker relocates. |

### Genuine shared-module inconsistencies to normalize in code

1. **`StepControl` value width differs:** metronome 40px (`kitbag-metronome.html:231`), play-along 44px (`kitbag-playalong.html:210`), Settings 52px (`kitbag-settings.html:251`). Do not create three components. Use intrinsic content width with named compact/default/wide constraints only where screenshot comparison needs them; padding and tap targets stay identical.
2. **Warning badge is inline:** Library `ANALYZING…` and Play-along `DRIFT` hand-apply warning colors (`kitbag-ui.html:428`, `kitbag-playalong.html:667-669`). Add a named `warning` Badge variant.
3. **Feedback-border Cards are inline:** library match/success, restore warning, permission promises. Add semantic `success/warning/danger` Card emphasis while retaining text/icon, never color alone.
4. **App title shrinks via inline `font-size:15px` for Player/Stems:** keep one AppBar module with an explicit long-title behavior; no per-screen raw size.
5. **Many glyphs mix emoji, Unicode symbols, and SVG:** define one semantic icon-name mapping in `core-design`. Do not let tools choose platform-dependent emoji rendering. Play/pause is already SVG in specimens and should establish the rule.
6. **Spacing/radius values are raw and near-duplicate:** centralize named roles; do not copy every `9/10/11px` inline override into product styles.
7. **Motion has no token names:** add semantic durations/easings only when implementing actual presses/sheets; the beat animation is audio-clock-driven and must not use a generic timer token.
8. **Design-doc typography is mixed with product typography:** do not copy document `body 16/1.6`, `h1 34–52`, or annotation styles into app tokens. Product roles come from SPEC §12.2 and phone specimens.
9. **`Card.hot` is used for active accent and warning-like attention:** split component semantics into `active` (accent) and feedback variants rather than one boolean called `hot`.
10. **Status chips and action chips share `.chip`:** one visual primitive is correct, but accessibility semantics differ. Expose `Pressable Chip` versus read-only `StatusPill`; do not make a status label announce as a button.
11. **LED roles overlap:** main beat LEDs, small poly LEDs, tap-progress LEDs and subdivision LEDs share visuals but different semantics. One visual module; callers supply accessible label/action and grouping logic.
12. **Phone status bar/notch are specimen chrome, not product modules:** safe-area handling belongs to app-shell; do not implement fake status bars/notches.

## `core-design` backlog and ownership

### Wave 0 extraction order

1. Theme/token consumption and icon-name contract.
2. Button, Chip/StatusPill, Card, Badge.
3. BeatLed visual + generic hit-target geometry.
4. StepControl and PresetButton.
5. Sheet shell and Numpad keypad.
6. TransportKey and PrimaryPlayButton.
7. SegmentedControl.
8. AppBar only if its safe-area contract is kept in app-shell composition; otherwise defer AppBar until shell integration.

Move visual modules, not tool behavior. Feature-owned compositions remain:

- Metronome: meter grouping, native accent mapping, tempo bounds, tap series, preset deltas, transport meanings.
- Play along: source/lock/drift/phase state machine, BPM ladder, media transport.
- Settings: calibration math, route persistence, rig preview lifecycle.
- Player/Stems: playback/mixer semantics.

### Later implementation order

1. ListRow/EditRow/SectionLabel/Toggle/Checkbox/RouteRow.
2. Search/FAB/ToolTile/DragListRow/EmptyState/StatusCard.
3. Waveform/loop/progress/slider/MuteSolo.
4. TapPad/Scatter/Drift/Phase.
5. TunerStrip/PegSelector.
6. NotificationTransport/MiniPlayer.

## Review checklist for every screen

- Correct binding file and precedence used.
- Stage and Daylight both use the exact semantic palette.
- Space Grotesk for displays/numerics/labels; Inter for body; changing numbers tabular.
- One shared implementation per repeated module; no tool-local color/name list.
- Active/on-beat uses accent; warnings/errors/success use semantic colors plus text/shape/icon.
- Mid-practice controls meet 48dp unless the recorded LED exemption applies.
- Gestures have visible twins; hidden gestures get one-time hints.
- Empty/error/permission/offline states name reason and next action.
- Feedback appears within 400ms; long work gets background progress.
- Reduced motion preserves functional beat/tuner state.
- 200% text scale preserves action access and does not clip values.
- Sheet applies live where specified and is dismissible by scrim/drag.
- Realtime visuals never transit React state.
- Safe-area/status-bar treatment comes from app-shell, not copied specimen chrome.
- Web screenshots verify layout/state only and are not evidence of native/audio behavior.
