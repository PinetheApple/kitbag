# UI/UX best practices and audit

Researched 2026-10-29. Tags: **verified** (read on the owning page or measured here), **vendor-claim**, **inferred** (my reasoning or arithmetic), **unmeasured**, **refuted**. Everything in section 1 is a structural rule unless marked volatile.

Limits of this pass:
- Material 3 pages (m3.material.io) returned only their titles to my fetcher because they are script-rendered. M3 touch-target, navigation-bar and bottom-sheet claims therefore rest on developer.android.com, not on M3 pages.
- I had no shell, so I could not run `gh issue list`. Issue numbers below are only the ones named in the brief. Check the rest before filing (see Open questions).

## 1. Best-practice digest

What changes a design decision, not generic advice.

| Practice | Source | Tag | Decision it drives |
|---|---|---|---|
| Touch targets: at least 48x48dp (more is better) | [Android accessibility guide](https://developer.android.com/guide/topics/ui/accessibility/apps) | verified | Any control touched mid-practice is 48dp. 24dp is only the WCAG floor. |
| WCAG 2.2 target size minimum: 24x24 CSS px, or 24px circles that do not overlap | [SC 2.5.8, AA](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) | verified | Hard floor for dense rows. Below it is a failure. |
| Contrast: text under 18sp (or bold under 14sp) needs 4.5:1, other text 3:1 | [Android accessibility guide](https://developer.android.com/guide/topics/ui/accessibility/apps), [WCAG 1.4.3](https://www.w3.org/TR/WCAG22/) | verified | Muted/tertiary text tokens are the usual failure. |
| UI component boundaries need 3:1 against adjacent colours | [WCAG 1.4.11](https://www.w3.org/TR/WCAG22/) | verified | Outline-only buttons and tracks on cream. |
| Text must work resized to 200%; reflow at 320 CSS px wide | [WCAG 1.4.4, 1.4.10](https://www.w3.org/TR/WCAG22/) | verified | Fixed-height rows and chips break first. |
| Dragging needs a single-pointer, no-drag alternative | [SC 2.5.7, AA](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html) | verified | The sliders and swipe tempo already have twins. Keep them. |
| Flashing: at most 3 flashes per second, or the flash area under 0.006 sr (341x256 CSS px) | [SC 2.3.1, A](https://www.w3.org/WAI/WCAG22/Understanding/three-flashes-or-below-threshold.html) | verified | A full-screen beat flash at 180 BPM (3 Hz) sits at the limit. Prefer a bounded area. |
| Reduce motion: interaction animation can be disabled | [SC 2.3.3, AAA](https://www.w3.org/TR/WCAG22/) | verified | Keep the on-beat cue as a static colour swap (SPEC 12.3). |
| Android 15+: apps targeting API 35 are edge-to-edge. Avoid touch targets under gesture-nav insets. | [System bars](https://developer.android.com/design/ui/mobile/guides/foundations/system-bars), [codelab](https://developer.android.com/codelabs/edge-to-edge) | verified | The app must set system-bar icon appearance itself. Test with 3-button and gesture navigation. |
| Predictive back is on by default from Android 15. Custom back handling must use `OnBackPressedCallback`/`OnBackInvokedCallback`. | [Predictive back](https://developer.android.com/guide/navigation/custom-back/predictive-back-gesture) | verified | Every screen needs a real back, and it must animate correctly. |
| Window size classes: compact <600dp, medium 600-840dp, expanded >=840dp. Compact height <480dp (phones in landscape). | [Window size classes](https://developer.android.com/develop/ui/compose/layouts/adaptive/window-size-classes) | verified, volatile (Large/XL classes were added recently) | Decide layout by window, not by "is tablet". |
| Targeting API 36: orientation, aspect-ratio and resizability restrictions are ignored on sw>=600dp | [Support different screen sizes](https://developer.android.com/develop/ui/compose/layouts/adaptive/support-different-screen-sizes) | verified | Tablets on stands will rotate whatever the manifest says. |
| `FLAG_KEEP_SCREEN_ON` is the sanctioned way to hold the screen. It must be set in an activity, cleared when no longer needed, and the system releases it in the background. | [Keep the screen on](https://developer.android.com/develop/background-work/background-tasks/awake/screen-on) | verified | Set it only while a tool is actively running. |
| Fast audio paths are hints and are not guaranteed | [Audio latency](https://source.android.com/docs/core/audio/latency/design) | verified | Latency is a measurement problem (see Open questions). |
| One-handed grip is 49% and cradled 36% of touching users. The author later repudiated his thumb-reach diagrams: people touch the centre of the screen most. | [Hoober, UXmatters, 2013](https://www.uxmatters.com/mt/archives/2013/02/how-do-users-really-hold-mobile-devices.php) | verified, 13 years old, no demographics | Do not build on thumb-zone heatmaps. Put the critical control where it is large and central. |
| Gesture discoverability needs visible alternatives | Already encoded in SPEC 12.6 | n/a | The NN/g page 404'd. Not re-cited. |

Not established: Apple HIG. The page returned only its title, so I cite nothing from it. It adds nothing platform-neutral that the Android and WCAG sources do not already carry.

## 2. Findings, ranked by impact on a practising musician

Existing issues: #56 (metronome back), #170 (Settings), #173 (time signature and subdivisions), #175 (metronome lower half, stopwatch). The stem-player layout is in progress in `docs/research/mockups/`. Nothing below re-proposes those. Where a finding touches one, I say so.

| # | Screens | What is wrong | Practice broken | Fix | Issue |
|---|---|---|---|---|---|
| 1 | All tools | No screen-on handling anywhere. No match for keepScreenOn, KEEP_SCREEN_ON or keep-awake in `packages/` (searched ts, tsx, kt, json, excluding node_modules). SPEC 12.7 promises "screen stays awake". The display will time out at a music stand while the metronome keeps clicking. | [Keep the screen on](https://developer.android.com/develop/background-work/background-tasks/awake/screen-on) | Set the flag while the metronome or player is running, or the tuner is listening. Clear it on stop and on leaving the tool. Make it a Settings toggle. | none known (**inferred** absent from the search) |
| 2 | Metronome | The beat cue is weak at arm's length. Beat LEDs are about 24dp circles squeezed into the time-signature card. The sweep is a thin line under the BPM. The ambient glow is barely visible. SPEC 12.1 asks for "readable from 1-2m". | SPEC 12.1 (own rule); [WCAG 2.3.1](https://www.w3.org/WAI/WCAG22/Understanding/three-flashes-or-below-threshold.html) bounds the fix | Make the downbeat/beat cue a large element under or around the BPM: a row of wide segments, or a tint of the BPM digits and a bounded-area pulse. Keep it under the flash-area limit. | partly #175 |
| 3 | Metronome | No reduced-motion handling in the metronome's own animation. The tuner and `Sheet` use `useReducedMotion`. `BeatLeds`, `BarSweep` and `SwipeTempoZone` do not (grep of those files found no reduce-motion hook). SPEC 12.3 requires it. | [SC 2.3.3](https://www.w3.org/TR/WCAG22/); SPEC 12.3 | Read the setting and degrade the sweep to a static colour swap on the beat. | none known |
| 4 | Stem player | M, S and dB controls are about 24dp tall in the screenshot (**inferred** from 1080px width, about 2.75px/dp). The `hitSlopFor` helper caps extension at half the neighbour gap, so the effective horizontal target is about 46dp. Vertical is unmeasured. Mute and solo are the two actions used most in this tool. | 48dp ([Android](https://developer.android.com/guide/topics/ui/accessibility/apps)); SC 2.5.8 | Make M and S 44-48dp squares and move the dB readout to a tap-to-expand row. Measure the real hit rect with Accessibility Scanner or uiautomator. | layout mockups cover space, not target size |
| 5 | All (light theme, **inferred**) | Contrast tokens fail by my arithmetic from SPEC 12.2 hex values. Light `text3` `#98929F` on `bg` `#F5F3EE` is about 2.7:1. Dark `text3` `#6C6878` on `#0E0D10` is about 3.6:1. Light accent `#B26F0E` on white is about 4.1:1 and on `bg` about 3.7:1. SPEC 12.2 claims light accent keeps "4.5:1+ on white": **refuted** by that calculation. The STEMS x6 chip label and the filter chips are 11-12sp accent text. Placeholders, "Coming soon" and transport labels use text3. | 4.5:1 for small text ([Android](https://developer.android.com/guide/topics/ui/accessibility/apps)) | Darken `text3` in both themes to at least 4.5:1. Use `accentDeep` (`#8F5A0C`) for accent text under 18sp on light. Keep `accent` for fills and icons (3:1). Recompute with a script and pin it in `theme.test.ts`. | none known |
| 6 | All (screenshots) | Status-bar clock and icons are near-invisible white on cream in all four captures. Edge-to-edge hands the status-bar appearance to the app. `app-shell/src` has no StatusBar or bar-style call (grep for StatusBar and barStyle found none), and `_layout.tsx` only resolves the theme. | [System bars](https://developer.android.com/design/ui/mobile/guides/foundations/system-bars) says the bar is transparent by default | Set status-bar and gesture-bar icon style from the resolved theme, and update it when the theme changes. | none known |
| 7 | All | The stage-dark theme follows the OS scheme only (`useColorScheme() === 'light' ? 'light' : 'dark'`, `_layout.tsx:35`). The brief's "on stage in the dark" case depends on a system setting. There is no in-app override. | SPEC 12.1 "stage-first" | Add the System/Dark/Light override. Consider a one-tap "stage" toggle on the metronome, since a gig wants dark whatever the phone says. | #170 (add the one-tap toggle there) |
| 8 | Tablet, any | Landscape is deferred (D13). Targeting API 36, orientation locks are ignored on sw>=600dp ([source](https://developer.android.com/develop/ui/compose/layouts/adaptive/support-different-screen-sizes)), and a phone in landscape is compact height. `flex: 1` spacers (as in `TunerScreen`) will stretch, and bottom transport can clip. | Window-size-class guidance | Before targeting 36, run each screen at 480dp height and at sw 600+ and fix clipping. Landscape stays out of scope. | none known (**inferred** from D13 plus the platform change) |
| 9 | Home | The lower 45% of the screen is empty. The cards that fill the top are "Play along: Coming soon" and "More tools: future tools arrive as plugins". There is no Continue card, which SPEC 12.4 says "dominates the top". Placeholder cards compete with tools that work. | SPEC 12.4 (own rule) | Hide or demote the "coming soon" cards. Add the Continue card. Put the tool tiles where the thumb already rests. | none known |
| 10 | All tools | Back and predictive back are unchecked. #56 covers the metronome only. Library, player and tuner have an AppBar. I did not check whether the manifest opts in to `enableOnBackInvokedCallback`, or whether sheets close on back before the screen does. | [Predictive back](https://developer.android.com/guide/navigation/custom-back/predictive-back-gesture) | Verify on device: back closes an open sheet first, then pops the screen, and never exits mid-playback by accident. | #56 (metronome) |
| 11 | Library, player | Text-scale behaviour is unmeasured. The library row wraps long titles, and the player title and metadata line truncate or overflow. Nothing in the code caps `maxFontSizeMultiplier`, so RN default scaling applies. SPEC 12.6 says "verified at 200%", and I found no evidence it was. | [WCAG 1.4.4](https://www.w3.org/TR/WCAG22/) | Screenshot each screen at 200% font scale on the device. Fix clipped controls. | none known |
| 12 | Metronome | Secondary labels ("BPM . ALLEGRO . SWIPE ANYWHERE", chevrons) are 11-12sp, letter-spaced, text3-coloured. They are not readable from a stand. The hint should disappear after first use (SPEC 12.6). | SPEC 12.6; contrast (finding 5) | Show the hint once, then drop it. Tempo name at least 15sp in `text2`. | #175 may cover |

What passes, so nobody re-opens it:
- The swipe tempo has visible +/-5, +/-10 and TAP twins. That satisfies SC 2.5.7 and SPEC 12.6.
- The tuner readout is a polite live region.
- Edge-to-edge insets are applied in the screens (the tuner pads by measured insets).
- The play button is about 55dp. The secondary transport circles are about 39dp but extended by hit slop to about 48dp (**inferred**).

## 3. Quick wins

- Status-bar icon style from the theme (finding 6): one call plus one effect. Fixes legibility on every screen.
- Keep-awake while a tool is running (finding 1): small, high payoff at a stand.
- Darken `text3` and use `accentDeep` for small accent text (finding 5): token edits plus a test.
- Hide the "Play along" and "More tools" placeholder cards until they ship (finding 9).
- Replace the metronome's `isReduceMotionEnabled`-blind animations with a static on-beat swap (finding 3).
- Enlarge M/S to 44-48dp (finding 4).

## Open questions

- **Issue overlap.** I could not list open issues. Before filing anything above, check `gh issue list --state open` for keep-awake, contrast, status bar and reduced motion.
- **Real hit areas.** Findings 4 and the transport circles use pixel-to-dp arithmetic from screenshots at an assumed 2.75px/dp. Settle it with Accessibility Scanner or `uiautomator dump` on the device. **Unmeasured.**
- **Contrast figures.** Computed from the SPEC hex values, not from rendered pixels. Several chip fills are tinted, so real ratios may be slightly lower. Confirm with a rendered-pixel check.
- **Beat visibility at 1-2m.** No trustworthy public number exists. Measure by photographing the device at stand distance in a dark room. **Unmeasured.**
- **Manifest back opt-in** and sheet-back ordering (finding 10): not read.
- **Tuner screenshot** was not captured. Tuner findings come from code only.
- **Adjacent, not pursued:** audio output latency on this device class (a fast path is not guaranteed per the audio-latency page above), and Material 3 Expressive component guidance, which I could not read.
