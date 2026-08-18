// The metronome performance surface (SPEC §5.2, design §02). Everything here is
// something you touch while playing: tempo, pattern, transport.
//
// Two clocks, deliberately: every value below is human-speed React state read
// from the core-state store (§13.4), and the two 60fps truths — the bar sweep
// and the LED flash — come from useMetronomeFrame's worklet, never through
// React (§13.3). The store is intent; the engine is truth.
//
// NOT here yet: the four chips and their sheets (M4), the setlist chip and
// note strip (M5), and the §12.6 first-use hint that teaches swipe and
// tap-to-type. Volume, latency offset and subdivision accents are Settings by
// §5.3 and never appear on this screen.

import { radii, resolveTheme } from '@kitbag/core-design';
import {
  KB_ACCENT,
  KB_DENOMINATORS,
  KB_STOPPED_BEAT,
} from '@kitbag/core-native';
import { BPM_BOUNDS, useMetronome } from '@kitbag/core-state';
import { useCallback, useMemo, useRef, useState } from 'react';
import { GestureDetector } from 'react-native-gesture-handler';
import { StyleSheet, View } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';

import { subdivisionGlyph } from '../logic/subdivision.ts';
import { pushTap, tapTempoBpm } from '../logic/tapTempo.ts';
import { BeatLeds } from './BeatLeds.tsx';
import { PolyToggle } from './PolyToggle.tsx';
import { PracticePill, usePracticeElapsed } from './PracticePill.tsx';
import { PresetRow } from './PresetRow.tsx';
import { StepBadge, StepBadgeLabel } from './StepBadge.tsx';
import { SwipeTempoZone } from './SwipeTempoZone.tsx';
import { TempoNumpadSheet } from './TempoNumpadSheet.tsx';
import { Transport } from './Transport.tsx';
import { useTempoSwipe } from './useTempoSwipe.ts';
import { useMetronomeFrame } from './useMetronomeFrame.ts';

const theme = resolveTheme('dark');

const SCREEN_PADDING = 16;
const SCREEN_GAP = 14;
const CARD_PADDING = 14;
const CARD_ROW_GAP = 10;
const FIRST_BEAT = 0;

// SPEC §5.2 gives the poly row "own accent states", but the C ABI has one
// accent table, for the main pattern (kb_metronome_set_accent). So the poly row
// shows its downbeat and is not tap-editable — a poly accent the engine cannot
// play would be a control that lies. Editable when the ABI grows one.
function polyAccents(beats: number): readonly KB_ACCENT[] {
  return Array.from({ length: beats }, (_unused, beat) =>
    beat === FIRST_BEAT
      ? KB_ACCENT.KB_ACCENT_ACCENTED
      : KB_ACCENT.KB_ACCENT_NORMAL,
  );
}

/** Window insets in dp. The shell measures them: a tool may not depend on the
 * shell's safe-area library (§13.1), and portrait-only makes top/bottom the
 * whole story (app.json `orientation`). */
export interface ScreenInsets {
  readonly top: number;
  readonly bottom: number;
}

export interface MetronomeScreenProps {
  readonly insets: ScreenInsets;
}

export function MetronomeScreen({ insets }: MetronomeScreenProps) {
  const bpm = useMetronome((s) => s.bpm);
  const beatsPerBar = useMetronome((s) => s.beatsPerBar);
  const denominator = useMetronome((s) => s.denominator);
  const subdivision = useMetronome((s) => s.subdivision);
  const accents = useMetronome((s) => s.accents);
  const polyEnabled = useMetronome((s) => s.polyEnabled);
  const polyBeats = useMetronome((s) => s.polyBeats);
  const running = useMetronome((s) => s.running);

  const setTempo = useMetronome((s) => s.setTempo);
  const setBeats = useMetronome((s) => s.setBeats);
  const setSubdivision = useMetronome((s) => s.setSubdivision);
  const setPoly = useMetronome((s) => s.setPoly);
  const cycleAccent = useMetronome((s) => s.cycleAccent);
  const start = useMetronome((s) => s.start);
  const stop = useMetronome((s) => s.stop);

  const { barPhase, currentBeat } = useMetronomeFrame(running);
  const { elapsedMs, reset: resetPractice } = usePracticeElapsed(running);
  const [numpadOpen, setNumpadOpen] = useState(false);
  const tapTimes = useRef<readonly number[]>([]);

  // Any tempo set another way ends the tap series: a TAP moments after typing
  // 124 must start counting, not average against taps from before.
  const handleTempo = useCallback(
    (next: number) => {
      tapTimes.current = [];
      setTempo(next);
    },
    [setTempo],
  );

  // Swipe ANYWHERE (§5.2): the pan is mounted at the screen root, not on the
  // readout, so any empty space is the tempo control too.
  const tempoSwipe = useTempoSwipe(bpm, handleTempo);

  // The poly row does not flash: the engine HAS the value
  // (kb_metronome_current_poly_beat) but the JSI HostObject does not publish it
  // yet, so there is nothing to read on the UI thread. Held at STOPPED_BEAT —
  // claiming nothing beats guessing. Closing it is a core-native change.
  const polyBeatUnpublished = useSharedValue(KB_STOPPED_BEAT);

  const handleNudge = useCallback(
    (delta: number) => {
      handleTempo(bpm + delta);
    },
    [bpm, handleTempo],
  );

  const handleTap = useCallback(() => {
    tapTimes.current = pushTap(tapTimes.current, Date.now(), BPM_BOUNDS);
    const tapped = tapTempoBpm(tapTimes.current);
    if (tapped !== undefined) setTempo(tapped);
  }, [setTempo]);

  const handleBeatsStep = useCallback(
    (delta: number) => {
      setBeats(beatsPerBar + delta, denominator);
    },
    [beatsPerBar, denominator, setBeats],
  );

  // The denominator is a set, not a range (KB_DENOMINATORS is generated from
  // the engine, §13.7), so the badge's own face cycles it rather than adding a
  // fourth stepper to the row.
  const handleDenominatorCycle = useCallback(() => {
    const next =
      KB_DENOMINATORS[
        (KB_DENOMINATORS.indexOf(denominator) + 1) % KB_DENOMINATORS.length
      ];
    if (next !== undefined) setBeats(beatsPerBar, next);
  }, [beatsPerBar, denominator, setBeats]);

  const handleSubdivisionStep = useCallback(
    (delta: number) => {
      setSubdivision(subdivision + delta);
    },
    [subdivision, setSubdivision],
  );

  const handlePolyStep = useCallback(
    (delta: number) => {
      setPoly(polyEnabled, polyBeats + delta);
    },
    [polyEnabled, polyBeats, setPoly],
  );

  const handlePolyToggle = useCallback(() => {
    setPoly(!polyEnabled, polyBeats);
  }, [polyEnabled, polyBeats, setPoly]);

  const handleToggleTransport = useCallback(() => {
    if (running) stop();
    else start();
  }, [running, start, stop]);

  const handleOpenNumpad = useCallback(() => {
    setNumpadOpen(true);
  }, []);

  const handleCloseNumpad = useCallback(() => {
    setNumpadOpen(false);
  }, []);

  // Intended to keep the transport clear of the gesture bar under edge-to-edge;
  // not measured on a device.
  const insetPadding = useMemo(
    () => ({
      paddingTop: SCREEN_PADDING + insets.top,
      paddingBottom: SCREEN_PADDING + insets.bottom,
    }),
    [insets.top, insets.bottom],
  );

  return (
    <GestureDetector gesture={tempoSwipe}>
      <View style={[styles.screen, insetPadding]}>
        <PracticePill elapsedMs={elapsedMs} onReset={resetPractice} />

        <SwipeTempoZone
          bpm={bpm}
          barPhase={barPhase}
          onTypeTempo={handleOpenNumpad}
        />

        <PresetRow onNudge={handleNudge} onTap={handleTap} />

        <View style={styles.card}>
          <View style={styles.cardRow}>
            <StepBadge onStep={handleBeatsStep}>
              <StepBadgeLabel onPress={handleDenominatorCycle}>
                {beatsPerBar}/{denominator}
              </StepBadgeLabel>
            </StepBadge>
            <BeatLeds
              beatCount={beatsPerBar}
              accents={accents}
              currentBeat={currentBeat}
              onCycle={cycleAccent}
            />
          </View>

          {polyEnabled ? (
            <View style={styles.cardRow}>
              <StepBadge accented onStep={handlePolyStep}>
                <StepBadgeLabel>
                  {polyBeats}:{beatsPerBar}
                </StepBadgeLabel>
              </StepBadge>
              <BeatLeds
                small
                beatCount={polyBeats}
                accents={polyAccents(polyBeats)}
                currentBeat={polyBeatUnpublished}
              />
            </View>
          ) : null}

          <View style={styles.cardRow}>
            <StepBadge onStep={handleSubdivisionStep}>
              <StepBadgeLabel>{subdivisionGlyph(subdivision)}</StepBadgeLabel>
            </StepBadge>
            <PolyToggle enabled={polyEnabled} onToggle={handlePolyToggle} />
          </View>
        </View>

        <View style={styles.spacer} />

        <Transport
          running={running}
          onToggle={handleToggleTransport}
          onResetPractice={resetPractice}
        />

        <TempoNumpadSheet
          visible={numpadOpen}
          bpm={bpm}
          onConfirm={handleTempo}
          onDismiss={handleCloseNumpad}
        />
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.bg,
    paddingHorizontal: SCREEN_PADDING,
    gap: SCREEN_GAP,
  },
  card: {
    backgroundColor: theme.surface1,
    borderRadius: radii.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.line,
    padding: CARD_PADDING,
    gap: CARD_ROW_GAP,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: CARD_ROW_GAP,
  },
  spacer: {
    flex: 1,
  },
});
