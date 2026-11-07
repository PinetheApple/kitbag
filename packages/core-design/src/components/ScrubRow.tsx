import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { Text, View, type LayoutChangeEvent } from 'react-native';
import { useAnimatedReaction, type SharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { asPercent } from '../percent.ts';
import { textRoles } from '../roles.ts';
import {
  sliderGeometry,
  stemPlayer,
  stemPlayerMix,
} from '../stemPlayerRoles.ts';
import { textStyle } from '../textStyle.ts';
import { createThemedStyles } from '../ThemeProvider.tsx';
import { withAlpha } from '../theme.ts';
import { useScreenReader } from '../useScreenReader.ts';
import { Icon } from './Icon.tsx';
import { LiveText } from './LiveText.tsx';
import { Slider } from './Slider.tsx';

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

export interface ScrubMarks {
  readonly start: number;
  readonly end: number | null;
}

function LoopMarks({ marks }: { readonly marks: ScrubMarks | null }) {
  const styles = useStyles();
  if (marks === null) return null;
  const { start, end } = marks;
  return (
    <View pointerEvents="none" style={styles.marks}>
      {end === null ? null : (
        <View
          style={[
            styles.region,
            { left: asPercent(start), width: asPercent(end - start) },
          ]}
        />
      )}
      <LoopEdge at={start} edge="start" />
      {end === null ? null : <LoopEdge at={end} edge="end" />}
    </View>
  );
}

export interface ScrubNote {
  readonly text: string;
  readonly failed: boolean;
}

export interface ScrubLaneLayout {
  readonly noteSide: 'left' | 'right';
  readonly paddingTop: number | null;
  readonly onLane: (event: LayoutChangeEvent) => void;
  readonly onBar: (event: LayoutChangeEvent) => void;
  readonly onNote: (event: LayoutChangeEvent) => void;
}

interface NoteLineProps {
  readonly note: ScrubNote | null;
  readonly layout: ScrubLaneLayout | undefined;
}

function NoteLine({ note, layout }: NoteLineProps) {
  const styles = useStyles();
  if (note === null) return null;
  return (
    <View
      testID="loop-note"
      style={[
        styles.note,
        layout?.noteSide === 'left' ? styles.noteLeft : styles.noteRight,
      ]}
      accessibilityLiveRegion="polite"
      onLayout={layout?.onNote}
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

// The spoken position is React state, so it is kept only while a screen reader
// runs; the visible clock stays on the UI thread (SPEC §13.3).
function useSpokenSecond(frame: ScrubFrame): number {
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
  readonly layout?: ScrubLaneLayout;
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
  layout,
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
  const paddingTop = layout?.paddingTop ?? null;
  const lanePadding = useMemo(
    () => (paddingTop === null ? undefined : { paddingTop }),
    [paddingTop],
  );
  return (
    <View
      testID="scrub-lane"
      style={[styles.lane, lanePadding]}
      onLayout={layout?.onLane}
    >
      <NoteLine note={note} layout={layout} />
      <View
        style={styles.elapsed}
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden
      >
        <LiveText text={frame.elapsed} role="scrubTime" align="left" />
      </View>
      <View testID="scrub-bar" style={styles.bar} onLayout={layout?.onBar}>
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
        <LoopMarks marks={marks} />
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
