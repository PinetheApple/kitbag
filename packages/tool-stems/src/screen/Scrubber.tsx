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
  useStemPlayer,
  type LoopFailure,
  type LoopState,
} from '@kitbag/core-state';
import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { useAnimatedReaction } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

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
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: stemPlayer.loopNoteGap,
  },
  noteText: { ...textStyle(textRoles.loopNote), color: theme.color.accent },
  failText: { ...textStyle(textRoles.loopNote), color: theme.color.red },
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
    backgroundColor: theme.color.accent,
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

function loopNote(loop: LoopState): string | null {
  if (loop.kind === 'armed')
    return `Loop from ${formatClockSeconds(loop.startSec)}`;
  if (loop.kind === 'on')
    return `Loop ${formatClockSeconds(loop.startSec)} – ${formatClockSeconds(loop.endSec)}`;
  return null;
}

function LoopNote() {
  const styles = useStyles();
  const loop = useStemPlayer((s) => s.loop);
  const failure = useStemPlayer((s) => s.loopFailure);
  const note = loopNote(loop);
  if (failure !== null)
    return (
      <View style={styles.note} accessibilityLiveRegion="polite">
        <Text style={styles.failText}>{FAILURES[failure]}</Text>
      </View>
    );
  if (note === null) return null;
  return (
    <View style={styles.note} accessibilityLiveRegion="polite">
      <Icon name="repeat" size="action" color="accent" />
      <Text style={styles.noteText}>{note}</Text>
    </View>
  );
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
  const second = useSpokenSecond(frame);
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
    <View style={styles.lane}>
      <LoopNote />
      <View
        style={styles.elapsed}
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden
      >
        <LiveText text={frame.elapsed} role="scrubTime" align="left" />
      </View>
      <View style={styles.bar}>
        <Slider
          value={frame.progress}
          onSlide={slide}
          onRelease={release}
          onCancel={cancelScrub}
          step={SCRUB_STEP}
          mode="seek"
          accessibilityLabel="Song position"
          accessibilityValue={`${formatClockSeconds(second)} of ${total}`}
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
