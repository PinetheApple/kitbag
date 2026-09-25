import {
  Card,
  createThemedStyles,
  SegmentedControl,
  space,
  StepControl,
} from '@kitbag/core-design';
import {
  KB_ACCENT,
  KB_DENOMINATORS,
  KB_STOPPED_BEAT,
} from '@kitbag/core-native';
import { BPM_BOUNDS, useMetronome } from '@kitbag/core-state';
import { useCallback, useMemo, useRef, useState } from 'react';
import { GestureDetector } from 'react-native-gesture-handler';
import { View } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';

import { subdivisionGlyph } from '../logic/subdivision.ts';
import { pushTap, tapTempoBpm } from '../logic/tapTempo.ts';
import { BeatLeds } from './BeatLeds.tsx';
import { PracticePill, usePracticeElapsed } from './PracticePill.tsx';
import { PresetRow } from './PresetRow.tsx';
import { SwipeTempoZone } from './SwipeTempoZone.tsx';
import { TempoNumpadSheet } from './TempoNumpadSheet.tsx';
import { Transport } from './Transport.tsx';
import { useTempoSwipe } from './useTempoSwipe.ts';
import { useMetronomeFrame } from './useMetronomeFrame.ts';

const SCREEN_PADDING = 16;
const SCREEN_GAP = 14;
const FIRST_BEAT = 0;

const POLY = 'poly';
const POLY_OPTIONS = [{ value: POLY, label: POLY }] as const;

function polyAccents(beats: number): readonly KB_ACCENT[] {
  return Array.from({ length: beats }, (_unused, beat) =>
    beat === FIRST_BEAT
      ? KB_ACCENT.KB_ACCENT_ACCENTED
      : KB_ACCENT.KB_ACCENT_NORMAL,
  );
}

export interface ShellMeasuredInsets {
  readonly top: number;
  readonly bottom: number;
}

export interface MetronomeScreenProps {
  readonly insets: ShellMeasuredInsets;
}

export function MetronomeScreen({ insets }: MetronomeScreenProps) {
  const styles = useStyles();
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

  const setTempoEndingTapSeries = useCallback(
    (next: number) => {
      tapTimes.current = [];
      setTempo(next);
    },
    [setTempo],
  );

  const tempoSwipe = useTempoSwipe(bpm, setTempoEndingTapSeries);

  const polyBeatUnpublished = useSharedValue(KB_STOPPED_BEAT);

  const handleNudge = useCallback(
    (delta: number) => {
      setTempoEndingTapSeries(bpm + delta);
    },
    [bpm, setTempoEndingTapSeries],
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

  const polyLeds = useMemo(() => polyAccents(polyBeats), [polyBeats]);

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

  const edgeToEdgePadding = useMemo(
    () => ({
      paddingTop: SCREEN_PADDING + insets.top,
      paddingBottom: SCREEN_PADDING + insets.bottom,
    }),
    [insets.top, insets.bottom],
  );

  return (
    <GestureDetector gesture={tempoSwipe}>
      <View style={[styles.screen, edgeToEdgePadding]}>
        <PracticePill elapsedMs={elapsedMs} onReset={resetPractice} />

        <SwipeTempoZone
          bpm={bpm}
          barPhase={barPhase}
          onTypeTempo={handleOpenNumpad}
        />

        <PresetRow onNudge={handleNudge} onTap={handleTap} />

        <Card>
          <View style={styles.cardBody}>
            <View style={styles.cardRow}>
              <StepControl
                label="Time signature"
                value={`${String(beatsPerBar)}/${String(denominator)}`}
                onStep={handleBeatsStep}
                onValuePress={handleDenominatorCycle}
              />
              <BeatLeds
                beatCount={beatsPerBar}
                accents={accents}
                currentBeat={currentBeat}
                onCycle={cycleAccent}
              />
            </View>

            {polyEnabled ? (
              <View style={styles.cardRow}>
                <StepControl
                  accented
                  label="Polyrhythm"
                  value={`${String(polyBeats)}:${String(beatsPerBar)}`}
                  onStep={handlePolyStep}
                />
                <BeatLeds
                  size="small"
                  beatCount={polyBeats}
                  accents={polyLeds}
                  currentBeat={polyBeatUnpublished}
                />
              </View>
            ) : null}

            <View style={styles.cardRow}>
              <StepControl
                label="Subdivision"
                value={subdivisionGlyph(subdivision)}
                accessibilityValue={String(subdivision)}
                onStep={handleSubdivisionStep}
              />
              <SegmentedControl
                fill
                accessibilityLabel="Polyrhythm"
                options={POLY_OPTIONS}
                selected={polyEnabled ? POLY : undefined}
                selectedTone="accent"
                onSelect={handlePolyToggle}
              />
            </View>
          </View>
        </Card>

        <View style={styles.spacer} />

        <Transport
          running={running}
          onToggle={handleToggleTransport}
          onResetPractice={resetPractice}
        />

        <TempoNumpadSheet
          visible={numpadOpen}
          bpm={bpm}
          bottomInset={insets.bottom}
          onConfirm={setTempoEndingTapSeries}
          onDismiss={handleCloseNumpad}
        />
      </View>
    </GestureDetector>
  );
}

const useStyles = createThemedStyles((theme) => ({
  screen: {
    flex: 1,
    backgroundColor: theme.color.bg,
    paddingHorizontal: SCREEN_PADDING,
    gap: SCREEN_GAP,
  },
  cardBody: {
    gap: space.rowGap,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.rowGap,
  },
  spacer: {
    flex: 1,
  },
}));
