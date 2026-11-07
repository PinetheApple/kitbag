import {
  asPercent,
  createThemedStyles,
  LiveText,
  sliderGeometry,
  Icon,
  Slider,
  stemPlayer,
  stemPlayerMix,
  textRoles,
  textStyle,
  useScreenReader,
  withAlpha,
} from '@kitbag/core-design';
import {
  formatClock,
  formatClockSeconds,
  framesToSeconds,
  useStemPlayer,
  type LoopFailure,
  type LoopState,
} from '@kitbag/core-state';
import { useCallback, useMemo, useState } from 'react';
import { Text, View, type LayoutChangeEvent } from 'react-native';
import { useAnimatedReaction } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import {
  aboveFlagsPadding,
  loopNotePlacement,
  type LoopNotePlacement,
} from '../logic/loopNotePlacement.ts';
import { loopNoteText, songSeconds } from '../logic/sectionView.ts';
import { SectionNotches, SectionTint } from './SectionMarks.tsx';
import type { MixerFrameValues } from './useMixerFrame.ts';

const SCRUB_STEP = 0.02;

const useStyles = createThemedStyles((theme) => ({
  lane: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: stemPlayer.laneGap,
    minHeight: stemPlayer.laneHeight,
    paddingTop: stemPlayer.laneTop,
  },
  note: {
    position: 'absolute',
    top: stemPlayer.loopNoteTop,
    flexDirection: 'row',
    alignItems: 'center',
    gap: stemPlayer.loopNoteGap,
  },
  noteRight: { right: 0 },
  noteLeft: { left: 0 },
  noteText: {
    ...textStyle(textRoles.loopNote),
    color: theme.color[theme.accentInk],
  },
  failText: {
    ...textStyle(textRoles.loopNote),
    color: theme.feedback.danger.ink,
  },
  elapsed: { flexShrink: 0 },
  total: { ...textStyle(textRoles.scrubTime), color: theme.color.text2 },
  bar: {
    flex: 1,
    marginHorizontal: sliderGeometry.seek.thumb / 2,
  },
  marks: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  region: {
    position: 'absolute',
    top: stemPlayer.loopTintInset,
    bottom: stemPlayer.loopTintInset,
    backgroundColor: withAlpha(theme.color.accent, stemPlayerMix.loopTint),
  },
  line: {
    position: 'absolute',
    top: stemPlayer.loopTintInset,
    bottom: stemPlayer.loopTintInset,
    width: stemPlayer.loopLine,
    marginLeft: -stemPlayer.loopLine / 2,
    backgroundColor: theme.color.accent,
  },
  flag: {
    position: 'absolute',
    top: stemPlayer.loopTintInset + stemPlayer.loopFlagTop,
    width: stemPlayer.loopFlagWidth,
    minHeight: stemPlayer.loopFlagHeight,
    borderRadius: stemPlayer.loopFlagRadius,
    backgroundColor: theme.accentTextFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flagStart: { marginLeft: -stemPlayer.loopFlagWidth },
  flagEnd: { marginLeft: 0 },
  flagText: { ...textStyle(textRoles.loopFlag), color: theme.color.onAccent },
}));

const FAILURES: Readonly<Record<LoopFailure, string>> = {
  tooShort: 'Loop too short',
  pastEnd: 'Loop runs past the end',
  engine: 'Loop not set, try again',
};

function fractionOf(seconds: number, rate: number, frames: number): number {
  return frames > 0 ? (seconds * rate) / frames : 0;
}

type Edge = 'start' | 'end';

const EDGE_LETTERS: Readonly<Record<Edge, string>> = { start: 'A', end: 'B' };

// A's flag hangs left of its line and B's right of its own, so a short loop
// never hides one flag under the other.
function LoopEdge({ at, edge }: { readonly at: number; readonly edge: Edge }) {
  const styles = useStyles();
  const left = asPercent(at);
  return (
    <>
      <View style={[styles.line, { left }]} />
      <View
        style={[
          styles.flag,
          edge === 'start' ? styles.flagStart : styles.flagEnd,
          { left },
        ]}
      >
        <Text style={styles.flagText}>{EDGE_LETTERS[edge]}</Text>
      </View>
    </>
  );
}

function LoopMarks({ loop }: { readonly loop: LoopState }) {
  const styles = useStyles();
  const rate = useStemPlayer((s) => s.engineRate);
  const frames = useStemPlayer((s) => s.durationFrames);
  if (loop.kind === 'off') return null;
  const start = fractionOf(loop.startSec, rate, frames);
  if (loop.kind === 'armed')
    return (
      <View pointerEvents="none" style={styles.marks}>
        <LoopEdge at={start} edge="start" />
      </View>
    );
  const end = fractionOf(loop.endSec, rate, frames);
  return (
    <View pointerEvents="none" style={styles.marks}>
      <View
        style={[
          styles.region,
          { left: asPercent(start), width: asPercent(end - start) },
        ]}
      />
      <LoopEdge at={start} edge="start" />
      <LoopEdge at={end} edge="end" />
    </View>
  );
}

interface LoopNoteProps {
  readonly placement: LoopNotePlacement;
  readonly onLayout: (event: LayoutChangeEvent) => void;
}

function LoopNote({ placement, onLayout }: LoopNoteProps) {
  const styles = useStyles();
  const loop = useStemPlayer((s) => s.loop);
  const failure = useStemPlayer((s) => s.loopFailure);
  const sections = useStemPlayer((s) => s.sections);
  const durationSec = useStemPlayer(songSeconds);
  const note = loopNoteText(loop, sections, durationSec);
  if (failure === null && note === null) return null;
  return (
    <View
      testID="loop-note"
      style={[
        styles.note,
        placement === 'left' ? styles.noteLeft : styles.noteRight,
      ]}
      accessibilityLiveRegion="polite"
      onLayout={onLayout}
    >
      {failure === null ? (
        <>
          <Icon name="repeat" size="action" color="accent" />
          <Text style={styles.noteText}>{note}</Text>
        </>
      ) : (
        <Text style={styles.failText}>{FAILURES[failure]}</Text>
      )}
    </View>
  );
}

// Measured once per layout and read only when the loop changes, never per frame.
function useLoopNotePlacement(loop: LoopState, rate: number, frames: number) {
  const [laneWidth, setLaneWidth] = useState(0);
  const [bar, setBar] = useState({ x: 0, width: 0 });
  const [note, setNote] = useState({ width: 0, height: 0 });
  const onLane = useCallback((event: LayoutChangeEvent) => {
    setLaneWidth(event.nativeEvent.layout.width);
  }, []);
  const onBar = useCallback((event: LayoutChangeEvent) => {
    const { x, width } = event.nativeEvent.layout;
    setBar({ x, width });
  }, []);
  const onNote = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setNote({ width, height });
  }, []);
  const placement = loopNotePlacement({
    laneWidth,
    barLeft: bar.x,
    barWidth: bar.width,
    noteWidth: note.width,
    start: loop.kind === 'off' ? null : fractionOf(loop.startSec, rate, frames),
    end: loop.kind === 'on' ? fractionOf(loop.endSec, rate, frames) : null,
  });
  return { placement, noteHeight: note.height, onLane, onBar, onNote };
}

// The spoken position is React state, so it is kept only while a screen reader
// runs; the visible clock stays on the UI thread (SPEC §13.3).
function useSpokenSecond(frame: MixerFrameValues): number {
  const reader = useScreenReader();
  const [second, setSecond] = useState(0);
  useAnimatedReaction(
    () => frame.second.value,
    (now, before) => {
      if (reader && now !== before) scheduleOnRN(setSecond, Math.max(0, now));
    },
    [reader],
  );
  return second;
}

export function Scrubber({ frame }: { readonly frame: MixerFrameValues }) {
  const styles = useStyles();
  const frames = useStemPlayer((s) => s.durationFrames);
  const rate = useStemPlayer((s) => s.engineRate);
  const loop = useStemPlayer((s) => s.loop);
  const scrub = useStemPlayer((s) => s.scrub);
  const cancelScrub = useStemPlayer((s) => s.cancelScrub);
  const seek = useStemPlayer((s) => s.seek);
  const durationSec = framesToSeconds(frames, rate);
  const second = useSpokenSecond(frame);
  const { placement, noteHeight, onLane, onBar, onNote } = useLoopNotePlacement(
    loop,
    rate,
    frames,
  );
  const lanePadding = useMemo(
    () =>
      placement === 'above'
        ? { paddingTop: aboveFlagsPadding(noteHeight) }
        : undefined,
    [placement, noteHeight],
  );
  const slide = useCallback(
    (fraction: number) => {
      scrub(Math.round(fraction * frames));
    },
    [scrub, frames],
  );
  const { hold } = frame;
  const release = useCallback(
    (fraction: number) => {
      hold(fraction);
      seek(Math.round(fraction * frames));
    },
    [hold, seek, frames],
  );
  const total = formatClock(frames, rate);
  return (
    <View
      testID="scrub-lane"
      style={[styles.lane, lanePadding]}
      onLayout={onLane}
    >
      <LoopNote placement={placement} onLayout={onNote} />
      <View
        style={styles.elapsed}
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden
      >
        <LiveText text={frame.elapsed} role="scrubTime" align="left" />
      </View>
      <View testID="scrub-bar" style={styles.bar} onLayout={onBar}>
        <Slider
          value={frame.progress}
          onSlide={slide}
          onRelease={release}
          onCancel={cancelScrub}
          step={SCRUB_STEP}
          mode="seek"
          accessibilityLabel="Song position"
          accessibilityValue={`${formatClockSeconds(second)} of ${total}`}
          behindFill={
            <SectionTint songSec={frame.songSec} durationSec={durationSec} />
          }
          overFill={<SectionNotches durationSec={durationSec} />}
        />
        <LoopMarks loop={loop} />
      </View>
      <Text
        style={styles.total}
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden
      >
        {total}
      </Text>
    </View>
  );
}
