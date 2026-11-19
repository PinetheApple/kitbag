import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { Text, View, type LayoutChangeEvent } from 'react-native';
import { useAnimatedReaction, type SharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { aboveFlagsPadding, loopNotePlacement } from '../loopNotePlacement.ts';
import { textRoles } from '../roles.ts';
import { sliderGeometry, stemPlayer } from '../stemPlayerRoles.ts';
import { textStyle } from '../textStyle.ts';
import { createThemedStyles } from '../ThemeProvider.tsx';
import { useAccessibilityReadout } from '../useAccessibilityReadout.ts';
import { Icon } from './Icon.tsx';
import { LiveText } from './LiveText.tsx';
import {
  LoopHandleLayer,
  LoopMarks,
  useLoopGeometry,
  type LoopGeometry,
  type LoopHandles,
  type ScrubMarks,
} from './LoopMarks.tsx';
import { Slider } from './Slider.tsx';

export type {
  EdgeStep,
  LoopHandles,
  ScrubEdge,
  ScrubMarks,
} from './LoopMarks.tsx';

const SCRUB_STEP = 0.02;
const NOT_READ = -1;

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
}));

export interface ScrubNote {
  readonly text: string;
  readonly failed: boolean;
}

function useLaneLayout(marks: ScrubMarks | null, geometry: LoopGeometry) {
  const [laneWidth, setLaneWidth] = useState(0);
  const [bar, setBar] = useState({ x: 0, width: 0 });
  const [note, setNote] = useState({ width: 0, height: 0 });
  const onLane = useCallback(
    (event: LayoutChangeEvent) => {
      const { width, height } = event.nativeEvent.layout;
      setLaneWidth(width);
      geometry.lane.value = { width, height };
    },
    [geometry],
  );
  const onBar = useCallback(
    (event: LayoutChangeEvent) => {
      const { x, y, width, height } = event.nativeEvent.layout;
      setBar({ x, width });
      geometry.bar.value = { x, y, width, height };
    },
    [geometry],
  );
  const onNote = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setNote({ width, height });
  }, []);
  const placement = loopNotePlacement({
    laneWidth,
    barLeft: bar.x,
    barWidth: bar.width,
    noteWidth: note.width,
    start: marks?.start ?? null,
    end: marks?.end ?? null,
  });
  return {
    noteSide: placement === 'left' ? 'left' : 'right',
    paddingTop: placement === 'above' ? aboveFlagsPadding(note.height) : null,
    onLane,
    onBar,
    onNote,
  } as const;
}

interface NoteLineProps {
  readonly note: ScrubNote | null;
  readonly side: 'left' | 'right';
  readonly onLayout: (event: LayoutChangeEvent) => void;
}

function NoteLine({ note, side, onLayout }: NoteLineProps) {
  const styles = useStyles();
  if (note === null) return null;
  return (
    <View
      testID="loop-note"
      style={[
        styles.note,
        side === 'left' ? styles.noteLeft : styles.noteRight,
      ]}
      accessibilityLiveRegion="polite"
      onLayout={onLayout}
    >
      {note.failed ? null : <Icon name="repeat" size="action" color="accent" />}
      <Text style={note.failed ? styles.failText : styles.noteText}>
        {note.text}
      </Text>
    </View>
  );
}

export interface ScrubFrame {
  readonly progress: SharedValue<number>;
  readonly elapsed: SharedValue<string>;
  readonly second: SharedValue<number>;
  readonly hold: (fraction: number) => void;
}

export interface PlayerFrame extends ScrubFrame {
  readonly playing: SharedValue<number>;
}

// Unread, the reaction parks on NOT_READ, so a service turning on is itself a
// change and commits the shown second rather than waiting for the next one.
function useSpokenSecond(frame: ScrubFrame): number {
  const reading = useAccessibilityReadout();
  const [second, setSecond] = useState(0);
  useAnimatedReaction(
    () => (reading ? Math.max(0, frame.second.value) : NOT_READ),
    (now, before) => {
      if (now !== NOT_READ && now !== before) scheduleOnRN(setSecond, now);
    },
    [reading],
  );
  return second;
}

export interface ScrubRowProps {
  readonly frame: ScrubFrame;
  readonly durationFrames: number;
  readonly total: string;
  readonly spokenPosition: (second: number) => string;
  readonly marks: ScrubMarks | null;
  readonly note: ScrubNote | null;
  readonly onScrub: (frame: number) => void;
  readonly onCancel: () => void;
  readonly onSeek: (frame: number) => void;
  readonly behindFill?: ReactNode;
  readonly overFill?: ReactNode;
  readonly loopHandles?: LoopHandles;
}

export function ScrubRow({
  frame,
  durationFrames,
  total,
  spokenPosition,
  marks,
  note,
  onScrub,
  onCancel,
  onSeek,
  behindFill,
  overFill,
  loopHandles,
}: ScrubRowProps) {
  const styles = useStyles();
  const second = useSpokenSecond(frame);
  const slide = useCallback(
    (fraction: number) => {
      onScrub(Math.round(fraction * durationFrames));
    },
    [onScrub, durationFrames],
  );
  const { hold } = frame;
  const release = useCallback(
    (fraction: number) => {
      hold(fraction);
      onSeek(Math.round(fraction * durationFrames));
    },
    [hold, onSeek, durationFrames],
  );
  const geometry = useLoopGeometry();
  const layout = useLaneLayout(marks, geometry);
  const { paddingTop } = layout;
  const lanePadding = useMemo(
    () => (paddingTop === null ? undefined : { paddingTop }),
    [paddingTop],
  );
  return (
    <View
      testID="scrub-lane"
      style={[styles.lane, lanePadding]}
      onLayout={layout.onLane}
    >
      <NoteLine note={note} side={layout.noteSide} onLayout={layout.onNote} />
      <View
        style={styles.elapsed}
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden
      >
        <LiveText text={frame.elapsed} role="scrubTime" align="left" />
      </View>
      <View testID="scrub-bar" style={styles.bar} onLayout={layout.onBar}>
        <Slider
          value={frame.progress}
          onSlide={slide}
          onRelease={release}
          onCancel={onCancel}
          step={SCRUB_STEP}
          mode="seek"
          accessibilityLabel="Song position"
          accessibilityValue={spokenPosition(second)}
          behindFill={behindFill}
          overFill={overFill}
        />
        <LoopMarks marks={marks} geometry={geometry} handles={loopHandles} />
      </View>
      <Text
        style={styles.total}
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden
      >
        {total}
      </Text>
      <LoopHandleLayer
        marks={marks}
        handles={loopHandles}
        geometry={geometry}
      />
    </View>
  );
}
