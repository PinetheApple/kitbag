import {
  AppBar,
  BarIconButton,
  Button,
  Card,
  createThemedStyles,
  grownTextScale,
  hitBoxStyle,
  hitExtension,
  Icon,
  mixHex,
  onHardwareBack,
  size,
  stemPlayer,
  stemSections,
  stemSectionsMix,
  stemSectionsText,
  TEXT_ICON_SCALE_MAX,
  textStyle,
  useTheme,
} from '@kitbag/core-design';
import { NO_LINE, useStemPlayer } from '@kitbag/core-state';
import { useCallback, useEffect, useMemo } from 'react';
import {
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import {
  retimeLineLabel,
  retimePreview,
  shiftLabel,
} from '../logic/retimeView.ts';
import { tapOnce } from '../logic/tapOnce.ts';
import { ConfirmDialog } from './ConfirmDialog.tsx';
import { useLyricStyles } from './StageLyrics.tsx';

const STEP_KEY_HIT_BOX = hitBoxStyle(
  hitExtension(stemSections.stepperKey, stemSections.stepperHeight, {
    left: stemSections.stepperGap,
    right: stemSections.stepperGap,
  }),
);
const STEP_EARLIER = -1;
const STEP_LATER = 1;

const useStyles = createThemedStyles((theme) => ({
  saveSlot: { marginRight: stemSections.saveEnd },
  body: { flex: 1, minHeight: 0 },
  content: {
    flexGrow: 1,
    gap: stemSections.retimeGap,
    paddingBottom: stemPlayer.bodyGap,
  },
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

export function RetimeBar({ onAskReset }: { readonly onAskReset: () => void }) {
  const styles = useStyles();
  const lines = useStemPlayer((s) => s.lyrics.lines);
  const retime = useStemPlayer((s) => s.retime);
  const retimed = useStemPlayer((s) => s.lyrics.retimed);
  const cancelRetime = useStemPlayer((s) => s.cancelRetime);
  const commitRetime = useStemPlayer((s) => s.commitRetime);
  useEffect(() => onHardwareBack(cancelRetime), [cancelRetime]);
  const save = useCallback(() => {
    void commitRetime();
  }, [commitRetime]);
  if (retime.kind !== 'recording') return null;
  const canReset = retimed || retime.taps.length > 0 || retime.shiftSteps !== 0;
  return (
    <AppBar
      flush
      title="Retime lyrics"
      subtitle={retimeLineLabel(lines, retime.nextLine)}
      closeLabel="Close retime"
      onClose={cancelRetime}
      trailing={
        <>
          <BarIconButton
            icon="reset"
            label="Reset to bundle timing"
            disabled={!canReset}
            onPress={onAskReset}
          />
          <View style={styles.saveSlot}>
            <Button
              size="bar"
              variant="primary"
              label="Save"
              neighbourGapDp={{}}
              onPress={save}
            />
          </View>
        </>
      }
    />
  );
}

// Past this size three wrapped lines push the pad off the screen.
function useLargeText(): boolean {
  return grownTextScale(useWindowDimensions().fontScale) >= TEXT_ICON_SCALE_MAX;
}

function RetimeLines() {
  const styles = useStyles();
  const lyricStyles = useLyricStyles();
  const lines = useStemPlayer((s) => s.lyrics.lines);
  const retime = useStemPlayer((s) => s.retime);
  const largeText = useLargeText();
  const preview = useMemo(
    () =>
      retime.kind === 'recording'
        ? retimePreview(lines, retime.taps, retime.nextLine)
        : null,
    [lines, retime],
  );
  if (preview === null) return null;
  const { done, current, next } = preview;
  return (
    <View style={styles.lines}>
      {done === null || largeText ? null : (
        <View style={styles.done}>
          <View style={styles.doneMark}>
            <Icon name="check" size="retimeDone" color="text2" />
            <Text style={styles.doneTime}>{done.time}</Text>
          </View>
          <Text style={[lyricStyles.line, styles.doneText]}>{done.text}</Text>
        </View>
      )}
      {current === null ? null : (
        <View style={lyricStyles.currentRow}>
          <View style={lyricStyles.bar} />
          <Text style={[lyricStyles.line, lyricStyles.current]}>{current}</Text>
        </View>
      )}
      {next === null || largeText ? null : (
        <Text style={lyricStyles.line}>{next}</Text>
      )}
    </View>
  );
}

function TapPad() {
  const styles = useStyles();
  const theme = useTheme();
  const tapRetime = useStemPlayer((s) => s.tapRetime);
  const allTapped = useStemPlayer(
    (s) => s.retime.kind === 'recording' && s.retime.nextLine === NO_LINE,
  );
  const pad = useMemo(() => tapOnce(tapRetime), [tapRetime]);
  const title = allTapped ? 'All lines tapped' : 'Tap as this line starts';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      style={styles.pad}
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

function ShiftRow() {
  const styles = useStyles();
  const steps = useStemPlayer((s) =>
    s.retime.kind === 'recording' ? s.retime.shiftSteps : 0,
  );
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

export function RetimeBody() {
  const styles = useStyles();
  const undoRetimeTap = useStemPlayer((s) => s.undoRetimeTap);
  const noTaps = useStemPlayer(
    (s) => s.retime.kind === 'recording' && s.retime.taps.length === 0,
  );
  return (
    <ScrollView style={styles.body} contentContainerStyle={styles.content}>
      <RetimeLines />
      <RetimeFailureCard />
      <TapPad />
      <View style={styles.undoRow}>
        <Button
          fill
          size="target"
          variant="ghost"
          icon="undo"
          iconSize="lyricsChip"
          label="Undo tap"
          disabled={noTaps}
          outlinedWhenDisabled
          onPress={undoRetimeTap}
        />
      </View>
      <ShiftRow />
    </ScrollView>
  );
}

export function ResetDialog({ onClose }: { readonly onClose: () => void }) {
  const resetRetime = useStemPlayer((s) => s.resetRetime);
  const confirm = useCallback(() => {
    onClose();
    void resetRetime();
  }, [onClose, resetRetime]);
  return (
    <ConfirmDialog
      title="Reset to bundle timing?"
      body="Your taps and offset for this song are dropped. Lyrics go back to the timing that came in the bundle."
      confirmLabel="Reset"
      onConfirm={confirm}
      onCancel={onClose}
    />
  );
}
