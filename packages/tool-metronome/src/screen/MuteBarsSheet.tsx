import {
  Button,
  createThemedStyles,
  opacity,
  radius,
  Sheet,
  SheetHint,
  SHEET_TOUCH_ROOM,
  size,
  space,
  StepControl,
  textRoles,
  textStyle,
  unshared,
} from '@kitbag/core-design';
import { useCallback, useState } from 'react';
import { Text, View, type LayoutChangeEvent } from 'react-native';

import { useBarMuteEditor, type BarMuteEditor } from './useBarMuteEditor.ts';

// The steppers' row heads the sheet, the preview below takes no touches, and
// neither do the labels beside each stepper. At a large font scale the mute
// stepper wraps under the play stepper, and the two share the row's gap.
const STEPPER_ROW = {
  top: unshared(SHEET_TOUCH_ROOM),
  bottom: unshared(space.sectionGap),
};
const PLAY_GAPS = { ...STEPPER_ROW, right: unshared(space.controlGap) };
const MUTE_GAPS = { ...STEPPER_ROW, right: 0 };
const WRAPPED_PLAY_GAPS = { ...PLAY_GAPS, bottom: space.controlGap };
const WRAPPED_MUTE_GAPS = { ...MUTE_GAPS, top: space.controlGap };
const ACTION_GAPS = {
  top: unshared(space.sectionGap),
  bottom: unshared(SHEET_TOUCH_ROOM),
};

const useStyles = createThemedStyles((theme) => ({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.controlGap,
  },
  label: {
    ...textStyle(textRoles.fieldLabel),
    color: theme.color.text2,
  },
  preview: {
    flexDirection: 'row',
    gap: space.barPreviewGap,
  },
  bar: {
    flex: 1,
    height: size.barPreview,
    borderRadius: radius.barPreview,
  },
  sounding: {
    backgroundColor: theme.color.accent,
    opacity: opacity.barPreviewSounding,
  },
  silent: {
    backgroundColor: theme.color.surface3,
  },
  actions: {
    flexDirection: 'row',
    gap: space.controlGap,
  },
}));

const bars = (count: number) =>
  `${String(count)} ${count === 1 ? 'bar' : 'bars'}`;

function MuteSteppers({ editor }: { readonly editor: BarMuteEditor }) {
  const styles = useStyles();
  const { playBars, muteBars } = editor.barMute;
  const [wrapped, setWrapped] = useState(false);
  const handleMuteLayout = useCallback((event: LayoutChangeEvent) => {
    const { y, height } = event.nativeEvent.layout;
    setWrapped(y >= height);
  }, []);
  return (
    <View style={styles.row}>
      <Text style={styles.label}>Play</Text>
      <StepControl
        variant="inline"
        label="Bars to play"
        value={String(playBars)}
        accessibilityValue={bars(playBars)}
        neighbourGapDp={wrapped ? WRAPPED_PLAY_GAPS : PLAY_GAPS}
        onStep={editor.stepPlay}
      />
      <Text style={styles.label}>then mute</Text>
      <View onLayout={handleMuteLayout}>
        <StepControl
          variant="inline"
          label="Bars to mute"
          value={String(muteBars)}
          accessibilityValue={bars(muteBars)}
          neighbourGapDp={wrapped ? WRAPPED_MUTE_GAPS : MUTE_GAPS}
          onStep={editor.stepMute}
        />
      </View>
    </View>
  );
}

function MutePreview({ preview }: { readonly preview: readonly boolean[] }) {
  const styles = useStyles();
  const spoken = preview
    .map((sounding) => (sounding ? 'play' : 'mute'))
    .join(', ');
  return (
    <View
      accessible
      accessibilityLabel={`First eight bars from start: ${spoken}`}
      style={styles.preview}
    >
      {preview.map((sounding, bar) => (
        <View
          key={bar}
          style={[styles.bar, sounding ? styles.sounding : styles.silent]}
        />
      ))}
    </View>
  );
}

function MuteActions({ editor }: { readonly editor: BarMuteEditor }) {
  const styles = useStyles();
  return (
    <View style={styles.actions}>
      <Button
        fill
        variant="ghost"
        label="Off"
        disabled={!editor.barMute.enabled}
        neighbourGapDp={ACTION_GAPS}
        onPress={editor.turnOff}
      />
      <Button
        fill
        variant="primary"
        label="Apply"
        neighbourGapDp={ACTION_GAPS}
        onPress={editor.apply}
      />
    </View>
  );
}

interface MuteBarsSheetProps {
  readonly visible: boolean;
  readonly bottomInset: number;
  readonly onDismiss: () => void;
}

export function MuteBarsSheet({
  visible,
  bottomInset,
  onDismiss,
}: MuteBarsSheetProps) {
  const editor = useBarMuteEditor(onDismiss);
  return (
    <Sheet
      visible={visible}
      title="Mute bars"
      titleIcon="muteBars"
      dismissLabel="Close mute bars"
      bottomInset={bottomInset}
      onDismiss={onDismiss}
    >
      <MuteSteppers editor={editor} />
      <MutePreview preview={editor.preview} />
      <SheetHint>
        Preview shows the first eight bars from start. Silent bars still light
        the LEDs — you keep the visual, lose the click.
      </SheetHint>
      <MuteActions editor={editor} />
    </Sheet>
  );
}
