import {
  Button,
  Card,
  createThemedStyles,
  hitBoxStyle,
  hitExtension,
  Icon,
  mixHex,
  size,
  stemPlayer,
  stemSections,
  stemSectionsMix,
  stemSectionsText,
  textStyle,
  useTheme,
} from '@kitbag/core-design';
import { NO_LINE, useStemPlayer, type RetimeState } from '@kitbag/core-state';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  Text,
  View,
  type LayoutChangeEvent,
} from 'react-native';

import { retimePreview, shiftLabel } from '../logic/retimeView.ts';
import { tapOnce } from '../logic/tapOnce.ts';
import { useLyricStyles } from './StageLyrics.tsx';

const STEP_KEY_HIT_BOX = hitBoxStyle(
  hitExtension(stemSections.stepperKey, stemSections.stepperHeight, {
    left: stemSections.stepperGap,
    right: stemSections.stepperGap,
  }),
);
const STEP_EARLIER = -1;
const STEP_LATER = 1;
// Rounding can leave a fitting body a fraction of a dp over.
const OVERFLOW_SLOP_DP = 1;

type Recording = Extract<RetimeState, { readonly kind: 'recording' }>;

const useStyles = createThemedStyles((theme) => ({
  body: { flex: 1, minHeight: 0 },
  content: {
    flexGrow: 1,
    gap: stemSections.retimeGap,
    paddingBottom: stemPlayer.bodyGap,
  },
  pinned: {
    flex: 1,
    minHeight: 0,
    gap: stemSections.retimeGap,
    paddingBottom: stemPlayer.bodyGap,
  },
  pinnedLines: { flex: 1, minHeight: 0 },
  pinnedLinesContent: { gap: stemSections.retimeGap },
  lines: {
    paddingTop: stemSections.retimeTop,
    paddingLeft: stemSections.linesLeft,
  },
  done: { flexDirection: 'row', alignItems: 'flex-start' },
  doneMark: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: stemSections.doneTimeIconGap,
    minHeight: stemSections.stageLineHeight,
    marginRight: stemSections.doneTimeRight,
  },
  doneTime: {
    ...textStyle(stemSectionsText.doneTime),
    color: theme.color.text2,
  },
  doneText: { flexShrink: 1 },
  pad: {
    flexGrow: 1,
    minHeight: stemSections.padMinHeight,
    alignItems: 'center',
    justifyContent: 'center',
    gap: stemSections.padGap,
    borderRadius: stemSections.padRadius,
    borderWidth: stemSections.padBorder,
    borderStyle: 'dashed',
    borderColor: theme.color.accentDim,
    backgroundColor: mixHex(
      theme.color.accent,
      theme.color.surface2,
      stemSectionsMix.pad,
    ),
  },
  padPinned: { flexGrow: 0, flexShrink: 0 },
  padTitle: {
    ...textStyle(stemSectionsText.padTitle),
    color: theme.color.text,
    textAlign: 'center',
  },
  padHint: {
    ...textStyle(stemSectionsText.padHint),
    color: theme.color.text2,
    textAlign: 'center',
  },
  undoRow: { flexDirection: 'row' },
  shift: {
    minHeight: stemSections.shiftMinHeight,
    paddingVertical: stemSections.shiftV,
    paddingRight: stemSections.shiftRight,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: stemSections.retimeGap,
  },
  shiftText: {
    ...textStyle(stemSectionsText.shift),
    color: theme.color.text,
    flexShrink: 1,
  },
  stepper: {
    minHeight: stemSections.stepperHeight,
    paddingHorizontal: stemSections.stepperH,
    flexDirection: 'row',
    alignItems: 'center',
    gap: stemSections.stepperGap,
    borderRadius: stemSections.stepperRadius,
    borderWidth: size.stroke,
    borderColor: theme.color.line,
    backgroundColor: theme.color.surface2,
  },
  stepKey: {
    width: stemSections.stepperKey,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepValue: {
    ...textStyle(stemSectionsText.stepValue),
    minWidth: stemSections.stepperValue,
    color: theme.color.text,
    textAlign: 'center',
  },
  note: { ...textStyle(stemSectionsText.shift), color: theme.color.text },
}));

interface RetimeLinesProps {
  readonly retime: Recording;
  readonly onCurrentLayout?: (event: LayoutChangeEvent) => void;
}

function RetimeLines({ retime, onCurrentLayout }: RetimeLinesProps) {
  const styles = useStyles();
  const lyricStyles = useLyricStyles();
  const lines = useStemPlayer((s) => s.lyrics.lines);
  const { done, current, next } = useMemo(
    () => retimePreview(lines, retime.taps, retime.nextLine),
    [lines, retime],
  );
  return (
    <View style={styles.lines}>
      {done === null ? null : (
        <View style={styles.done}>
          <View style={styles.doneMark}>
            <Icon name="check" size="retimeDone" color="text2" />
            <Text style={styles.doneTime}>{done.time}</Text>
          </View>
          <Text style={[lyricStyles.line, styles.doneText]}>{done.text}</Text>
        </View>
      )}
      {current === null ? null : (
        <View
          testID="retime-current"
          style={lyricStyles.currentRow}
          onLayout={onCurrentLayout}
        >
          <Text style={[lyricStyles.line, lyricStyles.current]}>{current}</Text>
        </View>
      )}
      {next === null ? null : <Text style={lyricStyles.line}>{next}</Text>}
    </View>
  );
}

interface TapPadProps {
  readonly allTapped: boolean;
  readonly pinned: boolean;
}

function TapPad({ allTapped, pinned }: TapPadProps) {
  const styles = useStyles();
  const theme = useTheme();
  const tapRetime = useStemPlayer((s) => s.tapRetime);
  const pad = useMemo(() => tapOnce(tapRetime), [tapRetime]);
  const title = allTapped ? 'All lines tapped' : 'Tap as this line starts';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      style={[styles.pad, pinned && styles.padPinned]}
      onPressIn={pad.pressIn}
      onPress={pad.press}
    >
      <Icon name="tapAlong" size="retimePad" color={theme.accentInk} />
      <Text style={styles.padTitle}>{title}</Text>
      <Text style={styles.padHint}>
        {allTapped ? 'Save, or undo a tap' : 'Anywhere in this panel'}
      </Text>
    </Pressable>
  );
}

function ShiftRow({ steps }: { readonly steps: number }) {
  const styles = useStyles();
  const shiftRetime = useStemPlayer((s) => s.shiftRetime);
  const earlier = useCallback(() => {
    shiftRetime(STEP_EARLIER);
  }, [shiftRetime]);
  const later = useCallback(() => {
    shiftRetime(STEP_LATER);
  }, [shiftRetime]);
  return (
    <View style={styles.shift}>
      <Text style={styles.shiftText}>Shift all lines</Text>
      <View style={styles.stepper}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Shift all lines earlier"
          style={[styles.stepKey, STEP_KEY_HIT_BOX]}
          onPress={earlier}
        >
          <Icon name="decrease" size="lyricsChip" color="text2" />
        </Pressable>
        <Text style={styles.stepValue}>{shiftLabel(steps)}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Shift all lines later"
          style={[styles.stepKey, STEP_KEY_HIT_BOX]}
          onPress={later}
        >
          <Icon name="increase" size="lyricsChip" color="text2" />
        </Pressable>
      </View>
    </View>
  );
}

function RetimeFailureCard() {
  const styles = useStyles();
  const failed = useStemPlayer((s) => s.retimeFailure !== null);
  if (!failed) return null;
  return (
    <Card emphasis="danger" statusIcon="failure" statusLabel="Failed">
      <Text style={styles.note}>
        Timing not saved. Your taps are still here, try again.
      </Text>
    </Card>
  );
}

function RetimeControls({
  retime,
  pinned,
}: {
  readonly retime: Recording;
  readonly pinned: boolean;
}) {
  const styles = useStyles();
  const undoRetimeTap = useStemPlayer((s) => s.undoRetimeTap);
  return (
    <>
      <TapPad allTapped={retime.nextLine === NO_LINE} pinned={pinned} />
      <View style={styles.undoRow}>
        <Button
          fill
          size="target"
          variant="ghost"
          icon="undo"
          iconSize="lyricsChip"
          label="Undo tap"
          disabled={retime.taps.length === 0}
          outlinedWhenDisabled
          onPress={undoRetimeTap}
        />
      </View>
      <ShiftRow steps={retime.shiftSteps} />
    </>
  );
}

// The lines take all the spare height, so no line can move the pad under a finger.
function PinnedRetime({ retime }: { readonly retime: Recording }) {
  const styles = useStyles();
  const failed = useStemPlayer((s) => s.retimeFailure !== null);
  const list = useRef<ScrollView>(null);
  const showCurrent = useCallback(
    (event: LayoutChangeEvent) => {
      list.current?.scrollTo({
        y: failed ? 0 : event.nativeEvent.layout.y,
        animated: false,
      });
    },
    [failed],
  );
  return (
    <View style={styles.pinned}>
      <ScrollView
        ref={list}
        testID="retime-lines"
        style={styles.pinnedLines}
        contentContainerStyle={styles.pinnedLinesContent}
      >
        <RetimeFailureCard />
        <RetimeLines retime={retime} onCurrentLayout={showCurrent} />
      </ScrollView>
      <RetimeControls retime={retime} pinned />
    </View>
  );
}

function useOverflowLatch() {
  const [overflowed, setOverflowed] = useState(false);
  const viewport = useRef(0);
  const content = useRef(0);
  const check = useCallback(() => {
    const past = content.current - viewport.current;
    if (viewport.current > 0 && past > OVERFLOW_SLOP_DP) setOverflowed(true);
  }, []);
  const onViewport = useCallback(
    (event: LayoutChangeEvent) => {
      viewport.current = event.nativeEvent.layout.height;
      check();
    },
    [check],
  );
  const onContent = useCallback(
    (_: number, height: number) => {
      content.current = height;
      check();
    },
    [check],
  );
  return { overflowed, onViewport, onContent };
}

export function RetimeBody() {
  const styles = useStyles();
  const retime = useStemPlayer((s) => s.retime);
  const { overflowed, onViewport, onContent } = useOverflowLatch();
  if (retime.kind !== 'recording') return null;
  if (overflowed) return <PinnedRetime retime={retime} />;
  return (
    <ScrollView
      testID="retime-body"
      style={styles.body}
      contentContainerStyle={styles.content}
      onLayout={onViewport}
      onContentSizeChange={onContent}
    >
      <RetimeLines retime={retime} />
      <RetimeFailureCard />
      <RetimeControls retime={retime} pinned={false} />
    </ScrollView>
  );
}
