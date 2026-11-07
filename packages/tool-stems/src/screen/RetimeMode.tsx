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
import { useCallback, useMemo } from 'react';
import {
  Pressable,
  ScrollView,
  Text,
  View,
  type LayoutChangeEvent,
  type TextLayoutEvent,
} from 'react-native';

import { retimePreview, shiftLabel } from '../logic/retimeView.ts';
import { tapOnce } from '../logic/tapOnce.ts';
import { useRetimeLayout, useRetimeScroll } from './retimeBodyHooks.ts';
import { useLyricStyles } from './StageLyrics.tsx';

const STEP_KEY_HIT_BOX = hitBoxStyle(
  hitExtension(stemSections.stepperKey, stemSections.stepperHeight, {
    left: stemSections.stepperGap,
    right: stemSections.stepperGap,
  }),
);
const STEP_EARLIER = -1;
const STEP_LATER = 1;

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
  controls: { flexShrink: 0, gap: stemSections.retimeGap },
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
  readonly onLinesLayout?: (event: LayoutChangeEvent) => void;
  readonly onCurrentLayout?: (event: LayoutChangeEvent) => void;
  readonly onCurrentLine?: (event: TextLayoutEvent) => void;
}

function RetimeLines({
  retime,
  onLinesLayout,
  onCurrentLayout,
  onCurrentLine,
}: RetimeLinesProps) {
  const styles = useStyles();
  const lyricStyles = useLyricStyles();
  const lines = useStemPlayer((s) => s.lyrics.lines);
  const { done, current, next } = useMemo(
    () => retimePreview(lines, retime.taps, retime.nextLine),
    [lines, retime],
  );
  return (
    <View testID="retime-column" style={styles.lines} onLayout={onLinesLayout}>
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
          <Text
            style={[lyricStyles.line, lyricStyles.current]}
            onTextLayout={onCurrentLine}
          >
            {current}
          </Text>
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

interface PinnedRetimeProps {
  readonly retime: Recording;
  readonly onBodyLayout: (event: LayoutChangeEvent) => void;
  readonly onControlsLayout: (event: LayoutChangeEvent) => void;
  readonly onCurrentLine: (event: TextLayoutEvent) => void;
}

// The lines take all the spare height, so no line can move the pad under a finger.
function PinnedRetime({
  retime,
  onBodyLayout,
  onControlsLayout,
  onCurrentLine,
}: PinnedRetimeProps) {
  const styles = useStyles();
  const { list, onLinesLayout, onCurrentLayout } = useRetimeScroll(
    retime,
    true,
  );
  return (
    <View testID="retime-pinned" style={styles.pinned} onLayout={onBodyLayout}>
      <ScrollView
        ref={list}
        testID="retime-lines"
        style={styles.pinnedLines}
        contentContainerStyle={styles.pinnedLinesContent}
      >
        <RetimeFailureCard />
        <RetimeLines
          retime={retime}
          onLinesLayout={onLinesLayout}
          onCurrentLayout={onCurrentLayout}
          onCurrentLine={onCurrentLine}
        />
      </ScrollView>
      <View
        testID="retime-controls"
        style={styles.controls}
        onLayout={onControlsLayout}
      >
        <RetimeControls retime={retime} pinned />
      </View>
    </View>
  );
}

// A drag here moves the pad, which the pinned layout exists to avoid; it is only for
// when pinning leaves no room to read, and it follows no line for the same reason.
function ScrollingRetime({ retime }: { readonly retime: Recording }) {
  const styles = useStyles();
  const { list } = useRetimeScroll(retime, false);
  return (
    <ScrollView
      ref={list}
      testID="retime-body"
      style={styles.body}
      contentContainerStyle={styles.content}
    >
      <RetimeFailureCard />
      <RetimeLines retime={retime} />
      <RetimeControls retime={retime} pinned />
    </ScrollView>
  );
}

export function RetimeBody() {
  const styles = useStyles();
  const retime = useStemPlayer((s) => s.retime);
  const layout = useRetimeLayout();
  if (retime.kind !== 'recording') return null;
  if (layout.mode === 'scrolling') return <ScrollingRetime retime={retime} />;
  if (layout.mode === 'pinned')
    return (
      <PinnedRetime
        retime={retime}
        onBodyLayout={layout.onPinnedBody}
        onControlsLayout={layout.onControls}
        onCurrentLine={layout.onCurrentLine}
      />
    );
  return (
    <ScrollView
      testID="retime-body"
      style={styles.body}
      contentContainerStyle={styles.content}
      onLayout={layout.onViewport}
      onContentSizeChange={layout.onContent}
    >
      <RetimeLines retime={retime} />
      <RetimeFailureCard />
      <RetimeControls retime={retime} pinned={false} />
    </ScrollView>
  );
}
