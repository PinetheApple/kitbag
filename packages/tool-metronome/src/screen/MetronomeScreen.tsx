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
import { GestureDetector, ScrollView } from 'react-native-gesture-handler';
import {
  Text,
  useWindowDimensions,
  View,
  type LayoutChangeEvent,
} from 'react-native';

import { useLibraryRefresh } from '../library/useLibraryRefresh.ts';
import { belowTempoReserve } from '../logic/belowTempo.ts';
import { noteStrip, type NoteStrip } from '../logic/noteStrip.ts';
import { practiceBadgeCount } from '../logic/statusRows.ts';
import { pushTap, tapTempoBpm } from '../logic/tapTempo.ts';
import { BeatDots } from './BeatDots.tsx';
import { NumberEntrySheet } from './NumberEntrySheet.tsx';
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
import { UnsavedSnackbar } from './UnsavedSnackbar.tsx';
import { useHoldEngine } from './useHoldEngine.ts';
import { useTempoSwipe } from './useTempoSwipe.ts';
import { useMetronomeFrame } from './useMetronomeFrame.ts';
import { useScreenDensity } from './useScreenDensity.ts';
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
  // A ScrollView clips its content; the poly row's last pulse and cycle
  // bracket hang past the content edge into the screen inset.
  body: {
    flex: 1,
    marginHorizontal: -space.screenInset,
  },
  bodyContent: {
    flexGrow: 1,
    paddingTop: metronome.belowAppBar,
    paddingHorizontal: space.screenInset,
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

function useNoteStrip(): NoteStrip | null {
  const songLoaded = useLibrary((state) => state.loaded !== null);
  const notes = useLibrary((state) => {
    const loadedId = state.loaded?.presetId;
    if (loadedId === undefined) return null;
    return (
      state.presets.find((preset) => preset.id === loadedId)?.notes ?? null
    );
  });
  return useMemo(() => noteStrip(songLoaded, notes), [songLoaded, notes]);
}

export function MetronomeScreen({
  insets,
  onBack,
  onOpenSetlists,
}: MetronomeScreenProps) {
  useHoldEngine();
  useLibraryRefresh();
  const styles = useStyles();
  const window = useWindowDimensions();
  const bpm = useMetronome((s) => s.bpm);
  const beatsPerBar = useMetronome((s) => s.beatsPerBar);
  const denominator = useMetronome((s) => s.denominator);
  const subdivision = useMetronome((s) => s.subdivision);
  const accents = useMetronome((s) => s.accents);
  const polyEnabled = useMetronome((s) => s.polyEnabled);
  const polyBeats = useMetronome((s) => s.polyBeats);
  const polyAgainst = useMetronome((s) => s.polyAgainst);
  const running = useMetronome((s) => s.running);
  const setTempo = useMetronome((s) => s.setTempo);
  const nudgeTempo = useMetronome((s) => s.nudgeTempo);
  const syncTempoFromEngine = useMetronome((s) => s.syncTempoFromEngine);
  const cycleAccent = useMetronome((s) => s.cycleAccent);
  const start = useMetronome((s) => s.start);
  const stop = useMetronome((s) => s.stop);
  const hintSeen = useSwipeHint((s) => s.seen);
  const dismissHint = useSwipeHint((s) => s.dismiss);
  const strip = useNoteStrip();
  const settings = usePracticeSettings();

  const frame = useMetronomeFrame(running, bpm);
  const { elapsedMs, reset: resetPractice } = usePracticeElapsed();
  const [openSheet, setOpenSheet] = useState<OpenSheet>('none');
  const [bodyTop, setBodyTop] = useState(0);
  const [zone, setZone] = useState<ZoneFrame>({ top: 0, height: 0 });
  const [bodyHeight, setBodyHeight] = useState(0);
  const [contentHeight, setContentHeight] = useState(0);
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

  const scrollRef = useRef<ScrollView>(null);
  const scrollable = Math.round(contentHeight) > Math.round(bodyHeight);
  const screenSwipe = useTempoSwipe(frame.currentBpm, handleSwipeOrTypedTempo, {
    enabled: !scrollable,
  });
  const zoneSwipe = useTempoSwipe(frame.currentBpm, handleSwipeOrTypedTempo, {
    enabled: true,
    blocks: scrollRef,
  });

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
    setBodyHeight(event.nativeEvent.layout.height);
  }, []);

  const handleContentSize = useCallback((_width: number, height: number) => {
    setContentHeight(height);
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
  const layoutKey = [
    window.width,
    window.height,
    window.fontScale,
    strip === null,
  ].join('|');
  const density = useScreenDensity(window.height, layoutKey, scrollable);
  const gap = useMemo(
    () => ({
      gap: density === 'compact' ? metronome.bodyGapCompact : space.sectionGap,
    }),
    [density],
  );
  const fontScale = window.fontScale;
  const belowTempo = useMemo(
    () => ({
      ...gap,
      minHeight: belowTempoReserve({
        width: dotsWidth,
        density,
        gap: gap.gap,
        fontScale,
      }),
    }),
    [gap, dotsWidth, density, fontScale],
  );

  return (
    <GestureDetector gesture={screenSwipe}>
      <View style={[styles.screen, edgeToEdgePadding]}>
        <MetronomeAppBar
          bottomInset={insets.bottom}
          onBack={onBack}
          onOpenSetlists={onOpenSetlists}
        />
        <ScrollView
          style={styles.body}
          contentContainerStyle={[styles.bodyContent, gap]}
          ref={scrollRef}
          scrollEnabled={scrollable}
          showsVerticalScrollIndicator={false}
          onLayout={handleBodyLayout}
          onContentSizeChange={handleContentSize}
        >
          <PracticePill elapsedMs={elapsedMs} onReset={resetPractice} />
          {strip === null ? null : (
            <Text
              accessible={strip.spoken !== null}
              accessibilityLabel={strip.spoken ?? undefined}
              numberOfLines={1}
              style={styles.notes}
            >
              {strip.text}
            </Text>
          )}
          <GestureDetector gesture={zoneSwipe}>
            <View onLayout={handleZoneLayout}>
              <SwipeTempoZone
                bpm={bpm}
                density={density}
                currentBpm={frame.currentBpm}
                barPhase={frame.barPhase}
                onTypeTempo={handleOpenNumpad}
                onNudge={handleNudge}
              />
            </View>
          </GestureDetector>
          <PresetRow onNudge={handleNudge} onTap={handleTap} />
          <PickerChips
            beatsPerBar={beatsPerBar}
            denominator={denominator}
            subdivision={subdivision}
            onOpenMeter={handleOpenMeter}
            onOpenSubdivision={handleOpenSubdivision}
          />
          <View style={belowTempo}>
            <BeatDots
              beatCount={beatsPerBar}
              subdivision={subdivision}
              polyBeats={polyEnabled ? polyBeats : null}
              polyAgainst={polyAgainst}
              accents={accents}
              width={dotsWidth}
              density={density}
              frame={frame}
              onCycle={cycleAccent}
            />
            <StatusStack frame={frame} settings={settings} running={running} />
          </View>
        </ScrollView>
        <Transport
          running={running}
          armedCount={practiceBadgeCount(settings)}
          gap={gap.gap}
          onToggle={handleToggleTransport}
          onOpenPractice={handleOpenPractice}
          onOpenSetlists={onOpenSetlists}
        />

        <UnsavedSnackbar bottomInset={insets.bottom} />
        {hintSeen || zone.height === 0 ? null : (
          <SwipeHint
            zoneTop={bodyTop + zone.top}
            zoneHeight={zone.height}
            onDismiss={dismissHint}
          />
        )}

        <NumberEntrySheet
          visible={openSheet === 'numpad'}
          title="Tempo"
          confirmLabel="Set tempo"
          value={bpm}
          bounds={BPM_BOUNDS}
          unit="BPM"
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
