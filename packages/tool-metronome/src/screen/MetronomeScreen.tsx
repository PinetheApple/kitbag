import {
  metronome,
  PickerChips,
  readerHiding,
  space,
} from '@kitbag/core-design';
import {
  BPM_BOUNDS,
  getPracticeSessionStore,
  pushTap,
  tapTempoBpm,
  useMetronome,
  useSwipeHint,
} from '@kitbag/core-state';
import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type ComponentRef,
} from 'react';
import { GestureDetector, ScrollView } from 'react-native-gesture-handler';
import { Text, useWindowDimensions, View } from 'react-native';

import { useLibraryRefresh } from '../library/useLibraryRefresh.ts';
import {
  belowTempoReserve,
  statusStackPinned,
  statusStackRows,
  pinnedStackGap,
  pinnedStackScrollSlack,
  pinnedViewportOverlap,
} from '../logic/belowTempo.ts';
import { endPractice, summarySheetOnMount } from '../logic/practiceSummary.ts';
import { practiceBadgeCount, restLegend } from '../logic/statusRows.ts';
import { showSwipeHint } from '../logic/swipeHint.ts';
import { BeatDots, BeatLegend } from './BeatDots.tsx';
import { MetronomeAppBar } from './MetronomeAppBar.tsx';
import { useMetronomeScreenStyles } from './metronomeScreenStyles.ts';
import { MetronomeSheets, type OpenSheet } from './MetronomeSheets.tsx';
import { PolyLegend } from './PolyLegend.tsx';
import { PracticePill, usePracticeElapsed } from './PracticePill.tsx';
import { usePendingPractice } from './PracticeSummarySheet.tsx';
import { PresetRow } from './PresetRow.tsx';
import { StatusStack } from './StatusStack.tsx';
import { EndedSetlistSnackbar } from './EndedSetlistSnackbar.tsx';
import {
  SkippedSongSnackbar,
  useSkippedNotice,
} from './SkippedSongSnackbar.tsx';
import { SongClickSnackbar } from './SongClickSnackbar.tsx';
import { SwipeHint } from './SwipeHint.tsx';
import { SwipeTempoZone } from './SwipeTempoZone.tsx';
import { Transport } from './Transport.tsx';
import { UnsavedSnackbar } from './UnsavedSnackbar.tsx';
import { useEndPracticeOnLeave } from './useEndPracticeOnLeave.ts';
import { useControlsFit } from './useControlsFit.ts';
import { useHoldEngine } from './useHoldEngine.ts';
import { useTempoSwipe } from './useTempoSwipe.ts';
import { useMetronomeFrame } from './useMetronomeFrame.ts';
import { useNoteStrip } from './useMetronomeNotes.ts';
import { useStatusRunRows } from './useStatusRunRows.ts';
import { usePracticeSettings } from './usePracticeSettings.ts';

interface ZoneFrame {
  readonly top: number;
  readonly height: number;
}

export interface ShellMeasuredInsets {
  readonly top: number;
  readonly bottom: number;
}

export interface MetronomeScreenProps {
  readonly insets: ShellMeasuredInsets;
  readonly onBack?: () => void;
  readonly onOpenSetlists?: () => void;
  readonly onOpenStemSet?: (stemSetId: number) => void;
}

export function MetronomeScreen({
  insets,
  onBack,
  onOpenSetlists,
  onOpenStemSet,
}: MetronomeScreenProps) {
  const skipped = useSkippedNotice();
  useHoldEngine();
  useEndPracticeOnLeave();
  useLibraryRefresh();
  const styles = useMetronomeScreenStyles();
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
  const pendingPractice = usePendingPractice();
  const [openSheet, setOpenSheet] = useState<OpenSheet>(() =>
    summarySheetOnMount(getPracticeSessionStore().getState().pending),
  );
  // The summary can open on mount, before the hint's first layout; the hint
  // would then stack over it and take Back first.
  const summaryShown = openSheet === 'summary' && pendingPractice !== null;
  const [zone, setZone] = useState<ZoneFrame>({ top: 0, height: 0 });
  const zoneRef = useRef<ComponentRef<typeof View>>(null);
  const hintShown = showSwipeHint(hintSeen, zone.height, summaryShown);
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

  const layoutKey = [
    window.width,
    window.height,
    window.fontScale,
    strip === null,
  ].join('|');
  const {
    scrollable,
    density,
    tight,
    fadePadding,
    handleBodyLayout,
    handleContentSize,
  } = useControlsFit(window.height, layoutKey);
  const hintSwipe = useTempoSwipe(frame.currentBpm, handleSwipeOrTypedTempo, {
    enabled: !scrollable,
  });
  const screenSwipe = useTempoSwipe(frame.currentBpm, handleSwipeOrTypedTempo, {
    enabled: !scrollable,
  });
  const zoneSwipe = useTempoSwipe(frame.currentBpm, handleSwipeOrTypedTempo, {
    enabled: true,
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

  const handleEndPractice = useCallback(() => {
    endPractice(getPracticeSessionStore(), resetPractice);
    setOpenSheet('summary');
  }, [resetPractice]);

  // The hint draws over the whole window, so the zone is placed in window
  // coordinates; the block's layout moves the zone without a zone layout.
  const measureZone = useCallback(() => {
    zoneRef.current?.measureInWindow((_x, y, _width, height) => {
      setZone({ top: y, height });
    });
  }, []);

  const edgeToEdgePadding = useMemo(
    () => ({ paddingTop: insets.top, paddingBottom: insets.bottom }),
    [insets.top, insets.bottom],
  );

  const dotsWidth = window.width - space.screenInset * 2;
  const bodyGap =
    density === 'compact' ? metronome.bodyGapCompact : space.sectionGap;
  const topGap = useMemo(() => ({ marginTop: bodyGap }), [bodyGap]);
  const fontScale = window.fontScale;
  const belowTempo = useMemo(
    () => ({
      flexGrow: 1,
      marginTop: metronome.controlsToDots,
      minHeight: belowTempoReserve({ width: dotsWidth, density, fontScale }),
    }),
    [dotsWidth, density, fontScale],
  );
  const legend = restLegend(running, polyEnabled);
  const pinStatus = statusStackPinned(fontScale);
  const runRows = useStatusRunRows(frame.beatPlayed, running, settings);
  const stackRows = statusStackRows(running, runRows, fontScale);
  const stackGap = useMemo(
    () => ({ marginTop: pinnedStackGap(stackRows, bodyGap) }),
    [stackRows, bodyGap],
  );
  const viewportFrame = useMemo(
    () => ({ bottom: -pinnedViewportOverlap(stackRows, fontScale, bodyGap) }),
    [stackRows, fontScale, bodyGap],
  );
  const scrollSlack = useMemo(
    () => ({
      paddingBottom:
        pinnedStackScrollSlack(running, fontScale, bodyGap) + fadePadding,
    }),
    [running, fontScale, bodyGap, fadePadding],
  );
  const status = (
    <StatusStack
      frame={frame}
      settings={settings}
      running={running}
      stackRows={stackRows}
    />
  );

  return (
    <GestureDetector gesture={screenSwipe}>
      <View style={[styles.screen, edgeToEdgePadding]}>
        <View
          style={styles.readerLayer}
          collapsable={false}
          {...readerHiding(hintShown)}
        >
          <MetronomeAppBar
            bottomInset={insets.bottom}
            onBack={onBack}
            onOpenSetlists={onOpenSetlists}
            onOpenStemSet={onOpenStemSet}
            onSkipped={skipped.show}
          />
          <View
            testID="tempo-block"
            style={styles.tempoBlock}
            onLayout={measureZone}
          >
            <PracticePill elapsedMs={elapsedMs} onEnd={handleEndPractice} />
            {strip === null ? null : (
              <Text
                accessible={strip.spoken !== null}
                accessibilityLabel={strip.spoken ?? undefined}
                numberOfLines={1}
                style={[styles.notes, topGap]}
              >
                {strip.text}
              </Text>
            )}
            <GestureDetector gesture={zoneSwipe}>
              <View ref={zoneRef} style={topGap} onLayout={measureZone}>
                <SwipeTempoZone
                  bpm={bpm}
                  density={density}
                  tight={tight}
                  swipeAnywhere={!scrollable}
                  currentBpm={frame.currentBpm}
                  barPhase={frame.barPhase}
                  onTypeTempo={handleOpenNumpad}
                  onNudge={handleNudge}
                />
              </View>
            </GestureDetector>
          </View>
          <View style={styles.bodyClip}>
            <ScrollView
              style={[styles.body, viewportFrame]}
              contentContainerStyle={[styles.bodyContent, scrollSlack]}
              scrollEnabled={scrollable}
              showsVerticalScrollIndicator={scrollable}
              persistentScrollbar
              onLayout={handleBodyLayout}
              onContentSizeChange={handleContentSize}
            >
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
                {legend === null ? null : (
                  <View style={styles.legend}>
                    {legend === 'poly' ? <PolyLegend /> : <BeatLegend />}
                  </View>
                )}
                {pinStatus ? null : (
                  <>
                    <View style={styles.toolsPush} />
                    {status}
                  </>
                )}
              </View>
            </ScrollView>
            {scrollable ? (
              <View testID="scroll-fade" style={styles.fade} />
            ) : null}
          </View>
          {pinStatus ? (
            <View testID="pinned-status" style={stackGap}>
              {status}
            </View>
          ) : null}
          <Transport
            running={running}
            armedCount={practiceBadgeCount(settings)}
            gap={bodyGap}
            onToggle={handleToggleTransport}
            onOpenPractice={handleOpenPractice}
            onOpenSetlists={onOpenSetlists}
          />
        </View>
        <View
          style={styles.snackbarLayer}
          collapsable={false}
          {...readerHiding(hintShown)}
        >
          <UnsavedSnackbar bottomInset={insets.bottom} />
          <SongClickSnackbar bottomInset={insets.bottom} />
          <EndedSetlistSnackbar bottomInset={insets.bottom} />
          <SkippedSongSnackbar
            shownAt={skipped.shownAt}
            bottomInset={insets.bottom}
            onDone={skipped.hide}
          />
        </View>
        {hintShown ? (
          <SwipeHint
            zoneTop={zone.top}
            zoneHeight={zone.height}
            gesture={hintSwipe}
            onDismiss={dismissHint}
          />
        ) : null}

        <MetronomeSheets
          openSheet={openSheet}
          bpm={bpm}
          bottomInset={insets.bottom}
          pendingPractice={pendingPractice}
          onTypedTempo={handleSwipeOrTypedTempo}
          onClose={handleCloseSheet}
        />
      </View>
    </GestureDetector>
  );
}
