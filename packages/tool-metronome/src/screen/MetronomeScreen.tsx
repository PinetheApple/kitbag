import {
  createThemedStyles,
  metronome,
  space,
  textRoles,
  textStyle,
} from '@kitbag/core-design';
import {
  BPM_BOUNDS,
  useLibrary,
  useMetronome,
  useSwipeHint,
} from '@kitbag/core-state';
import { useCallback, useMemo, useRef, useState } from 'react';
import { GestureDetector } from 'react-native-gesture-handler';
import {
  Text,
  useWindowDimensions,
  View,
  type LayoutChangeEvent,
} from 'react-native';

import { useLibraryRefresh } from '../library/useLibraryRefresh.ts';
import { practiceBadgeCount } from '../logic/statusLine.ts';
import { pushTap, tapTempoBpm } from '../logic/tapTempo.ts';
import { BeatDots, BeatLegend } from './BeatDots.tsx';
import { BpmNumpadSheet } from './BpmNumpadSheet.tsx';
import { MeterSheet } from './MeterSheet.tsx';
import { MetronomeAppBar } from './MetronomeAppBar.tsx';
import { PickerChips } from './PickerChips.tsx';
import { PracticePill, usePracticeElapsed } from './PracticePill.tsx';
import { PracticeSheet } from './PracticeSheet.tsx';
import { PresetRow } from './PresetRow.tsx';
import { StatusStack } from './StatusStack.tsx';
import { SubdivisionSheet } from './SubdivisionSheet.tsx';
import { SwipeHint } from './SwipeHint.tsx';
import { SwipeTempoZone } from './SwipeTempoZone.tsx';
import { Transport } from './Transport.tsx';
import { useTempoSwipe } from './useTempoSwipe.ts';
import { useMetronomeFrame } from './useMetronomeFrame.ts';
import { usePracticeSettings } from './usePracticeSettings.ts';

type OpenSheet = 'none' | 'numpad' | 'meter' | 'subdivision' | 'practice';

interface ZoneFrame {
  readonly top: number;
  readonly height: number;
}

const useStyles = createThemedStyles((theme) => ({
  screen: {
    flex: 1,
    backgroundColor: theme.color.bg,
    paddingHorizontal: space.screenInset,
  },
  body: {
    flex: 1,
    paddingTop: metronome.belowAppBar,
    gap: space.sectionGap,
  },
  notes: {
    ...textStyle(textRoles.fieldLabel),
    color: theme.color.text2,
    textAlign: 'center',
  },
}));

export interface ShellMeasuredInsets {
  readonly top: number;
  readonly bottom: number;
}

export interface MetronomeScreenProps {
  readonly insets: ShellMeasuredInsets;
  readonly onBack?: () => void;
  readonly onOpenSetlists?: () => void;
}

function useLoadedNotes(): string | null {
  return useLibrary((state) => {
    const loadedId = state.loaded?.presetId;
    if (loadedId === undefined) return null;
    return (
      state.presets.find((preset) => preset.id === loadedId)?.notes ?? null
    );
  });
}

export function MetronomeScreen({
  insets,
  onBack,
  onOpenSetlists,
}: MetronomeScreenProps) {
  useLibraryRefresh();
  const styles = useStyles();
  const window = useWindowDimensions();
  const bpm = useMetronome((s) => s.bpm);
  const beatsPerBar = useMetronome((s) => s.beatsPerBar);
  const denominator = useMetronome((s) => s.denominator);
  const subdivision = useMetronome((s) => s.subdivision);
  const accents = useMetronome((s) => s.accents);
  const running = useMetronome((s) => s.running);
  const setTempo = useMetronome((s) => s.setTempo);
  const nudgeTempo = useMetronome((s) => s.nudgeTempo);
  const syncTempoFromEngine = useMetronome((s) => s.syncTempoFromEngine);
  const cycleAccent = useMetronome((s) => s.cycleAccent);
  const start = useMetronome((s) => s.start);
  const stop = useMetronome((s) => s.stop);
  const hintSeen = useSwipeHint((s) => s.seen);
  const dismissHint = useSwipeHint((s) => s.dismiss);
  const notes = useLoadedNotes();
  const settings = usePracticeSettings();

  const frame = useMetronomeFrame(running, bpm);
  const { elapsedMs, reset: resetPractice } = usePracticeElapsed();
  const [openSheet, setOpenSheet] = useState<OpenSheet>('none');
  const [bodyTop, setBodyTop] = useState(0);
  const [zone, setZone] = useState<ZoneFrame>({ top: 0, height: 0 });
  const tapTimes = useRef<readonly number[]>([]);

  const setTempoEndingTapSeries = useCallback(
    (next: number) => {
      tapTimes.current = [];
      setTempo(next);
    },
    [setTempo],
  );

  const handleSwipeOrTypedTempo = useCallback(
    (next: number) => {
      dismissHint();
      setTempoEndingTapSeries(next);
    },
    [dismissHint, setTempoEndingTapSeries],
  );

  const tempoSwipe = useTempoSwipe(frame.currentBpm, handleSwipeOrTypedTempo);

  const handleNudge = useCallback(
    (delta: number) => {
      tapTimes.current = [];
      nudgeTempo(delta);
    },
    [nudgeTempo],
  );

  const handleTap = useCallback(() => {
    tapTimes.current = pushTap(tapTimes.current, Date.now(), BPM_BOUNDS);
    const tapped = tapTempoBpm(tapTimes.current);
    if (tapped !== undefined) setTempo(tapped);
  }, [setTempo]);

  const handleToggleTransport = useCallback(() => {
    if (running) stop();
    else start();
  }, [running, start, stop]);

  const handleOpenNumpad = useCallback(() => {
    syncTempoFromEngine();
    setOpenSheet('numpad');
  }, [syncTempoFromEngine]);

  const handleOpenMeter = useCallback(() => {
    setOpenSheet('meter');
  }, []);

  const handleOpenSubdivision = useCallback(() => {
    setOpenSheet('subdivision');
  }, []);

  const handleOpenPractice = useCallback(() => {
    setOpenSheet('practice');
  }, []);

  const handleCloseSheet = useCallback(() => {
    setOpenSheet('none');
  }, []);

  const handleBodyLayout = useCallback((event: LayoutChangeEvent) => {
    setBodyTop(event.nativeEvent.layout.y);
  }, []);

  const handleZoneLayout = useCallback((event: LayoutChangeEvent) => {
    const { y, height } = event.nativeEvent.layout;
    setZone({ top: y, height });
  }, []);

  const edgeToEdgePadding = useMemo(
    () => ({ paddingTop: insets.top, paddingBottom: insets.bottom }),
    [insets.top, insets.bottom],
  );

  const dotsWidth = window.width - space.screenInset * 2;

  return (
    <GestureDetector gesture={tempoSwipe}>
      <View style={[styles.screen, edgeToEdgePadding]}>
        <MetronomeAppBar onBack={onBack} onOpenSetlists={onOpenSetlists} />
        <View style={styles.body} onLayout={handleBodyLayout}>
          <PracticePill elapsedMs={elapsedMs} onReset={resetPractice} />
          {notes === null || notes.trim() === '' ? null : (
            <Text
              accessibilityLabel={`Song notes: ${notes}`}
              style={styles.notes}
            >
              {notes}
            </Text>
          )}
          <View onLayout={handleZoneLayout}>
            <SwipeTempoZone
              bpm={bpm}
              currentBpm={frame.currentBpm}
              barPhase={frame.barPhase}
              onTypeTempo={handleOpenNumpad}
              onNudge={handleNudge}
            />
          </View>
          <PresetRow onNudge={handleNudge} onTap={handleTap} />
          <PickerChips
            beatsPerBar={beatsPerBar}
            denominator={denominator}
            subdivision={subdivision}
            onOpenMeter={handleOpenMeter}
            onOpenSubdivision={handleOpenSubdivision}
          />
          <BeatDots
            beatCount={beatsPerBar}
            subdivision={subdivision}
            accents={accents}
            width={dotsWidth}
            frame={frame}
            onCycle={cycleAccent}
          />
          <StatusStack frame={frame} settings={settings} running={running} />
          {running ? null : <BeatLegend />}
          <Transport
            running={running}
            armedCount={practiceBadgeCount(settings)}
            onToggle={handleToggleTransport}
            onOpenPractice={handleOpenPractice}
            onOpenSetlists={onOpenSetlists}
          />
        </View>

        {hintSeen || zone.height === 0 ? null : (
          <SwipeHint
            zoneTop={bodyTop + zone.top}
            zoneHeight={zone.height}
            onDismiss={dismissHint}
          />
        )}

        <BpmNumpadSheet
          visible={openSheet === 'numpad'}
          title="Tempo"
          confirmLabel="Set tempo"
          bpm={bpm}
          bottomInset={insets.bottom}
          onConfirm={handleSwipeOrTypedTempo}
          onDismiss={handleCloseSheet}
        />
        <MeterSheet
          visible={openSheet === 'meter'}
          bottomInset={insets.bottom}
          onDismiss={handleCloseSheet}
        />
        <SubdivisionSheet
          visible={openSheet === 'subdivision'}
          bottomInset={insets.bottom}
          onDismiss={handleCloseSheet}
        />
        <PracticeSheet
          visible={openSheet === 'practice'}
          bottomInset={insets.bottom}
          onDismiss={handleCloseSheet}
        />
      </View>
    </GestureDetector>
  );
}
